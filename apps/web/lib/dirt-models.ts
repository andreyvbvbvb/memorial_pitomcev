import {
  dirtModelOptionsGenerated,
  type GeneratedDirtModelOption
} from "./dirt-models.generated";
import { splitHouseVariantId } from "./house-variants";

export type DirtSlotIndex = 1 | 2 | 3 | 4;
export type DirtModelOption = GeneratedDirtModelOption;

export const DIRT_SLOT_NAMES = [
  "dirt_slot_1",
  "dirt_slot_2",
  "dirt_slot_3",
  "dirt_slot_4"
] as const;
export type DirtSlotName = (typeof DIRT_SLOT_NAMES)[number];

export type DirtSlotPlacement = {
  slot: DirtSlotName;
  slotIndex: DirtSlotIndex;
  url: string;
  modelId: string;
};

export const dirtModelOptions: readonly GeneratedDirtModelOption[] =
  dirtModelOptionsGenerated;

export const getDirtSlotIndex = (slotName?: string | null): DirtSlotIndex | null => {
  const match = slotName?.match(/^dirt_slot_([1-4])$/i);
  if (!match) {
    return null;
  }
  return Number(match[1]) as DirtSlotIndex;
};

export const normalizeDirtSlotName = (value: unknown): DirtSlotName | null => {
  if (typeof value === "number") {
    return DIRT_SLOT_NAMES[value - 1] ?? null;
  }
  if (typeof value !== "string") {
    return null;
  }
  if ((DIRT_SLOT_NAMES as readonly string[]).includes(value)) {
    return value as DirtSlotName;
  }
  const slotIndex = getDirtSlotIndex(value);
  return slotIndex ? (DIRT_SLOT_NAMES[slotIndex - 1] ?? null) : null;
};

export const normalizeDirtSlotNames = (value: unknown): DirtSlotName[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const slots: DirtSlotName[] = [];
  value.forEach((item) => {
    const slot = normalizeDirtSlotName(item);
    if (slot && !slots.includes(slot)) {
      slots.push(slot);
    }
  });
  return slots;
};

export const readActiveDirtSlots = (
  sceneJson?: Record<string, unknown> | null,
  level = 0
): DirtSlotName[] => {
  if (sceneJson && Array.isArray(sceneJson.activeDirtSlots)) {
    return normalizeDirtSlotNames(sceneJson.activeDirtSlots);
  }
  const safeLevel = Math.max(0, Math.min(DIRT_SLOT_NAMES.length, Math.floor(level)));
  return [...DIRT_SLOT_NAMES.slice(0, safeLevel)];
};

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const pickStable = <T,>(items: readonly T[], seed: string): T | null => {
  if (items.length === 0) {
    return null;
  }
  return items[hashString(seed) % items.length] ?? null;
};

export const getDirtModelsForSlot = (
  slotIndex: DirtSlotIndex,
  houseId?: string | null
): readonly GeneratedDirtModelOption[] => {
  const baseHouseId = splitHouseVariantId(houseId).baseId || houseId || null;
  return dirtModelOptions.filter((model) => {
    const slotMatches = model.slot === null || model.slot === slotIndex;
    if (!slotMatches) {
      return false;
    }
    if (model.scope === "global") {
      return true;
    }
    return Boolean(baseHouseId && model.houseId === baseHouseId);
  });
};

export const buildDirtSlotPlacements = ({
  houseId,
  level,
  activeSlots,
  seed
}: {
  houseId?: string | null;
  level: number;
  activeSlots?: readonly DirtSlotName[] | null;
  seed: string;
}): DirtSlotPlacement[] => {
  const slotNames = activeSlots
    ? activeSlots
        .map((slot) => normalizeDirtSlotName(slot))
        .filter((slot): slot is DirtSlotName => Boolean(slot))
    : readActiveDirtSlots(null, level);
  return slotNames
    .map((slotName) => {
      const slotIndex = getDirtSlotIndex(slotName);
      if (!slotIndex) {
        return null;
      }
      const models = getDirtModelsForSlot(slotIndex, houseId);
      const selected = pickStable(models, `${seed}:${houseId ?? "default"}:${slotName}`);
      if (!selected) {
        return null;
      }
      return {
        slot: slotName,
        slotIndex,
        url: selected.url,
        modelId: selected.modelId
      };
    })
    .filter((placement): placement is DirtSlotPlacement => Boolean(placement));
};
