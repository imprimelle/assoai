import React, { useRef, useEffect, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export interface Mirror3DProps {
  L: number; // Largeur en cm
  H: number; // Longueur en cm
  d: number; // Espace interne en cm
  n: number; // Nombre de reflets
  R_f: number; // Réflectivité film sans tain (%)
  R_m: number; // Réflectivité miroir de fond (%)
}

const Mirror3D: React.FC<Mirror3DProps> = ({ L, H, d, n, R_f, R_m }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const frameGroupRef = useRef<THREE.Group | null>(null);
  const tunnelGroupRef = useRef<THREE.Group | null>(null);

  // Scale: 1 unit = 1 cm, so 60 cm = 60 units... that's too big.
  // Let's use 0.01 scale: 1 unit = 1 cm → 60 units is reasonable
  const SCALE = 0.01; // 1 unit in 3D = 1 cm

  const initScene = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0f0f1a");
    scene.fog = new THREE.Fog("#0f0f1a", 5, 30);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(2.5, 1.8, 2.5);
    camera.lookAt(0, -0.1, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.8;
    controls.maxDistance = 6;
    controls.maxPolarAngle = Math.PI * 0.65;
    controls.target.set(0, -0.1, 0);
    controls.update();
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight("#334466", 2.5);
    scene.add(ambientLight);

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

    const fillLight = new THREE.DirectionalLight("#8899cc", 2);
    fillLight.position.set(-2, 0.5, -1);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight("#ffaa66", 3);
    rimLight.position.set(0, 0.3, -3);
    scene.add(rimLight);

    // Ground plane (subtle reflection surface)
    const groundGeom = new THREE.PlaneGeometry(6, 6);
    const groundMat = new THREE.MeshStandardMaterial({
      color: "#1a1a2e",
      roughness: 0.2,
      metalness: 0.8,
    });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Groups for dynamic content
    const frameGroup = new THREE.Group();
    scene.add(frameGroup);
    frameGroupRef.current = frameGroup;

    const tunnelGroup = new THREE.Group();
    scene.add(tunnelGroup);
    tunnelGroupRef.current = tunnelGroup;

    // Animate
    const animate = () => {
      requestAnimationFrame(animate);
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    // Resize handler
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current)
        return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Initialize scene once
  useEffect(() => {
    const cleanup = initScene();
    return () => {
      cleanup?.();
      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (containerRef.current && rendererRef.current.domElement) {
          containerRef.current.removeChild(rendererRef.current.domElement);
        }
      }
    };
  }, [initScene]);

  // Update model geometry when props change
  useEffect(() => {
    if (!frameGroupRef.current || !tunnelGroupRef.current) return;

    const frameGroup = frameGroupRef.current;
    const tunnelGroup = tunnelGroupRef.current;

    // Clear previous geometry
    while (frameGroup.children.length > 0) {
      const child = frameGroup.children[0];
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material?.dispose();
        }
      }
      frameGroup.remove(child);
    }
    while (tunnelGroup.children.length > 0) {
      const child = tunnelGroup.children[0];
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material?.dispose();
        }
      }
      tunnelGroup.remove(child);
    }

    const w = L * SCALE; // width (X)
    const l = H * SCALE; // length (Z)
    const depth = d * SCALE; // internal spacing (Y)
    const frameThickness = 0.02;
    const boxHeight = depth * Math.max(n, 1) * 1.2; // visual height

    // === FRAME (outer box) ===
    // Bottom base (mirror)
    const bottomGeom = new THREE.BoxGeometry(w, frameThickness, l);
    const bottomMat = new THREE.MeshStandardMaterial({
      color: "#8899cc",
      roughness: 0.1,
      metalness: 1.0,
      envMapIntensity: 0.8,
    });
    const bottom = new THREE.Mesh(bottomGeom, bottomMat);
    bottom.position.y = -boxHeight / 2;
    bottom.castShadow = true;
    bottom.receiveShadow = true;
    frameGroup.add(bottom);

    // Top glass (semi-transparent)
    const topGeom = new THREE.BoxGeometry(w, frameThickness * 0.5, l);
    const topMat = new THREE.MeshPhysicalMaterial({
      color: "#aaccff",
      roughness: 0.05,
      metalness: 0.1,
      transparent: true,
      opacity: 0.4,
      envMapIntensity: 1.5,
    });
    const top = new THREE.Mesh(topGeom, topMat);
    top.position.y = boxHeight / 2;
    top.castShadow = true;
    frameGroup.add(top);

    // Frame sides (4 edges)
    const frameColor = "#334455";
    const frameMat = new THREE.MeshStandardMaterial({
      color: frameColor,
      roughness: 0.3,
      metalness: 0.9,
    });

    // Side extrusions for a more realistic frame
    const edgeThickness = 0.03;
    const edgeHeight = boxHeight;

    // Front edge (Z+)
    const frontGeom = new THREE.BoxGeometry(w + edgeThickness * 2, edgeHeight, edgeThickness);
    const front = new THREE.Mesh(frontGeom, frameMat);
    front.position.set(0, 0, l / 2 + edgeThickness / 2);
    front.castShadow = true;
    front.receiveShadow = true;
    frameGroup.add(front);

    // Back edge (Z-)
    const backGeom = new THREE.BoxGeometry(w + edgeThickness * 2, edgeHeight, edgeThickness);
    const back = new THREE.Mesh(backGeom, frameMat);
    back.position.set(0, 0, -l / 2 - edgeThickness / 2);
    back.castShadow = true;
    back.receiveShadow = true;
    frameGroup.add(back);

    // Left edge (X-)
    const leftGeom = new THREE.BoxGeometry(edgeThickness, edgeHeight, l);
    const left = new THREE.Mesh(leftGeom, frameMat);
    left.position.set(-w / 2 - edgeThickness / 2, 0, 0);
    left.castShadow = true;
    left.receiveShadow = true;
    frameGroup.add(left);

    // Right edge (X+)
    const rightGeom = new THREE.BoxGeometry(edgeThickness, edgeHeight, l);
    const right = new THREE.Mesh(rightGeom, frameMat);
    right.position.set(w / 2 + edgeThickness / 2, 0, 0);
    right.castShadow = true;
    right.receiveShadow = true;
    frameGroup.add(right);

    // Corner accents (small cubes at each corner)
    const cornerSize = 0.025;
    const cornerMat = new THREE.MeshStandardMaterial({
      color: "#667788",
      roughness: 0.15,
      metalness: 1.0,
    });
    const corners = [
      [-w / 2, boxHeight / 2, l / 2],
      [w / 2, boxHeight / 2, l / 2],
      [-w / 2, boxHeight / 2, -l / 2],
      [w / 2, boxHeight / 2, -l / 2],
      [-w / 2, -boxHeight / 2, l / 2],
      [w / 2, -boxHeight / 2, l / 2],
      [-w / 2, -boxHeight / 2, -l / 2],
      [w / 2, -boxHeight / 2, -l / 2],
    ];
    corners.forEach(([cx, cy, cz]) => {
      const cornerGeom = new THREE.BoxGeometry(cornerSize, cornerSize, cornerSize);
      const corner = new THREE.Mesh(cornerGeom, cornerMat);
      corner.position.set(cx, cy, cz);
      corner.castShadow = true;
      frameGroup.add(corner);
    });

    // === TUNNEL EFFECT (nested reflective frames) ===
    if (n > 0) {
      const frameInset = 0.04; // how much each inner frame shrinks
      const startY = boxHeight / 2 - depth; // start just below the top glass
      const totalTunnelDepth = n * depth; // actual depth of the tunnel

      for (let i = 0; i < Math.min(n, 20); i++) {
        const y = startY - i * depth;
        const shrink = frameInset * i;
        const fw = w - shrink * 2;
        const fl = l - shrink * 2;
        const fh = frameThickness * 0.3;

        // Compute intensity based on the actual reflection formula
        // I = 100 * (R_f/100)^(i+1) * (R_m/100)^(i+1)
        const reflectionFactor = Math.pow(R_f / 100, i + 1) * Math.pow(R_m / 100, i + 1);
        const opacity = Math.max(0.05, reflectionFactor * 0.7);
        const brightness = Math.max(0.1, reflectionFactor);

        // Neon-like glow colors that shift with depth
        const hue = 0.58 + i * 0.02; // shift from blue toward purple
        const saturation = 0.8 - i * 0.03;
        const lightness = 0.3 + brightness * 0.5;
        const color = new THREE.Color().setHSL(hue % 1, saturation, lightness);

        // Frame rectangle (using 4 thin boxes to form a rectangular outline)
        const outlineThickness = 0.008;
        const outlineMat = new THREE.MeshStandardMaterial({
          color: color,
          roughness: 0.1,
          metalness: 0.3,
          emissive: color,
          emissiveIntensity: brightness * 3,
          transparent: true,
          opacity: opacity,
        });

        // Front bar
        const barFGeom = new THREE.BoxGeometry(fw + outlineThickness * 2, fh, outlineThickness);
        const barF = new THREE.Mesh(barFGeom, outlineMat);
        barF.position.set(0, y, fl / 2);
        tunnelGroup.add(barF);

        // Back bar
        const barBGeom = new THREE.BoxGeometry(fw + outlineThickness * 2, fh, outlineThickness);
        const barB = new THREE.Mesh(barBGeom, outlineMat);
        barB.position.set(0, y, -fl / 2);
        tunnelGroup.add(barB);

        // Left bar
        const barLGeom = new THREE.BoxGeometry(outlineThickness, fh, fl);
        const barL = new THREE.Mesh(barLGeom, outlineMat);
        barL.position.set(-fw / 2, y, 0);
        tunnelGroup.add(barL);

        // Right bar
        const barRGeom = new THREE.BoxGeometry(outlineThickness, fh, fl);
        const barR = new THREE.Mesh(barRGeom, outlineMat);
        barR.position.set(fw / 2, y, 0);
        tunnelGroup.add(barR);

        // Add subtle LED dots at corners
        const dotGeom = new THREE.SphereGeometry(0.005, 4, 4);
        const dotMat = new THREE.MeshStandardMaterial({
          color: color,
          roughness: 0.1,
          emissive: color,
          emissiveIntensity: brightness * 5,
          transparent: true,
          opacity: opacity * 1.5,
        });
        [
          [-fw / 2, y, fl / 2],
          [fw / 2, y, fl / 2],
          [-fw / 2, y, -fl / 2],
          [fw / 2, y, -fl / 2],
        ].forEach(([dx, dy, dz]) => {
          const dot = new THREE.Mesh(dotGeom, dotMat);
          dot.position.set(dx, dy, dz);
          tunnelGroup.add(dot);
        });
      }
    }

    // Position the whole model so it sits nicely
    frameGroup.position.y = boxHeight / 2 - 0.1;
    tunnelGroup.position.y = boxHeight / 2 - 0.1;
  }, [L, H, d, n, R_f, R_m, SCALE]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[400px] rounded-xl overflow-hidden cursor-grab active:cursor-grabbing"
      style={{ touchAction: "none" }}
    />
  );
};

export default Mirror3D;
