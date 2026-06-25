import { houseSlotsGenerated } from "./memorial-slots.generated";

export type HouseSlots = {
  roof?: string;
  wall?: string;
  sign?: string;
  frameLeft?: string;
  frameRight?: string;
  mat?: string;
  bowlFood?: string;
  bowlWater?: string;
  [slotKey: string]: string | undefined;
};

export type HouseSlotEntry = {
  key: string;
  slot: string;
  category: string;
  label: string;
  legacy: boolean;
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

export const HOUSE_SLOTS: Record<string, HouseSlots> =
  houseSlotsGenerated as Record<string, HouseSlots>;

export const LEGACY_HOUSE_SLOT_CATEGORIES: Record<string, string> = {
  roof: "roof",
  wall: "wall",
  sign: "sign",
  frameLeft: "frame_left",
  frameRight: "frame_right",
  mat: "mat",
  bowlFood: "bowl_food",
  bowlWater: "bowl_water"
};

const LEGACY_HOUSE_SLOT_LABELS: Record<string, string> = {
  roof: "Крыша",
  wall: "Стены",
  sign: "Украшение",
  frameLeft: "Рамка слева",
  frameRight: "Рамка справа",
  mat: "Коврик",
  bowlFood: "Миска (еда)",
  bowlWater: "Миска (вода)"
};

const LEGACY_HOUSE_SLOT_ORDER = Object.keys(LEGACY_HOUSE_SLOT_CATEGORIES);

export const normalizeRepeatedHouseSlotName = (slotName?: string | null) =>
  slotName?.trim().replace(/_slot_\d+$/i, "_slot") ?? "";

export const getHouseSlotCategory = (slotName?: string | null) => {
  const normalized = normalizeRepeatedHouseSlotName(slotName);
  if (!normalized) {
    return "";
  }
  return normalized.replace(/_slot$/i, "");
};

const humanizeSlotCategory = (category: string) =>
  category
    .split("_")
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");

export const getHouseSlotLabel = (slotName: string, slotKey?: string | null) => {
  if (slotKey && LEGACY_HOUSE_SLOT_LABELS[slotKey]) {
    return LEGACY_HOUSE_SLOT_LABELS[slotKey];
  }
  const category = getHouseSlotCategory(slotName);
  const numberMatch = slotName.match(/_slot_(\d+)$/i);
  const baseLabel = humanizeSlotCategory(category);
  return numberMatch ? `${baseLabel} ${numberMatch[1]}` : baseLabel;
};

export const isHouseDetailSlotName = (slotName?: string | null) => {
  const normalized = slotName?.trim().toLowerCase() ?? "";
  if (!normalized || normalized === "dom_slot") {
    return false;
  }
  if (
    /^dirt_slot(?:_\d+)?$/i.test(normalized) ||
    /^gift_/.test(normalized) ||
    /^fire_slot(?:_\d+)?$/i.test(normalized)
  ) {
    return false;
  }
  return /_slot(?:_\d+)?$/i.test(normalized);
};

export const getHouseSlotEntries = (slots?: Partial<HouseSlots> | null) => {
  if (!slots) {
    return [];
  }
  const entries = Object.entries(slots)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .filter(([, slot]) => isHouseDetailSlotName(slot))
    .map(([key, slot]): HouseSlotEntry => {
      const legacy = Boolean(LEGACY_HOUSE_SLOT_CATEGORIES[key]);
      const category = LEGACY_HOUSE_SLOT_CATEGORIES[key] ?? getHouseSlotCategory(slot);
      return {
        key,
        slot,
        category,
        label: getHouseSlotLabel(slot, legacy ? key : null),
        legacy
      };
    });
  return entries.sort((a, b) => {
    const aLegacyIndex = LEGACY_HOUSE_SLOT_ORDER.indexOf(a.key);
    const bLegacyIndex = LEGACY_HOUSE_SLOT_ORDER.indexOf(b.key);
    if (aLegacyIndex !== -1 || bLegacyIndex !== -1) {
      return (aLegacyIndex === -1 ? 1000 : aLegacyIndex) - (bLegacyIndex === -1 ? 1000 : bLegacyIndex);
    }
    return a.slot.localeCompare(b.slot, "ru");
  });
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
