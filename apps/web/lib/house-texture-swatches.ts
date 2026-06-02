import { splitHouseVariantId } from "./house-variants";

const namedTextureColors: Record<string, string> = {
  base: "#c79d72",
  default: "#c79d72",
  second: "#9f7658",
  third: "#6f5146",
  fourth: "#d2a66f",
  brown: "#7c5438",
  white: "#f1ece4",
  stone: "#9f9a90",
  toy: "#bd7658",
  soso: "#b98462",
  tuntun: "#6b4b3f"
};

const fallbackTextureColors = [
  "#c79d72",
  "#8f6348",
  "#d7b37d",
  "#efe7dd",
  "#9f9a90",
  "#b98462",
  "#6b4b3f",
  "#c18a74"
];

const hexToRgb = (hex: string) => {
  const clean = hex.replace("#", "");
  const normalized =
    clean.length === 3 ? clean.split("").map((char) => char + char).join("") : clean;
  const value = Number.parseInt(normalized, 16);
  if (!Number.isFinite(value)) {
    return { r: 199, g: 157, b: 114 };
  }
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
};

const mix = (hex: string, target: "white" | "black", amount: number) => {
  const rgb = hexToRgb(hex);
  const targetValue = target === "white" ? 255 : 0;
  const next = {
    r: Math.round(rgb.r + (targetValue - rgb.r) * amount),
    g: Math.round(rgb.g + (targetValue - rgb.g) * amount),
    b: Math.round(rgb.b + (targetValue - rgb.b) * amount)
  };
  return `rgb(${next.r}, ${next.g}, ${next.b})`;
};

export const getHouseTextureSwatchBackground = (variantId: string, index = 0) => {
  const textureId = splitHouseVariantId(variantId).textureId ?? "base";
  const key = textureId.toLowerCase();
  const baseColor =
    namedTextureColors[key] ??
    fallbackTextureColors[index % fallbackTextureColors.length] ??
    fallbackTextureColors[0] ??
    "#c79d72";
  return `linear-gradient(135deg, ${mix(
    baseColor,
    "white",
    0.28
  )} 0%, ${baseColor} 54%, ${mix(baseColor, "black", 0.18)} 100%)`;
};
