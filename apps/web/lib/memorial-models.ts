import {
  bowlFoodOptions,
  bowlWaterOptions,
  environmentOptions,
  frameLeftOptions,
  frameRightOptions,
  houseOptions,
  matOptions,
  roofOptions,
  signOptions,
  wallOptions
} from "./memorial-options";
import {
  environmentModelByIdGenerated,
  environmentSeasonModelsByIdGenerated,
  houseModelByIdGenerated,
  roofModelByIdGenerated,
  wallModelByIdGenerated,
  signModelByIdGenerated,
  frameLeftModelByIdGenerated,
  frameRightModelByIdGenerated,
  matModelByIdGenerated,
  bowlFoodModelByIdGenerated,
  bowlWaterModelByIdGenerated
} from "./memorial-models.generated";

const environmentModelById: Record<string, string> = environmentModelByIdGenerated;
const environmentSeasonModelsById: Record<string, Record<string, string>> =
  environmentSeasonModelsByIdGenerated as Record<string, Record<string, string>>;
const houseModelById: Record<string, string> = houseModelByIdGenerated;
const roofModelById: Record<string, string> = roofModelByIdGenerated;
const wallModelById: Record<string, string> = wallModelByIdGenerated;
const signModelById: Record<string, string> = signModelByIdGenerated;
const frameLeftModelById: Record<string, string> = frameLeftModelByIdGenerated;
const frameRightModelById: Record<string, string> = frameRightModelByIdGenerated;
const matModelById: Record<string, string> = matModelByIdGenerated;
const bowlFoodModelById: Record<string, string> = bowlFoodModelByIdGenerated;
const bowlWaterModelById: Record<string, string> = bowlWaterModelByIdGenerated;

export const getAllMemorialModelUrls = () => {
  const urls = new Set<string>();
  const add = (value?: string | null) => {
    if (value) {
      urls.add(value);
    }
  };
  Object.values(environmentModelById).forEach(add);
  Object.values(environmentSeasonModelsById).forEach((seasons) => {
    Object.values(seasons ?? {}).forEach(add);
  });
  Object.values(houseModelById).forEach(add);
  Object.values(roofModelById).forEach(add);
  Object.values(wallModelById).forEach(add);
  Object.values(signModelById).forEach(add);
  Object.values(frameLeftModelById).forEach(add);
  Object.values(frameRightModelById).forEach(add);
  Object.values(matModelById).forEach(add);
  Object.values(bowlFoodModelById).forEach(add);
  Object.values(bowlWaterModelById).forEach(add);
  return Array.from(urls.values());
};

const resolveOptionalModel = (map: Record<string, string>, id?: string | null) => {
  if (!id || id === "none") {
    return null;
  }
  return map[id] ?? null;
};

export type SeasonKey = "spring" | "summer" | "autumn" | "winter";

const seasonSuffixes: SeasonKey[] = ["spring", "summer", "autumn", "winter"];

const extractSeasonFromId = (id?: string | null): SeasonKey | null => {
  if (!id) return null;
  const normalized = id.trim().toLowerCase();
  for (const season of seasonSuffixes) {
    if (normalized.endsWith(`_${season}`)) {
      return season;
    }
  }
  return null;
};

const normalizeEnvironmentId = (id?: string | null) => {
  if (!id) return "";
  const normalized = id.trim();
  const lower = normalized.toLowerCase();
  for (const season of seasonSuffixes) {
    const suffix = `_${season}`;
    if (lower.endsWith(suffix)) {
      const base = normalized.slice(0, -suffix.length);
      return base || normalized;
    }
  }
  return normalized;
};

export const getSeasonForDate = (date = new Date()): SeasonKey => {
  const month = date.getMonth();
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "autumn";
  return "winter";
};

export const getEnvironmentSeasons = (id?: string | null): SeasonKey[] => {
  const baseId = normalizeEnvironmentId(id);
  const seasonal = environmentSeasonModelsById[baseId];
  if (!seasonal) {
    return [];
  }
  return seasonSuffixes.filter((season) => seasonal[season]);
};

export const resolveEnvironmentModel = (
  id?: string | null,
  season?: SeasonKey | "auto" | null
) => {
  const baseId = normalizeEnvironmentId(id);
  const seasonal = environmentSeasonModelsById[baseId];
  if (seasonal) {
    const explicitSeason = extractSeasonFromId(id);
    const seasonKey =
      explicitSeason ?? (season === "auto" ? getSeasonForDate() : season ?? "summer");
    return seasonal[seasonKey] ?? seasonal.summer ?? Object.values(seasonal)[0];
  }
  return (
    environmentModelById[id ?? ""] ??
    environmentModelById[environmentOptions[0]?.id ?? ""]
  );
};

export const resolveHouseModel = (id?: string | null) =>
  houseModelById[id ?? ""] ?? houseModelById[houseOptions[0]?.id ?? ""];

export const resolveRoofModel = (id?: string | null) =>
  roofModelById[id ?? ""] ?? roofModelById[roofOptions[0]?.id ?? ""];

export const resolveWallModel = (id?: string | null) =>
  wallModelById[id ?? ""] ?? wallModelById[wallOptions[0]?.id ?? ""];

export const resolveSignModel = (id?: string | null) =>
  resolveOptionalModel(signModelById, id) ?? null;

export const resolveFrameLeftModel = (id?: string | null) =>
  resolveOptionalModel(frameLeftModelById, id) ?? null;

export const resolveFrameRightModel = (id?: string | null) =>
  resolveOptionalModel(frameRightModelById, id) ?? null;

export const resolveMatModel = (id?: string | null) =>
  resolveOptionalModel(matModelById, id) ?? null;

export const resolveBowlFoodModel = (id?: string | null) =>
  resolveOptionalModel(bowlFoodModelById, id) ?? null;

export const resolveBowlWaterModel = (id?: string | null) =>
  resolveOptionalModel(bowlWaterModelById, id) ?? null;
