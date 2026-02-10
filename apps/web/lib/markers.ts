import { markerVariantsGenerated } from "./markers.generated";

export type MarkerStyle = {
  id: string;
  name: string;
  color: string;
};

export type MarkerVariant = {
  id: string;
  baseId: string;
  url: string;
};

export const DEFAULT_MARKER_STYLE: MarkerStyle = {
  id: "other",
  name: "Другое",
  color: "#8D6FD1"
};

const PNG_ASPECT_RATIO = 1280 / 853;
const PIN_ASPECT_RATIO = 48 / 36;
const PNG_ICON_IDS = new Set(["dog", "cat", "bird", "rat", "gryzun", "fish", "other"]);

export const markerStyles: MarkerStyle[] = [
  { id: "dog", name: "Собака", color: "#6E91F6" },
  { id: "cat", name: "Кошка", color: "#F6A66E" },
  { id: "bird", name: "Птица", color: "#6ED7F6" },
  { id: "rat", name: "Крыса", color: "#B0B3B8" },
  { id: "gryzun", name: "Грызун", color: "#B89C77" },
  { id: "fish", name: "Рыбка", color: "#6EE0A0" },
  { id: "other", name: "Другое", color: "#8D6FD1" }
];

const normalizedVariants: MarkerVariant[] = markerVariantsGenerated.map((variant) => ({
  id: variant.id.toLowerCase(),
  baseId: variant.baseId.toLowerCase(),
  url: variant.url
}));

const variantOrder = markerStyles.map((style) => style.id);

const extractVariantNumber = (id: string) => {
  const match = id.match(/_(\d+)$/);
  return match ? Number(match[1]) : null;
};

export const markerVariants: MarkerVariant[] = [...normalizedVariants].sort((a, b) => {
  const aIndex = variantOrder.indexOf(a.baseId);
  const bIndex = variantOrder.indexOf(b.baseId);
  if (aIndex !== bIndex) {
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  }
  const aNum = extractVariantNumber(a.id);
  const bNum = extractVariantNumber(b.id);
  if (aNum !== null && bNum !== null && aNum !== bNum) {
    return aNum - bNum;
  }
  if (a.id === a.baseId && b.id !== b.baseId) {
    return -1;
  }
  if (b.id === b.baseId && a.id !== a.baseId) {
    return 1;
  }
  return a.id.localeCompare(b.id);
});

const markerVariantById = new Map(markerVariants.map((variant) => [variant.id, variant]));
const markerVariantIds = new Set(markerVariants.map((variant) => variant.id));

export const markerBaseId = (id?: string | null) => {
  const normalized = (id ?? "").toLowerCase();
  if (!normalized) {
    return "other";
  }
  const variant = markerVariantById.get(normalized);
  if (variant) {
    return variant.baseId;
  }
  return normalized.split("_")[0] ?? normalized;
};

export const markerStyleById = (id?: string | null): MarkerStyle =>
  markerStyles.find((style) => style.id === markerBaseId(id)) ??
  markerStyles[0] ??
  DEFAULT_MARKER_STYLE;

export const markerSize = (markerId: string | null | undefined, width: number) => {
  const normalized = markerId?.toLowerCase() ?? "";
  const base = markerBaseId(normalized);
  const aspect =
    normalized && (markerVariantIds.has(normalized) || PNG_ICON_IDS.has(base))
      ? PNG_ASPECT_RATIO
      : PIN_ASPECT_RATIO;
  return {
    width: Math.round(width),
    height: Math.round(width * aspect)
  };
};

export const markerAnchor = (markerId: string | null | undefined, width: number) => {
  const size = markerSize(markerId, width);
  return { x: Math.round(size.width / 2), y: size.height };
};

export const markerIconUrl = (idOrColor: string) => {
  const id = idOrColor.toLowerCase();
  const variant = markerVariantById.get(id);
  if (variant) {
    return variant.url;
  }
  const iconMap: Record<string, string> = {
    dog: "/markers/dog.png",
    cat: "/markers/cat.png",
    bird: "/markers/bird.png",
    rat: "/markers/rat.png",
    gryzun: "/markers/gryzun.png",
    fish: "/markers/fish.png",
    other: "/markers/other.png"
  };
  if (iconMap[id]) {
    return iconMap[id];
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48" viewBox="0 0 36 48" fill="none">
  <path d="M18 0C8.6 0 1 7.6 1 17c0 11.7 17 31 17 31s17-19.3 17-31C35 7.6 27.4 0 18 0z" fill="${idOrColor}"/>
  <circle cx="18" cy="17" r="6" fill="white"/>
</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

export const markerVariantsForSpecies = (speciesId?: string | null) => {
  const base = markerBaseId(speciesId ?? "other");
  const primary = markerVariants.filter((variant) => variant.baseId === base);
  const secondary = markerVariants.filter((variant) => variant.baseId !== base);
  return {
    primary,
    secondary,
    all: primary.length > 0 ? [...primary, ...secondary] : markerVariants
  };
};

export const firstMarkerVariantId = (speciesId?: string | null) => {
  const { primary, all } = markerVariantsForSpecies(speciesId ?? "other");
  return primary[0]?.id ?? all[0]?.id ?? DEFAULT_MARKER_STYLE.id;
};
