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
  path: PetSoulPath | null;
};

export type PetSoulPathPoint = {
  x: number;
  y: number;
  z: number;
  duration: number;
};

export type PetSoulPathCurve = "smooth" | "linear";

export type PetSoulPath = {
  enabled: boolean;
  points: PetSoulPathPoint[];
  returnDuration: number;
  idleDuration: number;
  curve: PetSoulPathCurve;
  closed: boolean;
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
const SOUL_PATH_MIN_DURATION = 0.2;
const SOUL_PATH_MAX_DURATION = 30;
const SOUL_PATH_MAX_POINTS = 12;
const SOUL_PATH_MAX_OFFSET = 20;
const MEMORIAL_ORBIT_RADIUS_MULTIPLIER = 1.1;
const MEMORIAL_ORBIT_DURATION = 4;
const MEMORIAL_ORBIT_TRANSITION_DURATION = 1.5;
const MEMORIAL_ORBIT_START_RAMP_DURATION = 0;
const MEMORIAL_ORBIT_CLOCKWISE_YAW = -Math.PI / 4;
const MEMORIAL_ORBIT_TRANSITION_TURNS = 4;
const SOUL_ANCHOR_OFFSET_X = 1;
const SOUL_ANCHOR_OFFSET_Z = 1;
const FLOAT_ACTION_MIN_DURATION = 13.5;
const FLOAT_ACTION_MAX_DURATION = 18;
const WHIRLPOOL_RISE_DURATION = 4.2;
const WHIRLPOOL_RETURN_DURATION = 1.2;
const WHIRLPOOL_TURNS = 5;
const WHIRLPOOL_HEIGHT = 1.5;
const WHIRLPOOL_RADIUS = 0.62;
const SURFACE_HOP_DESCEND_DURATION = 0.85;
const SURFACE_HOP_DURATION = 4.4;
const SURFACE_HOP_RETURN_DURATION = 1.1;
const SURFACE_HOP_COUNT = 7;
const HOP_GROUND_OFFSET = -0.4;
const POINT_HOP_DESCEND_DURATION = 0.65;
const POINT_HOP_DURATION = 4.2;
const POINT_HOP_RETURN_DURATION = 0.85;
const POINT_HOP_COUNT = 6;

const clampFiniteNumber = (value: unknown, fallback: number, min: number, max: number) => {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return THREE.MathUtils.clamp(number, min, max);
};

export function normalizeSoulColor(value?: unknown, fallback = DEFAULT_SOUL_COLOR) {
  const safeFallback = HEX_COLOR_RE.test(fallback) ? fallback : DEFAULT_SOUL_COLOR;
  if (typeof value !== "string") {
    return safeFallback;
  }
  const trimmed = value.trim();
  return HEX_COLOR_RE.test(trimmed) ? trimmed : safeFallback;
}

export function normalizeSoulPath(value?: unknown): PetSoulPath | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const raw = value as Record<string, unknown>;
  const rawPoints = Array.isArray(raw.points) ? raw.points : [];
  const points = rawPoints
    .slice(0, SOUL_PATH_MAX_POINTS)
    .map((point) => {
      if (!point || typeof point !== "object" || Array.isArray(point)) {
        return null;
      }
      const item = point as Record<string, unknown>;
      return {
        x: clampFiniteNumber(item.x, 0, -SOUL_PATH_MAX_OFFSET, SOUL_PATH_MAX_OFFSET),
        y: clampFiniteNumber(item.y, 0, -SOUL_PATH_MAX_OFFSET, SOUL_PATH_MAX_OFFSET),
        z: clampFiniteNumber(item.z, 0, -SOUL_PATH_MAX_OFFSET, SOUL_PATH_MAX_OFFSET),
        duration: clampFiniteNumber(
          item.duration,
          2,
          SOUL_PATH_MIN_DURATION,
          SOUL_PATH_MAX_DURATION
        )
      };
    })
    .filter((point): point is PetSoulPathPoint => Boolean(point));

  if (points.length === 0) {
    return null;
  }

  return {
    enabled: raw.enabled === true,
    points,
    returnDuration: clampFiniteNumber(
      raw.returnDuration,
      2,
      SOUL_PATH_MIN_DURATION,
      SOUL_PATH_MAX_DURATION
    ),
    idleDuration: clampFiniteNumber(raw.idleDuration, 2.5, 0, SOUL_PATH_MAX_DURATION),
    curve: raw.curve === "linear" ? "linear" : "smooth",
    closed: raw.closed !== false
  };
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
    glowColor: color,
    path: normalizeSoulPath(soul.path)
  };
}

export function buildSoulSettings(
  color: string,
  path?: PetSoulPath | null
): PetSoulSettings & { version: number } {
  const normalizedColor = normalizeSoulColor(color);
  const normalizedPath = normalizeSoulPath(path);
  return {
    enabled: true,
    color: normalizedColor,
    glowColor: normalizedColor,
    path: normalizedPath
      ? {
          ...normalizedPath,
          enabled: path?.enabled === true
        }
      : null,
    version: 2
  };
}

export function resolveSoulAnchorPosition(
  terrain: THREE.Object3D,
  house: THREE.Object3D
): [number, number, number] {
  terrain.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(terrain);
  const center = new THREE.Vector3();
  box.getCenter(center);
  terrain.worldToLocal(center);
  center.x += SOUL_ANCHOR_OFFSET_X;
  center.z += SOUL_ANCHOR_OFFSET_Z;
  center.y = resolveSoulSurfaceFloorY(terrain, house);
  return [center.x, center.y, center.z];
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

export function resolveSoulOrbitCenterPosition(
  terrain: THREE.Object3D,
  house: THREE.Object3D
): [number, number, number] {
  terrain.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(terrain);
  const center = new THREE.Vector3();
  box.getCenter(center);
  terrain.worldToLocal(center);
  center.y = resolveSoulSurfaceFloorY(terrain, house);
  return [center.x, center.y, center.z];
}

export function resolveSoulOrbitRadius(terrain: THREE.Object3D) {
  terrain.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(terrain);
  const size = new THREE.Vector3();
  box.getSize(size);
  return Math.max(1.2, Math.max(size.x, size.z) * 0.5 * MEMORIAL_ORBIT_RADIUS_MULTIPLIER);
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
  kind:
    | "float"
    | "loop"
    | "memorialOrbit"
    | "whirlpool"
    | "surfaceHops"
    | "pointHops";
  startedAt: number;
  duration: number;
  seed: number;
  direction: 1 | -1;
  radius: number;
  startPosition?: THREE.Vector3;
};

type IdleSoulActionKind = IdleSoulAction["kind"];

type PreparedSoulPath = {
  knots: THREE.Vector3[];
  segmentDurations: number[];
  travelDuration: number;
  idleDuration: number;
  closed: boolean;
  curve: THREE.CatmullRomCurve3 | null;
};

function progressWithStartRamp(elapsed: number, duration: number, rampDuration: number) {
  const safeDuration = Math.max(0.001, duration);
  const safeRamp = THREE.MathUtils.clamp(rampDuration, 0, safeDuration * 0.8);
  const safeElapsed = THREE.MathUtils.clamp(elapsed, 0, safeDuration);
  if (safeRamp <= 0) {
    return safeElapsed / safeDuration;
  }
  const cruiseSpeed = 1 / (safeDuration - safeRamp * 0.5);
  if (safeElapsed <= safeRamp) {
    return (0.5 * cruiseSpeed * safeElapsed * safeElapsed) / safeRamp;
  }
  return cruiseSpeed * (safeElapsed - safeRamp * 0.5);
}

function cubicBezierVector(
  start: THREE.Vector3,
  controlA: THREE.Vector3,
  controlB: THREE.Vector3,
  end: THREE.Vector3,
  progress: number
) {
  const t = THREE.MathUtils.clamp(progress, 0, 1);
  const inv = 1 - t;
  return start
    .clone()
    .multiplyScalar(inv * inv * inv)
    .add(controlA.clone().multiplyScalar(3 * inv * inv * t))
    .add(controlB.clone().multiplyScalar(3 * inv * t * t))
    .add(end.clone().multiplyScalar(t * t * t));
}

function spiraledBezierVector(
  start: THREE.Vector3,
  controlA: THREE.Vector3,
  controlB: THREE.Vector3,
  end: THREE.Vector3,
  progress: number,
  radius: number,
  turns: number,
  seed: number,
  direction: 1 | -1
) {
  const point = cubicBezierVector(start, controlA, controlB, end, progress);
  const travelAxis = end.clone().sub(start);
  if (travelAxis.lengthSq() < 0.0001 || radius <= 0 || turns <= 0) {
    return point;
  }
  travelAxis.normalize();
  const reference =
    Math.abs(travelAxis.dot(new THREE.Vector3(0, 1, 0))) > 0.92
      ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3(0, 1, 0);
  const normalA = new THREE.Vector3().crossVectors(travelAxis, reference).normalize();
  const normalB = new THREE.Vector3().crossVectors(travelAxis, normalA).normalize();
  const envelope = Math.sin(THREE.MathUtils.clamp(progress, 0, 1) * Math.PI);
  const angle = seed + direction * progress * Math.PI * 2 * turns;
  return point.add(
    normalA
      .multiplyScalar(Math.cos(angle) * radius * envelope)
      .add(normalB.multiplyScalar(Math.sin(angle) * radius * envelope))
  );
}

function pickIdleSoulAction(
  startedAt: number,
  canMemorialOrbit: boolean,
  preferMemorialOrbit = false,
  recentKinds: IdleSoulActionKind[] = [],
  forceFloat = false
): IdleSoulAction {
  if (forceFloat) {
    return {
      kind: "float",
      startedAt,
      duration:
        FLOAT_ACTION_MIN_DURATION +
        Math.random() * (FLOAT_ACTION_MAX_DURATION - FLOAT_ACTION_MIN_DURATION),
      seed: Math.random() * Math.PI * 2,
      direction: Math.random() > 0.5 ? 1 : -1,
      radius: 0.56 + Math.random() * 0.38
    };
  }
  const candidates: IdleSoulActionKind[] = ["loop", "whirlpool", "surfaceHops", "pointHops"];
  if (canMemorialOrbit) {
    candidates.push("memorialOrbit");
  }
  const availableCandidates = candidates.filter((candidate) => !recentKinds.includes(candidate));
  const pool = availableCandidates.length > 0 ? availableCandidates : candidates;

  let kind: IdleSoulActionKind = "loop";
  if (preferMemorialOrbit && pool.includes("memorialOrbit")) {
    kind = "memorialOrbit";
  } else {
    kind = pool[Math.floor(Math.random() * pool.length)] ?? "loop";
  }
  const duration =
    kind === "memorialOrbit"
      ? MEMORIAL_ORBIT_DURATION + MEMORIAL_ORBIT_TRANSITION_DURATION * 2
      : kind === "whirlpool"
        ? WHIRLPOOL_RISE_DURATION + WHIRLPOOL_RETURN_DURATION
      : kind === "surfaceHops"
        ? SURFACE_HOP_DESCEND_DURATION + SURFACE_HOP_DURATION + SURFACE_HOP_RETURN_DURATION
      : kind === "pointHops"
        ? POINT_HOP_DESCEND_DURATION + POINT_HOP_DURATION + POINT_HOP_RETURN_DURATION
      : kind === "loop"
        ? 2.6 + Math.random() * 1.3
        : 4.2 + Math.random() * 2.2;
  return {
    kind,
    startedAt,
    duration,
    seed: Math.random() * Math.PI * 2,
    direction: kind === "memorialOrbit" ? 1 : Math.random() > 0.5 ? 1 : -1,
    radius: 0.56 + Math.random() * 0.38
  };
}

function prepareSoulPath(path?: PetSoulPath | null): PreparedSoulPath | null {
  if (!path?.enabled || path.points.length === 0) {
    return null;
  }

  const closed = path.closed !== false;
  const knots = [
    new THREE.Vector3(0, 0, 0),
    ...path.points.map((point) => new THREE.Vector3(point.x, point.y, point.z))
  ];
  const segmentDurations = path.points.map((point) =>
    Math.max(SOUL_PATH_MIN_DURATION, point.duration)
  );
  if (closed) {
    segmentDurations.push(Math.max(SOUL_PATH_MIN_DURATION, path.returnDuration));
  }
  const travelDuration = segmentDurations.reduce((total, duration) => total + duration, 0);
  const idleDuration = Math.max(0, path.idleDuration);
  const curve =
    path.curve === "smooth" && closed && knots.length >= 3
      ? new THREE.CatmullRomCurve3(knots, true, "centripetal", 0.5)
      : null;

  return {
    knots,
    segmentDurations,
    travelDuration,
    idleDuration,
    closed,
    curve
  };
}

function sampleSoulPathOffset(elapsed: number, preparedPath?: PreparedSoulPath | null) {
  if (!preparedPath || preparedPath.segmentDurations.length === 0) {
    return null;
  }
  const { knots, segmentDurations, travelDuration, idleDuration, closed, curve } = preparedPath;
  const cycleDuration = travelDuration + idleDuration;
  if (cycleDuration <= 0) {
    return null;
  }
  let cursor = ((elapsed % cycleDuration) + cycleDuration) % cycleDuration;

  for (let segmentIndex = 0; segmentIndex < segmentDurations.length; segmentIndex += 1) {
    const duration = segmentDurations[segmentIndex] ?? SOUL_PATH_MIN_DURATION;
    if (cursor <= duration) {
      const progress = THREE.MathUtils.clamp(cursor / duration, 0, 1);
      if (curve && closed) {
        const segmentCount = knots.length;
        return curve.getPoint((segmentIndex + progress) / segmentCount);
      }

      const from = knots[segmentIndex];
      const nextIndex = segmentIndex + 1;
      const to = knots[nextIndex] ?? (closed ? knots[0] : knots[knots.length - 1]);
      if (!from || !to) {
        return new THREE.Vector3(0, 0, 0);
      }
      return from.clone().lerp(to, progress);
    }
    cursor -= duration;
  }

  return new THREE.Vector3(0, 0, 0);
}

export function PetSoul({
  color = DEFAULT_SOUL_COLOR,
  position = [0, 0, 0],
  avoidCenter = null,
  orbitCenter = null,
  orbitRadius = null,
  avoidRadius = 0.92,
  floorY = null,
  scale = 1,
  mode = "idle",
  quality = "full",
  path = null
}: {
  color?: string | null;
  glowColor?: string | null;
  position?: [number, number, number];
  avoidCenter?: [number, number, number] | null;
  orbitCenter?: [number, number, number] | null;
  orbitRadius?: number | null;
  avoidRadius?: number;
  floorY?: number | null;
  scale?: number;
  mode?: PetSoulMode;
  quality?: PetSoulQuality;
  path?: PetSoulPath | null;
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
  const recentIdleActionKindsRef = useRef<IdleSoulActionKind[]>([]);
  const initialMemorialOrbitPlayedRef = useRef(false);
  const normalizedColor = normalizeSoulColor(color);
  const preparedPath = useMemo(() => prepareSoulPath(path), [path]);
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
    recentIdleActionKindsRef.current = [];
    initialMemorialOrbitPlayedRef.current = false;
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
    const pathOffset = mode === "idle" ? sampleSoulPathOffset(t + phase, preparedPath) : null;
    const followsCustomPath = Boolean(pathOffset);
    const naturalIdleTarget = base.clone().add(idle);
    const target = pathOffset ? base.clone().add(pathOffset) : naturalIdleTarget.clone();
    let shouldRespectSceneColliders = !followsCustomPath;
    let opacity = 1;
    let visualScale = scale;
    let spinBoost = 0;

    if (mode === "idle" && !pathOffset) {
      const canMemorialOrbit = Boolean(orbitCenter);
      const currentAction = idleActionRef.current;
      if (!currentAction || t - currentAction.startedAt >= currentAction.duration) {
        const forceFloat = Boolean(currentAction && currentAction.kind !== "float");
        const preferMemorialOrbit =
          !forceFloat && canMemorialOrbit && !initialMemorialOrbitPlayedRef.current;
        idleActionRef.current = pickIdleSoulAction(
          t,
          canMemorialOrbit,
          preferMemorialOrbit,
          recentIdleActionKindsRef.current,
          forceFloat
        );
        if (idleActionRef.current.kind !== "float") {
          recentIdleActionKindsRef.current = [
            idleActionRef.current.kind,
            ...recentIdleActionKindsRef.current
          ].slice(0, 2);
        }
        if (preferMemorialOrbit) {
          initialMemorialOrbitPlayedRef.current = true;
        }
        if (idleActionRef.current) {
          idleActionRef.current.startPosition = target.clone();
        }
      }
      const action = idleActionRef.current;
      if (action?.kind === "loop") {
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
      } else if (action?.kind === "whirlpool") {
        shouldRespectSceneColliders = false;
        const actionStart = action.startPosition?.clone() ?? naturalIdleTarget.clone();
        const actionElapsed = t - action.startedAt;
        if (actionElapsed < WHIRLPOOL_RISE_DURATION) {
          const progress = THREE.MathUtils.clamp(actionElapsed / WHIRLPOOL_RISE_DURATION, 0, 1);
          const heightProgress = progress * progress * (3 - 2 * progress);
          const radiusEnvelope = Math.sin(progress * Math.PI) * 0.72 + progress * 0.28;
          const radius = WHIRLPOOL_RADIUS * radiusEnvelope;
          const angle = action.seed + action.direction * progress * Math.PI * 2 * WHIRLPOOL_TURNS;
          target.set(
            actionStart.x + Math.cos(angle) * radius,
            actionStart.y + WHIRLPOOL_HEIGHT * heightProgress,
            actionStart.z + Math.sin(angle) * radius * 0.72
          );
          spinBoost = action.direction * progress * Math.PI * 3;
          visualScale = scale * (1 + Math.sin(progress * Math.PI) * 0.08);
        } else {
          const returnProgress = THREE.MathUtils.smoothstep(
            (actionElapsed - WHIRLPOOL_RISE_DURATION) / WHIRLPOOL_RETURN_DURATION,
            0,
            1
          );
          const topAngle = action.seed + action.direction * Math.PI * 2 * WHIRLPOOL_TURNS;
          const topPosition = new THREE.Vector3(
            actionStart.x + Math.cos(topAngle) * WHIRLPOOL_RADIUS * 0.28,
            actionStart.y + WHIRLPOOL_HEIGHT,
            actionStart.z + Math.sin(topAngle) * WHIRLPOOL_RADIUS * 0.28 * 0.72
          );
          const tangent = new THREE.Vector3(
            -Math.sin(topAngle) * action.direction,
            0,
            Math.cos(topAngle) * action.direction
          ).normalize();
          const returnControlA = topPosition
            .clone()
            .add(tangent.clone().multiplyScalar(WHIRLPOOL_RADIUS * 0.55))
            .add(new THREE.Vector3(0, 0.28, 0));
          const returnControlB = naturalIdleTarget
            .clone()
            .sub(tangent.clone().multiplyScalar(WHIRLPOOL_RADIUS * 0.35))
            .add(new THREE.Vector3(0, 0.48, 0));
          target.copy(
            cubicBezierVector(
              topPosition,
              returnControlA,
              returnControlB,
              naturalIdleTarget,
              returnProgress
            )
          );
          spinBoost = action.direction * Math.PI * 2;
          visualScale = scale * (1 + (1 - returnProgress) * 0.05);
        }
      } else if (action?.kind === "surfaceHops") {
        shouldRespectSceneColliders = false;
        const actionStart = action.startPosition?.clone() ?? naturalIdleTarget.clone();
        const actionElapsed = t - action.startedAt;
        const groundY =
          typeof floorY === "number" && Number.isFinite(floorY)
            ? floorY + HOP_GROUND_OFFSET
            : actionStart.y - 0.35;
        const surfaceRadius =
          typeof orbitRadius === "number" && Number.isFinite(orbitRadius) ? orbitRadius : 1.6;
        const hopRadius = THREE.MathUtils.clamp(surfaceRadius * 0.32, 0.72, 1.18);
        const hopCenter = orbitCenter
          ? new THREE.Vector3(orbitCenter[0], groundY, orbitCenter[2])
          : new THREE.Vector3(base.x, groundY, base.z);
        if (avoidCenter) {
          const awayFromHouse = hopCenter
            .clone()
            .sub(new THREE.Vector3(avoidCenter[0], groundY, avoidCenter[2]));
          if (awayFromHouse.lengthSq() < 0.001) {
            awayFromHouse.set(Math.cos(action.seed), 0, Math.sin(action.seed));
          }
          hopCenter.add(
            awayFromHouse
              .normalize()
              .multiplyScalar(Math.max(avoidRadius + 0.28, hopRadius * 0.42))
          );
        }
        const resolveHopPoint = (progress: number) => {
          const angle = action.seed + action.direction * progress * Math.PI * 2 * 1.16;
          const radiusPulse = hopRadius * (0.92 + Math.sin(progress * Math.PI * 2) * 0.08);
          const hopArc = Math.abs(Math.sin(progress * Math.PI * SURFACE_HOP_COUNT));
          return new THREE.Vector3(
            hopCenter.x + Math.cos(angle) * radiusPulse,
            groundY + hopArc * 0.5,
            hopCenter.z + Math.sin(angle) * radiusPulse * 0.72
          );
        };
        const firstHopPoint = resolveHopPoint(0);
        const hopEndTime = SURFACE_HOP_DESCEND_DURATION + SURFACE_HOP_DURATION;
        if (actionElapsed < SURFACE_HOP_DESCEND_DURATION) {
          const descendProgress = THREE.MathUtils.smoothstep(
            actionElapsed / SURFACE_HOP_DESCEND_DURATION,
            0,
            1
          );
          target.copy(
            cubicBezierVector(
              actionStart,
              actionStart.clone().add(new THREE.Vector3(0, -0.24, 0)),
              firstHopPoint.clone().add(new THREE.Vector3(0, 0.58, 0)),
              firstHopPoint,
              descendProgress
            )
          );
        } else if (actionElapsed < hopEndTime) {
          const hopProgress = THREE.MathUtils.clamp(
            (actionElapsed - SURFACE_HOP_DESCEND_DURATION) / SURFACE_HOP_DURATION,
            0,
            1
          );
          target.copy(resolveHopPoint(hopProgress));
          spinBoost = action.direction * Math.sin(hopProgress * Math.PI) * Math.PI * 1.2;
          visualScale =
            scale *
            (1 + Math.abs(Math.sin(hopProgress * Math.PI * SURFACE_HOP_COUNT)) * 0.06);
        } else {
          const returnProgress = THREE.MathUtils.smoothstep(
            (actionElapsed - hopEndTime) / SURFACE_HOP_RETURN_DURATION,
            0,
            1
          );
          const lastHopPoint = resolveHopPoint(1);
          const tangent = new THREE.Vector3(
            -Math.sin(action.seed + action.direction * Math.PI * 2 * 1.16) * action.direction,
            0,
            Math.cos(action.seed + action.direction * Math.PI * 2 * 1.16) * action.direction
          ).normalize();
          target.copy(
            cubicBezierVector(
              lastHopPoint,
              lastHopPoint
                .clone()
                .add(tangent.clone().multiplyScalar(hopRadius * 0.35))
                .add(new THREE.Vector3(0, 0.42, 0)),
              naturalIdleTarget
                .clone()
                .sub(tangent.clone().multiplyScalar(hopRadius * 0.22))
                .add(new THREE.Vector3(0, 0.36, 0)),
              naturalIdleTarget,
              returnProgress
            )
          );
          visualScale = scale * (1 + (1 - returnProgress) * 0.04);
        }
      } else if (action?.kind === "pointHops") {
        shouldRespectSceneColliders = false;
        const actionStart = action.startPosition?.clone() ?? naturalIdleTarget.clone();
        const actionElapsed = t - action.startedAt;
        const groundY =
          typeof floorY === "number" && Number.isFinite(floorY)
            ? floorY + HOP_GROUND_OFFSET
            : actionStart.y - 0.35;
        const jumpDuration = POINT_HOP_DURATION;
        const jumpVector = new THREE.Vector3(
          Math.cos(action.seed) * action.radius * 1.22,
          0,
          Math.sin(action.seed) * action.radius * 0.86
        );
        const pointA = actionStart.clone();
        pointA.y = groundY;
        const pointB = actionStart.clone().add(jumpVector);
        pointB.y = groundY;
        if (actionElapsed < POINT_HOP_DESCEND_DURATION) {
          const descendProgress = THREE.MathUtils.clamp(
            actionElapsed / POINT_HOP_DESCEND_DURATION,
            0,
            1
          );
          target.copy(
            cubicBezierVector(
              actionStart,
              actionStart.clone().add(new THREE.Vector3(0, -0.12, 0)),
              pointA.clone().add(new THREE.Vector3(0, 0.24, 0)),
              pointA,
              descendProgress
            )
          );
        } else if (actionElapsed < POINT_HOP_DESCEND_DURATION + jumpDuration) {
          const progress = THREE.MathUtils.clamp(
            (actionElapsed - POINT_HOP_DESCEND_DURATION) / jumpDuration,
            0,
            1
          );
          const scaledProgress = Math.min(progress * POINT_HOP_COUNT, POINT_HOP_COUNT - 0.0001);
          const jumpIndex = Math.floor(scaledProgress);
          const localProgress = scaledProgress - jumpIndex;
          const easedJump = THREE.MathUtils.smoothstep(localProgress, 0, 1);
          const from = jumpIndex % 2 === 0 ? pointA : pointB;
          const to = jumpIndex % 2 === 0 ? pointB : pointA;
          target.lerpVectors(from, to, easedJump);
          target.y += Math.sin(localProgress * Math.PI) * 0.46;
          spinBoost = action.direction * Math.sin(progress * Math.PI) * Math.PI * 1.6;
          visualScale = scale * (1 + Math.sin(localProgress * Math.PI) * 0.07);
        } else {
          const returnProgress = THREE.MathUtils.smoothstep(
            (actionElapsed - POINT_HOP_DESCEND_DURATION - jumpDuration) / POINT_HOP_RETURN_DURATION,
            0,
            1
          );
          target.copy(
            cubicBezierVector(
              pointA,
              pointA.clone().add(new THREE.Vector3(0, 0.16, 0)),
              naturalIdleTarget.clone().add(new THREE.Vector3(0, 0.22, 0)),
              naturalIdleTarget,
              returnProgress
            )
          );
        }
      } else if (action?.kind === "memorialOrbit" && orbitCenter) {
        shouldRespectSceneColliders = false;
        const center = new THREE.Vector3(orbitCenter[0], orbitCenter[1], orbitCenter[2]);
        const actionStart = action.startPosition?.clone() ?? base.clone();
        const startVector = actionStart.clone().sub(center);
        const verticalAxis = new THREE.Vector3(0, 1, 0);
        const horizontalAxis = new THREE.Vector3(-1, 0, 0)
          .applyAxisAngle(verticalAxis, MEMORIAL_ORBIT_CLOCKWISE_YAW)
          .normalize();
        const startHorizontal = startVector.dot(horizontalAxis);
        const startVertical = startVector.y;
        const memorialOrbitRadius = Math.max(
          1.2,
          typeof orbitRadius === "number" && Number.isFinite(orbitRadius)
            ? orbitRadius
            : Math.hypot(startHorizontal, startVertical)
        );
        const startAngle = Math.atan2(startVertical, startHorizontal);
        const actionElapsed = t - action.startedAt;
        const orbitTangent = horizontalAxis
          .clone()
          .multiplyScalar(-Math.sin(startAngle) * action.direction)
          .add(verticalAxis.clone().multiplyScalar(Math.cos(startAngle) * action.direction))
          .normalize();
        const orbitStart = center
          .clone()
          .add(horizontalAxis.clone().multiplyScalar(Math.cos(startAngle) * memorialOrbitRadius))
          .add(verticalAxis.clone().multiplyScalar(Math.sin(startAngle) * memorialOrbitRadius));
        const exitControlA = actionStart
          .clone()
          .add(orbitTangent.clone().multiplyScalar(memorialOrbitRadius * 0.2));
        const exitControlB = orbitStart
          .clone()
          .sub(orbitTangent.clone().multiplyScalar(memorialOrbitRadius * 0.22));
        const exitDuration = MEMORIAL_ORBIT_TRANSITION_DURATION;
        const returnStart = exitDuration + MEMORIAL_ORBIT_DURATION;
        const transitionSpiralRadius = Math.min(0.34, memorialOrbitRadius * 0.13);
        if (actionElapsed < exitDuration) {
          const exitProgress = THREE.MathUtils.clamp(actionElapsed / exitDuration, 0, 1);
          target.copy(
            spiraledBezierVector(
              actionStart,
              exitControlA,
              exitControlB,
              orbitStart,
              exitProgress,
              transitionSpiralRadius,
              MEMORIAL_ORBIT_TRANSITION_TURNS,
              action.seed,
              action.direction
            )
          );
          spinBoost = action.direction * exitProgress * Math.PI * 2;
        } else if (actionElapsed < returnStart) {
          const orbitElapsed = actionElapsed - exitDuration;
          const orbitProgress = progressWithStartRamp(
            orbitElapsed,
            MEMORIAL_ORBIT_DURATION,
            MEMORIAL_ORBIT_START_RAMP_DURATION
          );
          const angle = startAngle + action.direction * orbitProgress * Math.PI * 2;
          target
            .copy(center)
            .add(horizontalAxis.clone().multiplyScalar(Math.cos(angle) * memorialOrbitRadius))
            .add(verticalAxis.clone().multiplyScalar(Math.sin(angle) * memorialOrbitRadius));
        } else {
          const returnProgress = THREE.MathUtils.clamp(
            (actionElapsed - returnStart) / exitDuration,
            0,
            1
          );
          const returnControlA = orbitStart
            .clone()
            .add(orbitTangent.clone().multiplyScalar(memorialOrbitRadius * 0.18));
          const returnControlB = naturalIdleTarget
            .clone()
            .sub(orbitTangent.clone().multiplyScalar(memorialOrbitRadius * 0.16));
          target.copy(
            spiraledBezierVector(
              orbitStart,
              returnControlA,
              returnControlB,
              naturalIdleTarget,
              returnProgress,
              transitionSpiralRadius,
              MEMORIAL_ORBIT_TRANSITION_TURNS,
              action.seed + Math.PI,
              action.direction
            )
          );
          spinBoost = action.direction * (1 - returnProgress) * Math.PI * 2;
        }
        spinBoost += action.direction * Math.PI * 1.5;
        const actionProgress = THREE.MathUtils.clamp(actionElapsed / action.duration, 0, 1);
        visualScale = scale * (1 + Math.sin(actionProgress * Math.PI) * 0.06);
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

    if (mode !== "farewell" && mode !== "arrival" && shouldRespectSceneColliders) {
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
