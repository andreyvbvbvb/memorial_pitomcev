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
};

export const DEFAULT_SOUL_COLOR = "#8ee9ff";

export const SOUL_COLOR_OPTIONS = [
  { id: "sky", name: "Небесная", color: "#8ee9ff" },
  { id: "mint", name: "Мятная", color: "#8ff5c8" },
  { id: "gold", name: "Золотая", color: "#ffd36e" },
  { id: "rose", name: "Розовая", color: "#ff9fd2" },
  { id: "violet", name: "Лиловая", color: "#b8a4ff" },
  { id: "warm", name: "Тёплая", color: "#fff1bd" }
] as const;

const Group = "group" as unknown as ComponentType<any>;
const Mesh = "mesh" as unknown as ComponentType<any>;
const SphereGeometry = "sphereGeometry" as unknown as ComponentType<any>;
const MeshBasicMaterial = "meshBasicMaterial" as unknown as ComponentType<any>;
const Color = "color" as unknown as ComponentType<any>;
const AmbientLight = "ambientLight" as unknown as ComponentType<any>;

const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;

export function normalizeSoulColor(value?: unknown) {
  if (typeof value !== "string") {
    return DEFAULT_SOUL_COLOR;
  }
  const trimmed = value.trim();
  return HEX_COLOR_RE.test(trimmed) ? trimmed : DEFAULT_SOUL_COLOR;
}

export function readSoulSettings(sceneJson?: Record<string, unknown> | null): PetSoulSettings {
  const soul =
    sceneJson?.soul && typeof sceneJson.soul === "object" && !Array.isArray(sceneJson.soul)
      ? (sceneJson.soul as Record<string, unknown>)
      : {};
  return {
    enabled: soul.enabled !== false,
    color: normalizeSoulColor(soul.color)
  };
}

export function buildSoulSettings(color: string): PetSoulSettings & { version: number } {
  return {
    enabled: true,
    color: normalizeSoulColor(color),
    version: 1
  };
}

export function resolveSoulAnchorPosition(
  terrain: THREE.Object3D,
  house: THREE.Object3D
): [number, number, number] {
  terrain.updateMatrixWorld(true);
  house.updateMatrixWorld(true);
  const housePosition = new THREE.Vector3();
  house.getWorldPosition(housePosition);
  terrain.worldToLocal(housePosition);
  return [housePosition.x + 1.15, housePosition.y + 1.45, housePosition.z + 0.75];
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
  { x: -0.24, y: -0.01, z: 0.0, radius: 0.16, sx: 1.55, sy: 0.62, opacity: 0.34 },
  { x: -0.52, y: -0.03, z: 0.02, radius: 0.14, sx: 1.85, sy: 0.52, opacity: 0.25 },
  { x: -0.82, y: -0.04, z: -0.01, radius: 0.12, sx: 2.15, sy: 0.44, opacity: 0.18 },
  { x: -1.12, y: -0.05, z: 0.02, radius: 0.1, sx: 2.45, sy: 0.36, opacity: 0.12 },
  { x: -1.42, y: -0.06, z: -0.02, radius: 0.08, sx: 2.8, sy: 0.28, opacity: 0.08 },
  { x: -1.72, y: -0.06, z: 0.01, radius: 0.06, sx: 3.05, sy: 0.22, opacity: 0.05 }
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

export function PetSoul({
  color = DEFAULT_SOUL_COLOR,
  position = [0, 1.4, 0],
  scale = 1,
  mode = "idle",
  quality = "full"
}: {
  color?: string | null;
  position?: [number, number, number];
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
  const startedAtRef = useRef<number | null>(null);
  const normalizedColor = normalizeSoulColor(color);
  const particleSeeds = quality === "light" ? PARTICLE_SEEDS.slice(0, 4) : PARTICLE_SEEDS;
  const trailSegments = quality === "light" ? TRAIL_SEGMENTS.slice(0, 3) : TRAIL_SEGMENTS;
  const baseColor = useMemo(() => new THREE.Color(normalizedColor), [normalizedColor]);
  const lightColor = useMemo(
    () => baseColor.clone().lerp(new THREE.Color("#ffffff"), 0.22),
    [baseColor]
  );

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
      opacity = THREE.MathUtils.clamp(progress * 1.35, 0, 1);
      visualScale = scale * THREE.MathUtils.lerp(0.45, 1, eased);
    }

    if (mode === "farewell") {
      const progress = Math.min(elapsed / 1.25, 1);
      const eased = progress * progress * (3 - 2 * progress);
      const home = base.clone().add(new THREE.Vector3(-0.25, -0.62, -0.2));
      target.lerp(home, eased);
      opacity = 1 - eased;
      visualScale = scale * THREE.MathUtils.lerp(1, 0.18, eased);
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
    <Group ref={groupRef}>
      <Mesh ref={shellRef} raycast={() => null}>
        <SphereGeometry args={[0.62, 32, 32]} />
        <MeshBasicMaterial
          color={normalizedColor}
          transparent
          opacity={0.11}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </Mesh>
      <Mesh ref={auraRef} raycast={() => null}>
        <SphereGeometry args={[0.39, 32, 32]} />
        <MeshBasicMaterial
          color={normalizedColor}
          transparent
          opacity={0.28}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </Mesh>
      <Mesh ref={coreRef} raycast={() => null}>
        <SphereGeometry args={[0.18, 32, 32]} />
        <MeshBasicMaterial
          color={lightColor}
          transparent
          opacity={0.92}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
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
            color={index < 2 ? lightColor : normalizedColor}
            transparent
            opacity={segment.opacity}
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
  className
}: {
  color?: string | null;
  className?: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-[22px] bg-[#eef8ff] ${className ?? ""}`}>
      <Canvas dpr={1} camera={{ position: [0, 0.35, 3.2], fov: 42 }}>
        <SoulPreviewBackground />
        <AmbientLight intensity={0.8} />
        <PetSoul color={color} mode="preview" position={[0.42, 0, 0]} scale={1.05} />
      </Canvas>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02),rgba(255,255,255,0.16)_60%,rgba(255,255,255,0.38)_100%)]" />
    </div>
  );
}
