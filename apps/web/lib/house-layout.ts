import * as THREE from "three";
import { splitHouseVariantId } from "./house-variants";

export type HouseTransform = {
  offsetX: number;
  offsetZ: number;
  rotationY: number;
  scale: number;
};

const BOWL_PART_SLOTS = new Set(["bowl_food_slot", "bowl_water_slot"]);
const MAT_PART_SLOT = "mat_slot";
const RESCALED_BUDKA_BASE_IDS = new Set(["budka_1", "budka_2", "budka_3", "budka_4", "budka_5"]);
const MAT_HOUSE_CANONICAL_FIT_SIZE = new THREE.Vector3(0.848703, 0.29245, 0.979797);

export type HousePartFitBounds = {
  maxWidth: number;
  maxLength: number;
};

const DEFAULT_HOUSE_TRANSFORM: HouseTransform = {
  offsetX: 0,
  offsetZ: 0,
  rotationY: 0,
  scale: 1
};

const DEFAULT_HOUSE_TRANSFORMS: Record<string, Partial<HouseTransform>> = {
  budka_1: { offsetX: -3.05, offsetZ: 0.45, rotationY: 81, scale: 1.17 },
  kotik_1: { offsetX: -2.5, offsetZ: 0.65, rotationY: 60, scale: 1.13 },
  mat_1: { offsetX: -1.5, offsetZ: 0.95, rotationY: -31, scale: 1.16 },
  budka_2: { offsetX: -2.95, offsetZ: 0, rotationY: 61, scale: 1.03 },
  kotik_2: { offsetX: -2.05, offsetZ: 1.95, rotationY: 152, scale: 1 },
  budka_3: { offsetX: -3.1, offsetZ: 0.7, rotationY: 81, scale: 1 },
  kotik_3: { offsetX: -2.35, offsetZ: 0.2, rotationY: 50, scale: 1.26 },
  budka_4: { offsetX: -3.1, offsetZ: -0.15, rotationY: 52, scale: 1 },
  kotik_4: { offsetX: -3.1, offsetZ: -0.45, rotationY: 60, scale: 1.15 },
  budka_5: { offsetX: -3.15, offsetZ: 0.25, rotationY: 63, scale: 1.08 },
  kotik_5: { offsetX: -2.05, offsetZ: 1.6, rotationY: 149, scale: 1.21 },
  budka_6: { offsetX: -3.15, offsetZ: 0.15, rotationY: 72, scale: 0.84 },
  kotik_6: { offsetX: -2.5, offsetZ: 1.7, rotationY: 160, scale: 1 },
  budka_7: { offsetX: -1.7, offsetZ: 0.75, rotationY: 65, scale: 1.09 },
  budka_8: { offsetX: -1.7, offsetZ: 0.8, rotationY: 71, scale: 0.85 }
};

const TERRAIN_HOUSE_TRANSFORMS: Record<string, Record<string, Partial<HouseTransform>>> = {
  "1": DEFAULT_HOUSE_TRANSFORMS,
  "2": DEFAULT_HOUSE_TRANSFORMS,
  "3": DEFAULT_HOUSE_TRANSFORMS
};

export const normalizeTerrainLayoutId = (terrainId?: string | null) => {
  if (!terrainId) {
    return "";
  }
  const normalized = terrainId.trim();
  return normalized.replace(/_(spring|summer|autumn|winter)$/i, "");
};

export const buildHouseLayoutKey = (terrainId?: string | null, houseId?: string | null) => {
  const baseId = splitHouseVariantId(houseId ?? "").baseId || houseId || "";
  const terrainBaseId = normalizeTerrainLayoutId(terrainId) || "default";
  return `${terrainBaseId}::${baseId}`;
};

export const getHouseTransform = (houseId?: string | null, terrainId?: string | null): HouseTransform => {
  const baseId = splitHouseVariantId(houseId ?? "").baseId || houseId || "";
  const terrainBaseId = normalizeTerrainLayoutId(terrainId);
  const terrainTransforms = terrainBaseId ? TERRAIN_HOUSE_TRANSFORMS[terrainBaseId] : undefined;
  const transform = {
    ...DEFAULT_HOUSE_TRANSFORM,
    ...(baseId ? DEFAULT_HOUSE_TRANSFORMS[baseId] : undefined),
    ...(baseId ? terrainTransforms?.[baseId] : undefined)
  };
  return {
    ...transform,
    scale: Number.isFinite(transform.scale) && transform.scale > 0 ? transform.scale : 1
  };
};

export const getHouseScaleFitSizeOverride = (houseId?: string | null) => {
  const baseId = splitHouseVariantId(houseId ?? "").baseId || houseId || "";
  if (baseId.startsWith("mat_")) {
    return MAT_HOUSE_CANONICAL_FIT_SIZE.clone();
  }
  return null;
};

export const getHousePartScaleMultiplier = (
  houseId?: string | null,
  slot?: string | null
) => {
  const baseId = splitHouseVariantId(houseId ?? "").baseId || houseId || "";
  if (slot === MAT_PART_SLOT) {
    const legacyMultiplier = baseId === "budka_2" ? 1.15 : 1;
    return legacyMultiplier * (RESCALED_BUDKA_BASE_IDS.has(baseId) ? 0.4 : 1);
  }
  if (slot && BOWL_PART_SLOTS.has(slot) && baseId.startsWith("mat_")) {
    return 0.5;
  }
  if (slot && BOWL_PART_SLOTS.has(slot) && RESCALED_BUDKA_BASE_IDS.has(baseId)) {
    return 0.25;
  }
  return 1;
};

export const getHousePartFitBounds = (
  houseId?: string | null,
  slot?: string | null
): HousePartFitBounds | null => {
  const baseId = splitHouseVariantId(houseId ?? "").baseId || houseId || "";
  if (baseId === "budka_1" && slot === MAT_PART_SLOT) {
    return { maxWidth: 0.3465, maxLength: 0.3465 };
  }
  if (baseId === "budka_1" && slot && BOWL_PART_SLOTS.has(slot)) {
    return { maxWidth: 0.18, maxLength: 0.18 };
  }
  return null;
};

export const applyHousePlacement = (
  target: THREE.Object3D,
  houseId?: string | null,
  terrainId?: string | null,
  overrides?: Partial<HouseTransform>
) => {
  const transform = {
    ...getHouseTransform(houseId, terrainId),
    ...overrides
  };
  target.position.x = transform.offsetX;
  target.position.z = transform.offsetZ;
  target.rotation.y = THREE.MathUtils.degToRad(transform.rotationY);
  return transform;
};
