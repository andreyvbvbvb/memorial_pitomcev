import { giftModelsGenerated } from "./gifts.generated";

const DEFAULT_SLOT_TYPE = "default";
const LEGACY_PREFIX = "gift_slot_";
const SLOT_PREFIX = "gift_";

const giftModels: Record<string, Record<string, string>> =
  giftModelsGenerated as Record<string, Record<string, string>>;

export type GiftSlotInfo = {
  type: string;
  index?: number | null;
};

export type GiftSize = "s" | "m" | "l";

export const isGiftSlotName = (name?: string | null) => {
  if (!name) return false;
  return name.toLowerCase().startsWith(SLOT_PREFIX);
};

export const parseGiftSlot = (slotName?: string | null): GiftSlotInfo | null => {
  if (!slotName) return null;
  const normalized = slotName.trim();
  const lower = normalized.toLowerCase();
  if (lower.startsWith(LEGACY_PREFIX)) {
    const rawIndex = lower.slice(LEGACY_PREFIX.length);
    const index = Number.parseInt(rawIndex, 10);
    return {
      type: DEFAULT_SLOT_TYPE,
      index: Number.isNaN(index) ? null : index
    };
  }
  if (!lower.startsWith(SLOT_PREFIX)) {
    return null;
  }
  const rest = lower.slice(SLOT_PREFIX.length);
  const parts = rest.split("_").filter(Boolean);
  if (parts.length === 0) {
    return { type: DEFAULT_SLOT_TYPE, index: null };
  }
  const maybeIndex = Number.parseInt(parts[parts.length - 1] ?? "", 10);
  if (!Number.isNaN(maybeIndex) && parts.length > 1) {
    return {
      type: parts.slice(0, -1).join("_"),
      index: maybeIndex
    };
  }
  return {
    type: parts.join("_"),
    index: Number.isNaN(maybeIndex) ? null : maybeIndex
  };
};

export const getGiftSlotType = (slotName?: string | null) =>
  parseGiftSlot(slotName)?.type ?? DEFAULT_SLOT_TYPE;

export const getGiftSlotIndex = (slotName?: string | null) =>
  parseGiftSlot(slotName)?.index ?? null;

export const getGiftCodeFromUrl = (modelUrl?: string | null) => {
  if (!modelUrl) return null;
  const base = modelUrl.split("/").pop() ?? "";
  const cleaned = base.replace(/\.glb$/i, "");
  return cleaned || null;
};

export const getGiftCode = (gift?: { code?: string | null; modelUrl?: string | null }) =>
  gift?.code ?? getGiftCodeFromUrl(gift?.modelUrl);

export const getGiftAvailableTypes = (gift?: { code?: string | null; modelUrl?: string | null }) => {
  const code = getGiftCode(gift);
  if (!code) return [DEFAULT_SLOT_TYPE];
  const entry = giftModels[code];
  if (!entry) return [DEFAULT_SLOT_TYPE];
  const types = Object.keys(entry)
    .filter((key) => key !== "default")
    .map((type) => type.toLowerCase());
  return types.length > 0 ? types : [DEFAULT_SLOT_TYPE];
};

export const resolveGiftModelUrl = (options: {
  gift?: { code?: string | null; modelUrl?: string | null };
  slotType?: string | null;
  fallbackUrl?: string | null;
}) => {
  const code = getGiftCode(options.gift);
  const entry = code ? giftModels[code] : null;
  const slotType = options.slotType?.toLowerCase() ?? null;
  if (entry && slotType) {
    if (entry[slotType]) {
      return entry[slotType];
    }
    const matchedKey = Object.keys(entry).find((key) => key.toLowerCase() === slotType);
    if (matchedKey) {
      return entry[matchedKey];
    }
  }
  if (entry?.default) {
    return entry.default;
  }
  return options.gift?.modelUrl ?? options.fallbackUrl ?? null;
};

export const resolveGiftIconUrl = (gift?: { code?: string | null; modelUrl?: string | null }) => {
  const code = getGiftCode(gift);
  if (!code) return null;
  return `/gifts_icons/${code}.png`;
};

const giftWidthRules = [
  { prefix: "flower_", width: 0.6 },
  { prefix: "toy_", width: 0.5 },
  { prefix: "meal_", width: 0.45 }
];

const giftScaleMultipliers: Record<string, number> = {
  meal_8: 1,
  flower_11: 1.1,
  flower_8: 0.9,
  meal_5: 1,
  meal_4: 0.82,
  toy_8: 1,
  star_2: 1,
  meal_2: 1,
  meal_3: 1,
  meal_7: 0.87,
  meal_6: 1.13,
  star_8: 1,
  star_6: 1,
  toy_13: 0.2,
  star_9: 1,
  toy_1: 1,
  toy_9: 1,
  toy_10: 0.69,
  toy_11: 0.69,
  toy_21: 1,
  bird_1: 1,
  flower_2: 0.91,
  star_5: 1,
  toy_16: 1,
  toy_17: 1,
  toy_19: 1,
  toy_18: 1,
  toy_15: 1,
  toy_20: 1,
  toy_24: 1,
  toy_23: 1,
  toy_2: 0.41,
  toy_4: 1,
  meal_1: 1,
  toy_6: 0.72,
  toy_7: 0.74,
  toy_22: 0.71,
  bird_2: 1,
  star_4: 1,
  star_7: 1,
  flower_12: 1.12,
  flower_9: 0.9,
  flower_4: 1.3,
  flower_1: 0.94,
  star_1: 1,
  meal_12: 1,
  meal_11: 1,
  star_3: 1,
  flower_7: 0.78,
  toy_14: 1,
  flower_5: 0.91,
  flower_10: 0.83,
  candle: 1,
  candle_4: 1,
  candle_8: 1,
  candle_11: 1,
  candle_2: 1,
  candle_7: 1,
  candle_3: 1,
  candle_6: 1,
  candle_13: 1,
  candle_10: 1,
  candle_12: 1,
  candle_5: 1,
  candle_1: 1,
  candle_9: 1,
  flower_6: 0.94,
  toy_12: 1,
  meal_10: 1,
  meal_9: 1,
  toy_5: 0.39,
  meal_15: 1,
  flower_3: 1.04,
  toy_3: 0.86,
  meal_14: 1,
  meal_13: 1
};

const starSizeMultipliers: Record<GiftSize, number> = {
  s: 0.35,
  m: 0.5,
  l: 0.7
};

const resolveCandleWidth = (code: string) => {
  const match = code.match(/^candle_(\d+)$/);
  if (!match) return null;
  const number = Number(match[1]);
  if (Number.isNaN(number)) return null;
  return 0.39;
};

export const resolveGiftTargetWidth = (gift?: { code?: string | null; modelUrl?: string | null }) => {
  const code = getGiftCode(gift);
  if (!code) return null;
  const candleWidth = resolveCandleWidth(code);
  if (candleWidth) {
    return candleWidth;
  }
  const rule = giftWidthRules.find((item) => code.startsWith(item.prefix));
  return rule ? rule.width : null;
};

export const resolveGiftScaleMultiplier = (gift?: { code?: string | null; modelUrl?: string | null }): number => {
  const code = getGiftCode(gift);
  if (!code) return 1;
  const multiplier = giftScaleMultipliers[code];
  return typeof multiplier === "number" && Number.isFinite(multiplier) && multiplier > 0
    ? multiplier
    : 1;
};

export const giftSupportsSize = (gift?: { code?: string | null; modelUrl?: string | null }) => {
  const code = getGiftCode(gift);
  if (!code) return false;
  return code.startsWith("star");
};

export const resolveGiftSizeMultiplier = (options: {
  gift?: { code?: string | null; modelUrl?: string | null };
  size?: GiftSize | string | null;
}) => {
  if (!options.size) {
    return 1;
  }
  if (!giftSupportsSize(options.gift)) {
    return 1;
  }
  const normalized = String(options.size).toLowerCase();
  if (normalized === "s" || normalized === "small") {
    return starSizeMultipliers.s;
  }
  if (normalized === "l" || normalized === "large") {
    return starSizeMultipliers.l;
  }
  return starSizeMultipliers.m;
};
