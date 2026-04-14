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
  budka_1: { offsetX: -0.6, offsetZ: -0.6, rotationY: 24 },
  kotik_1: { offsetX: 0, offsetZ: 0, rotationY: 0 },
  mat_1: { offsetX: 0, offsetZ: 0.55, rotationY: -93 },
  budka_2: { offsetX: 0, offsetZ: -0.6, rotationY: 19 },
  kotik_2: { offsetX: -1.05, offsetZ: 0.55, rotationY: 88 },
  budka_3: { offsetX: -1.6, offsetZ: 0.7, rotationY: 81 },
  kotik_3: { offsetX: 0, offsetZ: 0, rotationY: 0 },
  budka_4: { offsetX: 0.3, offsetZ: -0.5, rotationY: 0 },
  kotik_4: { offsetX: 0, offsetZ: -0.2, rotationY: 20 },
  budka_5: { offsetX: 0.15, offsetZ: -0.3, rotationY: 0 },
  kotik_5: { offsetX: -0.65, offsetZ: 0.5, rotationY: 81 },
  budka_6: { offsetX: 0, offsetZ: -0.3, rotationY: 0 },
  kotik_6: { offsetX: -0.55, offsetZ: 0.65, rotationY: 90 },
  budka_7: { offsetX: 0.2, offsetZ: 0.55, rotationY: 0 },
  budka_8: { offsetX: 0, offsetZ: 0.85, rotationY: 0 }
};

export const getHouseTransform = (houseId?: string | null): HouseTransform => {
  const baseId = splitHouseVariantId(houseId ?? "").baseId || houseId || "";
  return {
    ...DEFAULT_HOUSE_TRANSFORM,
    ...(baseId ? HOUSE_TRANSFORMS[baseId] : undefined)
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
