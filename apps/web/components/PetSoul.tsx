"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import type { ComponentType } from "react";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

export type PetSoulMode = "preview" | "arrival" | "idle" | "farewell";
export type PetSoulQuality = "full" | "light";

export type PetSoulSettings = {
  enabled: boolean;
  color: string;
  glowColor: string;
};

export const DEFAULT_SOUL_COLOR = "#8ee9ff";
export const DEFAULT_SOUL_GLOW_COLOR = "#dffcff";

export const SOUL_COLOR_OPTIONS = [
  { id: "sky", name: "Небесная", color: "#8ee9ff" },
  { id: "mint", name: "Мятная", color: "#8ff5c8" },
  { id: "gold", name: "Золотая", color: "#ffd36e" },
  { id: "rose", name: "Розовая", color: "#ff9fd2" },
  { id: "violet", name: "Лиловая", color: "#b8a4ff" },
  { id: "warm", name: "Тёплая", color: "#fff1bd" }
] as const;

export const SOUL_GLOW_COLOR_OPTIONS = [
  { id: "mist", name: "Туманная", color: "#dffcff" },
  { id: "sky", name: "Голубая", color: "#8ee9ff" },
  { id: "mint", name: "Мятная", color: "#8ff5c8" },
  { id: "gold", name: "Золотая", color: "#ffd36e" },
  { id: "rose", name: "Розовая", color: "#ffb6dc" },
  { id: "violet", name: "Лиловая", color: "#c7bbff" }
] as const;

const Group = "group" as unknown as ComponentType<any>;
const Mesh = "mesh" as unknown as ComponentType<any>;
const SphereGeometry = "sphereGeometry" as unknown as ComponentType<any>;
const TorusGeometry = "torusGeometry" as unknown as ComponentType<any>;
const MeshBasicMaterial = "meshBasicMaterial" as unknown as ComponentType<any>;
const Color = "color" as unknown as ComponentType<any>;
const AmbientLight = "ambientLight" as unknown as ComponentType<any>;

const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

export function normalizeSoulColor(value?: unknown, fallback = DEFAULT_SOUL_COLOR) {
  const safeFallback = HEX_COLOR_RE.test(fallback) ? fallback : DEFAULT_SOUL_COLOR;
  if (typeof value !== "string") {
    return safeFallback;
  }
  const trimmed = value.trim();
  return HEX_COLOR_RE.test(trimmed) ? trimmed : safeFallback;
}

export function readSoulSettings(sceneJson?: Record<string, unknown> | null): PetSoulSettings {
  const soul =
    sceneJson?.soul && typeof sceneJson.soul === "object" && !Array.isArray(sceneJson.soul)
      ? (sceneJson.soul as Record<string, unknown>)
      : {};
  const color = normalizeSoulColor(soul.color);
  return {
    enabled: soul.enabled !== false,
    color,
    glowColor: normalizeSoulColor(soul.glowColor, color)
  };
}

export function buildSoulSettings(
  color: string,
  glowColor = color
): PetSoulSettings & { version: number } {
  const normalizedColor = normalizeSoulColor(color);
  return {
    enabled: true,
    color: normalizedColor,
    glowColor: normalizeSoulColor(glowColor, normalizedColor),
    version: 2
  };
}

export function resolveSoulAnchorPosition(
  terrain: THREE.Object3D,
  _house: THREE.Object3D
): [number, number, number] {
  terrain.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(terrain);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);
  const anchor = center.clone().add(
    new THREE.Vector3(
      -Math.max(1.1, size.x * 0.24),
      Math.max(1.12, size.y * 0.34 + 0.72),
      Math.max(0.56, size.z * 0.14)
    )
  );
  terrain.worldToLocal(anchor);
  return [anchor.x, anchor.y, anchor.z];
}

export function resolveSoulObstacleCenterPosition(
  terrain: THREE.Object3D,
  house: THREE.Object3D
): [number, number, number] {
  terrain.updateMatrixWorld(true);
  house.updateMatrixWorld(true);
  const housePosition = new THREE.Vector3();
  house.getWorldPosition(housePosition);
  terrain.worldToLocal(housePosition);
  return [housePosition.x, housePosition.y + 0.38, housePosition.z];
}

export function resolveSoulSurfaceFloorY(
  terrain: THREE.Object3D,
  house: THREE.Object3D
) {
  terrain.updateMatrixWorld(true);
  house.updateMatrixWorld(true);
  const housePosition = new THREE.Vector3();
  house.getWorldPosition(housePosition);
  terrain.worldToLocal(housePosition);
  return housePosition.y + 0.78;
}

const PARTICLE_SEEDS = [
  { angle: 0.1, radius: 0.52, speed: 0.92, y: 0.08, size: 0.035 },
  { angle: 1.4, radius: 0.68, speed: 0.72, y: -0.05, size: 0.028 },
  { angle: 2.6, radius: 0.44, speed: 1.1, y: 0.22, size: 0.024 },
  { angle: 3.7, radius: 0.78, speed: 0.62, y: 0.0, size: 0.032 },
  { angle: 4.5, radius: 0.58, speed: 0.82, y: -0.18, size: 0.022 },
  { angle: 5.6, radius: 0.72, speed: 1.02, y: 0.16, size: 0.026 },
  { angle: 0.9, radius: 0.88, speed: 0.52, y: 0.3, size: 0.02 },
  { angle: 2.2, radius: 0.64, speed: 1.2, y: -0.25, size: 0.024 }
];

const INNER_SPARKS = Array.from({ length: 26 }, (_, index) => {
  const angle = index * 2.3999632297;
  const ring = index % 5;
  return {
    angle,
    radius: 0.08 + ring * 0.052,
    speed: 1.15 + (index % 7) * 0.13,
    y: -0.18 + (index % 9) * 0.045,
    size: 0.012 + (index % 4) * 0.004,
    phase: index * 0.57,
    opacity: 0.42 + (index % 5) * 0.08
  };
});

const ENERGY_RAYS = [
  { angle: -0.1, length: 0.72, y: 0.0, z: 0.02, thickness: 0.018, opacity: 0.42, phase: 0.1 },
  { angle: 0.62, length: 0.56, y: 0.03, z: -0.04, thickness: 0.014, opacity: 0.32, phase: 0.9 },
  { angle: 1.36, length: 0.5, y: 0.04, z: 0.03, thickness: 0.012, opacity: 0.28, phase: 1.6 },
  { angle: 2.3, length: 0.62, y: -0.02, z: -0.03, thickness: 0.015, opacity: 0.34, phase: 2.25 },
  { angle: 3.48, length: 0.68, y: 0.01, z: 0.04, thickness: 0.016, opacity: 0.36, phase: 2.95 },
  { angle: 4.1, length: 0.48, y: -0.04, z: -0.02, thickness: 0.012, opacity: 0.24, phase: 3.5 },
  { angle: 5.25, length: 0.58, y: 0.05, z: 0.0, thickness: 0.013, opacity: 0.3, phase: 4.35 }
];

const SOUL_RINGS: Array<{
  radius: number;
  tube: number;
  opacity: number;
  rotation: [number, number, number];
  speed: number;
  phase: number;
}> = [
  { radius: 0.64, tube: 0.009, opacity: 0.58, rotation: [0.03, 0.48, 0.08], speed: 0.18, phase: 0 },
  { radius: 0.5, tube: 0.006, opacity: 0.34, rotation: [1.26, -0.3, 0.42], speed: -0.24, phase: 1.2 },
  { radius: 0.76, tube: 0.005, opacity: 0.25, rotation: [0.78, 0.15, 1.22], speed: 0.11, phase: 2.1 }
];

const MIST_RIBBONS = [
  { angle: 0.15, x: -0.08, y: 0.23, z: -0.08, radius: 0.035, sx: 10.4, sy: 1.2, opacity: 0.18, phase: 0.2, speed: 0.46 },
  { angle: 0.82, x: 0.2, y: -0.08, z: 0.08, radius: 0.026, sx: 8.2, sy: 1.0, opacity: 0.13, phase: 1.15, speed: 0.56 },
  { angle: -0.58, x: -0.26, y: -0.2, z: 0.04, radius: 0.024, sx: 7.4, sy: 0.9, opacity: 0.12, phase: 2.05, speed: 0.4 },
  { angle: 1.75, x: 0.0, y: 0.02, z: -0.12, radius: 0.02, sx: 6.6, sy: 0.86, opacity: 0.1, phase: 2.75, speed: 0.52 }
];

const TRAIL_SEGMENTS = [
  { x: -0.22, y: -0.01, z: 0.0, radius: 0.14, sx: 1.52, sy: 0.52, opacity: 0.42 },
  { x: -0.46, y: -0.03, z: 0.02, radius: 0.12, sx: 1.82, sy: 0.44, opacity: 0.34 },
  { x: -0.72, y: -0.05, z: -0.01, radius: 0.1, sx: 2.15, sy: 0.36, opacity: 0.25 },
  { x: -1.0, y: -0.06, z: 0.02, radius: 0.082, sx: 2.48, sy: 0.3, opacity: 0.18 },
  { x: -1.3, y: -0.07, z: -0.02, radius: 0.066, sx: 2.82, sy: 0.25, opacity: 0.12 },
  { x: -1.62, y: -0.08, z: 0.01, radius: 0.052, sx: 3.14, sy: 0.2, opacity: 0.082 },
  { x: -1.96, y: -0.08, z: -0.02, radius: 0.04, sx: 3.48, sy: 0.16, opacity: 0.052 },
  { x: -2.28, y: -0.08, z: 0.02, radius: 0.032, sx: 3.75, sy: 0.13, opacity: 0.03 }
];

const TRAIL_DUST = [
  { x: -0.42, y: 0.22, z: -0.16, size: 0.029, opacity: 0.42, speed: 1.3, phase: 0.1 },
  { x: -0.54, y: -0.18, z: 0.14, size: 0.025, opacity: 0.34, speed: 1.52, phase: 0.75 },
  { x: -0.68, y: 0.05, z: 0.22, size: 0.023, opacity: 0.3, speed: 1.1, phase: 1.15 },
  { x: -0.82, y: -0.22, z: -0.12, size: 0.021, opacity: 0.27, speed: 1.38, phase: 1.55 },
  { x: -0.98, y: 0.18, z: -0.2, size: 0.02, opacity: 0.24, speed: 1.68, phase: 2.05 },
  { x: -1.12, y: -0.08, z: 0.18, size: 0.018, opacity: 0.21, speed: 1.24, phase: 2.45 },
  { x: -1.28, y: 0.12, z: 0.08, size: 0.017, opacity: 0.18, speed: 1.52, phase: 2.95 },
  { x: -1.42, y: -0.16, z: -0.18, size: 0.016, opacity: 0.16, speed: 1.18, phase: 3.35 },
  { x: -1.58, y: 0.04, z: 0.2, size: 0.015, opacity: 0.14, speed: 1.74, phase: 3.8 },
  { x: -1.72, y: 0.14, z: -0.08, size: 0.014, opacity: 0.12, speed: 1.4, phase: 4.15 },
  { x: -1.88, y: -0.12, z: 0.1, size: 0.013, opacity: 0.1, speed: 1.62, phase: 4.55 },
  { x: -2.04, y: 0.08, z: -0.16, size: 0.012, opacity: 0.085, speed: 1.3, phase: 5.05 },
  { x: -2.22, y: -0.03, z: 0.16, size: 0.011, opacity: 0.072, speed: 1.48, phase: 5.45 },
  { x: -2.38, y: 0.11, z: -0.04, size: 0.01, opacity: 0.058, speed: 1.22, phase: 5.9 },
  { x: -2.56, y: -0.07, z: -0.12, size: 0.009, opacity: 0.046, speed: 1.64, phase: 6.35 },
  { x: -2.74, y: 0.04, z: 0.1, size: 0.008, opacity: 0.035, speed: 1.36, phase: 6.8 }
];

function SoulPreviewBackground() {
  const texture = useTexture("/nebo.png");
  const hasTexture = Boolean(texture?.image);

  useEffect(() => {
    if (!hasTexture) {
      return;
    }
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
  }, [hasTexture, texture]);

  if (!hasTexture) {
    return <Color attach="background" args={["#eef8ff"]} />;
  }

  return (
    <>
      <Color attach="background" args={["#eef8ff"]} />
      <Mesh renderOrder={-10} raycast={() => null}>
        <SphereGeometry args={[24, 48, 48]} />
        <MeshBasicMaterial map={texture} side={THREE.BackSide} depthWrite={false} />
      </Mesh>
    </>
  );
}

function setMaterialOpacity(object: THREE.Object3D | null, opacity: number) {
  if (!object) {
    return;
  }
  object.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) {
      return;
    }
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => {
      const mat = material as THREE.Material & {
        opacity?: number;
        userData?: Record<string, unknown>;
      };
      if (!mat.userData) {
        mat.userData = {};
      }
      const baseOpacity =
        typeof mat.userData.baseSoulOpacity === "number"
          ? mat.userData.baseSoulOpacity
          : mat.opacity ?? 1;
      mat.userData.baseSoulOpacity = baseOpacity;
      mat.opacity = baseOpacity * opacity;
      mat.needsUpdate = true;
    });
  });
}

function keepSoulOutsideObstacle(
  target: THREE.Vector3,
  center?: [number, number, number] | null,
  radius = 0.92
) {
  if (!center) {
    return;
  }
  const dx = target.x - center[0];
  const dz = target.z - center[2];
  const distance = Math.hypot(dx, dz);
  const isNearHouseHeight = target.y < center[1] + 1.7;
  if (!isNearHouseHeight || distance >= radius) {
    return;
  }
  const angle = distance > 0.001 ? Math.atan2(dz, dx) : Math.PI;
  target.x = center[0] + Math.cos(angle) * radius;
  target.z = center[2] + Math.sin(angle) * radius;
}

function keepSoulAboveSurface(target: THREE.Vector3, floorY?: number | null) {
  if (typeof floorY !== "number" || Number.isNaN(floorY)) {
    return;
  }
  target.y = Math.max(target.y, floorY);
}

export function PetSoul({
  color = DEFAULT_SOUL_COLOR,
  glowColor,
  position = [0, 1.4, 0],
  avoidCenter = null,
  avoidRadius = 0.92,
  floorY = null,
  scale = 1,
  mode = "idle",
  quality = "full"
}: {
  color?: string | null;
  glowColor?: string | null;
  position?: [number, number, number];
  avoidCenter?: [number, number, number] | null;
  avoidRadius?: number;
  floorY?: number | null;
  scale?: number;
  mode?: PetSoulMode;
  quality?: PetSoulQuality;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const auraRef = useRef<THREE.Mesh>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const particleRefs = useRef<(THREE.Mesh | null)[]>([]);
  const innerSparkRefs = useRef<(THREE.Mesh | null)[]>([]);
  const rayRefs = useRef<(THREE.Mesh | null)[]>([]);
  const ringRefs = useRef<(THREE.Mesh | null)[]>([]);
  const mistRefs = useRef<(THREE.Mesh | null)[]>([]);
  const trailRefs = useRef<(THREE.Mesh | null)[]>([]);
  const trailDustRefs = useRef<(THREE.Mesh | null)[]>([]);
  const shellMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const auraMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const coreMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const trailMaterialRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const trailDustMaterialRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const particleMaterialRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const innerSparkMaterialRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const rayMaterialRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const ringMaterialRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const mistMaterialRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const previousModeRef = useRef<PetSoulMode>(mode);
  const normalizedColor = normalizeSoulColor(color);
  const normalizedGlowColor = normalizeSoulColor(glowColor, normalizedColor);
  const particleSeeds = quality === "light" ? PARTICLE_SEEDS.slice(0, 4) : PARTICLE_SEEDS;
  const innerSparks = quality === "light" ? INNER_SPARKS.slice(0, 9) : INNER_SPARKS;
  const energyRays = quality === "light" ? ENERGY_RAYS.slice(0, 3) : ENERGY_RAYS;
  const soulRings = quality === "light" ? SOUL_RINGS.slice(0, 1) : SOUL_RINGS;
  const mistRibbons = quality === "light" ? MIST_RIBBONS.slice(0, 1) : MIST_RIBBONS;
  const trailSegments = quality === "light" ? TRAIL_SEGMENTS.slice(0, 3) : TRAIL_SEGMENTS;
  const trailDust = quality === "light" ? TRAIL_DUST.slice(0, 3) : TRAIL_DUST;
  const baseColor = useMemo(() => new THREE.Color(normalizedColor), [normalizedColor]);
  const glowBaseColor = useMemo(() => new THREE.Color(normalizedGlowColor), [normalizedGlowColor]);
  const lightColor = useMemo(
    () => baseColor.clone().lerp(new THREE.Color("#ffffff"), 0.02),
    [baseColor]
  );
  const softGlowColor = useMemo(
    () => glowBaseColor.clone().lerp(new THREE.Color("#ffffff"), 0.06),
    [glowBaseColor]
  );

  useEffect(() => {
    if (previousModeRef.current === mode) {
      return;
    }
    previousModeRef.current = mode;
    startedAtRef.current = null;
  }, [mode]);

  useEffect(() => {
    const updateMaterial = (
      material: THREE.MeshBasicMaterial | null,
      nextColor: THREE.Color | string
    ) => {
      if (!material) {
        return;
      }
      material.color.set(nextColor);
      material.needsUpdate = true;
    };
    updateMaterial(shellMaterialRef.current, normalizedGlowColor);
    updateMaterial(auraMaterialRef.current, normalizedGlowColor);
    updateMaterial(coreMaterialRef.current, lightColor);
    trailMaterialRefs.current.forEach((material, index) => {
      updateMaterial(material, index < 2 ? softGlowColor : normalizedGlowColor);
    });
    trailDustMaterialRefs.current.forEach((material) => updateMaterial(material, softGlowColor));
    particleMaterialRefs.current.forEach((material) => updateMaterial(material, lightColor));
    innerSparkMaterialRefs.current.forEach((material) => updateMaterial(material, lightColor));
    rayMaterialRefs.current.forEach((material) => updateMaterial(material, softGlowColor));
    ringMaterialRefs.current.forEach((material) => updateMaterial(material, softGlowColor));
    mistMaterialRefs.current.forEach((material) => updateMaterial(material, normalizedGlowColor));
  }, [lightColor, normalizedGlowColor, softGlowColor]);

  useFrame(({ clock }) => {
    if (startedAtRef.current === null) {
      startedAtRef.current = clock.elapsedTime;
    }
    const elapsed = clock.elapsedTime - startedAtRef.current;
    const t = clock.elapsedTime;
    const base = new THREE.Vector3(position[0], position[1], position[2]);
    const idle = new THREE.Vector3(
      Math.cos(t * 0.55) * 0.44,
      Math.sin(t * 1.28) * 0.18 + Math.sin(t * 0.42) * 0.08,
      Math.sin(t * 0.48) * 0.38
    );
    const target = base.clone().add(idle);
    let opacity = 1;
    let visualScale = scale;

    if (mode === "preview") {
      target.set(
        position[0] + Math.cos(t * 0.7) * 0.16,
        position[1] + Math.sin(t * 1.35) * 0.14,
        position[2] + Math.sin(t * 0.62) * 0.16
      );
      visualScale = scale * 1.16;
    }

    if (mode === "arrival") {
      const progress = Math.min(elapsed / 1.8, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const start = base.clone().add(new THREE.Vector3(-4.2, 2.2, -4.8));
      target.lerpVectors(start, target, eased);
      keepSoulOutsideObstacle(target, avoidCenter, avoidRadius);
      keepSoulAboveSurface(target, floorY);
      opacity = THREE.MathUtils.clamp(progress * 1.35, 0, 1);
      visualScale = scale * THREE.MathUtils.lerp(0.45, 1, eased);
    }

    if (mode === "farewell") {
      const progress = Math.min(elapsed / 3.4, 1);
      const center = avoidCenter
        ? new THREE.Vector3(avoidCenter[0], avoidCenter[1], avoidCenter[2])
        : base.clone().add(new THREE.Vector3(1.25, -1.04, -0.78));
      const orbitRadius = avoidRadius + 0.98;
      const startAngle = Math.PI * 0.86;
      const endAngle = startAngle + Math.PI * 2.18;
      if (progress < 0.74) {
        const orbitProgress = progress / 0.74;
        const easedOrbit = orbitProgress * orbitProgress * (3 - 2 * orbitProgress);
        const angle = THREE.MathUtils.lerp(startAngle, endAngle, easedOrbit);
        target.set(
          center.x + Math.cos(angle) * orbitRadius,
          center.y + 1.18 + Math.sin(orbitProgress * Math.PI) * 0.58,
          center.z + Math.sin(angle) * orbitRadius
        );
        keepSoulAboveSurface(target, floorY);
        opacity = 1;
        visualScale = scale * THREE.MathUtils.lerp(1, 1.08, Math.sin(orbitProgress * Math.PI));
      } else {
        const flyProgress = (progress - 0.74) / 0.26;
        const easedFly = 1 - Math.pow(1 - flyProgress, 3);
        const angle = endAngle;
        const from = new THREE.Vector3(
          center.x + Math.cos(angle) * orbitRadius,
          center.y + 1.18,
          center.z + Math.sin(angle) * orbitRadius
        );
        const home = center.clone().add(new THREE.Vector3(0.02, 0.34, 0.04));
        target.lerpVectors(from, home, easedFly);
        keepSoulAboveSurface(target, floorY);
        opacity = 1 - Math.max(0, flyProgress - 0.58) / 0.42;
        visualScale = scale * THREE.MathUtils.lerp(1.02, 0.12, easedFly);
      }
    }

    if (mode !== "farewell" && mode !== "arrival") {
      keepSoulOutsideObstacle(target, avoidCenter, avoidRadius);
      keepSoulAboveSurface(target, floorY);
    }

    if (groupRef.current) {
      groupRef.current.position.copy(target);
      groupRef.current.scale.setScalar(visualScale);
      groupRef.current.rotation.y = t * 0.38;
      groupRef.current.rotation.z = Math.sin(t * 0.5) * 0.08;
      setMaterialOpacity(groupRef.current, opacity);
    }
    if (coreRef.current) {
      const pulse = 1 + Math.sin(t * 2.4) * 0.08;
      coreRef.current.scale.setScalar(pulse);
    }
    if (auraRef.current) {
      const pulse = 1 + Math.sin(t * 1.7 + 0.8) * 0.13;
      auraRef.current.scale.setScalar(pulse);
    }
    if (shellRef.current) {
      const pulse = 1 + Math.sin(t * 1.1 + 1.6) * 0.18;
      shellRef.current.scale.setScalar(pulse);
    }
    soulRings.forEach((ring, index) => {
      const mesh = ringRefs.current[index];
      const material = ringMaterialRefs.current[index];
      if (!mesh || !material) {
        return;
      }
      const pulse = 1 + Math.sin(t * 1.35 + ring.phase) * 0.04;
      mesh.rotation.set(
        ring.rotation[0] + Math.sin(t * 0.22 + ring.phase) * 0.08,
        ring.rotation[1] + Math.cos(t * 0.18 + ring.phase) * 0.08,
        ring.rotation[2] + t * ring.speed
      );
      mesh.scale.setScalar(pulse);
      material.opacity = ring.opacity * (0.72 + Math.sin(t * 1.55 + ring.phase) * 0.2) * opacity;
      material.needsUpdate = true;
    });
    energyRays.forEach((ray, index) => {
      const mesh = rayRefs.current[index];
      const material = rayMaterialRefs.current[index];
      if (!mesh || !material) {
        return;
      }
      const pulse = 0.75 + (Math.sin(t * 1.8 + ray.phase) + 1) * 0.18;
      const length = ray.length * pulse;
      mesh.position.set(
        Math.cos(ray.angle) * length * 0.28,
        ray.y + Math.sin(ray.angle) * length * 0.28,
        ray.z + Math.sin(t * 0.72 + ray.phase) * 0.018
      );
      mesh.rotation.set(0, Math.sin(t * 0.36 + ray.phase) * 0.14, ray.angle);
      mesh.scale.set(length, ray.thickness, ray.thickness);
      material.opacity = ray.opacity * (0.62 + Math.sin(t * 2.1 + ray.phase) * 0.28) * opacity;
      material.needsUpdate = true;
    });
    mistRibbons.forEach((ribbon, index) => {
      const mesh = mistRefs.current[index];
      const material = mistMaterialRefs.current[index];
      if (!mesh || !material) {
        return;
      }
      const wave = Math.sin(t * ribbon.speed + ribbon.phase);
      mesh.position.set(
        ribbon.x + Math.cos(t * 0.32 + ribbon.phase) * 0.05,
        ribbon.y + wave * 0.06,
        ribbon.z + Math.sin(t * 0.28 + ribbon.phase) * 0.06
      );
      mesh.rotation.set(
        0.16 + Math.sin(t * 0.2 + ribbon.phase) * 0.16,
        0.38 + Math.cos(t * 0.18 + ribbon.phase) * 0.2,
        ribbon.angle + Math.sin(t * ribbon.speed + ribbon.phase) * 0.28
      );
      mesh.scale.set(
        ribbon.sx * (1 + wave * 0.035),
        ribbon.sy * (1 - wave * 0.04),
        ribbon.sy * 0.7
      );
      material.opacity = ribbon.opacity * (0.68 + (wave + 1) * 0.14) * opacity;
      material.needsUpdate = true;
    });
    trailSegments.forEach((segment, index) => {
      const trail = trailRefs.current[index];
      if (!trail) {
        return;
      }
      const wave = Math.sin(t * (1.1 + index * 0.18) + index * 0.72);
      trail.position.set(
        segment.x - Math.max(0, wave) * 0.04,
        segment.y + wave * 0.045,
        segment.z + Math.cos(t * 0.9 + index) * 0.045
      );
      trail.scale.set(
        segment.sx * (1 + wave * 0.035),
        segment.sy * (1 - wave * 0.025),
        segment.sy * (1 + wave * 0.03)
      );
    });
    trailDust.forEach((dust, index) => {
      const particle = trailDustRefs.current[index];
      const material = trailDustMaterialRefs.current[index];
      if (!particle || !material) {
        return;
      }
      const wave = Math.sin(t * dust.speed + dust.phase);
      const fade = (Math.sin(t * (dust.speed * 0.72) + dust.phase) + 1) * 0.5;
      particle.position.set(
        dust.x - fade * 0.16,
        dust.y + wave * 0.08,
        dust.z + Math.cos(t * dust.speed + dust.phase) * 0.08
      );
      particle.scale.setScalar(0.8 + fade * 0.55);
      material.opacity = dust.opacity * (0.45 + fade * 0.42) * opacity;
      material.needsUpdate = true;
    });
    particleSeeds.forEach((seed, index) => {
      const particle = particleRefs.current[index];
      if (!particle) {
        return;
      }
      const angle = seed.angle + t * seed.speed;
      particle.position.set(
        Math.cos(angle) * seed.radius,
        seed.y + Math.sin(t * (seed.speed + 0.35) + seed.angle) * 0.14,
        Math.sin(angle) * seed.radius
      );
      particle.scale.setScalar(1 + Math.sin(t * 2 + seed.angle) * 0.18);
    });
    innerSparks.forEach((spark, index) => {
      const particle = innerSparkRefs.current[index];
      const material = innerSparkMaterialRefs.current[index];
      if (!particle || !material) {
        return;
      }
      const angle = spark.angle + t * spark.speed;
      const verticalWave = Math.sin(t * (spark.speed * 0.86) + spark.phase);
      const radius = spark.radius + Math.sin(t * 1.4 + spark.phase) * 0.025;
      particle.position.set(
        Math.cos(angle) * radius,
        spark.y + verticalWave * 0.12,
        Math.sin(angle * 0.86 + spark.phase) * radius
      );
      const shimmer = 0.55 + (Math.sin(t * 3.2 + spark.phase) + 1) * 0.28;
      particle.scale.setScalar(0.72 + shimmer * 0.52);
      material.opacity = spark.opacity * shimmer * opacity;
      material.needsUpdate = true;
    });
  });

  return (
    <Group ref={groupRef} key={`${normalizedColor}-${normalizedGlowColor}-${quality}`}>
      <Mesh ref={shellRef} raycast={() => null}>
        <SphereGeometry args={[0.78, 40, 40]} />
        <MeshBasicMaterial
          ref={shellMaterialRef}
          color={normalizedGlowColor}
          transparent
          opacity={0.32}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </Mesh>
      <Mesh ref={auraRef} raycast={() => null}>
        <SphereGeometry args={[0.43, 32, 32]} />
        <MeshBasicMaterial
          ref={auraMaterialRef}
          color={normalizedGlowColor}
          transparent
          opacity={0.68}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </Mesh>
      {soulRings.map((ring, index) => (
        <Mesh
          key={`${ring.radius}-${ring.phase}`}
          ref={(node: THREE.Mesh | null) => {
            ringRefs.current[index] = node;
          }}
          rotation={ring.rotation}
          raycast={() => null}
        >
          <TorusGeometry args={[ring.radius, ring.tube, 10, 104]} />
          <MeshBasicMaterial
            ref={(node: THREE.MeshBasicMaterial | null) => {
              ringMaterialRefs.current[index] = node;
            }}
            color={softGlowColor}
            transparent
            opacity={ring.opacity}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </Mesh>
      ))}
      {mistRibbons.map((ribbon, index) => (
        <Mesh
          key={`${ribbon.angle}-${ribbon.phase}`}
          ref={(node: THREE.Mesh | null) => {
            mistRefs.current[index] = node;
          }}
          position={[ribbon.x, ribbon.y, ribbon.z]}
          rotation={[0, 0, ribbon.angle]}
          scale={[ribbon.sx, ribbon.sy, ribbon.sy * 0.7]}
          raycast={() => null}
        >
          <SphereGeometry args={[ribbon.radius, 18, 18]} />
          <MeshBasicMaterial
            ref={(node: THREE.MeshBasicMaterial | null) => {
              mistMaterialRefs.current[index] = node;
            }}
            color={normalizedGlowColor}
            transparent
            opacity={ribbon.opacity}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </Mesh>
      ))}
      {energyRays.map((ray, index) => (
        <Mesh
          key={`${ray.angle}-${ray.length}`}
          ref={(node: THREE.Mesh | null) => {
            rayRefs.current[index] = node;
          }}
          position={[Math.cos(ray.angle) * ray.length * 0.28, ray.y, ray.z]}
          rotation={[0, 0, ray.angle]}
          scale={[ray.length, ray.thickness, ray.thickness]}
          raycast={() => null}
        >
          <SphereGeometry args={[1, 18, 18]} />
          <MeshBasicMaterial
            ref={(node: THREE.MeshBasicMaterial | null) => {
              rayMaterialRefs.current[index] = node;
            }}
            color={softGlowColor}
            transparent
            opacity={ray.opacity}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </Mesh>
      ))}
      <Mesh ref={coreRef} raycast={() => null}>
        <SphereGeometry args={[0.2, 32, 32]} />
        <MeshBasicMaterial
          ref={coreMaterialRef}
          color={lightColor}
          transparent
          opacity={1}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </Mesh>
      <Mesh scale={[0.58, 1.46, 0.58]} raycast={() => null}>
        <SphereGeometry args={[0.14, 24, 24]} />
        <MeshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.78}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </Mesh>
      {innerSparks.map((spark, index) => (
        <Mesh
          key={`${spark.angle}-${spark.phase}`}
          ref={(node: THREE.Mesh | null) => {
            innerSparkRefs.current[index] = node;
          }}
          raycast={() => null}
        >
          <SphereGeometry args={[spark.size, 10, 10]} />
          <MeshBasicMaterial
            ref={(node: THREE.MeshBasicMaterial | null) => {
              innerSparkMaterialRefs.current[index] = node;
            }}
            color={lightColor}
            transparent
            opacity={spark.opacity}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </Mesh>
      ))}
      {trailSegments.map((segment, index) => (
        <Mesh
          key={`${segment.x}-${segment.radius}`}
          ref={(node: THREE.Mesh | null) => {
            trailRefs.current[index] = node;
          }}
          position={[segment.x, segment.y, segment.z]}
          scale={[segment.sx, segment.sy, segment.sy]}
          raycast={() => null}
        >
          <SphereGeometry args={[segment.radius, 24, 24]} />
          <MeshBasicMaterial
            ref={(node: THREE.MeshBasicMaterial | null) => {
              trailMaterialRefs.current[index] = node;
            }}
            color={index < 2 ? softGlowColor : normalizedGlowColor}
            transparent
            opacity={segment.opacity}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </Mesh>
      ))}
      {trailDust.map((dust, index) => (
        <Mesh
          key={`${dust.x}-${dust.phase}`}
          ref={(node: THREE.Mesh | null) => {
            trailDustRefs.current[index] = node;
          }}
          position={[dust.x, dust.y, dust.z]}
          raycast={() => null}
        >
          <SphereGeometry args={[dust.size, 12, 12]} />
          <MeshBasicMaterial
            ref={(node: THREE.MeshBasicMaterial | null) => {
              trailDustMaterialRefs.current[index] = node;
            }}
            color={softGlowColor}
            transparent
            opacity={dust.opacity}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </Mesh>
      ))}
      {particleSeeds.map((seed, index) => (
        <Mesh
          key={`${seed.angle}-${seed.radius}`}
          ref={(node: THREE.Mesh | null) => {
            particleRefs.current[index] = node;
          }}
          raycast={() => null}
        >
          <SphereGeometry args={[seed.size, 12, 12]} />
          <MeshBasicMaterial
            ref={(node: THREE.MeshBasicMaterial | null) => {
              particleMaterialRefs.current[index] = node;
            }}
            color={lightColor}
            transparent
            opacity={0.68}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </Mesh>
      ))}
    </Group>
  );
}

export function PetSoulPreview({
  color,
  glowColor,
  className
}: {
  color?: string | null;
  glowColor?: string | null;
  className?: string;
}) {
  const normalizedPreviewColor = normalizeSoulColor(color);
  const normalizedPreviewGlowColor = normalizeSoulColor(glowColor, normalizedPreviewColor);
  return (
    <div className={`relative overflow-hidden rounded-[22px] bg-[#eef8ff] ${className ?? ""}`}>
      <Canvas dpr={1} camera={{ position: [0, 0.35, 3.2], fov: 42 }}>
        <SoulPreviewBackground />
        <AmbientLight intensity={0.8} />
        <PetSoul
          key={`${normalizedPreviewColor}-${normalizedPreviewGlowColor}`}
          color={normalizedPreviewColor}
          glowColor={normalizedPreviewGlowColor}
          mode="preview"
          position={[0.42, 0, 0]}
          scale={1.05}
        />
      </Canvas>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02),rgba(255,255,255,0.16)_60%,rgba(255,255,255,0.38)_100%)]" />
    </div>
  );
}
