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

export const TERRAIN_GIFT_SLOTS: Record<string, string[]> = {
  summer: ["gift_slot_1", "gift_slot_2", "gift_slot_3", "gift_slot_4"],
  winter: ["gift_slot_1", "gift_slot_2", "gift_slot_3", "gift_slot_4"]
};

export const getTerrainGiftSlots = (terrainId?: string | null) =>
  TERRAIN_GIFT_SLOTS[terrainId ?? ""] ?? TERRAIN_GIFT_SLOTS.summer;
