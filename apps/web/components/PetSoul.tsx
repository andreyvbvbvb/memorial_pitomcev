"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import type { ComponentType } from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

export type PetSoulMode = "preview" | "arrival" | "idle" | "farewell";
export type PetSoulQuality = "full" | "light";

export type PetSoulSettings = {
  enabled: boolean;
  color: string;
  glowColor: string;
};

export const DEFAULT_SOUL_COLOR = "#8ee9ff";

export const SOUL_COLOR_OPTIONS = [
  { id: "sky", name: "Небесная", color: "#8ee9ff" },
  { id: "ocean", name: "Океанская", color: "#42c8ff" },
  { id: "aqua", name: "Аквамарин", color: "#4ee8df" },
  { id: "mint", name: "Мятная", color: "#8ff5c8" },
  { id: "emerald", name: "Изумрудная", color: "#5df0a6" },
  { id: "lime", name: "Лаймовая", color: "#baf76e" },
  { id: "gold", name: "Золотая", color: "#ffd36e" },
  { id: "amber", name: "Янтарная", color: "#ffb84d" },
  { id: "coral", name: "Коралловая", color: "#ff8a70" },
  { id: "rose", name: "Розовая", color: "#ff9fd2" },
  { id: "ruby", name: "Малиновая", color: "#ff5f8f" },
  { id: "violet", name: "Лиловая", color: "#b8a4ff" },
  { id: "lavender", name: "Лавандовая", color: "#d6b7ff" },
  { id: "moon", name: "Лунная", color: "#e6f2ff" },
  { id: "dusk", name: "Сумеречная", color: "#9fb7ff" },
  { id: "warm", name: "Тёплая", color: "#fff1bd" }
] as const;

const Group = "group" as unknown as ComponentType<any>;
const Mesh = "mesh" as unknown as ComponentType<any>;
const SphereGeometry = "sphereGeometry" as unknown as ComponentType<any>;
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
    glowColor: color
  };
}

export function buildSoulSettings(color: string): PetSoulSettings & { version: number } {
  const normalizedColor = normalizeSoulColor(color);
  return {
    enabled: true,
    color: normalizedColor,
    glowColor: normalizedColor,
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

type IdleSoulAction = {
  kind: "float" | "orbit" | "loop";
  startedAt: number;
  duration: number;
  seed: number;
  direction: 1 | -1;
  radius: number;
};

function pickIdleSoulAction(startedAt: number, canOrbit: boolean): IdleSoulAction {
  const roll = Math.random();
  let kind: IdleSoulAction["kind"] = "float";
  if (roll > 0.56 && roll <= 0.78) {
    kind = "loop";
  } else if (roll > 0.78 && canOrbit) {
    kind = "orbit";
  }
  const duration =
    kind === "orbit"
      ? 5.2 + Math.random() * 2.4
      : kind === "loop"
        ? 2.6 + Math.random() * 1.3
        : 4.2 + Math.random() * 2.2;
  return {
    kind,
    startedAt,
    duration,
    seed: Math.random() * Math.PI * 2,
    direction: Math.random() > 0.5 ? 1 : -1,
    radius: 0.56 + Math.random() * 0.38
  };
}

export function PetSoul({
  color = DEFAULT_SOUL_COLOR,
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
  const auraGeometryRef = useRef<THREE.BufferGeometry | null>(null);
  const auraBasePositionsRef = useRef<Float32Array | null>(null);
  const auraMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const coreMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const previousModeRef = useRef<PetSoulMode>(mode);
  const idlePhaseRef = useRef(Math.random() * Math.PI * 2);
  const idleActionRef = useRef<IdleSoulAction | null>(null);
  const normalizedColor = normalizeSoulColor(color);
  const baseColor = useMemo(() => new THREE.Color(normalizedColor), [normalizedColor]);
  const rimColor = useMemo(
    () => baseColor.clone().lerp(new THREE.Color("#ffffff"), 0.04),
    [baseColor]
  );
  const lightColor = useMemo(() => baseColor.clone(), [baseColor]);
  const setAuraGeometryRef = useCallback((geometry: THREE.BufferGeometry | null) => {
    auraGeometryRef.current = geometry;
    if (!geometry) {
      auraBasePositionsRef.current = null;
      return;
    }
    const positionAttribute = geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
    if (!positionAttribute) {
      auraBasePositionsRef.current = null;
      return;
    }
    positionAttribute.setUsage(THREE.DynamicDrawUsage);
    auraBasePositionsRef.current = new Float32Array(positionAttribute.array as ArrayLike<number>);
  }, []);

  useEffect(() => {
    if (previousModeRef.current === mode) {
      return;
    }
    previousModeRef.current = mode;
    startedAtRef.current = null;
    idleActionRef.current = null;
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
    updateMaterial(auraMaterialRef.current, rimColor);
    updateMaterial(coreMaterialRef.current, lightColor);
  }, [lightColor, rimColor]);

  useFrame(({ clock }) => {
    if (startedAtRef.current === null) {
      startedAtRef.current = clock.elapsedTime;
    }
    const elapsed = clock.elapsedTime - startedAtRef.current;
    const t = clock.elapsedTime;
    const phase = idlePhaseRef.current;
    const base = new THREE.Vector3(position[0], position[1], position[2]);
    const idle = new THREE.Vector3(
      Math.cos(t * 0.55 + phase) * 0.44,
      Math.sin(t * 1.28 + phase * 0.7) * 0.18 + Math.sin(t * 0.42 + phase) * 0.08,
      Math.sin(t * 0.48 + phase * 1.2) * 0.38
    );
    const target = base.clone().add(idle);
    let opacity = 1;
    let visualScale = scale;
    let spinBoost = 0;

    if (mode === "idle") {
      const canOrbit = Boolean(avoidCenter);
      const currentAction = idleActionRef.current;
      if (!currentAction || t - currentAction.startedAt >= currentAction.duration) {
        idleActionRef.current = pickIdleSoulAction(t, canOrbit);
      }
      const action = idleActionRef.current;
      if (action?.kind === "orbit" && avoidCenter) {
        const progress = THREE.MathUtils.clamp((t - action.startedAt) / action.duration, 0, 1);
        const envelope = Math.sin(progress * Math.PI);
        const eased = progress * progress * (3 - 2 * progress);
        const angle = action.seed + action.direction * progress * Math.PI * 2.15;
        const orbitRadius = avoidRadius + action.radius;
        const centerY = avoidCenter[1] + 0.98;
        const orbitTarget = new THREE.Vector3(
          avoidCenter[0] + Math.cos(angle) * orbitRadius,
          centerY + Math.sin(eased * Math.PI * 2 + action.seed) * 0.34,
          avoidCenter[2] + Math.sin(angle) * orbitRadius
        );
        target.lerp(orbitTarget, envelope);
        visualScale = scale * (1 + envelope * 0.08);
      } else if (action?.kind === "loop") {
        const progress = THREE.MathUtils.clamp((t - action.startedAt) / action.duration, 0, 1);
        const envelope = Math.sin(progress * Math.PI);
        const angle = action.seed + action.direction * progress * Math.PI * 2;
        target.add(
          new THREE.Vector3(
            Math.cos(angle) * action.radius * envelope,
            Math.sin(progress * Math.PI * 2) * 0.28 * envelope,
            Math.sin(angle * 1.35) * action.radius * 0.72 * envelope
          )
        );
        spinBoost = action.direction * envelope * Math.PI * 2;
        visualScale = scale * (1 + envelope * 0.1);
      }
    }

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
      groupRef.current.rotation.y = t * 0.38 + spinBoost;
      groupRef.current.rotation.z = Math.sin(t * 0.5 + phase) * 0.08;
      setMaterialOpacity(groupRef.current, opacity);
    }
    if (coreRef.current) {
      const pulse = 1 + Math.sin(t * 2.4) * 0.08;
      coreRef.current.scale.setScalar(pulse);
    }
    if (auraRef.current) {
      const pulse = 1 + Math.sin(t * 1.7 + 0.8) * 0.065;
      auraRef.current.scale.setScalar(pulse);
    }
    const auraGeometry = auraGeometryRef.current;
    const auraBasePositions = auraBasePositionsRef.current;
    const auraPositionAttribute = auraGeometry?.getAttribute("position") as
      | THREE.BufferAttribute
      | undefined;
    if (auraPositionAttribute && auraBasePositions) {
      const positions = auraPositionAttribute.array;
      for (let vertexIndex = 0; vertexIndex < auraPositionAttribute.count; vertexIndex += 1) {
        const index = vertexIndex * 3;
        const x = auraBasePositions[index] ?? 0;
        const y = auraBasePositions[index + 1] ?? 0;
        const z = auraBasePositions[index + 2] ?? 0;
        const length = Math.hypot(x, y, z) || 1;
        const nx = x / length;
        const ny = y / length;
        const nz = z / length;
        const wave =
          Math.sin(nx * 7.8 + t * 1.25) * 0.018 +
          Math.sin(ny * 6.4 - t * 1.55) * 0.014 +
          Math.sin((nx + nz) * 5.2 + t * 0.92) * 0.012;
        const radiusScale = 1 + wave;
        positions[index] = x * radiusScale;
        positions[index + 1] = y * radiusScale;
        positions[index + 2] = z * radiusScale;
      }
      auraPositionAttribute.needsUpdate = true;
    }
  });

  return (
    <Group ref={groupRef} key={`${normalizedColor}-${quality}`}>
      <Mesh ref={auraRef} renderOrder={1} raycast={() => null}>
        <SphereGeometry ref={setAuraGeometryRef} args={[0.34, 48, 48]} />
        <MeshBasicMaterial
          ref={auraMaterialRef}
          color={rimColor}
          transparent
          opacity={0.18}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </Mesh>
      <Mesh ref={coreRef} renderOrder={2} raycast={() => null}>
        <SphereGeometry args={[0.199, 40, 40]} />
        <MeshBasicMaterial
          ref={coreMaterialRef}
          color={lightColor}
          transparent
          opacity={0.96}
          depthWrite={false}
          blending={THREE.NormalBlending}
        />
      </Mesh>
    </Group>
  );
}

export function PetSoulPreview({
  color,
  className
}: {
  color?: string | null;
  className?: string;
}) {
  const normalizedPreviewColor = normalizeSoulColor(color);
  return (
    <div className={`relative overflow-hidden rounded-[22px] bg-[#eef8ff] ${className ?? ""}`}>
      <Canvas dpr={1} camera={{ position: [0, 0.35, 3.2], fov: 42 }}>
        <SoulPreviewBackground />
        <AmbientLight intensity={0.8} />
        <PetSoul
          key={normalizedPreviewColor}
          color={normalizedPreviewColor}
          mode="preview"
          position={[0.42, 0, 0]}
          scale={1.05}
        />
      </Canvas>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02),rgba(255,255,255,0.16)_60%,rgba(255,255,255,0.38)_100%)]" />
    </div>
  );
}
