import * as THREE from "three";
import { splitHouseVariantId } from "./house-variants";

export type HouseTransform = {
  offsetX: number;
  offsetZ: number;
  rotationY: number;
  scale: number;
};

const DEFAULT_HOUSE_TRANSFORM: HouseTransform = {
  offsetX: 0,
  offsetZ: 0,
  rotationY: 0,
  scale: 1
};

const HOUSE_TRANSFORMS: Record<string, Partial<HouseTransform>> = {
  budka_1: { offsetX: -3.05, offsetZ: -0.85, rotationY: 81, scale: 1.17 },
  kotik_1: { offsetX: -2.5, offsetZ: 0.65, rotationY: 60, scale: 1.13 },
  mat_1: { offsetX: -1.5, offsetZ: 0.95, rotationY: -31, scale: 1.16 },
  budka_2: { offsetX: -2.95, offsetZ: 0, rotationY: 61, scale: 1.03 },
  kotik_2: { offsetX: -2.05, offsetZ: 1.95, rotationY: 152, scale: 1 },
  budka_3: { offsetX: -3.1, offsetZ: 0.7, rotationY: 81, scale: 1 },
  kotik_3: { offsetX: -2.35, offsetZ: 0.2, rotationY: 50, scale: 1.26 },
  budka_4: { offsetX: -3.1, offsetZ: -0.15, rotationY: 52, scale: 1 },
  kotik_4: { offsetX: -3.1, offsetZ: -0.45, rotationY: 60, scale: 1 },
  budka_5: { offsetX: -3.15, offsetZ: 0.25, rotationY: 63, scale: 1.08 },
  kotik_5: { offsetX: -2.6, offsetZ: 0.8, rotationY: 149, scale: 1.21 },
  budka_6: { offsetX: -3.15, offsetZ: 0.15, rotationY: 72, scale: 0.84 },
  kotik_6: { offsetX: -2.5, offsetZ: 1.7, rotationY: 146, scale: 0 },
  budka_7: { offsetX: -1.7, offsetZ: 0.75, rotationY: 59, scale: 1.09 },
  budka_8: { offsetX: -1.7, offsetZ: 0.8, rotationY: 65, scale: 0.85 }
};

export const getHouseTransform = (houseId?: string | null): HouseTransform => {
  const baseId = splitHouseVariantId(houseId ?? "").baseId || houseId || "";
  const transform = {
    ...DEFAULT_HOUSE_TRANSFORM,
    ...(baseId ? HOUSE_TRANSFORMS[baseId] : undefined)
  };
  return {
    ...transform,
    scale: Number.isFinite(transform.scale) && transform.scale > 0 ? transform.scale : 1
  };
};

export const applyHousePlacement = (
  target: THREE.Object3D,
  houseId?: string | null,
  overrides?: Partial<HouseTransform>
) => {
  const transform = {
    ...getHouseTransform(houseId),
    ...overrides
  };
  target.position.x = transform.offsetX;
  target.position.z = transform.offsetZ;
  target.rotation.y = THREE.MathUtils.degToRad(transform.rotationY);
  return transform;
};
