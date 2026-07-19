// src/components/configurator/renderers/DiscRenderer.tsx
// Rendu 3D Famille B — Disque/Cercle (Caisson rond, Logo cercle lumineux).
// Cylindre avec diamètre variable et LED périmètre.

import React, { useRef, useEffect, useCallback, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { ProductRendererProps } from "../types";

const SCALE = 0.01;

interface DiscOptions {
  ledColor?: string;
  facadeColor?: string;
  edgeMaterial?: "metal" | "wood";
  showFacade?: boolean;
}

const DEFAULTS: Required<DiscOptions> = {
  ledColor: "#ffffff",
  facadeColor: "#e8e8f0",
  edgeMaterial: "metal",
  showFacade: true,
};

const DiscRenderer: React.FC<ProductRendererProps> = ({
  dimensions,
  options,
  onPartClick,
}) => {
  // Le diamètre vient de 'd', la profondeur de 'P'
  const diameter = dimensions.d ?? dimensions.L; // fallback L si pas de 'd'
  const depth = dimensions.P ?? 0.05;
  const opts: Required<DiscOptions> = { ...DEFAULTS, ...options };

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
    controls.minDistance = 0.3;
    controls.maxDistance = 8;
    controls.maxPolarAngle = Math.PI * 0.7;
    controls.target.set(0, 0, 0);
    controls.update();
    controlsRef.current = controls;

    // Lights
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
    const rim = new THREE.DirectionalLight("#ffaa66", 1.5);
    rim.position.set(0, 0.3, -3);
    scene.add(rim);

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
      renderer.domElement.addEventListener("click", (e) => {
        const rect = container.getBoundingClientRect();
        onPartClick("disc", e.clientX, e.clientY);
      });
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
      if (!cameraRef.current || !rendererRef.current || !containerRef.current) return;
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

  // Rebuild geometry
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

    const radius = (diameter * SCALE) / 2;
    const thickness = depth * SCALE;
    const segments = 64; // smooth circle

    // === FACADE (front disc) ===
    if (opts.showFacade) {
      const facadeGeom = new THREE.CylinderGeometry(radius, radius, 0.005, segments);
      const facadeMat = new THREE.MeshStandardMaterial({
        color: opts.facadeColor,
        roughness: 0.3,
        metalness: 0.1,
      });
      const facade = new THREE.Mesh(facadeGeom, facadeMat);
      facade.position.z = thickness / 2;
      facade.receiveShadow = true;
      facade.userData.clickable = true;
      facade.userData.part = "facade";
      group.add(facade);

      // Back disc
      const backGeom = new THREE.CylinderGeometry(radius, radius, 0.005, segments);
      const backMat = new THREE.MeshStandardMaterial({
        color: "#334455",
        roughness: 0.2,
        metalness: 0.9,
      });
      const back = new THREE.Mesh(backGeom, backMat);
      back.position.z = -thickness / 2;
      back.receiveShadow = true;
      group.add(back);
    }

    // === EDGE (cylindre extérieur) ===
    const edgeColor = opts.edgeMaterial === "wood" ? "#8B6914" : "#445566";
    const edgeRoughness = opts.edgeMaterial === "wood" ? 0.6 : 0.25;
    const edgeMetalness = opts.edgeMaterial === "wood" ? 0.05 : 0.9;

    const edgeGeom = new THREE.CylinderGeometry(radius + 0.008, radius + 0.008, thickness, segments, 1, true);
    const edgeMat = new THREE.MeshStandardMaterial({
      color: edgeColor,
      roughness: edgeRoughness,
      metalness: edgeMetalness,
      side: THREE.DoubleSide,
    });
    const edge = new THREE.Mesh(edgeGeom, edgeMat);
    edge.castShadow = true;
    edge.receiveShadow = true;
    edge.userData.clickable = true;
    edge.userData.part = "edge";
    group.add(edge);

    // === LED RING (glow autour du périmètre) ===
    if (opts.ledColor && opts.ledColor !== "#000000") {
      const ledColor3 = new THREE.Color(opts.ledColor);

      // Outer glow ring
      const glowGeom = new THREE.TorusGeometry(radius + 0.015, 0.006, 16, segments);
      const glowMat = new THREE.MeshBasicMaterial({
        color: ledColor3,
        transparent: true,
        opacity: 0.6,
      });
      const glow = new THREE.Mesh(glowGeom, glowMat);
      group.add(glow);

      // Inner bright ring
      const ringGeom = new THREE.TorusGeometry(radius + 0.01, 0.003, 8, segments);
      const ringMat = new THREE.MeshBasicMaterial({
        color: ledColor3.clone().multiplyScalar(1.3),
        transparent: true,
        opacity: 0.9,
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      group.add(ring);

      // LED dots around perimeter
      const dotCount = Math.max(8, Math.floor(2 * Math.PI * radius / 0.03));
      const dotGeom = new THREE.SphereGeometry(0.005, 6, 6);
      const dotMat = new THREE.MeshBasicMaterial({
        color: ledColor3,
        transparent: true,
        opacity: 0.8,
      });
      for (let i = 0; i < dotCount; i++) {
        const angle = (i / dotCount) * Math.PI * 2;
        const x = Math.cos(angle) * (radius + 0.012);
        const y = Math.sin(angle) * (radius + 0.012);
        const dot = new THREE.Mesh(dotGeom, dotMat);
        dot.position.set(x, y, 0);
        group.add(dot);
      }
    }

    // Rotate to face the camera (disc is flat, like a wall sign)
    group.rotation.x = 0;
  }, [diameter, depth, opts.facadeColor, opts.edgeMaterial, opts.ledColor, opts.showFacade]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[400px] rounded-xl overflow-hidden"
      style={{ cursor, touchAction: "none" }}
    />
  );
};

export default DiscRenderer;
