import type { OptionItem } from "./memorial-options";

export const HOUSE_VARIANT_SEPARATOR = "__";

export type HouseVariant = {
  id: string;
  baseId: string;
  textureId: string | null;
};

const extractNumber = (value: string) => {
  const match = value.match(/_(\d+)$/);
  return match ? Number(match[1]) : null;
};

const humanize = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());

export const splitHouseVariantId = (id?: string | null): HouseVariant => {
  const safeId = id ?? "";
  if (!safeId) {
    return { id: "", baseId: "", textureId: null };
  }
  const separatorIndex = safeId.indexOf(HOUSE_VARIANT_SEPARATOR);
  if (separatorIndex === -1) {
    return { id: safeId, baseId: safeId, textureId: null };
  }
  const baseId = safeId.slice(0, separatorIndex);
  const textureId = safeId.slice(separatorIndex + HOUSE_VARIANT_SEPARATOR.length) || null;
  return { id: safeId, baseId, textureId };
};

export const buildHouseVariantId = (baseId: string, textureId?: string | null) => {
  const cleanBase = baseId?.trim?.() ?? "";
  const cleanTexture = textureId?.trim?.() ?? "";
  if (!cleanBase) {
    return "";
  }
  if (!cleanTexture || cleanTexture === "default" || cleanTexture === "base") {
    return `${cleanBase}${HOUSE_VARIANT_SEPARATOR}base`;
  }
  return `${cleanBase}${HOUSE_VARIANT_SEPARATOR}${cleanTexture}`;
};

export const makeHouseBaseName = (baseId: string) => {
  const number = extractNumber(baseId);
  if (number !== null) {
    return `Будка ${number}`;
  }
  const human = humanize(baseId);
  return human || "Будка";
};

export const makeHouseTextureName = (textureId: string | null) => {
  if (!textureId || textureId === "default" || textureId === "base") {
    return "Базовая";
  }
  return humanize(textureId);
};

export type HouseVariantOption = OptionItem & HouseVariant;

export type HouseVariantGroup = {
  baseOptions: OptionItem[];
  textureOptionsByBase: Record<string, OptionItem[]>;
  defaultVariantByBase: Record<string, string>;
};

export const buildHouseVariantGroup = (houseOptions: OptionItem[]): HouseVariantGroup => {
  const variants: HouseVariantOption[] = houseOptions.map((option) => {
    const parsed = splitHouseVariantId(option.id);
    return { ...option, ...parsed };
  });

  const variantsByBase: Record<string, HouseVariantOption[]> = {};
  variants.forEach((variant) => {
    if (!variantsByBase[variant.baseId]) {
      variantsByBase[variant.baseId] = [];
    }
    const list = variantsByBase[variant.baseId];
    if (list) {
      list.push(variant);
    } else {
      variantsByBase[variant.baseId] = [variant];
    }
  });

  Object.values(variantsByBase).forEach((list) => {
    list.sort((a, b) => {
      const aIsDefault = !a.textureId || a.textureId === "default" || a.textureId === "base";
      const bIsDefault = !b.textureId || b.textureId === "default" || b.textureId === "base";
      if (aIsDefault !== bIsDefault) {
        return aIsDefault ? -1 : 1;
      }
      return (a.textureId ?? "").localeCompare(b.textureId ?? "");
    });
  });

  const baseOptionsMap = new Map<string, OptionItem>();
  Object.keys(variantsByBase).forEach((baseId) => {
    baseOptionsMap.set(baseId, {
      id: baseId,
      name: makeHouseBaseName(baseId),
      description: ""
    });
  });

  const baseOptions = Array.from(baseOptionsMap.values()).sort((a, b) => {
    const aNum = extractNumber(a.id);
    const bNum = extractNumber(b.id);
    if (aNum !== null && bNum !== null && aNum !== bNum) {
      return aNum - bNum;
    }
    return a.id.localeCompare(b.id);
  });

  const textureOptionsByBase: Record<string, OptionItem[]> = {};
  const defaultVariantByBase: Record<string, string> = {};

  Object.entries(variantsByBase).forEach(([baseId, list]) => {
    textureOptionsByBase[baseId] = list.map((variant) => ({
      id: variant.id,
      name: makeHouseTextureName(variant.textureId),
      description: ""
    }));
    defaultVariantByBase[baseId] = list[0]?.id ?? baseId;
  });

  return { baseOptions, textureOptionsByBase, defaultVariantByBase };
};
