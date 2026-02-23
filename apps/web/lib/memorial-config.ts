export type HouseSlots = {
  roof?: string;
  wall?: string;
  sign?: string;
  frameLeft?: string;
  frameRight?: string;
  mat?: string;
  bowlFood?: string;
  bowlWater?: string;
};

export const DEFAULT_HOUSE_SLOTS: HouseSlots = {
  roof: "roof_slot",
  wall: "wall_slot",
  sign: "sign_slot",
  frameLeft: "frame_left_slot",
  frameRight: "frame_right_slot",
  mat: "mat_slot",
  bowlFood: "bowl_food_slot",
  bowlWater: "bowl_water_slot"
};

export const HOUSE_SLOTS: Record<string, HouseSlots> = {
  budka_1: DEFAULT_HOUSE_SLOTS,
  budka_2: {
    roof: "roof_slot",
    wall: "wall_slot",
    sign: "sign_slot",
    frameLeft: "frame_left_slot",
    frameRight: "frame_right_slot",
    mat: "mat_slot",
    bowlFood: "bowl_food_slot",
    bowlWater: "bowl_water_slot"
  }
};

export const getHouseSlots = (houseId?: string | null): HouseSlots =>
  HOUSE_SLOTS[houseId ?? ""] ?? DEFAULT_HOUSE_SLOTS;

export const getConfiguredHouseSlots = (houseId?: string | null): HouseSlots | null =>
  HOUSE_SLOTS[houseId ?? ""] ?? null;

export const DEFAULT_TERRAIN_GIFT_SLOTS = [
  "gift_default_1",
  "gift_default_2",
  "gift_default_3",
  "gift_default_4",
  "gift_default_5",
  "gift_default_6",
  "gift_default_7",
  "gift_default_8",
  "gift_default_9",
  "gift_default_10"
];

export const TERRAIN_GIFT_SLOTS: Record<string, string[]> = {};

export const getTerrainGiftSlots = (terrainId?: string | null): string[] =>
  TERRAIN_GIFT_SLOTS[terrainId ?? ""] ?? DEFAULT_TERRAIN_GIFT_SLOTS;
