import React, { useRef, useEffect, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type LedType = "ruban" | "module" | "neon";

export interface Mirror3DProps {
  L: number;
  H: number;
  d: number;
  n: number;
  R_f: number;
  R_m: number;
  brightness?: number;
  ledColor?: string;
  ledType?: LedType;
  ledPower?: number;
}

const Mirror3D: React.FC<Mirror3DProps> = ({
  L,
  H,
  d,
  n,
  R_f,
  R_m,
  brightness = 1,
  ledColor = "#00aaff",
  ledType = "ruban",
  ledPower = 14.4,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const frameGroupRef = useRef<THREE.Group | null>(null);
  const tunnelGroupRef = useRef<THREE.Group | null>(null);
  const lightsRef = useRef<{ light: THREE.Light; baseIntensity: number }[]>([]);

  const SCALE = 0.01;

  const initScene = useCallback(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const w = container.clientWidth;
    const h = container.clientHeight;

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
    const ambientLight = new THREE.AmbientLight("#334466", 2.5);
    scene.add(ambientLight);
    lightsRef.current.push({ light: ambientLight, baseIntensity: 2.5 });

    const keyLight = new THREE.DirectionalLight("#ffffff", 5);
    keyLight.position.set(3, 5, 3);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.1;
    keyLight.shadow.camera.far = 30;
    keyLight.shadow.camera.left = -5;
    keyLight.shadow.camera.right = 5;
    keyLight.shadow.camera.top = 5;
    keyLight.shadow.camera.bottom = -5;
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
    const groundMat = new THREE.MeshStandardMaterial({
      color: "#1a1a2e",
      roughness: 0.2,
      metalness: 0.8,
    });
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
      const cw = containerRef.current.clientWidth;
      const ch = containerRef.current.clientHeight;
      cameraRef.current.aspect = cw / ch;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(cw, ch);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
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
    if (!frameGroupRef.current || !tunnelGroupRef.current) return;

    const frameGroup = frameGroupRef.current;
    const tunnelGroup = tunnelGroupRef.current;

    const disposeGroup = (g: THREE.Group) => {
      while (g.children.length > 0) {
        const child = g.children[0];
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
          else child.material?.dispose();
        }
        g.remove(child);
      }
    };
    disposeGroup(frameGroup);
    disposeGroup(tunnelGroup);

    const w = L * SCALE;
    const l = H * SCALE;
    // ── PHYSICAL DEPTH (not visual) ──
    const physicalDepth = d * SCALE;
    const frameThickness = 0.02;
    const edgeThickness = 0.03;

    // === FRAME ===
    const frameColor = "#334455";
    const frameMat = new THREE.MeshStandardMaterial({ color: frameColor, roughness: 0.3, metalness: 0.9 });

    // Bottom (mirror)
    const bottomGeom = new THREE.BoxGeometry(w, frameThickness, l);
    const bottomMat = new THREE.MeshStandardMaterial({ color: "#8899cc", roughness: 0.1, metalness: 1.0 });
    const bottom = new THREE.Mesh(bottomGeom, bottomMat);
    bottom.position.y = -physicalDepth / 2;
    bottom.castShadow = true;
    bottom.receiveShadow = true;
    frameGroup.add(bottom);

    // Top (glass)
    const topGeom = new THREE.BoxGeometry(w, frameThickness * 0.5, l);
    const topMat = new THREE.MeshPhysicalMaterial({
      color: "#aaccff", roughness: 0.05, metalness: 0.1,
      transparent: true, opacity: 0.35, envMapIntensity: 1.5,
    });
    const top = new THREE.Mesh(topGeom, topMat);
    top.position.y = physicalDepth / 2;
    top.castShadow = true;
    frameGroup.add(top);

    // Sides
    const edgeHeight = physicalDepth;
    const makeEdge = (x: number, z: number, gw: number, gl: number) => {
      const g = new THREE.BoxGeometry(gw, edgeHeight, gl);
      const m = new THREE.Mesh(g, frameMat);
      m.position.set(x, 0, z);
      m.castShadow = true;
      m.receiveShadow = true;
      frameGroup.add(m);
    };
    makeEdge(0, l / 2 + edgeThickness / 2, w + edgeThickness * 2, edgeThickness);
    makeEdge(0, -l / 2 - edgeThickness / 2, w + edgeThickness * 2, edgeThickness);
    makeEdge(-w / 2 - edgeThickness / 2, 0, edgeThickness, l);
    makeEdge(w / 2 + edgeThickness / 2, 0, edgeThickness, l);

    // Corners
    const cornerSize = 0.025;
    const cornerMat = new THREE.MeshStandardMaterial({ color: "#667788", roughness: 0.15, metalness: 1.0 });
    const corners: [number, number, number][] = [];
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          corners.push([sx * (w / 2), sy * (physicalDepth / 2), sz * (l / 2)]);
        }
      }
    }
    corners.forEach(([cx, cy, cz]) => {
      const cg = new THREE.BoxGeometry(cornerSize, cornerSize, cornerSize);
      const c = new THREE.Mesh(cg, cornerMat);
      c.position.set(cx, cy, cz);
      c.castShadow = true;
      frameGroup.add(c);
    });

    // === TUNNEL (nested frames within physical depth) ===
    if (n > 0) {
      // Parse LED color
      const color3 = new THREE.Color(ledColor);
      const maxFrames = Math.min(n, 20);

      // Frames are spaced exponentially converging to the bottom mirror
      // Geometric series: pos_i = top - depth * (1 - 1/2^i) for i=[1..maxFrames]
      const topY = physicalDepth / 2 - frameThickness;
      const bottomY = -physicalDepth / 2 + frameThickness;
      const range = topY - bottomY;

      const frameInset = 0.03;

      for (let i = 0; i < maxFrames; i++) {
        // Geometric progression: frames get closer together as they approach the bottom
        const t = 1 - Math.pow(0.5, i + 1); // 0.5, 0.75, 0.875, 0.9375, ...
        const y = topY - t * range;

        const shrink = frameInset * i;
        const fw = Math.max(0.02, w - shrink * 2);
        const fl = Math.max(0.02, l - shrink * 2);

        // Reflection intensity
        const reflectionFactor = Math.pow(R_f / 100, i + 1) * Math.pow(R_m / 100, i + 1);
        const opacity = Math.max(0.04, reflectionFactor * 0.6);
        const emissiveStrength = Math.max(0.1, reflectionFactor * 3 * (ledPower / 14.4));

        const emissive = color3.clone().multiplyScalar(emissiveStrength);

        if (ledType === "neon") {
          // Neon: thicker tubes, glow effect
          const tubeRadius = 0.006;
          const tubeMat = new THREE.MeshStandardMaterial({
            color: color3, roughness: 0.1, metalness: 0.1,
            emissive, emissiveIntensity: emissiveStrength * 1.5,
            transparent: true, opacity: opacity * 1.3,
          });

          const cg = new THREE.CylinderGeometry(tubeRadius, tubeRadius, fw, 8);
          const segments: THREE.Mesh[] = [];
          // Top tube
          const t1 = new THREE.Mesh(cg, tubeMat);
          t1.rotation.z = Math.PI / 2;
          t1.position.set(0, y, fl / 2);
          tunnelGroup.add(t1);
          // Bottom tube
          const t2 = new THREE.Mesh(cg.clone(), tubeMat);
          t2.rotation.z = Math.PI / 2;
          t2.position.set(0, y, -fl / 2);
          tunnelGroup.add(t2);
          // Left tube
          const cgV = new THREE.CylinderGeometry(tubeRadius, tubeRadius, fl, 8);
          const t3 = new THREE.Mesh(cgV, tubeMat);
          t3.rotation.x = Math.PI / 2;
          t3.position.set(-fw / 2, y, 0);
          tunnelGroup.add(t3);
          // Right tube
          const t4 = new THREE.Mesh(cgV.clone(), tubeMat);
          t4.rotation.x = Math.PI / 2;
          t4.position.set(fw / 2, y, 0);
          tunnelGroup.add(t4);
        } else if (ledType === "module") {
          // Module: individual LEDs as small dots/spheres along the perimeter
          const dotRadius = 0.007;
          const dotGeom = new THREE.SphereGeometry(dotRadius, 6, 6);
          const dotMat = new THREE.MeshStandardMaterial({
            color: color3, roughness: 0.1,
            emissive, emissiveIntensity: emissiveStrength * 2,
            transparent: true, opacity: opacity,
          });

          const dotCount = Math.max(4, Math.floor((2 * (fw + fl)) / 0.04));
          const perimeter = 2 * (fw + fl);
          for (let j = 0; j < dotCount; j++) {
            const p = (j / dotCount) * perimeter;
            let dx: number, dz: number;
            if (p < fw) { dx = -fw / 2 + p; dz = fl / 2; }
            else if (p < fw + fl) { dx = fw / 2; dz = fl / 2 - (p - fw); }
            else if (p < 2 * fw + fl) { dx = fw / 2 - (p - fw - fl); dz = -fl / 2; }
            else { dx = -fw / 2; dz = -fl / 2 + (p - 2 * fw - fl); }

            const dot = new THREE.Mesh(dotGeom.clone(), dotMat);
            dot.position.set(dx, y, dz);
            tunnelGroup.add(dot);
          }
        } else {
          // Ruban: thin rectangular outline
          const outlineThickness = 0.005;
          const outlineMat = new THREE.MeshStandardMaterial({
            color: color3, roughness: 0.1, metalness: 0.3,
            emissive, emissiveIntensity: emissiveStrength,
            transparent: true, opacity,
          });

          const barGeom = new THREE.BoxGeometry(fw + outlineThickness * 2, frameThickness * 0.3, outlineThickness);
          // Front, back
          const bf = new THREE.Mesh(barGeom, outlineMat);
          bf.position.set(0, y, fl / 2);
          tunnelGroup.add(bf);
          const bb = new THREE.Mesh(barGeom.clone(), outlineMat);
          bb.position.set(0, y, -fl / 2);
          tunnelGroup.add(bb);
          // Left, right
          const barVGeom = new THREE.BoxGeometry(outlineThickness, frameThickness * 0.3, fl);
          const bl = new THREE.Mesh(barVGeom, outlineMat);
          bl.position.set(-fw / 2, y, 0);
          tunnelGroup.add(bl);
          const br = new THREE.Mesh(barVGeom.clone(), outlineMat);
          br.position.set(fw / 2, y, 0);
          tunnelGroup.add(br);

          // Corner dots
          const dotGeom = new THREE.SphereGeometry(0.004, 4, 4);
          const dotMat = new THREE.MeshStandardMaterial({
            color: color3, roughness: 0.1,
            emissive, emissiveIntensity: emissiveStrength * 2,
            transparent: true, opacity: Math.min(1, opacity * 1.5),
          });
          for (const [dx, dz] of [[-fw / 2, fl / 2], [fw / 2, fl / 2], [-fw / 2, -fl / 2], [fw / 2, -fl / 2]]) {
            const dot = new THREE.Mesh(dotGeom, dotMat);
            dot.position.set(dx, y, dz);
            tunnelGroup.add(dot);
          }
        }
      }
    }

    // Center the model
    frameGroup.position.y = physicalDepth / 2;
    tunnelGroup.position.y = physicalDepth / 2;
  }, [L, H, d, n, R_f, R_m, ledColor, ledType, ledPower, SCALE]);

  // Brightness
  useEffect(() => {
    for (const entry of lightsRef.current) {
      entry.light.intensity = entry.baseIntensity * brightness;
    }
    if (rendererRef.current) {
      rendererRef.current.toneMappingExposure = 1.2 * brightness;
    }
  }, [brightness]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[400px] rounded-xl overflow-hidden cursor-grab active:cursor-grabbing"
      style={{ touchAction: "none" }}
    />
  );
};

export default Mirror3D;
