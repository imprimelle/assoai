// src/components/configurator/renderers/InfinityRenderer.tsx
// Rendu 3D du Miroir Infini — extrait de Mirror3D.tsx, adapté à ProductRendererProps.
// Comportement identique, interface standardisée.

import React, { useRef, useEffect, useCallback, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { ProductRendererProps } from "../types";

// ── Types ré-exportés pour rétrocompatibilité ──
export type LedType = "ruban" | "module" | "neon";
export type LegStyle = "none" | "metal" | "wood";
export type SideMaterial = "standard" | "glass" | "wood";

export interface MirrorOptions {
  showTopGlass: boolean;
  legStyle: LegStyle;
  sideMaterial: SideMaterial;
}

// ── Props spécifiques attendues dans options ──
interface InfinityOptions {
  R_f?: number;           // réflectivité film sans tain (%)
  R_m?: number;           // réflectivité miroir de fond (%)
  n?: number;             // nombre de réflexions (pré-calculé)
  brightness?: number;    // luminosité globale
  ledColor?: string;      // couleur LED (hex)
  ledType?: LedType;      // ruban | module | neon
  ledPower?: number;      // puissance W/m
  mirrorOptions?: MirrorOptions; // showTopGlass, legStyle, sideMaterial
  imageUrl?: string;      // image produit → texture miroir de fond
}

const DEFAULTS: Required<InfinityOptions> = {
  R_f: 80,
  R_m: 92,
  n: 5,
  brightness: 1,
  ledColor: "#00aaff",
  ledType: "ruban",
  ledPower: 14.4,
  mirrorOptions: { showTopGlass: true, legStyle: "none", sideMaterial: "standard" },
  imageUrl: "",
};

const SCALE = 0.01;

// ============================================================
// COMPOSANT
// ============================================================
const InfinityRenderer: React.FC<ProductRendererProps> = ({
  dimensions,
  options,
  onPartClick,
}) => {
  // Extraire les dimensions
  const L = dimensions.L;
  const H = dimensions.H;
  const d = dimensions.P ?? 0.03; // profondeur physique

  // Extraire les options avec défauts
  const opts: Required<InfinityOptions> = { ...DEFAULTS, ...options };
  const { R_f, R_m, n, brightness, ledColor, ledType, ledPower, mirrorOptions: mo } = opts;

  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const frameGroupRef = useRef<THREE.Group | null>(null);
  const tunnelGroupRef = useRef<THREE.Group | null>(null);
  const legsGroupRef = useRef<THREE.Group | null>(null);
  const lightsRef = useRef<{ light: THREE.Light; baseIntensity: number }[]>([]);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const hoveredRef = useRef<THREE.Object3D | null>(null);
  const hoveredOrigEmissive = useRef<THREE.Color | null>(null);
  const hoveredOrigEmissiveIntensity = useRef<number>(0);
  const [cursor, setCursor] = useState<string>("grab");

  // ── Init scene ──
  const initScene = useCallback(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const w = container.clientWidth, h = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0f0f1a");
    scene.fog = new THREE.Fog("#0f0f1a", 5, 30);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(2.5, 2.0, 2.5);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.5;
    controls.maxDistance = 8;
    controls.maxPolarAngle = Math.PI * 0.7;
    controls.target.set(0, 0, 0);
    controls.update();
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight("#223344", 1.2);
    scene.add(ambientLight);
    lightsRef.current.push({ light: ambientLight, baseIntensity: 1.2 });
    const keyLight = new THREE.DirectionalLight("#ffffff", 5);
    keyLight.position.set(3, 5, 3);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024; keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.1; keyLight.shadow.camera.far = 30;
    keyLight.shadow.camera.left = -5; keyLight.shadow.camera.right = 5;
    keyLight.shadow.camera.top = 5; keyLight.shadow.camera.bottom = -5;
    keyLight.shadow.bias = -0.0001;
    scene.add(keyLight);
    lightsRef.current.push({ light: keyLight, baseIntensity: 5 });
    const fillLight = new THREE.DirectionalLight("#8899cc", 2);
    fillLight.position.set(-2, 0.5, -1);
    scene.add(fillLight);
    lightsRef.current.push({ light: fillLight, baseIntensity: 2 });
    const rimLight = new THREE.DirectionalLight("#ffaa66", 3);
    rimLight.position.set(0, 0.3, -3);
    scene.add(rimLight);
    lightsRef.current.push({ light: rimLight, baseIntensity: 3 });

    // Ground
    const groundGeom = new THREE.PlaneGeometry(6, 6);
    const groundMat = new THREE.MeshStandardMaterial({ color: "#1a1a2e", roughness: 0.2, metalness: 0.8 });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.5;
    ground.receiveShadow = true;
    scene.add(ground);

    const frameGroup = new THREE.Group();
    scene.add(frameGroup);
    frameGroupRef.current = frameGroup;
    const tunnelGroup = new THREE.Group();
    scene.add(tunnelGroup);
    tunnelGroupRef.current = tunnelGroup;
    const legsGroup = new THREE.Group();
    scene.add(legsGroup);
    legsGroupRef.current = legsGroup;

    // ── Raycasting handlers ──
    const getClickables = (): THREE.Object3D[] => {
      const all: THREE.Object3D[] = [];
      [frameGroup, legsGroup].forEach(g => {
        g.traverse((child) => {
          if ((child as THREE.Mesh).isMesh && child.userData.clickable) all.push(child);
        });
      });
      return all;
    };

    const handlePointerMove = (e: MouseEvent) => {
      if (!containerRef.current || !cameraRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const targets = getClickables();
      const intersects = raycasterRef.current.intersectObjects(targets, false);

      if (hoveredRef.current) {
        const mat = (hoveredRef.current as THREE.Mesh).material;
        if (Array.isArray(mat)) {
          mat.forEach(m => {
            m.emissive?.copy(hoveredOrigEmissive.current || new THREE.Color(0));
            m.emissiveIntensity = hoveredOrigEmissiveIntensity.current;
          });
        } else if (mat && 'emissive' in mat) {
          if (hoveredOrigEmissive.current) (mat as THREE.MeshStandardMaterial).emissive.copy(hoveredOrigEmissive.current);
          (mat as THREE.MeshStandardMaterial).emissiveIntensity = hoveredOrigEmissiveIntensity.current;
        }
        hoveredRef.current = null;
        setCursor("grab");
      }

      if (intersects.length > 0) {
        const obj = intersects[0].object;
        const mat = (obj as THREE.Mesh).material;
        if (Array.isArray(mat)) {
          hoveredOrigEmissive.current = mat[0].emissive ? mat[0].emissive.clone() : new THREE.Color(0);
          hoveredOrigEmissiveIntensity.current = mat[0].emissiveIntensity || 0;
          mat.forEach(m => {
            m.emissive = new THREE.Color("#ff8800");
            m.emissiveIntensity = 0.3;
          });
        } else if (mat && 'emissive' in mat) {
          const sm = mat as THREE.MeshStandardMaterial;
          hoveredOrigEmissive.current = sm.emissive ? sm.emissive.clone() : new THREE.Color(0);
          hoveredOrigEmissiveIntensity.current = sm.emissiveIntensity || 0;
          sm.emissive = new THREE.Color("#ff8800");
          sm.emissiveIntensity = 0.3;
        }
        hoveredRef.current = obj;
        setCursor("pointer");
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (!containerRef.current || !cameraRef.current || !onPartClick) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const targets = getClickables();
      const intersects = raycasterRef.current.intersectObjects(targets, false);

      if (intersects.length > 0) {
        const part = intersects[0].object.userData.part as string;
        onPartClick(part || "scene", e.clientX, e.clientY);
        e.stopPropagation();
      }
    };

    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("click", handleClick);

    const animate = () => {
      requestAnimationFrame(animate);
      controlsRef.current?.update();
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      const cw = containerRef.current.clientWidth, ch = containerRef.current.clientHeight;
      cameraRef.current.aspect = cw / ch;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(cw, ch);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("click", handleClick);
    };
  }, []);

  useEffect(() => {
    const cleanup = initScene();
    return () => {
      cleanup?.();
      rendererRef.current?.dispose();
      if (containerRef.current && rendererRef.current?.domElement) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
    };
  }, [initScene]);

  // ── Rebuild geometry ──
  useEffect(() => {
    if (!frameGroupRef.current || !tunnelGroupRef.current || !legsGroupRef.current) return;
    const frameGroup = frameGroupRef.current;
    const tunnelGroup = tunnelGroupRef.current;
    const legsGroup = legsGroupRef.current;

    const disposeGroup = (g: THREE.Group) => {
      while (g.children.length > 0) {
        const child = g.children[0];
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) child.material.forEach((m: THREE.Material) => m.dispose());
          else child.material?.dispose();
        }
        g.remove(child);
      }
    };
    disposeGroup(frameGroup);
    disposeGroup(tunnelGroup);
    disposeGroup(legsGroup);

    const w = L * SCALE;
    const l = H * SCALE;
    const physicalDepth = d * SCALE;
    const frameThickness = 0.02;
    const edgeThickness = 0.03;

    const makeClickable = (mesh: THREE.Mesh, part: string) => {
      mesh.userData.clickable = true;
      mesh.userData.part = part;
    };

    // === FRAME ===
    const bottomGeom = new THREE.BoxGeometry(w, frameThickness, l);
    const bottomMat = new THREE.MeshStandardMaterial({ color: "#8899cc", roughness: 0.1, metalness: 1.0 });

    // 🆕 Texture produit sur le miroir de fond
    if (opts.imageUrl) {
      new THREE.TextureLoader().load(opts.imageUrl, (texture) => {
        bottomMat.map = texture;
        bottomMat.color.set(0xffffff);
        bottomMat.metalness = 0.3;
        bottomMat.roughness = 0.5;
        bottomMat.needsUpdate = true;
      });
    }
    const bottom = new THREE.Mesh(bottomGeom, bottomMat);
    bottom.position.y = -physicalDepth / 2;
    bottom.castShadow = true; bottom.receiveShadow = true;
    frameGroup.add(bottom);

    if (mo.showTopGlass) {
      const topGeom = new THREE.BoxGeometry(w, frameThickness * 0.5, l);
      const topMat = new THREE.MeshPhysicalMaterial({
        color: "#aaccff", roughness: 0.05, metalness: 0.1,
        transparent: true, opacity: 0.35, envMapIntensity: 1.5,
      });
      const top = new THREE.Mesh(topGeom, topMat);
      top.position.y = physicalDepth / 2;
      top.castShadow = true;
      makeClickable(top, "topGlass");
      frameGroup.add(top);
    }

    const sideMatFactory = (): THREE.MeshStandardMaterial => {
      switch (mo.sideMaterial) {
        case "glass":
          return new THREE.MeshPhysicalMaterial({
            color: "#aaccff", roughness: 0.05, metalness: 0.1,
            transparent: true, opacity: 0.3,
          });
        case "wood":
          return new THREE.MeshStandardMaterial({ color: "#8B6914", roughness: 0.6, metalness: 0.05 });
        default:
          return new THREE.MeshStandardMaterial({ color: "#334455", roughness: 0.3, metalness: 0.9 });
      }
    };

    const edgeHeight = physicalDepth;
    const sideMat = sideMatFactory();

    // Front
    const frontGeom = new THREE.BoxGeometry(w + edgeThickness * 2, edgeHeight, edgeThickness);
    const front = new THREE.Mesh(frontGeom, sideMat.clone());
    front.position.set(0, 0, l / 2 + edgeThickness / 2);
    front.castShadow = true; front.receiveShadow = true;
    makeClickable(front, "sideFront");
    frameGroup.add(front);

    // Back
    const backGeom = new THREE.BoxGeometry(w + edgeThickness * 2, edgeHeight, edgeThickness);
    const back = new THREE.Mesh(backGeom, sideMat.clone());
    back.position.set(0, 0, -l / 2 - edgeThickness / 2);
    back.castShadow = true; back.receiveShadow = true;
    makeClickable(back, "sideBack");
    frameGroup.add(back);

    // Left
    const leftGeom = new THREE.BoxGeometry(edgeThickness, edgeHeight, l);
    const left = new THREE.Mesh(leftGeom, sideMat.clone());
    left.position.set(-w / 2 - edgeThickness / 2, 0, 0);
    left.castShadow = true; left.receiveShadow = true;
    makeClickable(left, "sideLeft");
    frameGroup.add(left);

    // Right
    const rightGeom = new THREE.BoxGeometry(edgeThickness, edgeHeight, l);
    const right = new THREE.Mesh(rightGeom, sideMat.clone());
    right.position.set(w / 2 + edgeThickness / 2, 0, 0);
    right.castShadow = true; right.receiveShadow = true;
    makeClickable(right, "sideRight");
    frameGroup.add(right);

    // Corners
    const cornerSize = 0.025;
    const cornerMat = new THREE.MeshStandardMaterial({ color: "#667788", roughness: 0.15, metalness: 1.0 });
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const cg = new THREE.BoxGeometry(cornerSize, cornerSize, cornerSize);
          const c = new THREE.Mesh(cg, cornerMat);
          c.position.set(sx * w / 2, sy * physicalDepth / 2, sz * l / 2);
          c.castShadow = true;
          frameGroup.add(c);
        }
      }
    }

    // === LEGS ===
    if (mo.legStyle !== "none") {
      const legHeight = 0.5;
      const legRadius = 0.025;
      const legGeom = new THREE.CylinderGeometry(legRadius, legRadius * 1.2, legHeight, 8);
      const legMat = mo.legStyle === "wood"
        ? new THREE.MeshStandardMaterial({ color: "#8B6914", roughness: 0.5, metalness: 0.05 })
        : new THREE.MeshStandardMaterial({ color: "#556677", roughness: 0.2, metalness: 0.9 });

      const legInset = 0.08;
      const legPositions: [number, number, number][] = [
        [-w / 2 + legInset, -physicalDepth / 2 - legHeight / 2, l / 2 - legInset],
        [w / 2 - legInset, -physicalDepth / 2 - legHeight / 2, l / 2 - legInset],
        [-w / 2 + legInset, -physicalDepth / 2 - legHeight / 2, -l / 2 + legInset],
        [w / 2 - legInset, -physicalDepth / 2 - legHeight / 2, -l / 2 + legInset],
      ];

      legPositions.forEach(([lx, ly, lz]) => {
        const leg = new THREE.Mesh(legGeom, legMat.clone());
        leg.position.set(lx, ly, lz);
        leg.castShadow = true; leg.receiveShadow = true;
        makeClickable(leg, "leg");
        legsGroup.add(leg);
      });
    }

    // === TUNNEL ===
    if (n > 0) {
      const color3 = new THREE.Color(ledColor);
      const maxFrames = Math.min(n, 20);
      const topY = physicalDepth / 2 - frameThickness;
      const bottomY = -physicalDepth / 2 + frameThickness;
      const range = topY - bottomY;
      const frameInset = 0.03;

      for (let i = 0; i < maxFrames; i++) {
        const t = 1 - Math.pow(0.5, i + 1);
        const y = topY - t * range;
        const shrink = frameInset * i;
        const fw = Math.max(0.02, w - shrink * 2);
        const fl = Math.max(0.02, l - shrink * 2);

        const visibility = 1.0 - (i / maxFrames) * 0.85;
        const reflectionFactor = Math.pow(R_f / 100, i + 1) * Math.pow(R_m / 100, i + 1);
        const brightnessVal = visibility * Math.max(0.15, reflectionFactor);
        const opacity = 0.15 + visibility * 0.85;

        const brightColor = color3.clone();
        const hsl = { h: 0, s: 0, l: 0 };
        brightColor.getHSL(hsl);
        brightColor.setHSL(hsl.h, Math.min(1, hsl.s * 1.2), Math.max(0.1, brightnessVal * 0.9));

        if (ledType === "neon") {
          const tubeRadius = 0.008;
          const innerRadius = 0.004;
          const tubeMat = new THREE.MeshBasicMaterial({ color: brightColor, transparent: true, opacity });
          const glowMat = new THREE.MeshBasicMaterial({ color: color3, transparent: true, opacity: opacity * 0.3 });
          const makeTube = (len: number, axis: "x" | "z", mat: THREE.Material, r: number) => {
            const cg = new THREE.CylinderGeometry(r, r, len, 8);
            const tube = new THREE.Mesh(cg, mat);
            if (axis === "x") tube.rotation.z = Math.PI / 2;
            else tube.rotation.x = Math.PI / 2;
            return tube;
          };
          const g1 = makeTube(fw, "x", glowMat, tubeRadius + 0.004); g1.position.set(0, y, fl / 2); tunnelGroup.add(g1);
          const g2 = makeTube(fw, "x", glowMat, tubeRadius + 0.004); g2.position.set(0, y, -fl / 2); tunnelGroup.add(g2);
          const g3 = makeTube(fl, "z", glowMat, tubeRadius + 0.004); g3.position.set(-fw / 2, y, 0); tunnelGroup.add(g3);
          const g4 = makeTube(fl, "z", glowMat, tubeRadius + 0.004); g4.position.set(fw / 2, y, 0); tunnelGroup.add(g4);
          const t1 = makeTube(fw, "x", tubeMat, innerRadius); t1.position.set(0, y, fl / 2); tunnelGroup.add(t1);
          const t2 = makeTube(fw, "x", tubeMat, innerRadius); t2.position.set(0, y, -fl / 2); tunnelGroup.add(t2);
          const t3 = makeTube(fl, "z", tubeMat, innerRadius); t3.position.set(-fw / 2, y, 0); tunnelGroup.add(t3);
          const t4 = makeTube(fl, "z", tubeMat, innerRadius); t4.position.set(fw / 2, y, 0); tunnelGroup.add(t4);
        } else if (ledType === "module") {
          const dotRadius = 0.01;
          const glowRadius = 0.018;
          const dotMat = new THREE.MeshBasicMaterial({ color: brightColor, transparent: true, opacity });
          const glowMat = new THREE.MeshBasicMaterial({ color: color3, transparent: true, opacity: opacity * 0.25 });
          const dotGeom = new THREE.SphereGeometry(dotRadius, 8, 8);
          const glowGeom = new THREE.SphereGeometry(glowRadius, 8, 8);
          const dotCount = Math.max(4, Math.floor((2 * (fw + fl)) / 0.035));
          const perimeter = 2 * (fw + fl);
          for (let j = 0; j < dotCount; j++) {
            const p = (j / dotCount) * perimeter;
            let dx: number, dz: number;
            if (p < fw) { dx = -fw / 2 + p; dz = fl / 2; }
            else if (p < fw + fl) { dx = fw / 2; dz = fl / 2 - (p - fw); }
            else if (p < 2 * fw + fl) { dx = fw / 2 - (p - fw - fl); dz = -fl / 2; }
            else { dx = -fw / 2; dz = -fl / 2 + (p - 2 * fw - fl); }
            const glow = new THREE.Mesh(glowGeom.clone(), glowMat); glow.position.set(dx, y, dz); tunnelGroup.add(glow);
            const dot = new THREE.Mesh(dotGeom.clone(), dotMat); dot.position.set(dx, y, dz); tunnelGroup.add(dot);
          }
        } else {
          // Ruban
          const outlineThickness = 0.004;
          const glowThickness = 0.012;
          const stripMat = new THREE.MeshBasicMaterial({ color: brightColor, transparent: true, opacity });
          const glowMat = new THREE.MeshBasicMaterial({ color: color3, transparent: true, opacity: opacity * 0.2 });

          const barGeom = new THREE.BoxGeometry(fw + outlineThickness * 2, frameThickness * 0.2, outlineThickness);
          const barVGeom = new THREE.BoxGeometry(outlineThickness, frameThickness * 0.2, fl);
          const glowHGeom = new THREE.BoxGeometry(fw + glowThickness * 2, frameThickness * 0.5, glowThickness);
          const glowVGeom = new THREE.BoxGeometry(glowThickness, frameThickness * 0.5, fl);

          const gf = new THREE.Mesh(glowHGeom, glowMat); gf.position.set(0, y, fl / 2); tunnelGroup.add(gf);
          const gb = new THREE.Mesh(glowHGeom.clone(), glowMat); gb.position.set(0, y, -fl / 2); tunnelGroup.add(gb);
          const gl = new THREE.Mesh(glowVGeom, glowMat); gl.position.set(-fw / 2, y, 0); tunnelGroup.add(gl);
          const gr = new THREE.Mesh(glowVGeom.clone(), glowMat); gr.position.set(fw / 2, y, 0); tunnelGroup.add(gr);
          const bf = new THREE.Mesh(barGeom, stripMat); bf.position.set(0, y, fl / 2); tunnelGroup.add(bf);
          const bb = new THREE.Mesh(barGeom.clone(), stripMat); bb.position.set(0, y, -fl / 2); tunnelGroup.add(bb);
          const bl = new THREE.Mesh(barVGeom, stripMat); bl.position.set(-fw / 2, y, 0); tunnelGroup.add(bl);
          const br = new THREE.Mesh(barVGeom.clone(), stripMat); br.position.set(fw / 2, y, 0); tunnelGroup.add(br);

          const dotGeom = new THREE.SphereGeometry(0.006, 8, 8);
          const glowDotGeom = new THREE.SphereGeometry(0.012, 8, 8);
          for (const [dx, dz] of [[-fw / 2, fl / 2], [fw / 2, fl / 2], [-fw / 2, -fl / 2], [fw / 2, -fl / 2]]) {
            const gd = new THREE.Mesh(glowDotGeom, glowMat); gd.position.set(dx, y, dz); tunnelGroup.add(gd);
            const dot = new THREE.Mesh(dotGeom.clone(), stripMat); dot.position.set(dx, y, dz); tunnelGroup.add(dot);
          }
        }
      }
    }

    frameGroup.position.y = physicalDepth / 2;
    tunnelGroup.position.y = physicalDepth / 2;
    legsGroup.position.y = physicalDepth / 2;
  }, [L, H, d, n, R_f, R_m, ledColor, ledType, ledPower, mo.showTopGlass, mo.legStyle, mo.sideMaterial]);

  // Brightness
  useEffect(() => {
    for (const entry of lightsRef.current) entry.light.intensity = entry.baseIntensity * brightness;
    if (rendererRef.current) rendererRef.current.toneMappingExposure = 1.2 * brightness;
  }, [brightness]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[400px] rounded-xl overflow-hidden"
      style={{ cursor, touchAction: "none" }}
    />
  );
};

export default InfinityRenderer;
