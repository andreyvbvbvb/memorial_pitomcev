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

const TRAIL_SEGMENTS = [
  { x: -0.22, y: -0.01, z: 0.0, radius: 0.13, sx: 1.5, sy: 0.5, opacity: 0.28 },
  { x: -0.46, y: -0.03, z: 0.02, radius: 0.11, sx: 1.8, sy: 0.42, opacity: 0.22 },
  { x: -0.72, y: -0.05, z: -0.01, radius: 0.09, sx: 2.1, sy: 0.35, opacity: 0.16 },
  { x: -1.0, y: -0.06, z: 0.02, radius: 0.075, sx: 2.42, sy: 0.29, opacity: 0.11 },
  { x: -1.3, y: -0.07, z: -0.02, radius: 0.06, sx: 2.7, sy: 0.24, opacity: 0.078 },
  { x: -1.62, y: -0.08, z: 0.01, radius: 0.048, sx: 3.05, sy: 0.19, opacity: 0.052 },
  { x: -1.96, y: -0.08, z: -0.02, radius: 0.037, sx: 3.35, sy: 0.15, opacity: 0.032 },
  { x: -2.28, y: -0.08, z: 0.02, radius: 0.03, sx: 3.55, sy: 0.12, opacity: 0.016 }
];

const TRAIL_DUST = [
  { x: -0.52, y: 0.18, z: -0.14, size: 0.026, opacity: 0.3, speed: 1.3, phase: 0.1 },
  { x: -0.82, y: -0.19, z: 0.12, size: 0.022, opacity: 0.23, speed: 1.1, phase: 1.4 },
  { x: -1.08, y: 0.1, z: 0.18, size: 0.018, opacity: 0.17, speed: 1.45, phase: 2.1 },
  { x: -1.36, y: -0.12, z: -0.1, size: 0.015, opacity: 0.12, speed: 1.18, phase: 2.8 },
  { x: -1.68, y: 0.07, z: 0.08, size: 0.012, opacity: 0.09, speed: 1.55, phase: 3.5 },
  { x: -2.02, y: -0.05, z: -0.06, size: 0.01, opacity: 0.052, speed: 1.22, phase: 4.4 }
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

export function PetSoul({
  color = DEFAULT_SOUL_COLOR,
  glowColor,
  position = [0, 1.4, 0],
  avoidCenter = null,
  avoidRadius = 0.92,
  scale = 1,
  mode = "idle",
  quality = "full"
}: {
  color?: string | null;
  glowColor?: string | null;
  position?: [number, number, number];
  avoidCenter?: [number, number, number] | null;
  avoidRadius?: number;
  scale?: number;
  mode?: PetSoulMode;
  quality?: PetSoulQuality;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const auraRef = useRef<THREE.Mesh>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const particleRefs = useRef<(THREE.Mesh | null)[]>([]);
  const trailRefs = useRef<(THREE.Mesh | null)[]>([]);
  const trailDustRefs = useRef<(THREE.Mesh | null)[]>([]);
  const shellMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const auraMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const coreMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const trailMaterialRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const trailDustMaterialRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const particleMaterialRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const startedAtRef = useRef<number | null>(null);
  const previousModeRef = useRef<PetSoulMode>(mode);
  const normalizedColor = normalizeSoulColor(color);
  const normalizedGlowColor = normalizeSoulColor(glowColor, normalizedColor);
  const particleSeeds = quality === "light" ? PARTICLE_SEEDS.slice(0, 4) : PARTICLE_SEEDS;
  const trailSegments = quality === "light" ? TRAIL_SEGMENTS.slice(0, 3) : TRAIL_SEGMENTS;
  const trailDust = quality === "light" ? TRAIL_DUST.slice(0, 3) : TRAIL_DUST;
  const baseColor = useMemo(() => new THREE.Color(normalizedColor), [normalizedColor]);
  const glowBaseColor = useMemo(() => new THREE.Color(normalizedGlowColor), [normalizedGlowColor]);
  const lightColor = useMemo(
    () => baseColor.clone().lerp(new THREE.Color("#ffffff"), 0.1),
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
        opacity = 1 - Math.max(0, flyProgress - 0.58) / 0.42;
        visualScale = scale * THREE.MathUtils.lerp(1.02, 0.12, easedFly);
      }
    }

    if (mode !== "farewell" && mode !== "arrival") {
      keepSoulOutsideObstacle(target, avoidCenter, avoidRadius);
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
      material.opacity = dust.opacity * (0.45 + fade * 0.42);
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
  });

  return (
    <Group ref={groupRef} key={`${normalizedColor}-${normalizedGlowColor}-${quality}`}>
      <Mesh ref={shellRef} raycast={() => null}>
        <SphereGeometry args={[0.62, 32, 32]} />
        <MeshBasicMaterial
          ref={shellMaterialRef}
          color={normalizedGlowColor}
          transparent
          opacity={0.16}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </Mesh>
      <Mesh ref={auraRef} raycast={() => null}>
        <SphereGeometry args={[0.39, 32, 32]} />
        <MeshBasicMaterial
          ref={auraMaterialRef}
          color={normalizedGlowColor}
          transparent
          opacity={0.36}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </Mesh>
      <Mesh ref={coreRef} raycast={() => null}>
        <SphereGeometry args={[0.18, 32, 32]} />
        <MeshBasicMaterial
          ref={coreMaterialRef}
          color={lightColor}
          transparent
          opacity={0.86}
          depthWrite={false}
          blending={THREE.NormalBlending}
        />
      </Mesh>
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
            opacity={0.52}
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
