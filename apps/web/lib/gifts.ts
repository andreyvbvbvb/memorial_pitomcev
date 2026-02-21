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

const giftWidthRules = [{ prefix: "flower_", width: 0.6 }];
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
  return number <= 8 ? 0.3 : 1;
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
