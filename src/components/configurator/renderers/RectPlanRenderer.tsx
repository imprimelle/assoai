// src/components/configurator/renderers/RectPlanRenderer.tsx
// Rendu 3D pour les produits de la Famille A — Rectangle plan (Caisson, Plaque, Pochoir, etc.)
// Version POC : plan texturé avec cadre, sans tunnel de réflexions.

import React, { useRef, useEffect, useCallback, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { ProductRendererProps } from "../types";

const SCALE = 0.01;

interface RectOptions {
  showFrame?: boolean;
  ledColor?: string;
  facadeColor?: string;
  frameMaterial?: "metal" | "wood" | "glass";
}

const DEFAULTS: Required<RectOptions> = {
  showFrame: true,
  ledColor: "#ffffff",
  facadeColor: "#e8e8f0",
  frameMaterial: "metal",
};

const RectPlanRenderer: React.FC<ProductRendererProps> = ({
  dimensions,
  options,
  onPartClick,
}) => {
  const L = dimensions.L;
  const H = dimensions.H;
  const P = dimensions.P ?? 0.05;
  const opts: Required<RectOptions> = { ...DEFAULTS, ...options };

  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const [cursor, setCursor] = useState<string>("grab");

  const initScene = useCallback(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const w = container.clientWidth, h = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0f0f1a");
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(2.5, 1.5, 2.5);
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
    const ambient = new THREE.AmbientLight("#334455", 1.5);
    scene.add(ambient);
    const key = new THREE.DirectionalLight("#ffffff", 4);
    key.position.set(3, 5, 3);
    key.castShadow = true;
    key.shadow.mapSize.width = 1024; key.shadow.mapSize.height = 1024;
    key.shadow.camera.near = 0.1; key.shadow.camera.far = 30;
    key.shadow.camera.left = -5; key.shadow.camera.right = 5;
    key.shadow.camera.top = 5; key.shadow.camera.bottom = -5;
    scene.add(key);
    const fill = new THREE.DirectionalLight("#8899cc", 2);
    fill.position.set(-2, 0.5, -1);
    scene.add(fill);

    // Ground
    const groundGeom = new THREE.PlaneGeometry(6, 6);
    const groundMat = new THREE.MeshStandardMaterial({ color: "#1a1a2e", roughness: 0.2, metalness: 0.8 });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.5;
    ground.receiveShadow = true;
    scene.add(ground);

    const group = new THREE.Group();
    scene.add(group);
    groupRef.current = group;

    // Click handler
    if (onPartClick) {
      const handleClick = (e: MouseEvent) => {
        const rect = container.getBoundingClientRect();
        onPartClick("facade", e.clientX, e.clientY);
      };
      renderer.domElement.addEventListener("click", handleClick);
    }

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
      const cw = container.clientWidth, ch = container.clientHeight;
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

  // Rebuild geometry on dimension change
  useEffect(() => {
    if (!groupRef.current) return;
    const group = groupRef.current;

    while (group.children.length > 0) {
      const child = group.children[0];
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material?.dispose();
      }
      group.remove(child);
    }

    const w = L * SCALE;
    const h = H * SCALE;
    const depth = P * SCALE;
    const edgeThickness = 0.025;

    // Facade
    const facadeGeom = new THREE.PlaneGeometry(w, h);
    const facadeMat = new THREE.MeshStandardMaterial({
      color: opts.facadeColor,
      roughness: 0.3,
      metalness: 0.1,
    });
    const facade = new THREE.Mesh(facadeGeom, facadeMat);
    facade.receiveShadow = true;
    group.add(facade);

    // Frame (optional)
    if (opts.showFrame) {
      const frameColor = opts.frameMaterial === "wood" ? "#8B6914"
        : opts.frameMaterial === "glass" ? "#aaccff"
        : "#334455";
      const frameRoughness = opts.frameMaterial === "wood" ? 0.6 : 0.2;
      const frameMetalness = opts.frameMaterial === "wood" ? 0.05 : 0.9;

      const frameMat = new THREE.MeshStandardMaterial({
        color: frameColor,
        roughness: frameRoughness,
        metalness: frameMetalness,
      });

      // Bottom bar
      const bottomBar = new THREE.Mesh(
        new THREE.BoxGeometry(w + edgeThickness * 2, edgeThickness, depth),
        frameMat
      );
      bottomBar.position.y = -h / 2;
      bottomBar.castShadow = true; bottomBar.receiveShadow = true;
      group.add(bottomBar);

      // Top bar
      const topBar = new THREE.Mesh(
        new THREE.BoxGeometry(w + edgeThickness * 2, edgeThickness, depth),
        frameMat.clone()
      );
      topBar.position.y = h / 2;
      topBar.castShadow = true; topBar.receiveShadow = true;
      group.add(topBar);

      // Left bar
      const leftBar = new THREE.Mesh(
        new THREE.BoxGeometry(edgeThickness, h, depth),
        frameMat.clone()
      );
      leftBar.position.x = -w / 2;
      leftBar.castShadow = true; leftBar.receiveShadow = true;
      group.add(leftBar);

      // Right bar
      const rightBar = new THREE.Mesh(
        new THREE.BoxGeometry(edgeThickness, h, depth),
        frameMat.clone()
      );
      rightBar.position.x = w / 2;
      rightBar.castShadow = true; rightBar.receiveShadow = true;
      group.add(rightBar);
    }

    // LED perimeter glow (if ledColor is bright enough)
    if (opts.ledColor && opts.ledColor !== "#000000") {
      const ledColor3 = new THREE.Color(opts.ledColor);
      const glowGeom = new THREE.TorusGeometry(Math.min(w, h) / 2 + 0.01, 0.008, 8, 4);
      const glowMat = new THREE.MeshBasicMaterial({ color: ledColor3, transparent: true, opacity: 0.4 });
      const glow = new THREE.Mesh(glowGeom, glowMat);
      group.add(glow);
    }
  }, [L, H, P, opts.showFrame, opts.facadeColor, opts.frameMaterial, opts.ledColor]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[400px] rounded-xl overflow-hidden"
      style={{ cursor, touchAction: "none" }}
    />
  );
};

export default RectPlanRenderer;
