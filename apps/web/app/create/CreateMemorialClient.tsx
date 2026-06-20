"use client";

import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useGLTF } from "@react-three/drei";
import { useRouter, useSearchParams } from "next/navigation";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ensureDracoLoader } from "../../lib/draco";
import { API_BASE } from "../../lib/config";
import {
  MAP_PREVIEW_CAPTURE_HEIGHT,
  MAP_PREVIEW_CAPTURE_WIDTH,
} from "../../lib/map-preview";
import {
  canAccessAdmin,
  canUseCalibration,
  type AccessLevel,
  type AuthUser,
} from "../../lib/access";
import AuthModal from "../../components/AuthModal";
import {
  getAllMemorialModelUrls,
  getEnvironmentSeasons,
  getSeasonForDate,
  resolveEnvironmentModel,
  resolveHouseModel,
  resolveRoofModel,
  resolveWallModel,
  resolveSignModel,
  resolveFrameLeftModel,
  resolveFrameRightModel,
  resolveMatModel,
  resolveBowlFoodModel,
  resolveBowlWaterModel,
} from "../../lib/memorial-models";
import type { SeasonKey } from "../../lib/memorial-models";
import {
  buildHouseVariantGroup,
  splitHouseVariantId,
} from "../../lib/house-variants";
import { getHouseTextureSwatchBackground } from "../../lib/house-texture-swatches";
import {
  buildHouseLayoutKey,
  getHousePartAdjustment,
  getHouseTransform,
  normalizeTerrainLayoutId,
} from "../../lib/house-layout";
import {
  firstMarkerVariantId,
  markerAnchor,
  markerIconUrl,
  markerSize,
  markerStyleById,
  markerVariants,
  markerStyles,
  markerVariantsForSpecies,
} from "../../lib/markers";
import MemorialPreview, { type DetailPartOverrides } from "./MemorialPreview";
import ErrorToast from "../../components/ErrorToast";
import ConfirmDialog from "../../components/ConfirmDialog";
import usePortraitLayout from "../../components/usePortraitLayout";
import AuthHelpHint from "../../components/AuthHelpHint";
import {
  hudControlButtonClass,
  hudInnerSurfaceClass,
  hudPanelChromeClass,
  hudRoundButtonClass,
  hudTooltipClass,
} from "../../components/hudTheme";
import {
  DEFAULT_SOUL_COLOR,
  SOUL_COLOR_OPTIONS,
  PetSoulPreview,
  buildSoulSettings,
  normalizeSoulColor,
  normalizeSoulPath,
  readSoulSettings,
  type PetSoulMode,
  type PetSoulPath,
} from "../../components/PetSoul";
import {
  getConfiguredHouseSlots,
  getTerrainGiftSlots,
} from "../../lib/memorial-config";
import type { HouseSlots } from "../../lib/memorial-config";
import {
  getGiftAvailableTypes,
  getGiftSlotType,
  resolveGiftModelUrl,
} from "../../lib/gifts";
import { giftModelsGenerated } from "../../lib/gifts.generated";
import {
  bowlFoodOptions as allBowlFoodOptions,
  bowlWaterOptions as allBowlWaterOptions,
  environmentOptions as allEnvironmentOptions,
  filterOptionsForUser,
  frameLeftOptions as allFrameLeftOptions,
  frameRightOptions as allFrameRightOptions,
  houseOptions as allHouseOptions,
  matOptions as allMatOptions,
  roofOptions as allRoofOptions,
  signOptions as allSignOptions,
  wallOptions as allWallOptions,
  type OptionItem,
} from "../../lib/memorial-options";

ensureDracoLoader();

type Step = 0 | 1;

const DEFAULT_LOADING_TIPS = [
  "Создавайте памятные мемориалы — мы бережно сохраняем каждую историю.",
  "Подарки в мемориале помогают показать заботу и любовь.",
  "Вы можете менять оформление мемориала в любое время.",
  "Фотографии питомца можно добавить позже в личном кабинете.",
  "Мы храним данные безопасно и используем резервное копирование.",
];

type FormState = {
  ownerId: string;
  name: string;
  species: string;
  birthDate: string;
  deathDate: string;
  epitaph: string;
  story: string;
  isPublic: boolean;
  lat: string;
  lng: string;
  markerStyle: string;
  environmentId: string;
  environmentSeason: SeasonKey;
  environmentSeasonAuto: boolean;
  houseId: string;
  roofId: string;
  wallId: string;
  signId: string;
  frameLeftId: string;
  frameRightId: string;
  matId: string;
  bowlFoodId: string;
  bowlWaterId: string;
  roofColor: string;
  wallColor: string;
  signColor: string;
  frameLeftColor: string;
  frameRightColor: string;
  matColor: string;
  bowlFoodColor: string;
  bowlWaterColor: string;
  soulColor: string;
  soulPath: SoulPathState;
};

type EditContentSnapshot = {
  name: string;
  species: string;
  birthDate: string;
  deathDate: string;
  epitaph: string;
  story: string;
  isPublic: boolean;
};

type SoulPathPointState = {
  id: string;
  x: number;
  y: number;
  z: number;
  duration: number;
};

type SoulPathState = {
  enabled: boolean;
  returnDuration: number;
  idleDuration: number;
  points: SoulPathPointState[];
};

type DetailTooltipState = {
  id: string;
  name: string;
  description: string;
  left: number;
  top: number;
  width: number;
};

type PhotoDraft = {
  id: string;
  file: File | null;
  persistedId: string | null;
  isObjectUrl: boolean;
  url: string;
};

type EditMemorialPet = {
  id: string;
  ownerId: string;
  name: string;
  species?: string | null;
  birthDate: string | null;
  deathDate: string | null;
  epitaph: string | null;
  story: string | null;
  isPublic: boolean;
  moderationStatus?: "PENDING" | "APPROVED" | "NEEDS_CHANGES" | string;
  moderationComment?: string | null;
  marker?: {
    lat: number;
    lng: number;
    markerStyle?: string | null;
    previewPhotoId?: string | null;
  } | null;
  photos: {
    id: string;
    url: string;
  }[];
  memorial?: {
    environmentId: string | null;
    houseId: string | null;
    sceneJson: Record<string, unknown> | null;
  } | null;
};

type CreateMemorialClientProps = {
  editId?: string | null;
};

type MemorialDraftDto = {
  id: string;
  name: string;
  species?: string | null;
  birthDate?: string | null;
  deathDate?: string | null;
  epitaph?: string | null;
  story?: string | null;
  isPublic?: boolean;
  lat?: number | null;
  lng?: number | null;
  markerStyle?: string | null;
  environmentId?: string | null;
  houseId?: string | null;
  sceneJson?: Record<string, unknown> | null;
  step?: number | null;
};

const MEMORIAL_PLANS = [
  { id: "1y", years: 1, label: "1 год", price: 100 },
  { id: "2y", years: 2, label: "2 года", price: 200 },
  { id: "5y", years: 5, label: "5 лет", price: 500 },
  { id: "lifetime", years: 0, label: "Навсегда", price: 1200 },
] as const;
type MemorialPlanId = (typeof MEMORIAL_PLANS)[number]["id"];
type MemorialPlan = {
  id: MemorialPlanId;
  years: number;
  label: string;
  price: number;
};

const defaultCenter = { lat: 55.751244, lng: 37.618423 };

type Step3TabId =
  | "environment"
  | "house"
  | "roof"
  | "wall"
  | "sign"
  | "frameLeft"
  | "frameRight"
  | "mat"
  | "bowlFood"
  | "bowlWater";

type Step3Tab = {
  id: Step3TabId;
  label: string;
  focusSlot?: string | null;
};

type BuilderOverlayId =
  | "details"
  | "marker"
  | "photos"
  | "story"
  | "base"
  | "soul";
type MarkerPanelTab = "marker" | "map";

type CameraOffset = {
  x: number;
  y: number;
  z: number;
};

const MAX_PHOTOS = 10;
const MAX_PHOTO_SIZE_BYTES = 6 * 1024 * 1024;

const parseDateInputValue = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
};

const formatDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const SEASON_LABELS: Record<SeasonKey, string> = {
  spring: "Весна",
  summer: "Лето",
  autumn: "Осень",
  winter: "Зима",
};
const SEASON_SWATCHES: Record<SeasonKey, { color: string; label: string }> = {
  spring: { color: "#F3A4D8", label: SEASON_LABELS.spring },
  summer: { color: "#6BCB77", label: SEASON_LABELS.summer },
  autumn: { color: "#F2B84B", label: SEASON_LABELS.autumn },
  winter: { color: "#A7D8FF", label: SEASON_LABELS.winter },
};

const STEP3_ICON_CLASS = "h-6 w-6";

const Step3TabIcon = ({ id }: { id: Step3TabId }) => {
  switch (id) {
    case "environment":
      return (
        <svg
          viewBox="0 0 24 24"
          className={STEP3_ICON_CLASS}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="7" cy="7" r="2" />
          <path d="M3 19l6-7 4 5 3-4 5 6" />
        </svg>
      );
    case "house":
      return (
        <svg
          viewBox="0 0 24 24"
          className={STEP3_ICON_CLASS}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 11l9-7 9 7" />
          <path d="M5 10v9h14v-9" />
          <path d="M9 19v-6h6v6" />
        </svg>
      );
    case "roof":
      return (
        <svg
          viewBox="0 0 24 24"
          className={STEP3_ICON_CLASS}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 14l8-7 8 7" />
          <path d="M6 14h12" />
        </svg>
      );
    case "wall":
      return (
        <svg
          viewBox="0 0 24 24"
          className={STEP3_ICON_CLASS}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="4" y="6" width="16" height="12" rx="1.5" />
          <path d="M4 11h16" />
          <path d="M10 6v12" />
        </svg>
      );
    case "sign":
      return (
        <svg
          viewBox="0 0 24 24"
          className={STEP3_ICON_CLASS}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 4v16" />
          <rect x="8" y="6" width="10" height="6" rx="1" />
        </svg>
      );
    case "frameLeft":
      return (
        <svg
          viewBox="0 0 24 24"
          className={STEP3_ICON_CLASS}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="5" y="5" width="14" height="14" rx="2" />
          <path d="M9 5v14" />
        </svg>
      );
    case "frameRight":
      return (
        <svg
          viewBox="0 0 24 24"
          className={STEP3_ICON_CLASS}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="5" y="5" width="14" height="14" rx="2" />
          <path d="M15 5v14" />
        </svg>
      );
    case "mat":
      return (
        <svg
          viewBox="0 0 24 24"
          className={STEP3_ICON_CLASS}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="5" y="6" width="14" height="12" rx="2" />
          <path d="M9 6v12" />
        </svg>
      );
    case "bowlFood":
      return (
        <svg
          viewBox="0 0 24 24"
          className={STEP3_ICON_CLASS}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 11h16" />
          <path d="M6 11l2 6h8l2-6" />
          <circle cx="12" cy="7.5" r="1.5" />
        </svg>
      );
    case "bowlWater":
      return (
        <svg
          viewBox="0 0 24 24"
          className={STEP3_ICON_CLASS}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 4l6 6" />
          <path d="M12 4l-6 6" />
          <path d="M6 10c0 4 3 7 6 7s6-3 6-7" />
        </svg>
      );
    default:
      return null;
  }
};

const BuilderOverlayIcon = ({ id }: { id: BuilderOverlayId }) => {
  switch (id) {
    case "details":
      return (
        <svg
          viewBox="0 0 24 24"
          className={STEP3_ICON_CLASS}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 11l9-7 9 7" />
          <path d="M5 10v9h14v-9" />
          <path d="M9 19v-6h6v6" />
          <path d="M7 6h4" />
        </svg>
      );
    case "soul":
      return (
        <svg
          viewBox="0 0 24 24"
          className={STEP3_ICON_CLASS}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3c1.2 3.4 2.9 5.1 6 6-3.1.9-4.8 2.6-6 6-1.2-3.4-2.9-5.1-6-6 3.1-.9 4.8-2.6 6-6z" />
          <path d="M18 14c.7 1.7 1.6 2.6 3 3-.4.2-2.2.8-3 3-.8-2.2-2.6-2.8-3-3 1.4-.4 2.3-1.3 3-3z" />
        </svg>
      );
    case "base":
      return (
        <svg
          viewBox="0 0 24 24"
          className={STEP3_ICON_CLASS}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5" />
          <circle cx="12" cy="8" r="1" />
        </svg>
      );
    case "story":
      return (
        <svg
          viewBox="0 0 24 24"
          className={STEP3_ICON_CLASS}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 5h8a3 3 0 0 1 3 3v11" />
          <path d="M20 19H10a3 3 0 0 0-3 3V6a3 3 0 0 1 3-3h10z" />
        </svg>
      );
    case "marker":
      return (
        <svg
          viewBox="0 0 24 24"
          className={STEP3_ICON_CLASS}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 21s-6-6.5-6-11a6 6 0 1 1 12 0c0 4.5-6 11-6 11z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );
    case "photos":
      return (
        <svg
          viewBox="0 0 24 24"
          className={STEP3_ICON_CLASS}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="9" cy="11" r="2" />
          <path d="M21 15l-4-4-4 4-3-3-5 5" />
        </svg>
      );
  }
};

const STEP3_TAB_DESCRIPTIONS: Record<Step3TabId, string> = {
  environment: "Выбор покрытия и цвета площадки вокруг домика.",
  house: "Выбор формы домика и его текстуры.",
  roof: "Крыша домика и её цвет.",
  wall: "Стены домика и материалы.",
  sign: "Украшение над входом.",
  frameLeft: "Левая фоторамка у домика.",
  frameRight: "Правая фоторамка у домика.",
  mat: "Коврик перед входом.",
  bowlFood: "Миска с кормом.",
  bowlWater: "Миска с водой.",
};
const colorPalette = [
  "#F36C6C",
  "#F28C6B",
  "#F2B476",
  "#FFD166",
  "#FFE9A5",
  "#9BD1A5",
  "#6FCF97",
  "#8ECAE6",
  "#6FA8DC",
  "#5DADE2",
  "#CDB4DB",
  "#B39DDB",
  "#9B8CCC",
  "#FFFFFF",
  "#6B7280",
  "#F5E6D3",
  "#E9D1B3",
  "#DDBA8E",
  "#CFA06E",
  "#B88753",
  "#A0723F",
  "#8A5E2E",
  "#714A22",
  "#5A3A1B",
  "#422913",
];

const createDefaultSoulPathState = (): SoulPathState => ({
  enabled: false,
  returnDuration: 2.4,
  idleDuration: 2.5,
  points: [
    { id: "point-1", x: -1.15, y: 0.2, z: 0.45, duration: 2.2 },
    { id: "point-2", x: 0.15, y: 0.65, z: 1.1, duration: 2.4 },
    { id: "point-3", x: 1.05, y: 0.28, z: -0.35, duration: 2.2 },
  ],
});

const soulPathStateFromSettings = (
  path?: PetSoulPath | null,
): SoulPathState => {
  const fallback = createDefaultSoulPathState();
  if (!path?.points.length) {
    return fallback;
  }
  return {
    enabled: path.enabled,
    returnDuration: path.returnDuration,
    idleDuration: path.idleDuration,
    points: path.points.map((point, index) => ({
      id: `point-${index + 1}`,
      x: point.x,
      y: point.y,
      z: point.z,
      duration: point.duration,
    })),
  };
};

const soulPathForScene = (state: SoulPathState): PetSoulPath | null =>
  normalizeSoulPath({
    enabled: state.enabled,
    returnDuration: state.returnDuration,
    idleDuration: state.idleDuration,
    points: state.points.map(({ x, y, z, duration }) => ({
      x,
      y,
      z,
      duration,
    })),
  });

const initialState: FormState = {
  ownerId: "",
  name: "",
  species: "dog",
  birthDate: "",
  deathDate: "",
  epitaph: "",
  story: "",
  isPublic: true,
  lat: "",
  lng: "",
  markerStyle: markerStyles[0]?.id ?? "dog",
  environmentId: allEnvironmentOptions[0]?.id ?? "summer",
  environmentSeason: getSeasonForDate(),
  environmentSeasonAuto: false,
  houseId: allHouseOptions[0]?.id ?? "budka_1",
  roofId: allRoofOptions[0]?.id ?? "roof_1",
  wallId: allWallOptions[0]?.id ?? "wall_1",
  signId: allSignOptions[1]?.id ?? "sign_1",
  frameLeftId: allFrameLeftOptions[1]?.id ?? "frame_left_1",
  frameRightId: allFrameRightOptions[1]?.id ?? "frame_right_1",
  matId: allMatOptions[1]?.id ?? "mat_1",
  bowlFoodId: allBowlFoodOptions[1]?.id ?? "bowl_food_1",
  bowlWaterId: allBowlWaterOptions[1]?.id ?? "bowl_water_1",
  roofColor: colorPalette[0] ?? "#F36C6C",
  wallColor: colorPalette[1] ?? "#F2B476",
  signColor: colorPalette[16] ?? "#E9D1B3",
  frameLeftColor: colorPalette[16] ?? "#E9D1B3",
  frameRightColor: colorPalette[16] ?? "#E9D1B3",
  matColor: colorPalette[9] ?? "#5DADE2",
  bowlFoodColor: colorPalette[3] ?? "#FFD166",
  bowlWaterColor: colorPalette[7] ?? "#8ECAE6",
  soulColor: DEFAULT_SOUL_COLOR,
  soulPath: createDefaultSoulPathState(),
};

const SEASON_SUFFIXES: SeasonKey[] = ["spring", "summer", "autumn", "winter"];

const randomArrayItem = <T,>(items: readonly T[]): T | null => {
  if (items.length === 0) {
    return null;
  }
  return items[Math.floor(Math.random() * items.length)] ?? null;
};

const randomOptionId = (options: readonly OptionItem[], fallback: string) =>
  randomArrayItem(options)?.id ?? fallback;

const randomOptionalOptionId = (
  options: readonly OptionItem[],
  fallback: string,
) => {
  const visibleOptions = options.filter((option) => option.id !== "none");
  const noneOption = options.find((option) => option.id === "none");

  if (visibleOptions.length === 0) {
    return noneOption?.id ?? fallback;
  }

  if (noneOption && Math.random() < 0.12) {
    return noneOption.id;
  }

  return randomArrayItem(visibleOptions)?.id ?? fallback;
};

const parseEnvironmentDraft = (
  rawEnvironmentId?: string | null,
): {
  environmentId: string;
  environmentSeason: SeasonKey;
  environmentSeasonAuto: boolean;
} => {
  const value = rawEnvironmentId?.trim() || initialState.environmentId;
  const normalized = value.toLowerCase();
  for (const season of SEASON_SUFFIXES) {
    const suffix = `_${season}`;
    if (normalized.endsWith(suffix)) {
      const baseId = value.slice(0, -suffix.length) || value;
      return {
        environmentId: baseId,
        environmentSeason: season,
        environmentSeasonAuto: false,
      };
    }
  }
  return {
    environmentId: value,
    environmentSeason: getSeasonForDate(),
    environmentSeasonAuto: true,
  };
};

const buildEditFormState = (
  pet: EditMemorialPet,
  ownerId: string,
): FormState => {
  const memorial = pet.memorial;
  const marker = pet.marker;
  const sceneJson =
    memorial?.sceneJson &&
    typeof memorial.sceneJson === "object" &&
    !Array.isArray(memorial.sceneJson)
      ? memorial.sceneJson
      : {};
  const parts =
    sceneJson.parts &&
    typeof sceneJson.parts === "object" &&
    !Array.isArray(sceneJson.parts)
      ? (sceneJson.parts as Record<string, unknown>)
      : {};
  const colors =
    sceneJson.colors &&
    typeof sceneJson.colors === "object" &&
    !Array.isArray(sceneJson.colors)
      ? (sceneJson.colors as Record<string, unknown>)
      : {};
  const soul = readSoulSettings(sceneJson);
  const environmentDraft = parseEnvironmentDraft(
    memorial?.environmentId ?? null,
  );
  const pickId = (key: string, fallback: string) =>
    typeof parts[key] === "string" && parts[key]
      ? String(parts[key])
      : fallback;
  const pickColor = (key: string, fallback: string) =>
    typeof colors[key] === "string" && colors[key]
      ? String(colors[key])
      : fallback;

  return {
    ownerId,
    name: pet.name ?? "",
    species: pet.species ?? initialState.species,
    birthDate: pet.birthDate ? pet.birthDate.slice(0, 10) : "",
    deathDate: pet.deathDate ? pet.deathDate.slice(0, 10) : "",
    epitaph: pet.epitaph ?? "",
    story: pet.story ?? "",
    isPublic: pet.isPublic,
    lat:
      typeof marker?.lat === "number" && !Number.isNaN(marker.lat)
        ? marker.lat.toFixed(6)
        : "",
    lng:
      typeof marker?.lng === "number" && !Number.isNaN(marker.lng)
        ? marker.lng.toFixed(6)
        : "",
    markerStyle:
      marker?.markerStyle ??
      firstMarkerVariantId(pet.species ?? initialState.species),
    environmentId: environmentDraft.environmentId,
    environmentSeason: environmentDraft.environmentSeason,
    environmentSeasonAuto: environmentDraft.environmentSeasonAuto,
    houseId: memorial?.houseId ?? initialState.houseId,
    roofId: pickId("roof", initialState.roofId),
    wallId: pickId("wall", initialState.wallId),
    signId: pickId("sign", initialState.signId),
    frameLeftId: pickId("frameLeft", initialState.frameLeftId),
    frameRightId: pickId("frameRight", initialState.frameRightId),
    matId: pickId("mat", initialState.matId),
    bowlFoodId: pickId("bowlFood", initialState.bowlFoodId),
    bowlWaterId: pickId("bowlWater", initialState.bowlWaterId),
    roofColor: pickColor("roof_paint", initialState.roofColor),
    wallColor: pickColor("wall_paint", initialState.wallColor),
    signColor: pickColor("sign_paint", initialState.signColor),
    frameLeftColor: pickColor("frame_left_paint", initialState.frameLeftColor),
    frameRightColor: pickColor(
      "frame_right_paint",
      initialState.frameRightColor,
    ),
    matColor: pickColor("mat_paint", initialState.matColor),
    bowlFoodColor: pickColor("bowl_food_paint", initialState.bowlFoodColor),
    bowlWaterColor: pickColor("bowl_water_paint", initialState.bowlWaterColor),
    soulColor: soul.color,
    soulPath: soulPathStateFromSettings(soul.path),
  };
};

const buildEditContentSnapshot = (state: FormState): EditContentSnapshot => ({
  name: state.name.trim(),
  species: state.species,
  birthDate: state.birthDate,
  deathDate: state.deathDate,
  epitaph: state.epitaph.trim(),
  story: state.story.trim(),
  isPublic: state.isPublic,
});

const buildDraftFormState = (
  draft: MemorialDraftDto,
  ownerId: string,
): FormState => {
  const sceneJson =
    draft.sceneJson &&
    typeof draft.sceneJson === "object" &&
    !Array.isArray(draft.sceneJson)
      ? draft.sceneJson
      : {};
  const parts =
    sceneJson.parts &&
    typeof sceneJson.parts === "object" &&
    !Array.isArray(sceneJson.parts)
      ? (sceneJson.parts as Record<string, unknown>)
      : {};
  const colors =
    sceneJson.colors &&
    typeof sceneJson.colors === "object" &&
    !Array.isArray(sceneJson.colors)
      ? (sceneJson.colors as Record<string, unknown>)
      : {};
  const soul = readSoulSettings(sceneJson);
  const environmentDraft = parseEnvironmentDraft(draft.environmentId ?? null);
  const pickId = (key: string, fallback: string) =>
    typeof parts[key] === "string" && parts[key]
      ? String(parts[key])
      : fallback;
  const pickColor = (key: string, fallback: string) =>
    typeof colors[key] === "string" && colors[key]
      ? String(colors[key])
      : fallback;

  return {
    ownerId,
    name: draft.name ?? "",
    species: draft.species ?? initialState.species,
    birthDate: draft.birthDate ? draft.birthDate.slice(0, 10) : "",
    deathDate: draft.deathDate ? draft.deathDate.slice(0, 10) : "",
    epitaph: draft.epitaph ?? "",
    story: draft.story ?? "",
    isPublic: draft.isPublic ?? true,
    lat:
      typeof draft.lat === "number" && !Number.isNaN(draft.lat)
        ? draft.lat.toFixed(6)
        : "",
    lng:
      typeof draft.lng === "number" && !Number.isNaN(draft.lng)
        ? draft.lng.toFixed(6)
        : "",
    markerStyle:
      draft.markerStyle ??
      firstMarkerVariantId(draft.species ?? initialState.species),
    environmentId: environmentDraft.environmentId,
    environmentSeason: environmentDraft.environmentSeason,
    environmentSeasonAuto: environmentDraft.environmentSeasonAuto,
    houseId: draft.houseId ?? initialState.houseId,
    roofId: pickId("roof", initialState.roofId),
    wallId: pickId("wall", initialState.wallId),
    signId: pickId("sign", initialState.signId),
    frameLeftId: pickId("frameLeft", initialState.frameLeftId),
    frameRightId: pickId("frameRight", initialState.frameRightId),
    matId: pickId("mat", initialState.matId),
    bowlFoodId: pickId("bowlFood", initialState.bowlFoodId),
    bowlWaterId: pickId("bowlWater", initialState.bowlWaterId),
    roofColor: pickColor("roof_paint", initialState.roofColor),
    wallColor: pickColor("wall_paint", initialState.wallColor),
    signColor: pickColor("sign_paint", initialState.signColor),
    frameLeftColor: pickColor("frame_left_paint", initialState.frameLeftColor),
    frameRightColor: pickColor(
      "frame_right_paint",
      initialState.frameRightColor,
    ),
    matColor: pickColor("mat_paint", initialState.matColor),
    bowlFoodColor: pickColor("bowl_food_paint", initialState.bowlFoodColor),
    bowlWaterColor: pickColor("bowl_water_paint", initialState.bowlWaterColor),
    soulColor: soul.color,
    soulPath: soulPathStateFromSettings(soul.path),
  };
};

export default function CreateMemorialClient({
  editId = null,
}: CreateMemorialClientProps) {
  const isPortraitLayout = usePortraitLayout();
  const isEditMode = Boolean(editId);
  const [step, setStep] = useState<Step>(isEditMode ? 1 : 0);
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [editReady, setEditReady] = useState(!isEditMode);
  const [accessLevel, setAccessLevel] = useState<AccessLevel>("USER");
  const [currentUserLogin, setCurrentUserLogin] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpVisible, setTopUpVisible] = useState(false);
  const [topUpCurrency, setTopUpCurrency] = useState<"RUB" | "USD">("RUB");
  const [topUpPlan, setTopUpPlan] = useState<number | null>(null);
  const [memorialPlanId, setMemorialPlanId] = useState<MemorialPlanId>("1y");
  const [memorialPlans, setMemorialPlans] = useState<MemorialPlan[]>(() =>
    MEMORIAL_PLANS.map((plan) => ({ ...plan })),
  );
  const [detectedHouseSlots, setDetectedHouseSlots] =
    useState<HouseSlots | null>(null);
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);
  const [previewPhotoId, setPreviewPhotoId] = useState<string | null>(null);
  const photosRef = useRef<PhotoDraft[]>([]);
  const birthDateInputRef = useRef<HTMLInputElement | null>(null);
  const deathDateInputRef = useRef<HTMLInputElement | null>(null);
  const [markerCategory, setMarkerCategory] = useState(form.species);
  const [focusSlot, setFocusSlot] = useState<string | null>(null);
  const [cameraFocusKey, setCameraFocusKey] = useState<string | null>(null);
  const [focusRequestId, setFocusRequestId] = useState(0);
  const [hoveredOption, setHoveredOption] = useState<{
    category: string;
    id: string;
  } | null>(null);
  const [detailTooltip, setDetailTooltip] = useState<DetailTooltipState | null>(
    null,
  );
  const hoverIntentRef = useRef<{ category: string; id: string } | null>(null);
  const [tooltipTabId, setTooltipTabId] = useState<Step3TabId | null>(null);
  const tooltipTimerRef = useRef<number | null>(null);
  const [, setAssetsReady] = useState(false);
  const assetsLoadStartedRef = useRef(false);
  const gltfLoaderRef = useRef<GLTFLoader | null>(null);
  const gltfLoadCacheRef = useRef<Map<string, Promise<void>>>(new Map());
  const gltfQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [giftPreviewEnabled, setGiftPreviewEnabled] = useState(false);
  const [showMeterGrid, setShowMeterGrid] = useState(false);
  const [mapPreviewCaptureWithoutGifts, setMapPreviewCaptureWithoutGifts] =
    useState(false);
  const [soulSceneMode, setSoulSceneMode] = useState<PetSoulMode>("idle");
  const [soulPreviewReady, setSoulPreviewReady] = useState(isEditMode);
  const [hoveredSoulColor, setHoveredSoulColor] = useState<string | null>(null);
  const [customSoulPickerOpen, setCustomSoulPickerOpen] = useState(false);
  const [soulColorTab, setSoulColorTab] = useState<"standard" | "custom">(
    "standard",
  );
  const [farewellPlaying, setFarewellPlaying] = useState(false);
  const [detectedGiftSlots, setDetectedGiftSlots] = useState<string[] | null>(
    null,
  );
  const previewControlsRef = useRef<any>(null);
  const sceneDismissPointerRef = useRef<{
    x: number;
    y: number;
    pointerId: number | null;
  } | null>(null);
  const previewRenderRef = useRef<{
    gl: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.Camera;
  } | null>(null);
  const [activeOverlay, setActiveOverlay] = useState<BuilderOverlayId | null>(
    "details",
  );
  const [markerPanelTab, setMarkerPanelTab] =
    useState<MarkerPanelTab>("marker");
  const [visitedOverlays, setVisitedOverlays] = useState({
    details: true,
    marker: false,
    photos: false,
    story: false,
    base: false,
    soul: false,
  });

  useEffect(() => {
    if (step !== 0 || soulPreviewReady) {
      return;
    }
    const timeout = window.setTimeout(() => setSoulPreviewReady(true), 5000);
    return () => window.clearTimeout(timeout);
  }, [step, soulPreviewReady]);
  const handleBuilderScenePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!activeOverlay || farewellPlaying) {
        sceneDismissPointerRef.current = null;
        return;
      }

      sceneDismissPointerRef.current = {
        x: event.clientX,
        y: event.clientY,
        pointerId: typeof event.pointerId === "number" ? event.pointerId : null,
      };
    },
    [activeOverlay, farewellPlaying],
  );
  const handleBuilderScenePointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const start = sceneDismissPointerRef.current;
      sceneDismissPointerRef.current = null;

      if (!start || !activeOverlay || farewellPlaying) {
        return;
      }

      if (start.pointerId !== null && event.pointerId !== start.pointerId) {
        return;
      }

      const movedDistance = Math.hypot(
        event.clientX - start.x,
        event.clientY - start.y,
      );
      if (movedDistance <= 5) {
        setActiveOverlay(null);
      }
    },
    [activeOverlay, farewellPlaying],
  );
  const handleBuilderScenePointerCancel = useCallback(() => {
    sceneDismissPointerRef.current = null;
  }, []);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [reviewAttempted, setReviewAttempted] = useState(false);
  const [publishModerationConfirmOpen, setPublishModerationConfirmOpen] =
    useState(false);
  const [editModerationConfirmOpen, setEditModerationConfirmOpen] =
    useState(false);
  const [editModerationStatus, setEditModerationStatus] = useState<
    string | null
  >(null);
  const [initialPreviewPhotoId, setInitialPreviewPhotoId] = useState<
    string | null
  >(null);
  const editInitialContentRef = useRef<EditContentSnapshot | null>(null);
  const [mobileBuilderMenuOpen, setMobileBuilderMenuOpen] = useState(false);
  const [mobileBuilderMenuVisible, setMobileBuilderMenuVisible] =
    useState(false);
  const [mobileBuilderActionsOpen, setMobileBuilderActionsOpen] =
    useState(false);
  const [mobileBuilderActionsVisible, setMobileBuilderActionsVisible] =
    useState(false);
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const [authPromptVisible, setAuthPromptVisible] = useState(false);
  const [authPromptPurpose, setAuthPromptPurpose] = useState<
    "publish" | "draft"
  >("publish");
  const [pendingPublishAfterAuth, setPendingPublishAfterAuth] = useState(false);
  const [pendingDraftAfterAuth, setPendingDraftAfterAuth] = useState(false);
  const [pendingDraftRedirectHref, setPendingDraftRedirectHref] = useState<
    string | null
  >(null);
  const [leaveConfirmHref, setLeaveConfirmHref] = useState<string | null>(null);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(isEditMode);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const loadingProgressRef = useRef<number | null>(null);
  const editInitialPreloadDoneRef = useRef(false);
  const [loadingTips, setLoadingTips] =
    useState<string[]>(DEFAULT_LOADING_TIPS);
  const [loadingTipIndex, setLoadingTipIndex] = useState(0);
  const loadingTipTimerRef = useRef<number | null>(null);
  const [housePlacementOverrides, setHousePlacementOverrides] = useState<
    Record<string, { x: number; z: number; rotY: number }>
  >({});
  const [houseScaleOverrides, setHouseScaleOverrides] = useState<
    Record<string, number>
  >({});
  const [detailPartOverrides, setDetailPartOverrides] =
    useState<DetailPartOverrides>({});
  const [cameraOffsetAdjustments] = useState<Record<string, CameraOffset>>({
    dom_slot_environment: { x: 0.75, y: 4.94, z: 8.85 },
    dom_slot_house: { x: 2.11, y: 2.94, z: 3.3 },
    sign_slot: { x: 0, y: 0, z: 2.85 },
  });

  const router = useRouter();
  const searchParams = useSearchParams();
  const draftIdFromUrl = searchParams.get("draft");
  const apiUrl = useMemo(() => API_BASE, []);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const { isLoaded, loadError } = useJsApiLoader({ googleMapsApiKey: apiKey });
  const makeLocalPhotoId = useCallback(
    () =>
      crypto.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    [],
  );
  const normalizePhotoUrl = useCallback(
    (url: string) => (url.startsWith("http") ? url : `${apiUrl}${url}`),
    [apiUrl],
  );
  const revokePhotoUrl = useCallback((photo: PhotoDraft) => {
    if (photo.isObjectUrl) {
      URL.revokeObjectURL(photo.url);
    }
  }, []);
  const openAuthPrompt = useCallback((purpose: "publish" | "draft") => {
    setAuthPromptPurpose(purpose);
    setAuthPromptOpen(true);
    requestAnimationFrame(() => setAuthPromptVisible(true));
  }, []);
  const closeAuthPrompt = useCallback(() => {
    setAuthPromptVisible(false);
    setTimeout(() => setAuthPromptOpen(false), 200);
  }, []);
  const hasDraftContent = useMemo(
    () =>
      !isEditMode &&
      (form.name.trim() ||
        form.birthDate ||
        form.deathDate ||
        form.epitaph.trim() ||
        form.story.trim() ||
        form.lat.trim() ||
        form.lng.trim() ||
        photos.length > 0 ||
        step > 0),
    [
      form.birthDate,
      form.deathDate,
      form.epitaph,
      form.lat,
      form.lng,
      form.name,
      form.story,
      isEditMode,
      photos.length,
      step,
    ],
  );

  useEffect(() => {
    let isMounted = true;
    const loadMemorialPlans = async () => {
      try {
        const response = await fetch(`${apiUrl}/pricing/memorial-plans`);
        if (!response.ok) {
          return;
        }
        const rows = (await response.json()) as {
          years?: number;
          price?: number;
        }[];
        const priceByYears = new Map(
          rows
            .filter(
              (row) =>
                typeof row.years === "number" && typeof row.price === "number",
            )
            .map((row) => [row.years as number, row.price as number]),
        );
        if (!isMounted || priceByYears.size === 0) {
          return;
        }
        setMemorialPlans((prev) =>
          prev.map((plan) => ({
            ...plan,
            price: priceByYears.get(plan.years) ?? plan.price,
          })),
        );
      } catch {
        // Keep bundled fallback prices when pricing endpoint is unavailable.
      }
    };
    void loadMemorialPlans();
    return () => {
      isMounted = false;
    };
  }, [apiUrl]);

  useEffect(() => {
    let isMounted = true;
    const loadTips = async () => {
      try {
        const response = await fetch(`${apiUrl}/content/loading-tips`, {
          credentials: "include",
        });
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as { tips?: { text?: string }[] };
        const nextTips = Array.isArray(data.tips)
          ? data.tips
              .map((tip) =>
                typeof tip.text === "string" ? tip.text.trim() : "",
              )
              .filter(Boolean)
          : [];
        if (isMounted && nextTips.length > 0) {
          setLoadingTips(nextTips);
          setLoadingTipIndex(0);
        }
      } catch {
        // Keep fallback tips.
      }
    };
    void loadTips();
    return () => {
      isMounted = false;
    };
  }, [apiUrl]);

  useEffect(() => {
    if (!isTransitioning || loadingTips.length <= 1) {
      if (loadingTipTimerRef.current) {
        window.clearInterval(loadingTipTimerRef.current);
        loadingTipTimerRef.current = null;
      }
      return;
    }
    setLoadingTipIndex(0);
    loadingTipTimerRef.current = window.setInterval(() => {
      setLoadingTipIndex((prev) => (prev + 1) % loadingTips.length);
    }, 10000);
    return () => {
      if (loadingTipTimerRef.current) {
        window.clearInterval(loadingTipTimerRef.current);
        loadingTipTimerRef.current = null;
      }
    };
  }, [isTransitioning, loadingTips.length]);

  const hasCoords = form.lat.trim() !== "" && form.lng.trim() !== "";
  const lat = hasCoords ? Number(form.lat) : undefined;
  const lng = hasCoords ? Number(form.lng) : undefined;
  const canShowMarker =
    typeof lat === "number" &&
    typeof lng === "number" &&
    !Number.isNaN(lat) &&
    !Number.isNaN(lng);
  const mapCenter = canShowMarker ? { lat: lat!, lng: lng! } : defaultCenter;

  const selectedMarker = markerStyleById(form.markerStyle);
  const markerIconId =
    form.markerStyle === "other" ? "other" : form.markerStyle;
  const markerPreviewSize = markerSize(form.markerStyle, 43);
  const markerPreviewAnchor = markerAnchor(form.markerStyle, 43);
  useEffect(() => {
    setMarkerCategory(form.species);
  }, [form.species]);
  const markerGroups = useMemo(
    () => markerVariantsForSpecies(markerCategory),
    [markerCategory],
  );
  const environmentOptions = useMemo(
    () => filterOptionsForUser(allEnvironmentOptions, currentUserLogin),
    [currentUserLogin],
  );
  const houseOptions = useMemo(
    () => filterOptionsForUser(allHouseOptions, currentUserLogin),
    [currentUserLogin],
  );
  const roofOptions = useMemo(
    () => filterOptionsForUser(allRoofOptions, currentUserLogin),
    [currentUserLogin],
  );
  const wallOptions = useMemo(
    () => filterOptionsForUser(allWallOptions, currentUserLogin),
    [currentUserLogin],
  );
  const signOptions = useMemo(
    () => filterOptionsForUser(allSignOptions, currentUserLogin),
    [currentUserLogin],
  );
  const frameLeftOptions = useMemo(
    () => filterOptionsForUser(allFrameLeftOptions, currentUserLogin),
    [currentUserLogin],
  );
  const frameRightOptions = useMemo(
    () => filterOptionsForUser(allFrameRightOptions, currentUserLogin),
    [currentUserLogin],
  );
  const matOptions = useMemo(
    () => filterOptionsForUser(allMatOptions, currentUserLogin),
    [currentUserLogin],
  );
  const bowlFoodOptions = useMemo(
    () => filterOptionsForUser(allBowlFoodOptions, currentUserLogin),
    [currentUserLogin],
  );
  const bowlWaterOptions = useMemo(
    () => filterOptionsForUser(allBowlWaterOptions, currentUserLogin),
    [currentUserLogin],
  );
  const memorialPlan = useMemo(
    () =>
      memorialPlans.find((plan) => plan.id === memorialPlanId) ??
      memorialPlans[0] ??
      MEMORIAL_PLANS[0],
    [memorialPlanId, memorialPlans],
  );
  const memorialPrice = memorialPlan.price;
  const environmentSeasons = useMemo(
    () => getEnvironmentSeasons(form.environmentId),
    [form.environmentId],
  );
  const houseVariantGroup = useMemo(
    () => buildHouseVariantGroup(houseOptions),
    [houseOptions],
  );
  useEffect(() => {
    const firstId = (options: OptionItem[]) => options[0]?.id ?? "";
    setForm((prev) => {
      const nextEnvironmentId = environmentOptions.some(
        (option) => option.id === prev.environmentId,
      )
        ? prev.environmentId
        : firstId(environmentOptions);
      const nextHouseId = houseOptions.some(
        (option) => option.id === prev.houseId,
      )
        ? prev.houseId
        : firstId(houseOptions);
      const nextRoofId = roofOptions.some((option) => option.id === prev.roofId)
        ? prev.roofId
        : firstId(roofOptions);
      const nextWallId = wallOptions.some((option) => option.id === prev.wallId)
        ? prev.wallId
        : firstId(wallOptions);
      const nextSignId = signOptions.some((option) => option.id === prev.signId)
        ? prev.signId
        : firstId(signOptions);
      const nextFrameLeftId = frameLeftOptions.some(
        (option) => option.id === prev.frameLeftId,
      )
        ? prev.frameLeftId
        : firstId(frameLeftOptions);
      const nextFrameRightId = frameRightOptions.some(
        (option) => option.id === prev.frameRightId,
      )
        ? prev.frameRightId
        : firstId(frameRightOptions);
      const nextMatId = matOptions.some((option) => option.id === prev.matId)
        ? prev.matId
        : firstId(matOptions);
      const nextBowlFoodId = bowlFoodOptions.some(
        (option) => option.id === prev.bowlFoodId,
      )
        ? prev.bowlFoodId
        : firstId(bowlFoodOptions);
      const nextBowlWaterId = bowlWaterOptions.some(
        (option) => option.id === prev.bowlWaterId,
      )
        ? prev.bowlWaterId
        : firstId(bowlWaterOptions);

      if (
        nextEnvironmentId === prev.environmentId &&
        nextHouseId === prev.houseId &&
        nextRoofId === prev.roofId &&
        nextWallId === prev.wallId &&
        nextSignId === prev.signId &&
        nextFrameLeftId === prev.frameLeftId &&
        nextFrameRightId === prev.frameRightId &&
        nextMatId === prev.matId &&
        nextBowlFoodId === prev.bowlFoodId &&
        nextBowlWaterId === prev.bowlWaterId
      ) {
        return prev;
      }

      return {
        ...prev,
        environmentId: nextEnvironmentId,
        houseId: nextHouseId,
        roofId: nextRoofId,
        wallId: nextWallId,
        signId: nextSignId,
        frameLeftId: nextFrameLeftId,
        frameRightId: nextFrameRightId,
        matId: nextMatId,
        bowlFoodId: nextBowlFoodId,
        bowlWaterId: nextBowlWaterId,
      };
    });
  }, [
    bowlFoodOptions,
    bowlWaterOptions,
    environmentOptions,
    frameLeftOptions,
    frameRightOptions,
    houseOptions,
    matOptions,
    roofOptions,
    signOptions,
    wallOptions,
  ]);
  const selectedHouseVariant = splitHouseVariantId(form.houseId);
  const selectedHouseBaseId =
    selectedHouseVariant.baseId ||
    houseVariantGroup.baseOptions[0]?.id ||
    form.houseId;
  const selectedTerrainLayoutId = normalizeTerrainLayoutId(form.environmentId);
  const selectedHouseLayoutKey = buildHouseLayoutKey(
    selectedTerrainLayoutId,
    selectedHouseBaseId,
  );
  const houseBaseOptions = houseVariantGroup.baseOptions;
  const houseTextureOptions =
    houseVariantGroup.textureOptionsByBase[selectedHouseBaseId] ?? [];
  const defaultHouseTransform = useMemo(
    () => getHouseTransform(selectedHouseBaseId, selectedTerrainLayoutId),
    [selectedHouseBaseId, selectedTerrainLayoutId],
  );
  const activeHousePlacement = housePlacementOverrides[
    selectedHouseLayoutKey
  ] ?? {
    x: defaultHouseTransform.offsetX,
    z: defaultHouseTransform.offsetZ,
    rotY: defaultHouseTransform.rotationY,
  };
  const activeHouseScale =
    houseScaleOverrides[selectedHouseLayoutKey] ?? defaultHouseTransform.scale;
  const activeSoulPath = useMemo(
    () => soulPathForScene(form.soulPath),
    [form.soulPath],
  );
  const soulPathTotalDuration = useMemo(
    () =>
      form.soulPath.points.reduce(
        (total, point) =>
          total + (Number.isFinite(point.duration) ? point.duration : 0),
        0,
      ),
    [form.soulPath.points],
  );
  const soulPathExportJson = useMemo(() => {
    const enabledPath = soulPathForScene({ ...form.soulPath, enabled: true });
    return JSON.stringify(
      enabledPath ?? { enabled: false, points: [] },
      null,
      2,
    );
  }, [form.soulPath]);
  const updateHousePlacement = useCallback(
    (patch: Partial<{ x: number; z: number; rotY: number }>) => {
      if (!selectedHouseLayoutKey) {
        return;
      }
      setHousePlacementOverrides((prev) => ({
        ...prev,
        [selectedHouseLayoutKey]: {
          x: defaultHouseTransform.offsetX,
          z: defaultHouseTransform.offsetZ,
          rotY: defaultHouseTransform.rotationY,
          ...(prev[selectedHouseLayoutKey] ?? {}),
          ...patch,
        },
      }));
    },
    [
      defaultHouseTransform.offsetX,
      defaultHouseTransform.offsetZ,
      defaultHouseTransform.rotationY,
      selectedHouseLayoutKey,
    ],
  );
  const updateHouseScale = useCallback(
    (value: number) => {
      if (!selectedHouseLayoutKey) {
        return;
      }
      setHouseScaleOverrides((prev) => ({
        ...prev,
        [selectedHouseLayoutKey]: value,
      }));
    },
    [selectedHouseLayoutKey],
  );
  const updateSoulPath = useCallback(
    (patch: Partial<Omit<SoulPathState, "points">>) => {
      setForm((prev) => ({
        ...prev,
        soulPath: {
          ...prev.soulPath,
          ...patch,
        },
      }));
    },
    [],
  );
  const updateSoulPathPoint = useCallback(
    (id: string, patch: Partial<Omit<SoulPathPointState, "id">>) => {
      setForm((prev) => ({
        ...prev,
        soulPath: {
          ...prev.soulPath,
          points: prev.soulPath.points.map((point) =>
            point.id === id ? { ...point, ...patch } : point,
          ),
        },
      }));
    },
    [],
  );
  const updateSoulPathTotalDuration = useCallback((value: number) => {
    if (!Number.isFinite(value) || value <= 0) {
      return;
    }
    setForm((prev) => {
      const pointsCount = prev.soulPath.points.length;
      if (pointsCount === 0) {
        return prev;
      }
      const safeTotal = Math.max(0.2 * pointsCount, value);
      const currentTotal = prev.soulPath.points.reduce(
        (total, point) =>
          total + (Number.isFinite(point.duration) ? point.duration : 0),
        0,
      );
      const nextPoints =
        currentTotal > 0
          ? prev.soulPath.points.map((point) => ({
              ...point,
              duration: Number(
                Math.max(
                  0.2,
                  point.duration * (safeTotal / currentTotal),
                ).toFixed(2),
              ),
            }))
          : prev.soulPath.points.map((point) => ({
              ...point,
              duration: Number((safeTotal / pointsCount).toFixed(2)),
            }));
      return {
        ...prev,
        soulPath: {
          ...prev.soulPath,
          points: nextPoints,
        },
      };
    });
  }, []);
  const addSoulPathPoint = useCallback(() => {
    setForm((prev) => {
      if (prev.soulPath.points.length >= 12) {
        return prev;
      }
      const lastPoint = prev.soulPath.points[prev.soulPath.points.length - 1];
      return {
        ...prev,
        soulPath: {
          ...prev.soulPath,
          points: [
            ...prev.soulPath.points,
            {
              id: `point-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              x: lastPoint ? Number((lastPoint.x + 0.35).toFixed(2)) : 0,
              y: lastPoint?.y ?? 0.25,
              z: lastPoint ? Number((lastPoint.z - 0.35).toFixed(2)) : 0.4,
              duration: lastPoint?.duration ?? 2,
            },
          ],
        },
      };
    });
  }, []);
  const removeSoulPathPoint = useCallback((id: string) => {
    setForm((prev) => {
      if (prev.soulPath.points.length <= 1) {
        return prev;
      }
      return {
        ...prev,
        soulPath: {
          ...prev.soulPath,
          points: prev.soulPath.points.filter((point) => point.id !== id),
        },
      };
    });
  }, []);
  const hoveredId = (category: string) =>
    hoveredOption?.category === category ? hoveredOption.id : null;
  const environmentPreviewId = hoveredId("environment") ?? form.environmentId;
  const environmentPreviewSeason = form.environmentSeasonAuto
    ? "auto"
    : form.environmentSeason;
  const hoveredHouseVariantId = hoveredId("house-texture");
  const hoveredHouseBaseId = hoveredId("house-base");
  const housePreviewId =
    hoveredHouseVariantId ??
    (hoveredHouseBaseId
      ? (houseVariantGroup.defaultVariantByBase[hoveredHouseBaseId] ??
        hoveredHouseBaseId)
      : null) ??
    form.houseId;
  const previewHouseVariant = splitHouseVariantId(housePreviewId);
  const previewHouseBaseId =
    previewHouseVariant.baseId ||
    hoveredHouseBaseId ||
    selectedHouseBaseId ||
    housePreviewId;
  const previewTerrainLayoutId = normalizeTerrainLayoutId(environmentPreviewId);
  const previewHouseLayoutKey = buildHouseLayoutKey(
    previewTerrainLayoutId,
    previewHouseBaseId,
  );
  const previewHouseTransform = useMemo(
    () => getHouseTransform(previewHouseBaseId, previewTerrainLayoutId),
    [previewHouseBaseId, previewTerrainLayoutId],
  );
  const previewHousePlacement = housePlacementOverrides[
    previewHouseLayoutKey
  ] ?? {
    x: previewHouseTransform.offsetX,
    z: previewHouseTransform.offsetZ,
    rotY: previewHouseTransform.rotationY,
  };
  const previewHouseScale =
    houseScaleOverrides[previewHouseLayoutKey] ?? previewHouseTransform.scale;
  const roofPreviewId = hoveredId("roof") ?? form.roofId;
  const wallPreviewId = hoveredId("wall") ?? form.wallId;
  const signPreviewId = hoveredId("sign") ?? form.signId;
  const frameLeftPreviewId = hoveredId("frame-left") ?? form.frameLeftId;
  const frameRightPreviewId = hoveredId("frame-right") ?? form.frameRightId;
  const matPreviewId = hoveredId("mat") ?? form.matId;
  const bowlFoodPreviewId = hoveredId("bowl-food") ?? form.bowlFoodId;
  const bowlWaterPreviewId = hoveredId("bowl-water") ?? form.bowlWaterId;
  const resolveHoverModelUrl = useCallback(
    (category: string, id: string) => {
      if (!id || id === "none") {
        return null;
      }
      switch (category) {
        case "environment":
          return resolveEnvironmentModel(id, environmentPreviewSeason);
        case "house-base": {
          const variant = houseVariantGroup.defaultVariantByBase[id] ?? id;
          return resolveHouseModel(variant);
        }
        case "house-texture":
          return resolveHouseModel(id);
        case "roof":
          return resolveRoofModel(id);
        case "wall":
          return resolveWallModel(id);
        case "sign":
          return resolveSignModel(id);
        case "frame-left":
          return resolveFrameLeftModel(id);
        case "frame-right":
          return resolveFrameRightModel(id);
        case "mat":
          return resolveMatModel(id);
        case "bowl-food":
          return resolveBowlFoodModel(id);
        case "bowl-water":
          return resolveBowlWaterModel(id);
        default:
          return null;
      }
    },
    [environmentPreviewSeason, houseVariantGroup.defaultVariantByBase],
  );
  const selectedIdForCategory = useCallback(
    (category: string) => {
      switch (category) {
        case "environment":
          return form.environmentId;
        case "house-base":
          return selectedHouseBaseId;
        case "house-texture":
          return form.houseId;
        case "roof":
          return form.roofId;
        case "wall":
          return form.wallId;
        case "sign":
          return form.signId;
        case "frame-left":
          return form.frameLeftId;
        case "frame-right":
          return form.frameRightId;
        case "mat":
          return form.matId;
        case "bowl-food":
          return form.bowlFoodId;
        case "bowl-water":
          return form.bowlWaterId;
        default:
          return null;
      }
    },
    [
      form.bowlFoodId,
      form.bowlWaterId,
      form.environmentId,
      form.frameLeftId,
      form.frameRightId,
      form.houseId,
      form.matId,
      form.roofId,
      form.signId,
      form.wallId,
      selectedHouseBaseId,
    ],
  );
  const environmentUrl = resolveEnvironmentModel(
    environmentPreviewId,
    environmentPreviewSeason,
  );
  const houseUrl = resolveHouseModel(housePreviewId);
  const configuredHouseSlots = getConfiguredHouseSlots(housePreviewId);
  const houseSlots: Partial<HouseSlots> =
    detectedHouseSlots ?? configuredHouseSlots ?? {};
  const terrainGiftSlots = useMemo(
    () => detectedGiftSlots ?? getTerrainGiftSlots(environmentPreviewId),
    [detectedGiftSlots, environmentPreviewId],
  );
  const previewGiftCandidates = useMemo(
    () => Object.keys(giftModelsGenerated),
    [],
  );
  const previewGiftAssignmentsRef = useRef(
    new Map<string, { code: string; resolveType: string }>(),
  );
  const previewGiftCodesByType = useMemo(() => {
    const map = new Map<string, string[]>();
    previewGiftCandidates.forEach((code) => {
      getGiftAvailableTypes({ code }).forEach((type) => {
        const items = map.get(type) ?? [];
        items.push(code);
        map.set(type, items);
      });
    });
    return map;
  }, [previewGiftCandidates]);
  const previewGifts = useMemo(() => {
    if (!giftPreviewEnabled) {
      return [];
    }
    if (terrainGiftSlots.length === 0) {
      return [];
    }
    return terrainGiftSlots
      .map((slot) => {
        const slotType = getGiftSlotType(slot);
        if (!slotType) {
          return null;
        }
        const assignmentKey = `${slot}:${slotType}`;
        let assignment = previewGiftAssignmentsRef.current.get(assignmentKey);
        if (!assignment) {
          const candidates =
            slotType === "default"
              ? previewGiftCandidates
              : (previewGiftCodesByType.get(slotType) ?? []);
          const code =
            candidates[Math.floor(Math.random() * candidates.length)] ?? null;
          const resolveType =
            code && slotType === "default"
              ? (getGiftAvailableTypes({ code })[0] ?? null)
              : slotType;
          if (code && resolveType) {
            assignment = { code, resolveType };
            previewGiftAssignmentsRef.current.set(assignmentKey, assignment);
          }
        }
        if (!assignment) {
          return null;
        }
        const url = resolveGiftModelUrl({
          gift: { code: assignment.code },
          slotType: assignment.resolveType,
          fallbackUrl: null,
        });
        if (!url) {
          return null;
        }
        return { slot, url, name: "Подарок" };
      })
      .filter((gift): gift is { slot: string; url: string; name: string } =>
        Boolean(gift),
      );
  }, [
    giftPreviewEnabled,
    previewGiftCodesByType,
    previewGiftCandidates,
    terrainGiftSlots,
  ]);
  const previewPlaceholderSlots = useMemo(() => {
    if (!giftPreviewEnabled) {
      return [];
    }
    const filled = new Set(previewGifts.map((gift) => gift.slot));
    return terrainGiftSlots.filter((slot) => !filled.has(slot));
  }, [giftPreviewEnabled, previewGifts, terrainGiftSlots]);
  const [activeStep3Tab, setActiveStep3Tab] =
    useState<Step3TabId>("environment");
  const step3Tabs = useMemo<Step3Tab[]>(() => {
    const tabs: Step3Tab[] = [
      { id: "environment", label: "Поверхность", focusSlot: "dom_slot" },
      { id: "house", label: "Домик", focusSlot: "dom_slot" },
    ];
    if (houseSlots.roof) tabs.push({ id: "roof", label: "Крыша" });
    if (houseSlots.wall) tabs.push({ id: "wall", label: "Стены" });
    if (houseSlots.sign) tabs.push({ id: "sign", label: "Украшение" });
    if (houseSlots.frameLeft)
      tabs.push({ id: "frameLeft", label: "Рамка слева" });
    if (houseSlots.frameRight)
      tabs.push({ id: "frameRight", label: "Рамка справа" });
    if (houseSlots.mat) tabs.push({ id: "mat", label: "Коврик" });
    if (houseSlots.bowlFood)
      tabs.push({ id: "bowlFood", label: "Миска (еда)" });
    if (houseSlots.bowlWater)
      tabs.push({ id: "bowlWater", label: "Миска (вода)" });
    return tabs;
  }, [houseSlots]);
  const randomizeMemorialModels = useCallback(() => {
    const nextEnvironmentId = randomOptionId(
      environmentOptions,
      initialState.environmentId,
    );
    const nextEnvironmentSeasons = getEnvironmentSeasons(nextEnvironmentId);
    const nextEnvironmentSeason =
      randomArrayItem(nextEnvironmentSeasons) ?? getSeasonForDate();
    const nextHouseBase = randomArrayItem(houseBaseOptions);
    const nextHouseTextureOptions = nextHouseBase
      ? (houseVariantGroup.textureOptionsByBase[nextHouseBase.id] ?? [])
      : [];
    const nextDefaultHouseVariantId = nextHouseBase
      ? (houseVariantGroup.defaultVariantByBase[nextHouseBase.id] ??
        nextHouseBase.id)
      : null;
    const nextHouseId =
      randomArrayItem(nextHouseTextureOptions)?.id ??
      nextDefaultHouseVariantId ??
      randomOptionId(houseOptions, initialState.houseId);

    const nextFormPatch: Pick<
      FormState,
      | "environmentId"
      | "environmentSeason"
      | "environmentSeasonAuto"
      | "houseId"
      | "roofId"
      | "wallId"
      | "signId"
      | "frameLeftId"
      | "frameRightId"
      | "matId"
      | "bowlFoodId"
      | "bowlWaterId"
    > = {
      environmentId: nextEnvironmentId,
      environmentSeason: nextEnvironmentSeason,
      environmentSeasonAuto: false,
      houseId: nextHouseId,
      roofId: randomOptionId(roofOptions, initialState.roofId),
      wallId: randomOptionId(wallOptions, initialState.wallId),
      signId: randomOptionalOptionId(signOptions, initialState.signId),
      frameLeftId: randomOptionalOptionId(
        frameLeftOptions,
        initialState.frameLeftId,
      ),
      frameRightId: randomOptionalOptionId(
        frameRightOptions,
        initialState.frameRightId,
      ),
      matId: randomOptionalOptionId(matOptions, initialState.matId),
      bowlFoodId: randomOptionalOptionId(
        bowlFoodOptions,
        initialState.bowlFoodId,
      ),
      bowlWaterId: randomOptionalOptionId(
        bowlWaterOptions,
        initialState.bowlWaterId,
      ),
    };

    hoverIntentRef.current = null;
    previewGiftAssignmentsRef.current.clear();
    setHoveredOption(null);
    setDetailTooltip(null);
    setTooltipTabId(null);
    setFocusSlot(null);
    setCameraFocusKey(null);
    setDetectedGiftSlots(null);
    setDetectedHouseSlots(getConfiguredHouseSlots(nextHouseId));
    setActiveOverlay("details");
    setActiveStep3Tab("environment");
    setForm((prev) => ({
      ...prev,
      ...nextFormPatch,
    }));
  }, [
    bowlFoodOptions,
    bowlWaterOptions,
    environmentOptions,
    frameLeftOptions,
    frameRightOptions,
    houseBaseOptions,
    houseOptions,
    houseVariantGroup.defaultVariantByBase,
    houseVariantGroup.textureOptionsByBase,
    matOptions,
    roofOptions,
    signOptions,
    wallOptions,
  ]);
  const step3TabBySlot = useMemo(() => {
    const mapping = new Map<string, Step3TabId>();
    if (houseSlots.roof) mapping.set(houseSlots.roof, "roof");
    if (houseSlots.wall) mapping.set(houseSlots.wall, "wall");
    if (houseSlots.sign) mapping.set(houseSlots.sign, "sign");
    if (houseSlots.frameLeft) mapping.set(houseSlots.frameLeft, "frameLeft");
    if (houseSlots.frameRight) mapping.set(houseSlots.frameRight, "frameRight");
    if (houseSlots.mat) mapping.set(houseSlots.mat, "mat");
    if (houseSlots.bowlFood) mapping.set(houseSlots.bowlFood, "bowlFood");
    if (houseSlots.bowlWater) mapping.set(houseSlots.bowlWater, "bowlWater");
    return mapping;
  }, [houseSlots]);
  const activeDetailSlot = useMemo(() => {
    switch (activeStep3Tab) {
      case "roof":
        return houseSlots.roof ?? null;
      case "wall":
        return houseSlots.wall ?? null;
      case "sign":
        return houseSlots.sign ?? null;
      case "frameLeft":
        return houseSlots.frameLeft ?? null;
      case "frameRight":
        return houseSlots.frameRight ?? null;
      case "mat":
        return houseSlots.mat ?? null;
      case "bowlFood":
        return houseSlots.bowlFood ?? null;
      case "bowlWater":
        return houseSlots.bowlWater ?? null;
      default:
        return null;
    }
  }, [activeStep3Tab, houseSlots]);
  const getCameraFocusKey = (
    slot: string | null,
    tabId: Step3TabId = activeStep3Tab,
  ) => {
    if (!slot) {
      return null;
    }
    if (tabId === "environment") {
      return "dom_slot_environment";
    }
    if (tabId === "house") {
      return "dom_slot_house";
    }
    return slot;
  };
  const activeCameraKey = cameraFocusKey;
  const roofUrl = resolveRoofModel(roofPreviewId);
  const wallUrl = resolveWallModel(wallPreviewId);
  const signUrl = resolveSignModel(signPreviewId);
  const frameLeftUrl = resolveFrameLeftModel(frameLeftPreviewId);
  const frameRightUrl = resolveFrameRightModel(frameRightPreviewId);
  const matUrl = resolveMatModel(matPreviewId);
  const bowlFoodUrl = resolveBowlFoodModel(bowlFoodPreviewId);
  const bowlWaterUrl = resolveBowlWaterModel(bowlWaterPreviewId);
  const partList = [
    houseSlots.roof ? { slot: houseSlots.roof, url: roofUrl } : null,
    houseSlots.wall ? { slot: houseSlots.wall, url: wallUrl } : null,
    houseSlots.sign ? { slot: houseSlots.sign, url: signUrl } : null,
    houseSlots.frameLeft
      ? { slot: houseSlots.frameLeft, url: frameLeftUrl }
      : null,
    houseSlots.frameRight
      ? { slot: houseSlots.frameRight, url: frameRightUrl }
      : null,
    houseSlots.mat ? { slot: houseSlots.mat, url: matUrl } : null,
    houseSlots.bowlFood
      ? { slot: houseSlots.bowlFood, url: bowlFoodUrl }
      : null,
    houseSlots.bowlWater
      ? { slot: houseSlots.bowlWater, url: bowlWaterUrl }
      : null,
  ].filter((part): part is { slot: string; url: string } =>
    Boolean(part && part.url),
  );
  const currentDetailPartOverrides = useMemo(() => {
    const overrides: DetailPartOverrides = {};
    partList.forEach((part) => {
      const override =
        detailPartOverrides[`${form.houseId}::${part.slot}`] ??
        detailPartOverrides[`${selectedHouseBaseId}::${part.slot}`];
      if (override) {
        overrides[part.slot] = override;
      }
    });
    return overrides;
  }, [detailPartOverrides, form.houseId, partList, selectedHouseBaseId]);
  const previewDetailPartOverrides = useMemo(() => {
    const overrides: DetailPartOverrides = {};
    partList.forEach((part) => {
      const override =
        detailPartOverrides[`${housePreviewId}::${part.slot}`] ??
        detailPartOverrides[`${previewHouseBaseId}::${part.slot}`];
      if (override) {
        overrides[part.slot] = override;
      }
    });
    return overrides;
  }, [detailPartOverrides, housePreviewId, partList, previewHouseBaseId]);
  const colorOverrides = {
    roof_paint: form.roofColor,
    wall_paint: form.wallColor,
    sign_paint: form.signColor,
    frame_left_paint: form.frameLeftColor,
    frame_right_paint: form.frameRightColor,
    mat_paint: form.matColor,
    bowl_food_paint: form.bowlFoodColor,
    bowl_water_paint: form.bowlWaterColor,
  };
  const activeDetailOverrideKey = activeDetailSlot
    ? `${form.houseId}::${activeDetailSlot}`
    : null;
  const activeDetailFallbackOverrideKey = activeDetailSlot
    ? `${selectedHouseBaseId}::${activeDetailSlot}`
    : null;
  const defaultActiveDetailOverride = useMemo(() => {
    const adjustment = activeDetailSlot
      ? getHousePartAdjustment(form.houseId, activeDetailSlot) ??
        getHousePartAdjustment(selectedHouseBaseId, activeDetailSlot)
      : null;
    return {
      scale: adjustment?.scale ?? 1,
      rotationY: adjustment?.rotationY ?? 0,
      position: {
        x: adjustment?.position.x ?? 0,
        y: adjustment?.position.y ?? 0,
        z: adjustment?.position.z ?? 0,
      },
    };
  }, [activeDetailSlot, form.houseId, selectedHouseBaseId]);
  const activeDetailOverride =
    (activeDetailOverrideKey
      ? detailPartOverrides[activeDetailOverrideKey]
      : null) ??
    (activeDetailFallbackOverrideKey
      ? detailPartOverrides[activeDetailFallbackOverrideKey]
      : null) ??
    defaultActiveDetailOverride;
  const updateActiveDetailOverride = useCallback(
    (
      patch: Partial<{
        scale: number;
        rotationY: number;
        position: Partial<{ x: number; y: number; z: number }>;
      }>,
    ) => {
      if (!activeDetailSlot) {
        return;
      }
      const key = `${form.houseId}::${activeDetailSlot}`;
      const fallbackKey = `${selectedHouseBaseId}::${activeDetailSlot}`;
      setDetailPartOverrides((previous) => {
        const current =
          previous[key] ?? previous[fallbackKey] ?? defaultActiveDetailOverride;
        return {
          ...previous,
          [key]: {
            scale: patch.scale ?? current.scale,
            rotationY: patch.rotationY ?? current.rotationY ?? 0,
            position: {
              ...current.position,
              ...(patch.position ?? {}),
            },
          },
        };
      });
    },
    [
      activeDetailSlot,
      defaultActiveDetailOverride,
      form.houseId,
      selectedHouseBaseId,
    ],
  );
  const resetActiveDetailOverride = useCallback(() => {
    if (!activeDetailSlot) {
      return;
    }
    const key = `${form.houseId}::${activeDetailSlot}`;
    setDetailPartOverrides((previous) => {
      const next = { ...previous };
      delete next[key];
      return next;
    });
  }, [activeDetailSlot, form.houseId]);
  const detailCalibrationJson = useMemo(() => {
    const grouped: Record<
      string,
      Record<
        string,
	        {
	          scale: number;
	          rotationY?: number;
	          position: { x: number; y: number; z: number };
	        }
      >
    > = {};
    Object.entries(detailPartOverrides).forEach(([key, value]) => {
      const separatorIndex = key.indexOf("::");
      if (separatorIndex < 0) {
        return;
      }
      const houseId = key.slice(0, separatorIndex);
      const slot = key.slice(separatorIndex + 2);
      if (!houseId || !slot) {
        return;
      }
      grouped[houseId] = grouped[houseId] ?? {};
	      grouped[houseId][slot] = {
	        scale: Number(value.scale.toFixed(3)),
	        ...(Number.isFinite(value.rotationY) && Math.abs(value.rotationY ?? 0) > 0.0005
	          ? { rotationY: Number((value.rotationY ?? 0).toFixed(2)) }
	          : {}),
	        position: {
          x: Number(value.position.x.toFixed(3)),
          y: Number(value.position.y.toFixed(3)),
          z: Number(value.position.z.toFixed(3)),
        },
      };
    });
    return JSON.stringify(grouped, null, 2);
  }, [detailPartOverrides]);
  const copyDetailCalibrationJson = useCallback(() => {
    if (!navigator.clipboard) {
      setDraftNotice("JSON можно скопировать из поля ниже.");
      return;
    }
    void navigator.clipboard
      .writeText(detailCalibrationJson)
      .then(() => setDraftNotice("JSON калибровки скопирован."))
      .catch(() => setDraftNotice("JSON можно скопировать из поля ниже."));
  }, [detailCalibrationJson]);
  const currentEnvironmentId = form.environmentSeasonAuto
    ? form.environmentId
    : `${form.environmentId}_${form.environmentSeason}`;
  const buildCurrentSceneJson = useCallback(
    () => ({
      parts: {
        roof: form.roofId,
        wall: form.wallId,
        sign: form.signId,
        frameLeft: form.frameLeftId,
        frameRight: form.frameRightId,
        mat: form.matId,
        bowlFood: form.bowlFoodId,
        bowlWater: form.bowlWaterId,
      },
      colors: {
        roof_paint: form.roofColor,
        wall_paint: form.wallColor,
        sign_paint: form.signColor,
        frame_left_paint: form.frameLeftColor,
        frame_right_paint: form.frameRightColor,
        mat_paint: form.matColor,
        bowl_food_paint: form.bowlFoodColor,
        bowl_water_paint: form.bowlWaterColor,
      },
      soul: buildSoulSettings(form.soulColor, activeSoulPath),
      version: 3,
    }),
    [
      activeSoulPath,
      form.bowlFoodColor,
      form.bowlFoodId,
      form.bowlWaterColor,
      form.bowlWaterId,
      form.frameLeftColor,
      form.frameLeftId,
      form.frameRightColor,
      form.frameRightId,
      form.matColor,
      form.matId,
      form.roofColor,
      form.roofId,
      form.signColor,
      form.signId,
      form.soulColor,
      form.wallColor,
      form.wallId,
    ],
  );
  const soulPreviewColor = hoveredSoulColor ?? form.soulColor;
  const selectedSoulColorIsPreset = SOUL_COLOR_OPTIONS.some(
    (option) => option.color.toLowerCase() === form.soulColor.toLowerCase(),
  );
  const customSoulColorValue = normalizeSoulColor(form.soulColor);

  const applySoulColor = (value: string) => {
    const normalized = normalizeSoulColor(value, form.soulColor);
    setForm((prev) => ({ ...prev, soulColor: normalized }));
    setHoveredSoulColor(normalized);
  };

  const renderSoulColorControls = (compact = false) => {
    const swatchClass = compact ? "h-10 w-10" : "h-9 w-9";
    const standardPalette = (
      <div className="relative flex flex-wrap items-center gap-2">
        {SOUL_COLOR_OPTIONS.map((option) => {
          const isSelected =
            form.soulColor.toLowerCase() === option.color.toLowerCase();
          const isPreviewed =
            soulPreviewColor.toLowerCase() === option.color.toLowerCase();
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => applySoulColor(option.color)}
              onMouseEnter={() => setHoveredSoulColor(option.color)}
              onMouseLeave={() => setHoveredSoulColor(null)}
              onFocus={() => setHoveredSoulColor(option.color)}
              onBlur={() => setHoveredSoulColor(null)}
              className={`${swatchClass} rounded-full border transition ${
                isSelected
                  ? "border-[#5d4037] ring-2 ring-[#3bceac]/60"
                  : isPreviewed
                    ? "border-[#d3a27f] ring-2 ring-[#d3a27f]/30"
                    : "border-white hover:scale-105 hover:border-[#d3a27f]"
              }`}
              style={{ backgroundColor: option.color }}
              aria-label={option.name}
              title={option.name}
            />
          );
        })}
      </div>
    );

    if (compact) {
      return (
        <div className="relative grid gap-2">
          <div className="grid grid-cols-2 gap-1 rounded-2xl border border-[#eadfd9] bg-[#f7f1ee] p-1">
            {(
              [
                ["standard", "Стандартные"],
                ["custom", "Свой цвет"],
              ] as const
            ).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                onClick={() => setSoulColorTab(tab)}
                className={`rounded-xl px-2 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] transition ${
                  soulColorTab === tab
                    ? "bg-[#111827] text-white shadow-[0_3px_0_0_#000]"
                    : "bg-[#fffcf9] text-[#8d6e63]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {soulColorTab === "standard" ? (
            standardPalette
          ) : (
            <div className="grid gap-3 rounded-2xl bg-[#f7f1ee] p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8d6e63]">
                  Свой цвет
                </span>
                <span
                  className="h-9 w-9 rounded-full border-2 border-white shadow-inner"
                  style={{ backgroundColor: customSoulColorValue }}
                />
              </div>
              <input
                type="color"
                value={customSoulColorValue}
                onInput={(event) => applySoulColor(event.currentTarget.value)}
                onChange={(event) => applySoulColor(event.currentTarget.value)}
                className="h-14 w-full min-w-0 cursor-pointer rounded-2xl border-2 border-white bg-[#fffcf9] p-1 shadow-inner"
                aria-label="Выбрать свой цвет души"
              />
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="relative grid gap-2">
        <div
          className={
            compact
              ? overlayLabelClass
              : "text-[10px] font-black uppercase tracking-[0.2em] text-[#8d6e63]"
          }
        >
          Цвет души
        </div>
        <div className="relative flex flex-wrap items-center gap-2">
          {standardPalette}
          <button
            type="button"
            onClick={() => setCustomSoulPickerOpen((open) => !open)}
            onMouseEnter={() => setHoveredSoulColor(customSoulColorValue)}
            onMouseLeave={() => setHoveredSoulColor(null)}
            onFocus={() => setHoveredSoulColor(customSoulColorValue)}
            onBlur={() => setHoveredSoulColor(null)}
            className={`inline-flex h-10 items-center gap-2 rounded-full border bg-[#fffcf9] px-3 text-[10px] font-black uppercase tracking-[0.12em] text-[#5d4037] shadow-[0_10px_22px_-18px_rgba(93,64,55,0.5)] transition hover:-translate-y-0.5 ${
              !selectedSoulColorIsPreset
                ? "border-[#5d4037] ring-2 ring-[#3bceac]/60"
                : "border-white hover:border-[#d3a27f]"
            }`}
            aria-expanded={customSoulPickerOpen}
          >
            <span
              className="h-5 w-5 rounded-full border border-white shadow-inner"
              style={{ backgroundColor: customSoulColorValue }}
            />
            Свой
          </button>
          {customSoulPickerOpen ? (
            <div
              className={`absolute z-[260] w-[min(16rem,calc(100vw-2rem))] rounded-[18px] border-[3px] border-white bg-white/96 p-3 shadow-[0_18px_40px_-22px_rgba(93,64,55,0.55)] backdrop-blur ${compact ? "bottom-[calc(100%+0.6rem)] left-0" : "right-0 top-[calc(100%+0.6rem)]"}`}
            >
              <label className="grid gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#8d6e63]">
                Палитра
                <input
                  type="color"
                  value={customSoulColorValue}
                  onInput={(event) => applySoulColor(event.currentTarget.value)}
                  onChange={(event) =>
                    applySoulColor(event.currentTarget.value)
                  }
                  className="h-11 w-full min-w-[10rem] cursor-pointer rounded-2xl border-2 border-white bg-[#f6efea]/92 p-1 shadow-inner"
                  aria-label="Выбрать свой цвет души"
                />
              </label>
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    hoverIntentRef.current = null;
    setHoveredOption(null);
  }, [step]);

  const clearStep3TooltipTimer = () => {
    if (tooltipTimerRef.current !== null) {
      window.clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearStep3TooltipTimer();
    };
  }, []);

  useEffect(() => {
    setDetectedHouseSlots(getConfiguredHouseSlots(form.houseId));
  }, [form.houseId]);

  useEffect(() => {
    setDetectedGiftSlots(null);
  }, [form.environmentId]);

  useEffect(() => {
    if (environmentSeasons.length === 0) {
      return;
    }
    if (!environmentSeasons.includes(form.environmentSeason)) {
      setForm((prev) => ({
        ...prev,
        environmentSeason: environmentSeasons[0] ?? getSeasonForDate(),
      }));
    }
  }, [environmentSeasons, form.environmentSeason]);

  useEffect(() => {
    if (step3Tabs.length === 0) {
      return;
    }
    if (!step3Tabs.some((tab) => tab.id === activeStep3Tab)) {
      setActiveStep3Tab(step3Tabs[0]!.id);
    }
  }, [step3Tabs, activeStep3Tab]);

  const requestFocus = (
    slot: string | null,
    tabId: Step3TabId = activeStep3Tab,
  ) => {
    setFocusSlot(slot);
    setCameraFocusKey(getCameraFocusKey(slot, tabId));
    setFocusRequestId((prev) => prev + 1);
  };

  const openTopUp = () => {
    setTopUpOpen(true);
    requestAnimationFrame(() => setTopUpVisible(true));
  };

  const closeTopUp = () => {
    setTopUpVisible(false);
    setTimeout(() => setTopUpOpen(false), 180);
  };

  const handleStep3TabSelect = (tab: Step3Tab) => {
    setActiveOverlay(null);
    clearStep3TooltipTimer();
    setTooltipTabId(null);
    setActiveStep3Tab(tab.id);
    if (tab.id === "environment" || tab.id === "house") {
      requestFocus(tab.focusSlot ?? null, tab.id);
    }
  };

  const handleMobileDetailsTabSelect = (tab: Step3Tab) => {
    clearStep3TooltipTimer();
    setTooltipTabId(null);
    setActiveOverlay("details");
    setActiveStep3Tab(tab.id);
    if (tab.id === "environment" || tab.id === "house") {
      requestFocus(tab.focusSlot ?? null, tab.id);
    }
  };

  const handlePreviewDetailClick = (detail: {
    slot?: string;
    area?: "environment" | "house";
  }) => {
    if (detail.slot) {
      const tabId = step3TabBySlot.get(detail.slot);
      if (tabId) {
        if (isPortraitLayout) {
          setActiveOverlay("details");
        }
        setActiveStep3Tab(tabId);
        return;
      }
    }
    if (detail.area === "environment") {
      setActiveStep3Tab("environment");
      requestFocus("dom_slot", "environment");
      return;
    }
    if (detail.area === "house") {
      setActiveStep3Tab("house");
      requestFocus("dom_slot", "house");
    }
  };

  const topUpOptions = [
    { coins: 100, rub: 99, usd: 1.49 },
    { coins: 300, rub: 299, usd: 3.99 },
    { coins: 800, rub: 399, usd: 4.99 },
    { coins: 2000, rub: 1799, usd: 22.99 },
  ];

  const fetchWalletBalance = useCallback(async () => {
    if (!form.ownerId) {
      return;
    }
    setWalletLoading(true);
    try {
      const response = await fetch(`${apiUrl}/wallet/${form.ownerId}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Не удалось загрузить баланс");
      }
      const data = (await response.json()) as { coinBalance: number };
      setWalletBalance(
        typeof data.coinBalance === "number" ? data.coinBalance : null,
      );
    } catch {
      setWalletBalance(null);
    } finally {
      setWalletLoading(false);
    }
  }, [apiUrl, form.ownerId]);

  useEffect(() => {
    const loadMe = async () => {
      try {
        const response = await fetch(`${apiUrl}/auth/me`, {
          credentials: "include",
        });
        if (!response.ok) {
          if (isEditMode) {
            router.replace("/auth");
          } else {
            setCurrentUserLogin(null);
            setAccessLevel("USER");
          }
          return;
        }
        const data = (await response.json()) as {
          id: string;
          login?: string | null;
          accessLevel?: AccessLevel;
        };
        if (isEditMode && editId) {
          const petResponse = await fetch(`${apiUrl}/pets/${editId}`, {
            credentials: "include",
          });
          if (!petResponse.ok) {
            router.replace(`/pets/${editId}`);
            return;
          }
          const pet = (await petResponse.json()) as EditMemorialPet;
          if (pet.ownerId !== data.id && !canAccessAdmin(data.accessLevel)) {
            router.replace(`/pets/${editId}`);
            return;
          }
          if (!pet.memorial) {
            router.replace(`/pets/${editId}`);
            return;
          }
          const nextPhotos = Array.isArray(pet.photos)
            ? pet.photos.map((photo) => ({
                id: photo.id,
                file: null,
                persistedId: photo.id,
                isObjectUrl: false,
                url: normalizePhotoUrl(photo.url),
              }))
            : [];
          const nextPreviewPhotoId =
            pet.marker?.previewPhotoId &&
            nextPhotos.some((photo) => photo.id === pet.marker?.previewPhotoId)
              ? pet.marker.previewPhotoId
              : (nextPhotos[0]?.id ?? null);
          const nextForm = buildEditFormState(pet, data.id);
          editInitialContentRef.current = buildEditContentSnapshot(nextForm);
          setForm(nextForm);
          setPhotos(nextPhotos);
          setRemovedPhotoIds([]);
          setPreviewPhotoId(nextPreviewPhotoId);
          setInitialPreviewPhotoId(nextPreviewPhotoId);
          setEditModerationStatus(pet.moderationStatus ?? "APPROVED");
          setStep(1);
          setActiveStep3Tab("house");
          setActiveOverlay("details");
          requestFocus("dom_slot");
          setVisitedOverlays({
            details: true,
            marker: true,
            photos: true,
            story: true,
            base: true,
            soul: true,
          });
          setEditReady(true);
        } else {
          setForm((prev) =>
            prev.ownerId ? prev : { ...prev, ownerId: data.id },
          );
        }
        setCurrentUserLogin(data.login ?? null);
        setAccessLevel(data.accessLevel ?? "USER");
      } catch {
        if (!isEditMode) {
          setCurrentUserLogin(null);
          setAccessLevel("USER");
        } else if (editId) {
          router.replace(`/pets/${editId}`);
        } else {
          router.replace("/my-pets");
        }
      } finally {
        setAuthReady(true);
        if (!isEditMode) {
          setEditReady(true);
        }
      }
    };
    loadMe();
  }, [apiUrl, editId, isEditMode, normalizePhotoUrl, router]);

  useEffect(() => {
    if (!form.ownerId) {
      return;
    }
    void fetchWalletBalance();
  }, [fetchWalletBalance, form.ownerId]);

  useEffect(() => {
    if (isEditMode || !draftIdFromUrl || !authReady) {
      return;
    }
    if (!form.ownerId.trim()) {
      openAuthPrompt("draft");
      return;
    }
    let isMounted = true;
    const loadDraft = async () => {
      setDraftLoading(true);
      try {
        const response = await fetch(
          `${apiUrl}/pets/drafts/${encodeURIComponent(draftIdFromUrl)}`,
          { credentials: "include" },
        );
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || "Не удалось загрузить черновик");
        }
        const draft = (await response.json()) as MemorialDraftDto;
        if (!isMounted) {
          return;
        }
        photosRef.current.forEach((photo) => revokePhotoUrl(photo));
        setForm((prev) => buildDraftFormState(draft, prev.ownerId));
        setPhotos([]);
        setRemovedPhotoIds([]);
        setPreviewPhotoId(null);
        setStep(draft.step === 0 ? 0 : 1);
        setCurrentDraftId(draft.id);
        setDraftNotice(null);
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Не удалось загрузить черновик",
          );
        }
      } finally {
        if (isMounted) {
          setDraftLoading(false);
        }
      }
    };
    void loadDraft();
    return () => {
      isMounted = false;
    };
  }, [
    apiUrl,
    authReady,
    draftIdFromUrl,
    form.ownerId,
    isEditMode,
    openAuthPrompt,
    revokePhotoUrl,
  ]);

  const saveCurrentDraft = useCallback(
    async (options?: { redirectToMyPets?: boolean }) => {
      if (isEditMode) {
        return null;
      }
      if (!form.ownerId.trim()) {
        setPendingDraftAfterAuth(true);
        openAuthPrompt("draft");
        return null;
      }
      setDraftLoading(true);
      try {
        const response = await fetch(`${apiUrl}/pets/drafts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            id: currentDraftId ?? undefined,
            name: form.name.trim() || "Новый мемориал",
            species: form.species,
            birthDate: form.birthDate || undefined,
            deathDate: form.deathDate || undefined,
            epitaph: form.epitaph.trim() || undefined,
            story: form.story.trim() || undefined,
            isPublic: form.isPublic,
            lat: canShowMarker ? lat : undefined,
            lng: canShowMarker ? lng : undefined,
            markerStyle: form.markerStyle,
            environmentId: currentEnvironmentId,
            houseId: form.houseId,
            step,
            sceneJson: buildCurrentSceneJson(),
          }),
        });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || "Не удалось сохранить черновик");
        }
        const saved = (await response.json()) as MemorialDraftDto;
        setCurrentDraftId(saved.id);
        setDraftNotice(
          "Черновик сохранён. Фотографии сохраняются только при публикации.",
        );
        if (options?.redirectToMyPets !== false) {
          window.setTimeout(() => router.push("/my-pets"), 700);
        }
        return saved.id;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Не удалось сохранить черновик",
        );
        return null;
      } finally {
        setDraftLoading(false);
      }
    },
    [
      apiUrl,
      buildCurrentSceneJson,
      canShowMarker,
      currentDraftId,
      currentEnvironmentId,
      form.birthDate,
      form.deathDate,
      form.epitaph,
      form.houseId,
      form.isPublic,
      form.markerStyle,
      form.name,
      form.ownerId,
      form.species,
      form.story,
      isEditMode,
      lat,
      lng,
      openAuthPrompt,
      router,
      step,
    ],
  );

  useEffect(() => {
    if (!hasDraftContent) {
      return;
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasDraftContent]);

  useEffect(() => {
    if (!hasDraftContent || isEditMode) {
      return;
    }
    const handleLinkClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const link = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (
        !link ||
        link.target === "_blank" ||
        link.origin !== window.location.origin
      ) {
        return;
      }
      if (
        link.pathname === window.location.pathname &&
        link.search === window.location.search
      ) {
        return;
      }
      event.preventDefault();
      setLeaveConfirmHref(`${link.pathname}${link.search}${link.hash}`);
    };
    document.addEventListener("click", handleLinkClick, true);
    return () => {
      document.removeEventListener("click", handleLinkClick, true);
    };
  }, [hasDraftContent, isEditMode]);

  const closeLeaveConfirm = useCallback(() => {
    setLeaveConfirmHref(null);
  }, []);

  const continueWithoutDraft = useCallback(() => {
    if (!leaveConfirmHref) {
      return;
    }
    const href = leaveConfirmHref;
    setLeaveConfirmHref(null);
    router.push(href);
  }, [leaveConfirmHref, router]);

  const saveDraftBeforeNavigation = useCallback(() => {
    if (!leaveConfirmHref) {
      return;
    }
    const href = leaveConfirmHref;
    setLeaveConfirmHref(null);
    if (!form.ownerId.trim()) {
      setPendingDraftRedirectHref(href);
      setPendingDraftAfterAuth(true);
      openAuthPrompt("draft");
      return;
    }
    void saveCurrentDraft({ redirectToMyPets: false }).then((savedId) => {
      if (savedId) {
        router.push(href);
      }
    });
  }, [
    form.ownerId,
    leaveConfirmHref,
    openAuthPrompt,
    router,
    saveCurrentDraft,
  ]);

  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => revokePhotoUrl(photo));
    };
  }, [revokePhotoUrl]);

  useEffect(() => {
    if (step !== 1) {
      setFocusSlot(null);
    }
  }, [step]);

  useEffect(() => {
    if (photos.length === 0) {
      if (previewPhotoId !== null) {
        setPreviewPhotoId(null);
      }
      return;
    }
    if (
      !previewPhotoId ||
      !photos.some((photo) => photo.id === previewPhotoId)
    ) {
      setPreviewPhotoId(photos[0]?.id ?? null);
    }
  }, [photos, previewPhotoId]);

  useEffect(() => {
    if (step === 0) {
      setActiveOverlay(null);
      setReviewOpen(false);
      setReviewVisible(false);
    }
  }, [step]);

  const today = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  const dateValidationMessage = useMemo(() => {
    const birth = form.birthDate ? parseDateInputValue(form.birthDate) : null;
    const death = form.deathDate ? parseDateInputValue(form.deathDate) : null;
    if (form.birthDate && !birth) {
      return "Проверь дату рождения";
    }
    if (form.deathDate && !death) {
      return "Проверь дату ухода";
    }
    if (birth && birth > today) {
      return "Дата рождения не может быть позже текущей даты";
    }
    if (death && death > today) {
      return "Дата ухода не может быть позже текущей даты";
    }
    if (birth && death && birth > death) {
      return "Дата рождения должна быть не позже даты ухода";
    }
    return null;
  }, [form.birthDate, form.deathDate, today]);
  const hasRequiredDateError =
    reviewAttempted && (!form.birthDate.trim() || !form.deathDate.trim());
  const hasDateFieldError =
    hasRequiredDateError || Boolean(dateValidationMessage);

  const todayInputValue = useMemo(() => formatDateInputValue(today), [today]);

  const validateBasicInfo = (checkAuth: boolean) => {
    if (checkAuth && !authReady) {
      return "Проверяем авторизацию...";
    }
    if (!form.name.trim()) {
      return "Имя питомца обязательно";
    }
    if (!form.birthDate) {
      return "Нужно указать дату рождения";
    }
    if (!form.deathDate) {
      return "Нужно указать дату ухода";
    }
    if (dateValidationMessage) {
      return dateValidationMessage;
    }
    return null;
  };

  const validateStep = (current: Step) => {
    if (isEditMode) {
      return current === 0 ? validateBasicInfo(false) : null;
    }
    if (current === 0) {
      if (!authReady) {
        return "Проверяем авторизацию...";
      }
      return validateBasicInfo(false);
    }
    if (current === 1) {
      if (!canShowMarker) {
        return "Нужно выбрать точку на карте (для приватного мемориала она хранится скрыто)";
      }
      if (photos.length === 0) {
        return "Добавьте хотя бы одну фотографию питомца";
      }
    }
    return null;
  };

  const clampStep = (value: number): Step => {
    if (value <= 0) {
      return 0;
    }
    if (value >= 1) {
      return 1;
    }
    return value as Step;
  };

  const startLoadingProgress = useCallback(() => {
    if (loadingProgressRef.current) {
      window.clearInterval(loadingProgressRef.current);
    }
    setLoadingProgress(0);
    loadingProgressRef.current = window.setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 90) {
          return prev;
        }
        const increment = Math.max(2, Math.round((90 - prev) * 0.1));
        return Math.min(90, prev + increment);
      });
    }, 180);
  }, []);

  const stopLoadingProgress = useCallback(() => {
    if (loadingProgressRef.current) {
      window.clearInterval(loadingProgressRef.current);
      loadingProgressRef.current = null;
    }
    setLoadingProgress(100);
  }, []);

  useEffect(
    () => () => {
      if (loadingProgressRef.current) {
        window.clearInterval(loadingProgressRef.current);
        loadingProgressRef.current = null;
      }
    },
    [],
  );

  const handleNext = async () => {
    if (isEditMode) {
      return;
    }
    const message = validateStep(step);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    if (step === 0) {
      setIsTransitioning(true);
      startLoadingProgress();
      await preloadAssets();
      stopLoadingProgress();
      await new Promise((resolve) => setTimeout(resolve, 160));
      setIsTransitioning(false);
      setStep(1);
      setActiveOverlay("details");
      return;
    }
    setStep((prev) => clampStep(prev + 1));
  };

  const handleChange = (field: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const openDatePicker = useCallback((input: HTMLInputElement | null) => {
    if (!input) {
      return;
    }
    const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
    if (typeof pickerInput.showPicker === "function") {
      pickerInput.showPicker();
      return;
    }
    input.focus();
    input.click();
  }, []);

  const handleSpeciesChange = (value: string) => {
    setForm((prev) => {
      const nextMarker = firstMarkerVariantId(value) ?? prev.markerStyle;
      return { ...prev, species: value, markerStyle: nextMarker };
    });
  };

  const handlePhotosSelected = (files: FileList | null) => {
    if (!files) {
      return;
    }
    const available = Math.max(0, MAX_PHOTOS - photos.length);
    const picked = Array.from(files);
    const oversized = picked.some((file) => file.size > MAX_PHOTO_SIZE_BYTES);
    if (oversized) {
      setError("Максимальный размер фото — 6 МБ");
    }
    const selected = picked
      .filter((file) => file.size <= MAX_PHOTO_SIZE_BYTES)
      .slice(0, available);
    if (selected.length === 0) {
      return;
    }
    const mapped = selected.map((file) => ({
      id: makeLocalPhotoId(),
      file,
      persistedId: null,
      isObjectUrl: true,
      url: URL.createObjectURL(file),
    }));
    setPhotos((prev) => [...prev, ...mapped]);
    if (!previewPhotoId && mapped[0]) {
      setPreviewPhotoId(mapped[0].id);
    }
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const next = prev.filter((photo) => photo.id !== id);
      const removed = prev.find((photo) => photo.id === id);
      if (removed) {
        revokePhotoUrl(removed);
        const removedPersistedId = removed.persistedId;
        if (removedPersistedId) {
          setRemovedPhotoIds((current) =>
            current.includes(removedPersistedId)
              ? current
              : [...current, removedPersistedId],
          );
        }
      }
      if (previewPhotoId === id) {
        setPreviewPhotoId(next[0]?.id ?? null);
      }
      return next;
    });
  };

  const capturePreviewImage = useCallback(async () => {
    const renderContext = previewRenderRef.current;
    if (!renderContext) {
      return null;
    }
    const width = MAP_PREVIEW_CAPTURE_WIDTH;
    const height = MAP_PREVIEW_CAPTURE_HEIGHT;
    const controls = previewControlsRef.current;
    const camera =
      (controls?.object as THREE.PerspectiveCamera | undefined) ??
      (renderContext.camera as THREE.PerspectiveCamera | undefined);
    const perspectiveCamera =
      camera instanceof THREE.PerspectiveCamera ? camera : null;
    const prevAspect = perspectiveCamera?.aspect ?? null;
    const target = controls?.target as THREE.Vector3 | undefined;
    let restore: (() => void) | null = null;
    if (camera) {
      const prevPos = camera.position.clone();
      const prevTarget = target?.clone();
      const baseTarget = new THREE.Vector3(0, 0.6, 0);
      const basePosition = new THREE.Vector3(8, 5, 8);
      const baseOffset = basePosition.sub(baseTarget);
      const rotatedOffset = baseOffset
        .clone()
        .applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          THREE.MathUtils.degToRad(-30),
        );
      rotatedOffset.multiplyScalar(0.84);
      rotatedOffset.y -= 0.85;
      const nextPos = baseTarget.clone().add(rotatedOffset);
      const distance = nextPos.distanceTo(baseTarget);
      const tiltOffset = Math.tan(THREE.MathUtils.degToRad(5)) * distance;
      const nextTarget = baseTarget
        .clone()
        .add(new THREE.Vector3(0, tiltOffset, 0));
      camera.position.copy(nextPos);
      if (target && controls) {
        controls.target.copy(nextTarget);
        controls.update();
      } else {
        camera.lookAt(nextTarget);
      }
      if (perspectiveCamera) {
        perspectiveCamera.aspect = width / height;
        perspectiveCamera.updateProjectionMatrix();
      }
      restore = () => {
        camera.position.copy(prevPos);
        if (prevTarget && target && controls) {
          controls.target.copy(prevTarget);
          controls.update();
        } else if (prevTarget) {
          camera.lookAt(prevTarget);
        }
        if (perspectiveCamera && prevAspect !== null) {
          perspectiveCamera.aspect = prevAspect;
          perspectiveCamera.updateProjectionMatrix();
        }
      };
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
    }
    if (!camera) {
      restore?.();
      return null;
    }

    const { gl, scene } = renderContext;
    const renderTarget = new THREE.WebGLRenderTarget(width, height, {
      depthBuffer: true,
      stencilBuffer: false,
    });
    const prevTarget = gl.getRenderTarget();
    const prevAutoClear = gl.autoClear;
    gl.autoClear = true;
    gl.setRenderTarget(renderTarget);
    gl.clear();
    gl.render(scene, camera);
    const buffer = new Uint8Array(width * height * 4);
    gl.readRenderTargetPixels(renderTarget, 0, 0, width, height, buffer);
    gl.setRenderTarget(prevTarget);
    gl.autoClear = prevAutoClear;
    renderTarget.dispose();

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      restore?.();
      return null;
    }
    const toSrgbByte = (value: number) => {
      const normalized = value / 255;
      const srgb =
        normalized <= 0.0031308
          ? normalized * 12.92
          : 1.055 * Math.pow(normalized, 1 / 2.4) - 0.055;
      return Math.max(0, Math.min(255, Math.round(srgb * 255)));
    };
    const imageData = ctx.createImageData(width, height);
    for (let y = 0; y < height; y += 1) {
      const srcStart = (height - y - 1) * width * 4;
      const destStart = y * width * 4;
      for (let x = 0; x < width; x += 1) {
        const src = srcStart + x * 4;
        const dest = destStart + x * 4;
        imageData.data[dest] = toSrgbByte(buffer[src] ?? 0);
        imageData.data[dest + 1] = toSrgbByte(buffer[src + 1] ?? 0);
        imageData.data[dest + 2] = toSrgbByte(buffer[src + 2] ?? 0);
        imageData.data[dest + 3] = buffer[src + 3] ?? 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
    restore?.();
    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  }, []);

  const uploadMapPreview = useCallback(
    async (petId: string) => {
      setMapPreviewCaptureWithoutGifts(true);
      let snapshot: Blob | null = null;
      try {
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
        snapshot = await capturePreviewImage();
      } finally {
        setMapPreviewCaptureWithoutGifts(false);
      }
      if (!snapshot) {
        return;
      }
      const formData = new FormData();
      formData.append("file", snapshot, "map-preview.png");
      await fetch(`${apiUrl}/pets/${petId}/map-preview`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
    },
    [apiUrl, capturePreviewImage],
  );

  const syncEditedPhotos = useCallback(
    async (petId: string) => {
      const deletedPhotoIds: string[] = [];
      for (const photoId of removedPhotoIds) {
        const response = await fetch(
          `${apiUrl}/pets/${petId}/photos/${photoId}`,
          {
            method: "DELETE",
            credentials: "include",
          },
        );
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || "Ошибка удаления фото");
        }
        deletedPhotoIds.push(photoId);
      }

      const uploaded: { localId: string; id: string; url: string }[] = [];
      for (const photo of photos) {
        if (!photo.file) {
          continue;
        }
        const formData = new FormData();
        formData.append("file", photo.file);
        const uploadResponse = await fetch(`${apiUrl}/pets/${petId}/photos`, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        if (!uploadResponse.ok) {
          const text = await uploadResponse.text();
          throw new Error(text || "Ошибка загрузки фото");
        }
        const saved = (await uploadResponse.json()) as {
          id: string;
          url: string;
        };
        uploaded.push({
          localId: photo.id,
          id: saved.id,
          url: normalizePhotoUrl(saved.url),
        });
      }

      if (deletedPhotoIds.length > 0) {
        setRemovedPhotoIds((current) =>
          current.filter((photoId) => !deletedPhotoIds.includes(photoId)),
        );
      }

      let nextPreviewPersistedId = previewPhotoId;
      if (uploaded.length > 0) {
        const uploadedByLocalId = new Map(
          uploaded.map((item) => [item.localId, item]),
        );
        setPhotos((current) =>
          current.map((photo) => {
            const saved = uploadedByLocalId.get(photo.id);
            if (!saved) {
              return photo;
            }
            revokePhotoUrl(photo);
            return {
              id: saved.id,
              file: null,
              persistedId: saved.id,
              isObjectUrl: false,
              url: saved.url,
            };
          }),
        );
        if (previewPhotoId) {
          const uploadedPreview = uploadedByLocalId.get(previewPhotoId);
          if (uploadedPreview) {
            nextPreviewPersistedId = uploadedPreview.id;
            setPreviewPhotoId(uploadedPreview.id);
          }
        }
      }

      if (nextPreviewPersistedId) {
        const existingPreviewPhoto = photos.find(
          (photo) =>
            photo.persistedId === nextPreviewPersistedId ||
            (photo.id === nextPreviewPersistedId && photo.persistedId),
        );
        const existingPreviewId = existingPreviewPhoto?.persistedId ?? null;
        const uploadedPreviewId =
          uploaded.find((item) => item.id === nextPreviewPersistedId)?.id ??
          null;
        const resolvedPreviewId =
          uploadedPreviewId ?? existingPreviewId ?? null;
        if (resolvedPreviewId) {
          const previewResponse = await fetch(
            `${apiUrl}/pets/${petId}/preview-photo`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ photoId: resolvedPreviewId }),
            },
          );
          if (!previewResponse.ok) {
            const text = await previewResponse.text();
            throw new Error(text || "Ошибка выбора превью");
          }
        }
      }
    },
    [
      apiUrl,
      normalizePhotoUrl,
      photos,
      previewPhotoId,
      removedPhotoIds,
      revokePhotoUrl,
    ],
  );

  const hasEditedPhotoChanges = useMemo(() => {
    if (!isEditMode) {
      return false;
    }
    return (
      removedPhotoIds.length > 0 ||
      photos.some((photo) => Boolean(photo.file)) ||
      previewPhotoId !== initialPreviewPhotoId
    );
  }, [
    initialPreviewPhotoId,
    isEditMode,
    photos,
    previewPhotoId,
    removedPhotoIds,
  ]);

  const editedContentPatch = useMemo(() => {
    if (!isEditMode || !editInitialContentRef.current) {
      return {};
    }
    const initial = editInitialContentRef.current;
    const current = buildEditContentSnapshot(form);
    const patch: Partial<{
      name: string;
      species: string;
      birthDate?: string;
      deathDate?: string;
      epitaph?: string;
      story?: string;
      isPublic: boolean;
    }> = {};

    if (current.name !== initial.name) {
      patch.name = current.name;
    }
    if (current.species !== initial.species) {
      patch.species = current.species;
    }
    if (current.birthDate !== initial.birthDate) {
      patch.birthDate = current.birthDate || undefined;
    }
    if (current.deathDate !== initial.deathDate) {
      patch.deathDate = current.deathDate || undefined;
    }
    if (current.epitaph !== initial.epitaph) {
      patch.epitaph = current.epitaph;
    }
    if (current.story !== initial.story) {
      patch.story = current.story;
    }
    if (current.isPublic !== initial.isPublic) {
      patch.isPublic = current.isPublic;
    }

    return patch;
  }, [
    form.birthDate,
    form.deathDate,
    form.epitaph,
    form.isPublic,
    form.name,
    form.species,
    form.story,
    isEditMode,
  ]);

  const hasEditedContentChanges = useMemo(
    () => Object.keys(editedContentPatch).length > 0,
    [editedContentPatch],
  );

  const editSaveRequiresModeration = Boolean(
    isEditMode && (hasEditedContentChanges || hasEditedPhotoChanges),
  );

  const handleSubmit = async (options?: {
    confirmedModeration?: boolean;
    confirmedEditModeration?: boolean;
  }) => {
    if (isEditMode && editId) {
      const editValidationMessage = validateBasicInfo(false);
      if (editValidationMessage) {
        setError(editValidationMessage);
        return;
      }
      if (editSaveRequiresModeration && !options?.confirmedEditModeration) {
        setEditModerationConfirmOpen(true);
        return;
      }
      setEditModerationConfirmOpen(false);
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${apiUrl}/pets/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            ...editedContentPatch,
            lat: canShowMarker ? lat : undefined,
            lng: canShowMarker ? lng : undefined,
            markerStyle: form.markerStyle,
            environmentId: currentEnvironmentId,
            houseId: form.houseId,
            sceneJson: buildCurrentSceneJson(),
          }),
        });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || "Ошибка сохранения");
        }
        await syncEditedPhotos(editId);
        try {
          await uploadMapPreview(editId);
        } catch (err) {
          console.warn("Не удалось обновить превью для карты", err);
        }
        router.push(`/pets/${editId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка сохранения");
      } finally {
        setLoading(false);
      }
      return;
    }

    setReviewAttempted(true);
    const step0Message = validateStep(0);
    const step1Message = validateStep(1);
    const message = step0Message ?? step1Message;
    if (message) {
      setError(message);
      if (step1Message) {
        setStep(1);
      }
      return;
    }

    if (hasCoords) {
      if (lat !== undefined && (lat < -90 || lat > 90)) {
        setError("Широта должна быть в диапазоне -90..90");
        setStep(1);
        return;
      }
      if (lng !== undefined && (lng < -180 || lng > 180)) {
        setError("Долгота должна быть в диапазоне -180..180");
        setStep(1);
        return;
      }
    }

    if (!form.ownerId.trim()) {
      setError(null);
      openAuthPrompt("publish");
      return;
    }

    if (walletBalance === null) {
      setError("Не удалось загрузить баланс для оплаты мемориала");
      return;
    }
    if (walletBalance < memorialPrice) {
      setError(null);
      openTopUp();
      return;
    }

    if (!options?.confirmedModeration) {
      setPublishModerationConfirmOpen(true);
      return;
    }
    setPublishModerationConfirmOpen(false);

    setLoading(true);
    setError(null);

    const payload = {
      ownerId: form.ownerId.trim(),
      name: form.name.trim(),
      species: form.species,
      birthDate: form.birthDate || undefined,
      deathDate: form.deathDate || undefined,
      epitaph: form.epitaph.trim() || undefined,
      story: form.story.trim() || undefined,
      isPublic: form.isPublic,
      lat: canShowMarker ? lat : undefined,
      lng: canShowMarker ? lng : undefined,
      markerStyle: form.markerStyle,
      environmentId: currentEnvironmentId,
      houseId: form.houseId,
      memorialPlanYears: memorialPlan.years,
      sceneJson: buildCurrentSceneJson(),
    };

    try {
      const response = await fetch(`${apiUrl}/pets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Ошибка создания");
      }
      const created = (await response.json()) as { id: string };
      if (photos.length > 0) {
        const uploaded: { localId: string; id: string }[] = [];
        for (const photo of photos) {
          if (!photo.file) {
            continue;
          }
          const formData = new FormData();
          formData.append("file", photo.file);
          const uploadResponse = await fetch(
            `${apiUrl}/pets/${created.id}/photos`,
            {
              method: "POST",
              credentials: "include",
              body: formData,
            },
          );
          if (!uploadResponse.ok) {
            const text = await uploadResponse.text();
            throw new Error(text || "Ошибка загрузки фото");
          }
          const saved = (await uploadResponse.json()) as { id: string };
          uploaded.push({ localId: photo.id, id: saved.id });
        }
        if (previewPhotoId) {
          const previewMatch = uploaded.find(
            (item) => item.localId === previewPhotoId,
          );
          if (previewMatch) {
            const previewResponse = await fetch(
              `${apiUrl}/pets/${created.id}/preview-photo`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ photoId: previewMatch.id }),
              },
            );
            if (!previewResponse.ok) {
              const text = await previewResponse.text();
              throw new Error(text || "Ошибка выбора превью");
            }
          }
        }
      }
      try {
        await uploadMapPreview(created.id);
      } catch (err) {
        console.warn("Не удалось сохранить превью для карты", err);
      }
      setWalletBalance((prev) =>
        typeof prev === "number" ? Math.max(prev - memorialPrice, 0) : prev,
      );
      if (currentDraftId) {
        await fetch(
          `${apiUrl}/pets/drafts/${encodeURIComponent(currentDraftId)}`,
          {
            method: "DELETE",
            credentials: "include",
          },
        );
        setCurrentDraftId(null);
      }
      setReviewVisible(false);
      setReviewOpen(false);
      setActiveOverlay(null);
      setLoading(false);
      setFarewellPlaying(false);
      setSoulSceneMode("idle");
      try {
        window.sessionStorage.setItem(
          "memorial-page-toast",
          "Ваш мемориал был успешно отправлен на проверку.",
        );
      } catch {
        // Ignore storage errors; redirect still completes the publish flow.
      }
      router.push("/my-pets");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка создания");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!pendingPublishAfterAuth || !form.ownerId.trim()) {
      return;
    }
    setPendingPublishAfterAuth(false);
    void handleSubmit();
  }, [form.ownerId, pendingPublishAfterAuth]);

  useEffect(() => {
    if (!pendingDraftAfterAuth || !form.ownerId.trim()) {
      return;
    }
    const redirectHref = pendingDraftRedirectHref;
    setPendingDraftAfterAuth(false);
    setPendingDraftRedirectHref(null);
    void saveCurrentDraft({ redirectToMyPets: !redirectHref }).then(
      (savedId) => {
        if (savedId && redirectHref) {
          router.push(redirectHref);
        }
      },
    );
  }, [
    form.ownerId,
    pendingDraftAfterAuth,
    pendingDraftRedirectHref,
    router,
    saveCurrentDraft,
  ]);

  const toggleOverlay = (panel: BuilderOverlayId) => {
    if (
      isEditMode &&
      panel !== "details" &&
      panel !== "base" &&
      panel !== "story" &&
      panel !== "marker" &&
      panel !== "photos" &&
      panel !== "soul"
    ) {
      return;
    }
    clearStep3TooltipTimer();
    setTooltipTabId(null);
    setVisitedOverlays((prev) => ({ ...prev, [panel]: true }));
    setActiveOverlay((prev) => (prev === panel ? null : panel));
  };

  const openReview = () => {
    if (isEditMode) {
      setError(null);
      setReviewOpen(true);
      requestAnimationFrame(() => setReviewVisible(true));
      return;
    }
    setReviewAttempted(true);
    const message = validateStep(0) ?? validateStep(1);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setReviewOpen(true);
    requestAnimationFrame(() => setReviewVisible(true));
    void fetchWalletBalance();
  };

  const closeReview = () => {
    setReviewVisible(false);
    setTimeout(() => setReviewOpen(false), 180);
  };

  const openMobileBuilderMenu = () => {
    setMobileBuilderMenuOpen(true);
    requestAnimationFrame(() => setMobileBuilderMenuVisible(true));
  };

  const closeMobileBuilderMenu = () => {
    setMobileBuilderMenuVisible(false);
    setTimeout(() => setMobileBuilderMenuOpen(false), 180);
  };

  const openMobileBuilderActions = () => {
    setMobileBuilderActionsOpen(true);
    requestAnimationFrame(() => setMobileBuilderActionsVisible(true));
  };

  const closeMobileBuilderActions = () => {
    setMobileBuilderActionsVisible(false);
    setTimeout(() => setMobileBuilderActionsOpen(false), 180);
  };

  const navigateFromMobileMenu = (href: string) => {
    closeMobileBuilderMenu();
    window.setTimeout(() => {
      if (!isEditMode && hasDraftContent) {
        setLeaveConfirmHref(href);
        return;
      }
      router.push(href);
    }, 120);
  };

  const handleMobileSaveDraftAction = () => {
    closeMobileBuilderActions();
    window.setTimeout(() => {
      void saveCurrentDraft({ redirectToMyPets: true });
    }, 120);
  };

  const handleMobileFinishAction = () => {
    closeMobileBuilderActions();
    window.setTimeout(openReview, 120);
  };

  const renderArrowIcon = (className?: string) => (
    <span
      className={`ml-0 inline-flex max-w-0 items-center overflow-hidden opacity-0 transition-all duration-300 group-hover:ml-2 group-hover:max-w-5 group-hover:opacity-100 ${className ?? ""}`}
    >
      <svg
        viewBox="0 0 20 20"
        className="h-4 w-4 translate-x-[-4px] text-white transition-transform duration-300 group-hover:translate-x-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 10h10" />
        <path d="m10 5 5 5-5 5" />
      </svg>
    </span>
  );

  const renderNavButtons = (className?: string, buttonClassName?: string) => (
    <div className={`flex items-center justify-center ${className ?? ""}`}>
      {step < 1 ? (
        <button
          type="button"
          onClick={handleNext}
          className={`group inline-flex items-center justify-center rounded-2xl bg-[#111827] px-6 py-3 text-sm font-semibold text-white ${buttonClassName ?? ""}`}
          disabled={!authReady || isTransitioning || draftLoading}
        >
          <span className="transition-transform duration-300 group-hover:-translate-x-1">
            Продолжить
          </span>
          {renderArrowIcon()}
        </button>
      ) : null}
    </div>
  );

  const optionImage = (category: string, id: string) =>
    `/memorial/options/${category}/${id}.png`;

  const allModelUrls = useMemo(() => getAllMemorialModelUrls(), []);

  const preloadImageUrls = useMemo(() => {
    const urls = new Set<string>();
    const preloadCategories = new Set([
      "environment",
      "house",
      "house-texture",
      "sign",
      "mat",
      "bowl-food",
      "bowl-water",
    ]);
    const add = (category: string, id?: string | null) => {
      if (!preloadCategories.has(category)) {
        return;
      }
      if (!id || id === "none") {
        return;
      }
      urls.add(optionImage(category, id));
    };
    environmentOptions.forEach((option) => add("environment", option.id));
    houseVariantGroup.baseOptions.forEach((option) => add("house", option.id));
    houseOptions.forEach((option) => add("house-texture", option.id));
    signOptions.forEach((option) => add("sign", option.id));
    matOptions.forEach((option) => add("mat", option.id));
    bowlFoodOptions.forEach((option) => add("bowl-food", option.id));
    bowlWaterOptions.forEach((option) => add("bowl-water", option.id));
    return Array.from(urls.values());
  }, [
    bowlFoodOptions,
    bowlWaterOptions,
    environmentOptions,
    houseOptions,
    houseVariantGroup.baseOptions,
    matOptions,
    signOptions,
  ]);

  const warmAsset = useCallback(async (url: string) => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => {
        controller.abort();
      }, 12000);
      try {
        const response = await fetch(url, {
          cache: "force-cache",
          signal: controller.signal,
        });
        if (response.ok) {
          await response.arrayBuffer();
          return true;
        }
        if (response.status === 404) {
          return false;
        }
      } catch {
        // Retry on flaky HTTP/3/QUIC network failures.
      } finally {
        window.clearTimeout(timeoutId);
      }
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 180 * (attempt + 1));
      });
    }
    return false;
  }, []);

  const ensureGltfReady = useCallback(
    async (url: string) => {
      const cache = gltfLoadCacheRef.current;
      const cached = cache.get(url);
      if (cached) {
        return cached;
      }
      const task = (async () => {
        if (!gltfLoaderRef.current) {
          gltfLoaderRef.current = new GLTFLoader();
          const draco = ensureDracoLoader();
          if (draco) {
            gltfLoaderRef.current.setDRACOLoader(draco);
          }
        }
        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            await gltfLoaderRef.current.loadAsync(url);
            return;
          } catch (error) {
            if (attempt === 2) {
              throw error;
            }
            await new Promise<void>((resolve) => {
              setTimeout(resolve, 180 * (attempt + 1));
            });
          }
        }
      })().catch((error) => {
        cache.delete(url);
        throw error;
      });
      cache.set(url, task);
      return task;
    },
    [warmAsset],
  );

  const queueGltfLoad = useCallback(
    async (url: string) => {
      const task = gltfQueueRef.current.then(() => ensureGltfReady(url));
      gltfQueueRef.current = task.catch(() => {});
      return task;
    },
    [ensureGltfReady],
  );

  const warmAssetsWithLimit = useCallback(
    async (urls: string[], concurrency: number) => {
      const queue = Array.from(new Set(urls));
      const workerCount = Math.max(1, Math.min(concurrency, queue.length));
      let cursor = 0;

      const runWorker = async () => {
        while (cursor < queue.length) {
          const current = queue[cursor];
          cursor += 1;
          if (!current) {
            continue;
          }
          await warmAsset(current);
        }
      };

      await Promise.all(Array.from({ length: workerCount }, runWorker));
    },
    [warmAsset],
  );

  const loadGltfsWithLimit = useCallback(
    async (urls: string[], concurrency: number) => {
      const queue = Array.from(new Set(urls));
      const workerCount = Math.max(1, Math.min(concurrency, queue.length));
      let cursor = 0;

      const runWorker = async () => {
        while (cursor < queue.length) {
          const current = queue[cursor];
          cursor += 1;
          if (!current) {
            continue;
          }
          try {
            await ensureGltfReady(current);
          } catch {
            // Ignore preload failures; keep loading the rest.
          }
        }
      };

      await Promise.all(Array.from({ length: workerCount }, runWorker));
    },
    [ensureGltfReady],
  );

  const preloadConcurrency = useMemo(() => {
    if (typeof navigator === "undefined") {
      return 2;
    }
    const cores = navigator.hardwareConcurrency ?? 4;
    return cores <= 4 ? 1 : 2;
  }, []);

  const preloadAssets = useCallback(async () => {
    if (assetsLoadStartedRef.current) {
      return;
    }
    assetsLoadStartedRef.current = true;
    const modelUrls = new Set<string>(allModelUrls);
    const activeSeason = form.environmentSeasonAuto
      ? getSeasonForDate()
      : form.environmentSeason;
    [
      resolveEnvironmentModel(form.environmentId, activeSeason),
      resolveHouseModel(form.houseId),
      resolveRoofModel(form.roofId),
      resolveWallModel(form.wallId),
      resolveSignModel(form.signId),
      resolveFrameLeftModel(form.frameLeftId),
      resolveFrameRightModel(form.frameRightId),
      resolveMatModel(form.matId),
      resolveBowlFoodModel(form.bowlFoodId),
      resolveBowlWaterModel(form.bowlWaterId),
    ].forEach((url) => {
      if (url) {
        modelUrls.add(url);
      }
    });

    try {
      await Promise.all([
        warmAssetsWithLimit(preloadImageUrls, preloadConcurrency),
        loadGltfsWithLimit([...modelUrls.values()], preloadConcurrency),
      ]);
    } finally {
      setAssetsReady(true);
    }
  }, [
    allModelUrls,
    form.bowlFoodId,
    form.bowlWaterId,
    form.environmentId,
    form.environmentSeason,
    form.environmentSeasonAuto,
    form.frameLeftId,
    form.frameRightId,
    form.houseId,
    form.matId,
    form.roofId,
    form.signId,
    form.wallId,
    loadGltfsWithLimit,
    preloadConcurrency,
    preloadImageUrls,
    warmAssetsWithLimit,
  ]);

  useEffect(() => {
    if (step < 1) {
      return;
    }
    setSoulSceneMode("idle");
    if (isEditMode && !editInitialPreloadDoneRef.current) {
      editInitialPreloadDoneRef.current = true;
      setIsTransitioning(true);
      startLoadingProgress();
      void preloadAssets().finally(() => {
        stopLoadingProgress();
        window.setTimeout(() => setIsTransitioning(false), 160);
      });
      return;
    }
    void preloadAssets();
  }, [
    isEditMode,
    preloadAssets,
    startLoadingProgress,
    step,
    stopLoadingProgress,
  ]);

  const preloadOptionModel = useCallback(
    async (category: string, id: string) => {
      const url = resolveHoverModelUrl(category, id);
      if (!url) {
        return;
      }
      await queueGltfLoad(url);
    },
    [queueGltfLoad, resolveHoverModelUrl],
  );

  const handleOptionHover = useCallback(
    async (category: string, id: string) => {
      hoverIntentRef.current = { category, id };
      if (category !== "house-base" && id === selectedIdForCategory(category)) {
        setHoveredOption({ category, id });
        return;
      }
      await preloadOptionModel(category, id);
      if (
        hoverIntentRef.current?.category === category &&
        hoverIntentRef.current?.id === id
      ) {
        setHoveredOption({ category, id });
      }
    },
    [preloadOptionModel, selectedIdForCategory],
  );

  const handleOptionLeave = useCallback((category: string) => {
    if (hoverIntentRef.current?.category === category) {
      hoverIntentRef.current = null;
    }
    setHoveredOption((prev) => (prev?.category === category ? null : prev));
  }, []);

  const showDetailTooltip = useCallback(
    (option: OptionItem, element: HTMLElement) => {
      const width = isPortraitLayout ? 210 : 230;
      const maxHeight = isPortraitLayout ? 132 : 146;
      const gap = 10;
      const margin = 8;
      const rect = element.getBoundingClientRect();
      const hasLeftSpace = rect.left >= width + gap + margin;
      const preferredLeft = hasLeftSpace
        ? rect.left - width - gap
        : rect.right + gap;
      const maxLeft = window.innerWidth - width - margin;
      const left = Math.max(margin, Math.min(preferredLeft, maxLeft));
      const maxTop = Math.max(margin, window.innerHeight - maxHeight - margin);
      const top = Math.max(margin, Math.min(rect.top, maxTop));
      setDetailTooltip({
        id: option.id,
        name: option.name,
        description:
          option.description.trim() || "Деталь оформления мемориала.",
        left,
        top,
        width,
      });
    },
    [isPortraitLayout],
  );

  const hideDetailTooltip = useCallback(() => {
    setDetailTooltip(null);
  }, []);

  const handleOptionSelect = useCallback(
    async (category: string, id: string, apply: () => void) => {
      await preloadOptionModel(category, id);
      apply();
    },
    [preloadOptionModel],
  );

  const preloadEnvironmentSeason = useCallback(
    async (season: SeasonKey) => {
      const url = resolveEnvironmentModel(form.environmentId, season);
      if (!url) {
        return;
      }
      await queueGltfLoad(url);
    },
    [form.environmentId, queueGltfLoad],
  );

  const renderOptionGrid = (
    category: string,
    options: OptionItem[],
    selectedId: string,
    onSelect: (id: string) => void,
    imageCategory: string = category,
    gridClassName = "grid grid-cols-2 place-items-center gap-0.5",
  ) => (
    <div className={gridClassName}>
      {options.map((option) => {
        const isSelected = selectedId === option.id;
        const imageUrl =
          option.id === "none" ? null : optionImage(imageCategory, option.id);
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              void handleOptionSelect(category, option.id, () =>
                onSelect(option.id),
              );
            }}
            onMouseEnter={(event) => {
              showDetailTooltip(option, event.currentTarget);
              void handleOptionHover(category, option.id);
            }}
            onMouseLeave={() => {
              hideDetailTooltip();
              handleOptionLeave(category);
            }}
            onFocus={(event) => {
              showDetailTooltip(option, event.currentTarget);
              void handleOptionHover(category, option.id);
            }}
            onBlur={() => {
              hideDetailTooltip();
              handleOptionLeave(category);
            }}
            aria-label={option.name}
            className={`flex w-full aspect-square items-center justify-center rounded-xl border-[0.33px] p-0 transition ${
              isSelected
                ? "border-[#3bceac] bg-[#f0fffb]"
                : "border-[#eadfd9] bg-[#fffcf9] hover:border-[#d3a27f] hover:bg-[#fff7f2]"
            }`}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={option.name}
                loading="lazy"
                decoding="async"
                className="h-full w-full rounded-lg object-contain"
              />
            ) : (
              <div className="text-xs text-[#8d6e63]">Нет</div>
            )}
          </button>
        );
      })}
    </div>
  );

  const renderHouseTextureSwatches = (
    options: OptionItem[],
    selectedId: string,
    onSelect: (id: string) => void,
    vertical = false,
  ) => (
    <div
      className={
        vertical
          ? "flex max-h-full flex-col gap-2 overflow-y-auto pr-0.5"
          : "flex flex-wrap gap-2"
      }
    >
      {options.map((option, index) => {
        const isSelected = selectedId === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              void handleOptionSelect("house-texture", option.id, () =>
                onSelect(option.id),
              );
            }}
            onMouseEnter={(event) => {
              showDetailTooltip(option, event.currentTarget);
              void handleOptionHover("house-texture", option.id);
            }}
            onMouseLeave={() => {
              hideDetailTooltip();
              handleOptionLeave("house-texture");
            }}
            onFocus={(event) => {
              showDetailTooltip(option, event.currentTarget);
              void handleOptionHover("house-texture", option.id);
            }}
            onBlur={() => {
              hideDetailTooltip();
              handleOptionLeave("house-texture");
            }}
            aria-label={option.name}
            className={`h-8 w-8 rounded-lg border transition ${
              isSelected
                ? "border-[#5d4037] ring-2 ring-[#3bceac]/35"
                : "border-[#eadfd9] hover:border-[#d3a27f]"
            }`}
            style={{
              background: getHouseTextureSwatchBackground(option.id, index),
            }}
          />
        );
      })}
    </div>
  );

  const renderStep3TabContent = () => {
    switch (activeStep3Tab) {
      case "environment":
        return (
          <div className="grid h-full min-h-0 rounded-2xl bg-[#fffcf9] p-2">
            <div
              className={
                environmentSeasons.length > 0
                  ? "grid h-full min-h-0 grid-cols-[minmax(0,1fr)_auto] gap-2"
                  : "min-h-0"
              }
            >
              <div className="min-h-0 overflow-y-auto overscroll-contain">
                {renderOptionGrid(
                  "environment",
                  environmentOptions,
                  form.environmentId,
                  (id) => {
                    handleChange("environmentId", id);
                    requestFocus("dom_slot");
                  },
                )}
              </div>
              {environmentSeasons.length > 0 ? (
                <div className="grid w-11 min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] content-start justify-items-center gap-2 p-1.5">
                  <div className="group relative">
                    <span className="grid h-7 w-7 place-items-center rounded-full border border-white bg-[#fffcf9] text-[12px] font-black text-[#8d6e63] shadow-sm">
                      ?
                    </span>
                    <span className="pointer-events-none absolute right-full top-1/2 z-[1000] mr-2 w-52 -translate-y-1/2 rounded-lg border border-[#eadfd9] bg-white px-3 py-2 text-[11px] text-[#6f6360] opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                      Выбор времени года для поверхности мемориала.
                    </span>
                  </div>
                  <div className="flex min-h-0 flex-col gap-2 overflow-y-auto overscroll-contain pr-0.5">
                    {environmentSeasons.map((season) => {
                      const isActive = form.environmentSeason === season;
                      const swatch = SEASON_SWATCHES[season];
                      return (
                        <button
                          key={season}
                          type="button"
                          onClick={() => {
                            void preloadEnvironmentSeason(season).then(() =>
                              handleChange("environmentSeason", season),
                            );
                          }}
                          aria-label={swatch.label}
                          title={swatch.label}
                          className={`h-8 w-8 rounded-lg border transition ${
                            isActive
                              ? "border-[#5d4037] ring-2 ring-[#3bceac]/35"
                              : "border-[#eadfd9] hover:border-[#d3a27f]"
                          }`}
                          style={{ backgroundColor: swatch.color }}
                        />
                      );
                    })}
                  </div>
                  <label className="group relative flex items-center justify-center text-xs text-[#6f6360]">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={form.environmentSeasonAuto}
                      onChange={(event) =>
                        handleChange(
                          "environmentSeasonAuto",
                          event.target.checked,
                        )
                      }
                      aria-label="Автосмена сезонов"
                      title="Автосмена сезонов"
                    />
                    <span className="pointer-events-none absolute right-full top-1/2 z-[1000] mr-2 w-56 -translate-y-1/2 rounded-lg border border-[#eadfd9] bg-white px-3 py-2 text-[11px] text-[#6f6360] opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                      Если включить, поверхность будет меняться по текущей дате.
                    </span>
                  </label>
                </div>
              ) : null}
            </div>
          </div>
        );
      case "house":
        return (
          <div className="flex h-full min-h-0 flex-col gap-3">
            {houseTextureOptions.length > 0 ? (
              <div className="grid min-h-0 flex-1 rounded-2xl bg-[#fffcf9] p-2">
                <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
                    <h2 className="px-1 text-sm font-semibold text-[#5d4037]">
                      Домик
                    </h2>
                    <div className="min-h-0 overflow-y-auto overscroll-contain">
                      {renderOptionGrid(
                        "house-base",
                        houseBaseOptions,
                        selectedHouseBaseId,
                        (id) => {
                          const nextVariant =
                            houseVariantGroup.defaultVariantByBase[id] ?? id;
                          handleChange("houseId", nextVariant);
                          requestFocus("dom_slot");
                        },
                        "house",
                      )}
                    </div>
                  </div>
                  <div className="grid w-12 min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2 p-1.5">
                    <div className="group relative justify-self-center">
                      <span className="grid h-7 w-7 place-items-center rounded-full border border-white bg-[#fffcf9] text-[12px] font-black text-[#8d6e63] shadow-sm">
                        ?
                      </span>
                      <span className="pointer-events-none absolute right-full top-1/2 z-[1000] mr-2 w-44 -translate-y-1/2 rounded-lg border border-[#eadfd9] bg-white px-3 py-2 text-[11px] text-[#6f6360] opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                        Это текстура домика.
                      </span>
                    </div>
                    <div className="min-h-0 overflow-y-auto overscroll-contain">
                      {isPortraitLayout
                        ? renderHouseTextureSwatches(
                            houseTextureOptions,
                            form.houseId,
                            (id) => {
                              handleChange("houseId", id);
                              requestFocus("dom_slot");
                            },
                            true,
                          )
                        : renderOptionGrid(
                            "house-texture",
                            houseTextureOptions,
                            form.houseId,
                            (id) => {
                              handleChange("houseId", id);
                              requestFocus("dom_slot");
                            },
                            "house-texture",
                            "grid grid-cols-1 place-items-center gap-1",
                          )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {renderOptionGrid(
                  "house-base",
                  houseBaseOptions,
                  selectedHouseBaseId,
                  (id) => {
                    const nextVariant =
                      houseVariantGroup.defaultVariantByBase[id] ?? id;
                    handleChange("houseId", nextVariant);
                    requestFocus("dom_slot");
                  },
                  "house",
                )}
              </div>
            )}
            {canUseCalibration(accessLevel) ? (
              <div className="grid gap-3 rounded-2xl border border-[#eadfd9] bg-[#fffcf9] p-3 text-xs text-[#6f6360]">
                <div className="text-xs font-semibold text-[#5d4037]">
                  Временная настройка положения домика
                </div>
                <div className="text-[11px] text-[#8d6e63]">
                  Поверхность:{" "}
                  <span className="font-semibold text-[#6f6360]">
                    {selectedTerrainLayoutId || "default"}
                  </span>
                </div>
                <div className="text-[11px] text-[#8d6e63]">
                  Домик:{" "}
                  <span className="font-semibold text-[#6f6360]">
                    {selectedHouseBaseId}
                  </span>
                </div>
                <div className="grid gap-2">
                  <label className="flex items-center justify-between">
                    <span>Сдвиг X</span>
                    <span className="font-semibold text-[#6f6360]">
                      {activeHousePlacement.x.toFixed(2)}
                    </span>
                  </label>
                  <input
                    type="range"
                    min={-6}
                    max={6}
                    step={0.05}
                    value={activeHousePlacement.x}
                    onChange={(event) =>
                      updateHousePlacement({ x: Number(event.target.value) })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <label className="flex items-center justify-between">
                    <span>Сдвиг Z</span>
                    <span className="font-semibold text-[#6f6360]">
                      {activeHousePlacement.z.toFixed(2)}
                    </span>
                  </label>
                  <input
                    type="range"
                    min={-6}
                    max={6}
                    step={0.05}
                    value={activeHousePlacement.z}
                    onChange={(event) =>
                      updateHousePlacement({ z: Number(event.target.value) })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <label className="flex items-center justify-between">
                    <span>Поворот Y</span>
                    <span className="font-semibold text-[#6f6360]">
                      {activeHousePlacement.rotY.toFixed(0)}°
                    </span>
                  </label>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    step={1}
                    value={activeHousePlacement.rotY}
                    onChange={(event) =>
                      updateHousePlacement({ rotY: Number(event.target.value) })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <label className="flex items-center justify-between">
                    <span>Масштаб</span>
                    <span className="font-semibold text-[#6f6360]">
                      {activeHouseScale.toFixed(2)}
                    </span>
                  </label>
                  <input
                    type="range"
                    min={0.25}
                    max={3}
                    step={0.01}
                    value={activeHouseScale}
                    onChange={(event) =>
                      updateHouseScale(Number(event.target.value))
                    }
                  />
                </div>
              </div>
            ) : null}
          </div>
        );
      case "roof":
        return renderPartEditorPanel(
          renderOptionGrid("roof", roofOptions, form.roofId, (id) => {
            handleChange("roofId", id);
          }),
        );
      case "wall":
        return renderPartEditorPanel(
          renderOptionGrid("wall", wallOptions, form.wallId, (id) => {
            handleChange("wallId", id);
          }),
        );
      case "sign":
        return renderPartEditorPanel(
          renderOptionGrid("sign", signOptions, form.signId, (id) => {
            handleChange("signId", id);
          }),
        );
      case "frameLeft":
        return renderPartEditorPanel(
          renderOptionGrid(
            "frame-left",
            frameLeftOptions,
            form.frameLeftId,
            (id) => {
              handleChange("frameLeftId", id);
            },
          ),
        );
      case "frameRight":
        return renderPartEditorPanel(
          renderOptionGrid(
            "frame-right",
            frameRightOptions,
            form.frameRightId,
            (id) => {
              handleChange("frameRightId", id);
            },
          ),
        );
      case "mat":
        return renderPartEditorPanel(
          renderOptionGrid("mat", matOptions, form.matId, (id) => {
            handleChange("matId", id);
          }),
        );
      case "bowlFood":
        return renderPartEditorPanel(
          renderOptionGrid(
            "bowl-food",
            bowlFoodOptions,
            form.bowlFoodId,
            (id) => {
              handleChange("bowlFoodId", id);
            },
          ),
        );
      case "bowlWater":
        return renderPartEditorPanel(
          renderOptionGrid(
            "bowl-water",
            bowlWaterOptions,
            form.bowlWaterId,
            (id) => {
              handleChange("bowlWaterId", id);
            },
          ),
        );
      default:
        return null;
    }
  };

  const overlaySectionTitleClass = isPortraitLayout
    ? "mb-0 flex min-h-[1.15rem] items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#8d6e63]"
    : "mb-1 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.28em] text-[#8d6e63]";
  const overlayLabelClass = isPortraitLayout
    ? "text-[9px] font-black uppercase tracking-[0.14em] text-[#9f938e]"
    : "text-[10px] font-black uppercase tracking-widest text-[#adb5bd]";
  const overlayInputClass = isPortraitLayout
    ? "w-full rounded-xl border-b-[3px] border-transparent bg-[#fffcf9] px-2.5 py-1.5 text-[16px] font-bold leading-tight text-[#5d4037] shadow-inner outline-none transition-all focus:border-[#3bceac]"
    : "w-full rounded-2xl border-b-4 border-transparent bg-[#f7f1ee] px-4 py-3 text-sm font-bold text-[#5d4037] shadow-inner outline-none transition-all focus:border-[#3bceac]";
  const overlayTextareaClass = isPortraitLayout
    ? "min-h-[76px] w-full rounded-xl border-b-[3px] border-transparent bg-[#fffcf9] px-2.5 py-1.5 text-[16px] font-bold leading-snug text-[#5d4037] shadow-inner outline-none transition-all focus:border-[#3bceac]"
    : "min-h-[170px] w-full rounded-2xl border-b-4 border-transparent bg-[#f7f1ee] px-4 py-3.5 text-sm font-bold text-[#5d4037] shadow-inner outline-none transition-all focus:border-[#3bceac]";
  const overlayShellClass = isPortraitLayout
    ? "flex h-full min-h-0 flex-col gap-1.5 overflow-hidden bg-[#f7f1ee] p-1"
    : "grid min-h-0 gap-4 rounded-[32px] border-[4px] border-white bg-[#fffcf9] p-4 shadow-[0_20px_60px_-15px_rgba(93,64,55,0.22)] sm:p-5 [@media(max-height:640px)]:gap-2 [@media(max-height:640px)]:rounded-[22px] [@media(max-height:640px)]:border-[3px] [@media(max-height:640px)]:p-3";

  const centeredFieldClass =
    "w-full rounded-2xl border border-[#d8cfc9] bg-[#fbf7f4] px-4 py-2 text-center text-base font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]";
  const centeredSelectFieldClass = `${centeredFieldClass} h-[52px] min-h-[52px] py-0 text-center [text-align-last:center]`;
  const centeredDateFieldClass = (hasError: boolean) =>
    `block w-full min-w-0 max-w-full appearance-none rounded-2xl border px-4 py-2 text-center text-base font-semibold ${
      hasError ? "border-red-400" : "border-[#d8cfc9]"
    } min-h-[52px] bg-[#fbf7f4] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]`;
  const centeredDateFieldStyle: CSSProperties = {
    width: "100%",
    minWidth: 0,
    maxWidth: "100%",
    display: "block",
    WebkitAppearance: "none",
    appearance: "none",
  };

  const renderSoulPicker = () => (
    <div className="relative flex h-full w-full flex-col overflow-visible rounded-[30px] border border-white/70 bg-[#f7f1ee] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_8px_18px_rgba(126,102,93,0.08)] sm:rounded-[34px] sm:p-4">
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.5),transparent_38%)]" />
      <div className="relative z-10 grid h-full gap-3">
        <div className="flex items-center gap-2">
          <div className="text-[11px] font-black uppercase tracking-[0.28em] text-[#8d6e63]">
            Душа питомца
          </div>
          <AuthHelpHint
            className="h-6 w-6 border-2 text-[10px]"
            text="Выберите цвет светящегося спутника мемориала. Душа появится рядом с домиком и будет сопровождать мемориал в 3D."
          />
        </div>
        <PetSoulPreview
          color={soulPreviewColor}
          showGrid={canUseCalibration(accessLevel)}
          onReady={() => setSoulPreviewReady(true)}
          className="h-[clamp(13rem,40dvh,27rem)] w-full rounded-[28px] border-2 border-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_14px_34px_-22px_rgba(47,107,138,0.55)]"
        />
        <div className="relative grid gap-2 rounded-[24px] border border-white/70 bg-[#fffcf9] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
          {renderSoulColorControls()}
        </div>
      </div>
    </div>
  );

  const renderNameField = (centered = false) => (
    <label
      className={`${isPortraitLayout ? "grid gap-1" : "grid gap-2"} ${centered ? "w-full text-center text-sm text-[#8a7c77]" : ""}`}
    >
      {!centered ? (
        <span className={overlayLabelClass}>Имя питомца</span>
      ) : null}
      {centered ? "Имя питомца" : null}
      <input
        className={
          centered ? `${centeredFieldClass} min-h-[52px]` : overlayInputClass
        }
        value={form.name}
        onChange={(event) => handleChange("name", event.target.value)}
        placeholder="Барсик"
        required
        aria-invalid={!form.name.trim()}
        maxLength={80}
      />
    </label>
  );

  const renderSpeciesField = (centered = false) => (
    <label
      className={`${isPortraitLayout ? "grid gap-1" : "grid gap-2"} ${centered ? "w-full text-center text-sm text-[#8a7c77]" : ""}`}
    >
      {!centered ? (
        <span className={overlayLabelClass}>Вид питомца</span>
      ) : null}
      {centered ? "Вид питомца" : null}
      <select
        className={centered ? centeredSelectFieldClass : overlayInputClass}
        value={form.species}
        onChange={(event) => handleSpeciesChange(event.target.value)}
      >
        <option value="dog">Собака</option>
        <option value="cat">Кошка</option>
        <option value="bird">Птица</option>
        <option value="rat">Крыса</option>
        <option value="gryzun">Грызун</option>
        <option value="fish">Рыбка</option>
        <option value="other">Другое</option>
      </select>
    </label>
  );

  const renderBirthDateField = (centered = false) => (
    <label
      className={`${isPortraitLayout ? "grid gap-1" : "grid gap-2"} cursor-pointer ${centered ? "w-full text-center text-sm text-[#8a7c77]" : ""}`}
      onClick={() => openDatePicker(birthDateInputRef.current)}
    >
      {!centered ? (
        <span className={overlayLabelClass}>Дата рождения</span>
      ) : null}
      {centered ? "Дата рождения" : null}
      <input
        ref={birthDateInputRef}
        type="date"
        className={
          centered
            ? centeredDateFieldClass(hasDateFieldError)
            : `${overlayInputClass} ${hasDateFieldError ? "!border-red-400" : ""}`
        }
        value={form.birthDate}
        onChange={(event) => handleChange("birthDate", event.target.value)}
        max={form.deathDate || todayInputValue}
        aria-invalid={hasDateFieldError}
        style={centered ? centeredDateFieldStyle : undefined}
      />
    </label>
  );

  const renderDeathDateField = (centered = false) => (
    <label
      className={`${isPortraitLayout ? "grid gap-1" : "grid gap-2"} cursor-pointer ${centered ? "w-full text-center text-sm text-[#8a7c77]" : ""}`}
      onClick={() => openDatePicker(deathDateInputRef.current)}
    >
      {!centered ? <span className={overlayLabelClass}>Дата ухода</span> : null}
      {centered ? "Дата ухода" : null}
      <input
        ref={deathDateInputRef}
        type="date"
        className={
          centered
            ? centeredDateFieldClass(hasDateFieldError)
            : `${overlayInputClass} ${hasDateFieldError ? "!border-red-400" : ""}`
        }
        value={form.deathDate}
        onChange={(event) => handleChange("deathDate", event.target.value)}
        min={form.birthDate || undefined}
        max={todayInputValue}
        aria-invalid={hasDateFieldError}
        style={centered ? centeredDateFieldStyle : undefined}
      />
    </label>
  );

  const renderDateValidationMessage = (className = "min-h-[16px]") => (
    <div className={className}>
      {dateValidationMessage ? (
        <p className="text-xs text-red-600">{dateValidationMessage}</p>
      ) : null}
    </div>
  );

  const renderBaseInfoForm = (centered = false) => (
    <div
      className={
        centered
          ? "relative grid h-full min-h-[360px] w-full grid-rows-[auto_1fr_auto_1fr_auto_1fr_auto] text-center"
          : isPortraitLayout
            ? "grid content-start gap-2.5"
            : "grid gap-4"
      }
    >
      {renderNameField(centered)}
      {centered ? <div aria-hidden /> : null}
      {renderSpeciesField(centered)}
      {centered ? <div aria-hidden /> : null}
      {centered ? (
        renderBirthDateField(centered)
      ) : (
        <div
          className={isPortraitLayout ? "grid grid-cols-2 gap-2" : "grid gap-4"}
        >
          {renderBirthDateField(false)}
          {renderDeathDateField(false)}
        </div>
      )}
      {centered ? <div aria-hidden /> : null}
      {centered ? renderDeathDateField(centered) : null}
      {centered
        ? renderDateValidationMessage(
            "pointer-events-none absolute left-0 right-0 -bottom-6 min-h-[16px]",
          )
        : renderDateValidationMessage()}
    </div>
  );

  const renderMarkerPanel = () => {
    const markerDisplay =
      markerGroups.primary.length > 0 ? markerGroups.primary : markerGroups.all;
    return (
      <div
        className={`${overlayShellClass} ${isPortraitLayout ? "!grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden" : ""}`}
      >
        <h3 className={overlaySectionTitleClass}>
          <span className="h-2 w-2 rounded-full bg-[#3bceac]" />
          Место в мире
        </h3>
        {isPortraitLayout ? (
          <div className="grid grid-cols-2 gap-1 rounded-2xl border border-[#eadfd9] bg-[#f7f1ee] p-1">
            {(
              [
                ["marker", "Маркер"],
                ["map", "Карта"],
              ] as const
            ).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                onClick={() => setMarkerPanelTab(tab)}
                className={`rounded-xl px-2 py-1.5 text-[10px] font-black uppercase tracking-[0.08em] transition ${
                  markerPanelTab === tab
                    ? "bg-[#111827] text-white shadow-[0_3px_0_0_#000]"
                    : "bg-[#fffcf9] text-[#8d6e63]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
        <div
          className={
            isPortraitLayout
              ? "grid h-full min-h-0 gap-2 overflow-hidden"
              : "grid min-h-0 gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,0.95fr)] [@media(max-height:640px)]:!grid-cols-1 [@media(max-height:640px)]:gap-2"
          }
        >
          <div
            className={
              isPortraitLayout
                ? `${markerPanelTab !== "map" ? "hidden" : "grid"} h-full min-h-0 grid-rows-[minmax(0,1fr)] gap-2 overflow-hidden`
                : "grid content-start gap-3 [@media(max-height:640px)]:gap-2"
            }
          >
            <div
              className={`${isPortraitLayout ? "h-full min-h-0" : ""} overflow-hidden rounded-[24px] border-[3px] border-white bg-[#f8f9fa] shadow-inner [@media(max-height:640px)]:rounded-[18px] [@media(max-height:640px)]:border-2`}
            >
              {!apiKey ? (
                <div
                  className={`${isPortraitLayout ? "h-full min-h-0" : "min-h-[220px]"} flex items-center justify-center bg-[#fcf8f5] text-xs text-[#8d6e63]`}
                >
                  Укажи NEXT_PUBLIC_GOOGLE_MAPS_API_KEY в .env.local
                </div>
              ) : loadError ? (
                <div
                  className={`${isPortraitLayout ? "h-full min-h-0" : "min-h-[220px]"} flex items-center justify-center bg-[#fcf8f5] text-xs text-red-600`}
                >
                  Ошибка загрузки карты
                </div>
              ) : !isLoaded ? (
                <div
                  className={`${isPortraitLayout ? "h-full min-h-0" : "min-h-[220px]"} flex items-center justify-center bg-[#fcf8f5] text-xs text-[#8d6e63]`}
                >
                  Загрузка карты...
                </div>
              ) : (
                <GoogleMap
                  mapContainerStyle={{
                    width: "100%",
                    height: markerMapHeight,
                  }}
                  center={mapCenter}
                  zoom={canShowMarker ? 12 : 3}
                  onClick={(event) => {
                    const latValue = event.latLng?.lat();
                    const lngValue = event.latLng?.lng();
                    if (latValue === undefined || lngValue === undefined) {
                      return;
                    }
                    setForm((prev) => ({
                      ...prev,
                      lat: latValue.toFixed(6),
                      lng: lngValue.toFixed(6),
                    }));
                  }}
                >
                  {canShowMarker ? (
                    <Marker
                      position={{ lat: lat!, lng: lng! }}
                      icon={{
                        url: markerIconUrl(markerIconId),
                        scaledSize: new window.google.maps.Size(
                          markerPreviewSize.width,
                          markerPreviewSize.height,
                        ),
                        anchor: new window.google.maps.Point(
                          markerPreviewAnchor.x,
                          markerPreviewAnchor.y,
                        ),
                      }}
                    />
                  ) : null}
                </GoogleMap>
              )}
            </div>

            <div
              className={
                isPortraitLayout
                  ? "hidden"
                  : "grid gap-2 rounded-[24px] border-[3px] border-white bg-[#fcf8f5] p-3 shadow-inner [@media(max-height:640px)]:rounded-[18px] [@media(max-height:640px)]:border-2 [@media(max-height:640px)]:p-2"
              }
            >
              <div
                className={
                  isPortraitLayout
                    ? "grid grid-cols-2 gap-2"
                    : "grid grid-cols-2 gap-2 [@media(max-width:760px)]:grid-cols-1"
                }
              >
                <label
                  className={isPortraitLayout ? "grid gap-1" : "grid gap-2"}
                >
                  <span className={overlayLabelClass}>Широта</span>
                  <input
                    inputMode={isPortraitLayout ? "text" : "decimal"}
                    className={overlayInputClass}
                    placeholder="55.755826"
                    value={form.lat}
                    onChange={(event) =>
                      handleChange("lat", event.target.value)
                    }
                  />
                </label>
                <label
                  className={isPortraitLayout ? "grid gap-1" : "grid gap-2"}
                >
                  <span className={overlayLabelClass}>Долгота</span>
                  <input
                    inputMode={isPortraitLayout ? "text" : "decimal"}
                    className={overlayInputClass}
                    placeholder="37.617299"
                    value={form.lng}
                    onChange={(event) =>
                      handleChange("lng", event.target.value)
                    }
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => {
                    if (!navigator.geolocation) {
                      setError("Геолокация не поддерживается в этом браузере");
                      return;
                    }
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        setForm((prev) => ({
                          ...prev,
                          lat: pos.coords.latitude.toFixed(6),
                          lng: pos.coords.longitude.toFixed(6),
                        }));
                      },
                      () => setError("Не удалось получить геолокацию"),
                    );
                  }}
                  className="rounded-xl border border-[#eadfd9] bg-[#fffcf9] px-2 py-1 text-[10px] text-[#6f6360] transition hover:bg-[#fff7f2]"
                >
                  Моё местоположение
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({ ...prev, lat: "", lng: "" }))
                  }
                  className="rounded-xl border border-[#eadfd9] bg-[#fffcf9] px-2 py-1 text-[10px] text-[#6f6360] transition hover:bg-[#fff7f2]"
                >
                  Очистить
                </button>
              </div>

              <label className="group relative flex items-center gap-2 text-xs font-bold text-[#6f6360]">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={form.isPublic}
                  onChange={(event) =>
                    handleChange("isPublic", event.target.checked)
                  }
                />
                Публичный мемориал
                <span className="grid h-5 w-5 place-items-center rounded-full border border-white bg-[#fffcf9] text-[10px] font-black text-[#8d6e63]">
                  ?
                </span>
                <span className="pointer-events-none absolute left-0 top-full z-10 mt-2 w-64 rounded-lg border border-[#eadfd9] bg-white px-3 py-2 text-[11px] text-[#6f6360] opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                  Кликни на карте, чтобы выбрать точку. Публичный мемориал виден
                  на карте всем пользователям, приватные доступны только по
                  ссылке.
                </span>
              </label>
            </div>
          </div>

          <div
            className={
              isPortraitLayout
                ? `${markerPanelTab !== "marker" ? "hidden" : "grid"} h-full min-h-0 min-w-0 overflow-hidden`
                : "grid min-h-0 min-w-0 content-start gap-2"
            }
          >
            <div
              className={
                isPortraitLayout
                  ? "grid h-full min-h-0 grid-cols-[44px_minmax(0,1fr)] gap-2 overflow-hidden"
                  : "grid grid-cols-[56px_minmax(0,1fr)] gap-3 [@media(max-height:640px)]:grid-cols-1 [@media(max-height:640px)]:gap-2"
              }
            >
              <div
                className={
                  isPortraitLayout
                    ? "flex h-full min-h-0 w-11 touch-pan-y snap-y snap-mandatory flex-col items-center gap-1.5 overflow-y-auto overflow-x-hidden overscroll-contain pr-0.5 [overscroll-behavior-x:none]"
                    : "flex w-14 flex-col items-center gap-2 [@media(max-height:640px)]:w-full [@media(max-height:640px)]:flex-row [@media(max-height:640px)]:overflow-x-auto [@media(max-height:640px)]:pb-1"
                }
              >
                {markerStyles.map((style) => {
                  const isActive = markerCategory === style.id;
                  const categoryIconUrl =
                    markerVariants.find((variant) => variant.id === style.id)
                      ?.iconUrl ?? markerIconUrl(style.id);
                  return (
                    <div
                      key={style.id}
                      className={
                        isPortraitLayout
                          ? "group relative w-10 shrink-0 snap-start"
                          : "group relative"
                      }
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setMarkerCategory(style.id);
                          if (
                            markerStyleById(form.markerStyle).id !== style.id
                          ) {
                            handleChange(
                              "markerStyle",
                              firstMarkerVariantId(style.id),
                            );
                          }
                        }}
                        className={`flex shrink-0 items-center justify-center overflow-hidden border p-0 transition ${
                          isPortraitLayout
                            ? "h-10 w-10 rounded-xl"
                            : "h-12 w-12 rounded-2xl sm:h-14 sm:w-14 [@media(max-height:640px)]:h-10 [@media(max-height:640px)]:w-10 [@media(max-height:640px)]:rounded-xl"
                        } ${
                          isActive
                            ? "border-[#5d4037] bg-[#5d4037] text-white"
                            : "border-[#eadfd9] bg-white text-[#8d6e63] hover:border-[#d3a27f]"
                        }`}
                        aria-label={style.name}
                      >
                        <img
                          src={categoryIconUrl}
                          alt={style.name}
                          className="h-full w-full scale-[1.12] object-contain p-0.5"
                        />
                      </button>
                      <span
                        className={
                          isPortraitLayout
                            ? "hidden"
                            : "pointer-events-none absolute left-full top-1/2 z-10 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg border border-[#eadfd9] bg-white px-2 py-1 text-[10px] text-[#6f6360] opacity-0 shadow-sm transition group-hover:opacity-100"
                        }
                      >
                        {style.name}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[#c2a79a]">
                  Маркеры выбранного вида
                </p>
                <div
                  className={
                    isPortraitLayout
                      ? "grid min-h-0 flex-1 grid-cols-[repeat(auto-fit,minmax(3.5rem,1fr))] content-start gap-1 overflow-y-auto overscroll-contain pr-1"
                      : "flex w-full flex-wrap gap-1 [@media(max-height:640px)]:max-h-32 [@media(max-height:640px)]:overflow-y-auto"
                  }
                >
                  {markerDisplay.map((marker) => {
                    const markerName = markerStyleById(marker.baseId).name;
                    return (
                      <button
                        key={marker.id}
                        type="button"
                        onClick={() => handleChange("markerStyle", marker.id)}
                        className={`flex items-center justify-center rounded-lg border p-0.5 ${
                          form.markerStyle === marker.id
                            ? "border-[#5d4037] bg-[#5d4037] text-white"
                            : "border-[#eadfd9] bg-white text-[#6f6360]"
                        }`}
                      >
                        <span
                          className={
                            isPortraitLayout
                              ? "h-12 w-12 overflow-hidden rounded-lg bg-[#f7f1ee] min-[390px]:h-14 min-[390px]:w-14 [@media(max-height:640px)]:h-10 [@media(max-height:640px)]:w-10"
                              : "h-14 w-14 overflow-hidden rounded-lg bg-[#f7f1ee] [@media(max-height:640px)]:h-10 [@media(max-height:640px)]:w-10"
                          }
                        >
                          <img
                            src={marker.iconUrl}
                            alt={markerName}
                            className="h-full w-full object-contain"
                          />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderFloatingMapControls = () => (
    <div className="pointer-events-auto absolute bottom-[calc(49dvh+0.55rem)] right-2 z-[75] w-[min(17rem,calc(100vw-4rem))] rounded-[22px] border-[3px] border-white bg-[#fffcf9]/95 p-2 shadow-[0_18px_40px_-24px_rgba(93,64,55,0.5)] backdrop-blur">
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1">
          <span className="text-[8px] font-black uppercase tracking-[0.14em] text-[#c2a79a]">
            Широта
          </span>
          <input
            inputMode="text"
            className="min-w-0 rounded-[14px] border-2 border-white bg-[#f7f1ee] px-2 py-1.5 text-[16px] font-bold text-[#6f6360] outline-none"
            placeholder="55.755826"
            value={form.lat}
            onChange={(event) => handleChange("lat", event.target.value)}
          />
        </label>
        <label className="grid gap-1">
          <span className="text-[8px] font-black uppercase tracking-[0.14em] text-[#c2a79a]">
            Долгота
          </span>
          <input
            inputMode="text"
            className="min-w-0 rounded-[14px] border-2 border-white bg-[#f7f1ee] px-2 py-1.5 text-[16px] font-bold text-[#6f6360] outline-none"
            placeholder="37.617299"
            value={form.lng}
            onChange={(event) => handleChange("lng", event.target.value)}
          />
        </label>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5">
        <button
          type="button"
          onClick={() => {
            if (!navigator.geolocation) {
              setError("Геолокация не поддерживается в этом браузере");
              return;
            }
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                setForm((prev) => ({
                  ...prev,
                  lat: pos.coords.latitude.toFixed(6),
                  lng: pos.coords.longitude.toFixed(6),
                }));
              },
              () => setError("Не удалось получить геолокацию"),
            );
          }}
          className="rounded-xl border border-[#eadfd9] bg-white px-2 py-1 text-[9px] font-bold text-[#6f6360]"
        >
          Моё место
        </button>
        <button
          type="button"
          onClick={() => setForm((prev) => ({ ...prev, lat: "", lng: "" }))}
          className="rounded-xl border border-[#eadfd9] bg-white px-2 py-1 text-[9px] font-bold text-[#6f6360]"
        >
          Очистить
        </button>
      </div>
      <label className="group relative mt-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.08em] text-[#6f6360]">
        <input
          type="checkbox"
          className="h-3.5 w-3.5"
          checked={form.isPublic}
          onChange={(event) => handleChange("isPublic", event.target.checked)}
        />
        Публичный
        <span className="grid h-5 w-5 place-items-center rounded-full border border-white bg-[#f7f1ee] text-[10px] font-black text-[#8d6e63]">
          ?
        </span>
        <span className="pointer-events-none fixed left-4 right-4 top-[calc(3.75rem+env(safe-area-inset-top))] z-[2200] rounded-lg border border-[#eadfd9] bg-white px-3 py-2 text-[11px] font-semibold normal-case leading-snug tracking-normal text-[#6f6360] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          Кликни на карте, чтобы выбрать точку. Публичный мемориал виден на
          карте всем пользователям, приватные доступны только по ссылке.
        </span>
      </label>
    </div>
  );

  const renderStoryPanel = () => (
    <div className={overlayShellClass}>
      <h3 className={overlaySectionTitleClass}>
        <span className="h-2 w-2 rounded-full bg-[#3bceac]" />
        История и эпитафия
      </h3>
      <label className={isPortraitLayout ? "grid gap-1" : "grid gap-2"}>
        <span className={overlayLabelClass}>Эпитафия (до 200 символов)</span>
        <input
          className={overlayInputClass}
          value={form.epitaph}
          maxLength={200}
          onChange={(event) => handleChange("epitaph", event.target.value)}
          placeholder="Самый лучший друг"
        />
      </label>
      <label className={isPortraitLayout ? "grid gap-1" : "grid gap-2"}>
        <span className={overlayLabelClass}>История питомца</span>
        <textarea
          className={overlayTextareaClass}
          value={form.story}
          maxLength={2000}
          onChange={(event) => handleChange("story", event.target.value)}
          placeholder="Короткая история о жизни питомца"
        />
      </label>
    </div>
  );

  const renderPhotosPanel = () => (
    <div className={overlayShellClass}>
      <h3 className={overlaySectionTitleClass}>
        <span className="h-2 w-2 rounded-full bg-[#3bceac]" />
        Фотографии
      </h3>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#5d4037]">
          Фотографии (до {MAX_PHOTOS})
        </h3>
        <span className="rounded-full bg-[#d3a27f]/10 px-3 py-1 text-[10px] font-black text-[#d3a27f]">
          {photos.length}/{MAX_PHOTOS}
        </span>
      </div>
      <input
        type="file"
        accept="image/*"
        multiple
        className={overlayInputClass}
        onChange={(event) => {
          handlePhotosSelected(event.target.files);
          event.currentTarget.value = "";
        }}
      />
      <p className="text-xs text-[#8d6e63]">
        Максимум {MAX_PHOTOS} фото, до 6 МБ каждое.
      </p>
      {photos.length > 0 ? (
        <div
          className={
            isPortraitLayout
              ? "grid min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1"
              : "grid gap-2"
          }
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
            gap: "6px",
          }}
        >
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="relative rounded-2xl border border-[#eadfd9] bg-white p-2"
            >
              <button
                type="button"
                onClick={() => removePhoto(photo.id)}
                className="absolute right-2 top-2 h-6 w-6 rounded-full bg-black/70 text-xs text-white"
                aria-label="Удалить фото"
                title="Удалить фото"
              >
                ×
              </button>
              <img
                src={photo.url}
                alt="Фото питомца"
                className="h-24 w-full rounded-lg bg-[#f1e7e0] object-contain"
              />
              <div className="mt-2 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setPreviewPhotoId(photo.id)}
                  className={`rounded-full px-3 py-1 text-xs ${
                    previewPhotoId === photo.id
                      ? "bg-[#111827] text-white"
                      : "border border-[#eadfd9] text-[#6f6360]"
                  }`}
                >
                  {previewPhotoId === photo.id ? "На обложке" : "На обложку"}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[#8d6e63]">
          Добавь фотографии и выбери одну для мини‑окна на карте.
        </p>
      )}
    </div>
  );

  const renderBaseInfoPanel = () => (
    <div className={overlayShellClass}>
      <h3 className={overlaySectionTitleClass}>
        <span className="h-2 w-2 rounded-full bg-[#3bceac]" />
        Информация о мемориале
      </h3>
      {renderBaseInfoForm()}
    </div>
  );

  const renderDetailCalibrationPanel = () => {
    if (!canUseCalibration(accessLevel) || !activeDetailSlot) {
      return null;
    }

    const activeTabLabel =
      step3Tabs.find((tab) => tab.id === activeStep3Tab)?.label ?? "Деталь";
    const numberInputClass =
      "w-20 rounded-xl border border-white bg-[#fffcf9] px-2 py-1 text-right text-[16px] font-bold leading-tight text-[#5d4037] shadow-inner outline-none transition focus:border-[#3bceac] focus:ring-2 focus:ring-[#3bceac]/20";
    const rangeClass = "h-2 w-full accent-[#3bceac]";
    const updatePosition = (axis: "x" | "y" | "z", value: number) => {
      updateActiveDetailOverride({
        position: { [axis]: value },
      });
    };

    return (
      <div className="grid gap-3 rounded-2xl border border-[#eadfd9] bg-[#fffcf9] p-3 text-xs text-[#6f6360]">
        <div className="grid gap-1">
          <div className="text-xs font-semibold text-[#5d4037]">
            Временная настройка детали
          </div>
          <div className="text-[11px] leading-snug text-[#8d6e63]">
            Домик:{" "}
            <span className="font-semibold text-[#6f6360]">
              {form.houseId}
            </span>
            {" · "}Деталь:{" "}
            <span className="font-semibold text-[#6f6360]">
              {activeTabLabel}
            </span>
            {" · "}Слот:{" "}
            <span className="font-semibold text-[#6f6360]">
              {activeDetailSlot}
            </span>
          </div>
        </div>

        <div className="grid gap-2">
          <label className="flex items-center justify-between gap-3">
            <span>Масштаб</span>
            <input
              type="number"
              min={0.05}
              max={4}
              step={0.01}
              value={activeDetailOverride.scale}
              onChange={(event) =>
                updateActiveDetailOverride({
                  scale: Number(event.target.value) || 0.05,
                })
              }
              className={numberInputClass}
            />
          </label>
          <input
            type="range"
            min={0.05}
            max={4}
            step={0.01}
            value={activeDetailOverride.scale}
            onChange={(event) =>
              updateActiveDetailOverride({ scale: Number(event.target.value) })
            }
            className={rangeClass}
          />
        </div>

        <div className="grid gap-2">
	          <label className="flex items-center justify-between gap-3">
	            <span>Поворот Y</span>
	            <input
	              type="number"
	              min={-180}
	              max={180}
	              step={1}
	              value={activeDetailOverride.rotationY ?? 0}
	              onChange={(event) =>
	                updateActiveDetailOverride({
	                  rotationY: Number(event.target.value) || 0,
	                })
	              }
	              className={numberInputClass}
	            />
	          </label>
	          <input
	            type="range"
	            min={-180}
	            max={180}
	            step={1}
	            value={activeDetailOverride.rotationY ?? 0}
	            onChange={(event) =>
	              updateActiveDetailOverride({ rotationY: Number(event.target.value) })
	            }
	            className={rangeClass}
	          />
	        </div>

	        {(["x", "y", "z"] as const).map((axis) => (
	          <div key={axis} className="grid gap-2">
            <label className="flex items-center justify-between gap-3">
              <span>Сдвиг {axis.toUpperCase()}</span>
              <input
                type="number"
                min={-3}
                max={3}
                step={0.01}
                value={activeDetailOverride.position[axis]}
                onChange={(event) =>
                  updatePosition(axis, Number(event.target.value) || 0)
                }
                className={numberInputClass}
              />
            </label>
            <input
              type="range"
              min={-3}
              max={3}
              step={0.01}
              value={activeDetailOverride.position[axis]}
              onChange={(event) =>
                updatePosition(axis, Number(event.target.value))
              }
              className={rangeClass}
            />
          </div>
        ))}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={resetActiveDetailOverride}
            className="rounded-full border border-[#eadfd9] bg-white px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#8d6e63] transition hover:border-[#d3a27f]"
          >
            Сбросить деталь
          </button>
          <button
            type="button"
            onClick={copyDetailCalibrationJson}
            className="rounded-full bg-[#111827] px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-white shadow-sm transition hover:-translate-y-0.5"
          >
            Скопировать JSON
          </button>
        </div>

        <textarea
          readOnly
          value={detailCalibrationJson}
          className="min-h-[120px] resize-y rounded-2xl border border-[#eadfd9] bg-white px-3 py-2 font-mono text-[11px] leading-relaxed text-[#5d4037] outline-none"
          aria-label="JSON временной калибровки деталей"
        />
      </div>
    );
  };

  const renderPartEditorPanel = (children: ReactNode) => (
    <div className="grid gap-3">
      {children}
      {renderDetailCalibrationPanel()}
    </div>
  );

  const renderSoulPathCalibrationPanel = () => {
    if (!canUseCalibration(accessLevel)) {
      return null;
    }

    const rowInputClass = isPortraitLayout
      ? "w-20 rounded-xl border border-white bg-[#fffcf9] px-2 py-1 text-right text-[16px] font-bold leading-tight text-[#5d4037] shadow-inner outline-none transition focus:border-[#3bceac] focus:ring-2 focus:ring-[#3bceac]/20"
      : "w-16 rounded-xl border border-white bg-[#fffcf9] px-2 py-1 text-right text-[11px] font-bold text-[#5d4037] shadow-inner outline-none transition focus:border-[#3bceac] focus:ring-2 focus:ring-[#3bceac]/20";
    const rangeClass = "h-2 w-full accent-[#3bceac]";

    return (
      <div className="grid max-h-[min(48vh,420px)] gap-3 overflow-y-auto rounded-[20px] border-2 border-white bg-[#f7f1ee] p-3 text-[11px] text-[#6f6360] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-black uppercase tracking-[0.16em] text-[#5d4037]">
              Путь души
            </div>
            <div className="mt-1 leading-snug text-[#8a7c77]">
              Один путь — это одно движение души. Точки задают плавную
              траекторию без остановок, затем душа возвращается в старт.
            </div>
          </div>
          <label className="inline-flex items-center gap-2 rounded-full bg-[#fffcf9] px-3 py-1.5 font-black uppercase tracking-[0.1em] text-[#3b8d76]">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[#d8cfc9]"
              checked={form.soulPath.enabled}
              onChange={(event) =>
                updateSoulPath({ enabled: event.target.checked })
              }
            />
            Включить
          </label>
        </div>

        <div className="grid gap-2 rounded-[16px] bg-[#fffcf9] p-2">
          <label className="grid gap-1">
            <div className="flex items-center justify-between gap-3">
              <span className="font-bold">Время по точкам</span>
              <input
                type="number"
                min={0.2}
                max={120}
                step={0.1}
                value={Number(soulPathTotalDuration.toFixed(2))}
                onChange={(event) =>
                  updateSoulPathTotalDuration(Number(event.target.value))
                }
                className={rowInputClass}
              />
            </div>
            <input
              type="range"
              min={Math.max(0.2, form.soulPath.points.length * 0.2)}
              max={Math.max(30, Math.ceil(soulPathTotalDuration))}
              step={0.1}
              value={Math.max(0.2, soulPathTotalDuration)}
              onChange={(event) =>
                updateSoulPathTotalDuration(Number(event.target.value))
              }
              className={rangeClass}
            />
            <span className="text-[10px] leading-snug text-[#9b8a84]">
              Масштабирует время прохождения всей траектории по точкам, без
              участка возврата в старт.
            </span>
          </label>
          <label className="grid gap-1">
            <div className="flex items-center justify-between gap-3">
              <span className="font-bold">Возврат в старт</span>
              <input
                type="number"
                min={0.2}
                max={30}
                step={0.1}
                value={form.soulPath.returnDuration}
                onChange={(event) =>
                  updateSoulPath({ returnDuration: Number(event.target.value) })
                }
                className={rowInputClass}
              />
            </div>
            <input
              type="range"
              min={0.2}
              max={8}
              step={0.1}
              value={form.soulPath.returnDuration}
              onChange={(event) =>
                updateSoulPath({ returnDuration: Number(event.target.value) })
              }
              className={rangeClass}
            />
          </label>
          <label className="grid gap-1">
            <div className="flex items-center justify-between gap-3">
              <span className="font-bold">Пауза между циклами</span>
              <input
                type="number"
                min={0}
                max={30}
                step={0.1}
                value={form.soulPath.idleDuration}
                onChange={(event) =>
                  updateSoulPath({ idleDuration: Number(event.target.value) })
                }
                className={rowInputClass}
              />
            </div>
            <input
              type="range"
              min={0}
              max={8}
              step={0.1}
              value={form.soulPath.idleDuration}
              onChange={(event) =>
                updateSoulPath({ idleDuration: Number(event.target.value) })
              }
              className={rangeClass}
            />
          </label>
        </div>

        <div className="grid gap-2">
          {form.soulPath.points.map((point, index) => (
            <div
              key={point.id}
              className="grid gap-2 rounded-[16px] bg-[#fffcf9] p-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-black uppercase tracking-[0.12em] text-[#5d4037]">
                  Точка {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeSoulPathPoint(point.id)}
                  disabled={form.soulPath.points.length <= 1}
                  className="rounded-full bg-[#f1ebe9] px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#8d6e63] transition hover:bg-[#eadfd9] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Убрать
                </button>
              </div>
              {(["x", "y", "z"] as const).map((axis) => (
                <label key={axis} className="grid gap-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold uppercase">{axis}</span>
                    <input
                      type="number"
                      min={-20}
                      max={20}
                      step={0.05}
                      value={point[axis]}
                      onChange={(event) =>
                        updateSoulPathPoint(point.id, {
                          [axis]: Number(event.target.value),
                        })
                      }
                      className={rowInputClass}
                    />
                  </div>
                  <input
                    type="range"
                    min={-20}
                    max={20}
                    step={0.05}
                    value={point[axis]}
                    onChange={(event) =>
                      updateSoulPathPoint(point.id, {
                        [axis]: Number(event.target.value),
                      })
                    }
                    className={rangeClass}
                  />
                </label>
              ))}
              <label className="grid gap-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold">Время до точки</span>
                  <input
                    type="number"
                    min={0.2}
                    max={30}
                    step={0.1}
                    value={point.duration}
                    onChange={(event) =>
                      updateSoulPathPoint(point.id, {
                        duration: Number(event.target.value),
                      })
                    }
                    className={rowInputClass}
                  />
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={8}
                  step={0.1}
                  value={point.duration}
                  onChange={(event) =>
                    updateSoulPathPoint(point.id, {
                      duration: Number(event.target.value),
                    })
                  }
                  className={rangeClass}
                />
              </label>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addSoulPathPoint}
          disabled={form.soulPath.points.length >= 12}
          className="rounded-[16px] border-2 border-white bg-[#fffcf9] px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#5d4037] transition hover:-translate-y-0.5 hover:bg-[#fff7f2] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Добавить точку
        </button>

        <label className="grid gap-1">
          <span className="font-black uppercase tracking-[0.12em] text-[#8d6e63]">
            JSON для передачи
          </span>
          <textarea
            readOnly
            value={soulPathExportJson}
            className={
              isPortraitLayout
                ? "min-h-24 resize-y rounded-[16px] border-2 border-white bg-[#fffcf9] p-2 font-mono text-[16px] leading-snug text-[#5d4037] outline-none"
                : "min-h-28 resize-y rounded-[16px] border-2 border-white bg-[#fffcf9] p-2 font-mono text-[10px] leading-snug text-[#5d4037] outline-none"
            }
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
      </div>
    );
  };

  const renderSoulColorPanel = () => (
    <div className={overlayShellClass}>
      <h3 className={overlaySectionTitleClass}>
        <span className="h-2 w-2 rounded-full bg-[#3bceac]" />
        Душа питомца
        <AuthHelpHint
          className={`relative z-[120] h-6 w-6 border-2 text-[10px] normal-case tracking-normal ${
            isPortraitLayout
              ? "[&>span]:!fixed [&>span]:!left-14 [&>span]:!right-3 [&>span]:!top-[calc(3.75rem+env(safe-area-inset-top))] [&>span]:!z-[2000] [&>span]:!w-auto"
              : ""
          }`}
          placement={isPortraitLayout ? "bottom" : "top"}
          text="Цвет души меняет ядро и мягкое свечение вокруг него."
        />
      </h3>
      <div
        className={
          isPortraitLayout
            ? "grid content-start gap-2.5 overflow-y-auto overscroll-contain pr-1"
            : "grid gap-4"
        }
      >
        {renderSoulColorControls(true)}
        {renderSoulPathCalibrationPanel()}
      </div>
    </div>
  );

  const renderMobileDetailsPanel = () => (
    <div className="flex h-full min-h-0 min-w-0 gap-1 overflow-hidden">
      <div className={builderTabRailClass}>
        {step3Tabs.map((tab) => {
          const isActive = activeStep3Tab === tab.id;
          const isDisabled = false;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleMobileDetailsTabSelect(tab)}
              disabled={isDisabled}
              aria-label={tab.label}
              title={tab.label}
              className={builderTabButtonClass(isActive, isDisabled)}
            >
              <Step3TabIcon id={tab.id} />
              <span className="sr-only">{tab.label}</span>
            </button>
          );
        })}
      </div>
      <div
        key={`mobile-detail-${activeStep3Tab}`}
        className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain pr-1 pb-3"
      >
        {renderStep3TabContent()}
      </div>
    </div>
  );

  const renderActiveOverlayContent = () => {
    switch (activeOverlay) {
      case "details":
        return renderMobileDetailsPanel();
      case "base":
        return renderBaseInfoPanel();
      case "marker":
        return renderMarkerPanel();
      case "photos":
        return renderPhotosPanel();
      case "soul":
        return renderSoulColorPanel();
      case "story":
        return renderStoryPanel();
      default:
        return null;
    }
  };

  const isBuilderStep = step === 1;
  const isInitialStep = step === 0;
  const headerOffset = "var(--app-header-height, 56px)";
  const overlayPanelBase = isPortraitLayout
    ? `pointer-events-auto absolute left-16 right-1.5 bottom-[calc(4.35rem+env(safe-area-inset-bottom))] z-[80] ${hudPanelChromeClass(true)}`
    : `pointer-events-auto absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] left-[6.75rem] z-[80] ${hudPanelChromeClass(false)} sm:left-[7.35rem] sm:p-3 xl:left-[7.95rem]`;
  const overlayPanelClass = (variant?: "marker" | "soul") =>
    `${overlayPanelBase} ${
      variant === "marker"
        ? isPortraitLayout
          ? "w-auto max-h-[min(52vh,420px)] overflow-y-auto"
          : "w-[min(1080px,calc(100vw-8.75rem))] max-h-[min(74vh,700px)] overflow-x-hidden !overflow-y-auto [@media(max-height:640px)]:w-[min(720px,calc(100vw-8.75rem))] [@media(max-height:640px)]:max-h-[calc(100dvh-var(--app-header-height,56px)-5.5rem)] [@media(max-height:640px)]:rounded-[24px] [@media(max-height:640px)]:border-[3px] [@media(max-height:640px)]:p-1.5"
        : variant === "soul"
          ? isPortraitLayout
            ? "w-auto overflow-visible"
            : "w-[min(500px,calc(100vw-8.75rem))] overflow-visible"
          : isPortraitLayout
            ? "w-auto max-h-[min(44vh,360px)] overflow-y-auto"
            : "w-[min(500px,calc(100vw-8.75rem))] max-h-[70vh] overflow-y-auto"
    }`;
  const panelButtonClass = (active: boolean, highlight: boolean) =>
    `${hudRoundButtonClass(isPortraitLayout, active)} ${
      isPortraitLayout ? "" : "xl:h-[4.5rem] xl:w-[4.5rem]"
    } ${
      highlight
        ? "ring-2 ring-emerald-400/80 shadow-[0_0_0_4px_rgba(52,211,153,0.18)]"
        : ""
    }`;
  const builderControlTooltipClass = hudTooltipClass("right");
  const builderAttentionBadgeClass = isPortraitLayout
    ? "absolute -right-0.5 -top-0.5 flex h-[1.125rem] w-[1.125rem] items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white shadow"
    : "absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-[13px] font-bold text-white shadow";
  const builderEditorPanelClass = `pointer-events-auto ${
    isPortraitLayout
      ? "absolute left-0 right-0 bottom-0 z-[20] flex h-[49dvh] flex-col bg-[#f7f1ee]"
      : `absolute right-3 top-[calc(var(--app-header-height,56px)+10px)] bottom-[5.2rem] z-[20] flex w-[min(340px,calc(100vw-1.25rem))] max-w-[90vw] flex-col ${hudPanelChromeClass(false)} sm:right-5 sm:top-[calc(var(--app-header-height,56px)+12px)] sm:bottom-[5.5rem] sm:w-[min(358px,calc(100vw-1.75rem))] sm:p-3 xl:w-[378px]`
  }`;
  const builderOverlayButtonsWrapClass = isPortraitLayout
    ? "hidden"
    : "pointer-events-auto absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] left-6 z-[90]";
  const builderOverlayButtonsClass = isPortraitLayout
    ? "flex flex-col items-center justify-center gap-1.5 rounded-[20px] border-2 border-white bg-[#fffcf9] p-1.5 shadow-[0_14px_34px_-22px_rgba(93,64,55,0.34)] backdrop-blur"
    : "flex flex-col gap-2";
  const builderActionBarClass = isPortraitLayout
    ? "pointer-events-auto absolute left-0 right-0 top-[calc(0.55rem+env(safe-area-inset-top))] z-[95]"
    : "pointer-events-auto absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] right-3 sm:right-4";
  const builderEditorBodyClass = isPortraitLayout
    ? "flex min-h-0 flex-1 gap-1 overflow-hidden px-1 py-1"
    : "flex min-h-0 flex-1 gap-2.5 overflow-hidden px-3 py-3";
  const builderTabRailClass = isPortraitLayout
    ? "flex w-10 shrink-0 flex-col items-center gap-1.5 overflow-x-hidden overflow-y-auto rounded-[15px] bg-[#fffcf9] p-0.5"
    : "flex w-[58px] flex-col items-center gap-1.5 overflow-visible rounded-[22px] border-2 border-white bg-[#fffcf9] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] sm:w-[62px]";
  const builderTabButtonClass = (isActive: boolean, isDisabled: boolean) =>
    `${hudControlButtonClass(isPortraitLayout, isActive, isDisabled)} ${
      isPortraitLayout ? "" : "!h-11 !w-11 sm:!h-12 sm:!w-12"
    }`;
  const builderCancelButtonClass = isPortraitLayout
    ? "inline-flex min-w-0 flex-1 items-center justify-center rounded-xl border-[3px] border-white bg-[#fffcf9] px-4 py-3 text-[0.78rem] font-black uppercase tracking-[0.08em] text-[#8d6e63] shadow-[0_8px_20px_-14px_rgba(93,64,55,0.42)] transition hover:bg-[#fdf2e9]"
    : "inline-flex min-w-[9rem] items-center justify-center rounded-xl border-[3px] border-white bg-[#fffcf9] px-6 py-3 text-[0.95rem] font-black uppercase tracking-[0.14em] text-[#8d6e63] shadow-[0_10px_24px_-14px_rgba(93,64,55,0.42)] transition hover:-translate-y-[1px] hover:bg-[#fdf2e9]";
  const builderDraftButtonClass = isPortraitLayout
    ? "inline-flex w-[7.8rem] shrink-0 items-center justify-center rounded-xl border-[3px] border-white bg-[#fffcf9] px-3 py-2.5 text-center text-[0.68rem] font-black uppercase leading-tight tracking-[0.08em] text-[#8d6e63] shadow-[0_8px_20px_-14px_rgba(93,64,55,0.42)] transition hover:bg-[#fdf2e9] disabled:cursor-wait disabled:opacity-70"
    : "inline-flex w-[9rem] shrink-0 items-center justify-center rounded-xl border-[3px] border-white bg-[#fffcf9] px-3 py-2.5 text-center text-[0.72rem] font-black uppercase leading-tight tracking-[0.1em] text-[#8d6e63] shadow-[0_10px_24px_-14px_rgba(93,64,55,0.42)] transition hover:-translate-y-[1px] hover:bg-[#fdf2e9] disabled:cursor-wait disabled:opacity-70";
  const builderFinishButtonClass = isPortraitLayout
    ? "group inline-flex min-w-0 flex-1 items-center justify-center rounded-xl bg-[#2d3436] px-4 py-3 text-[0.9rem] font-black text-white shadow-[0_4px_0_0_#111827] transition-all hover:brightness-105 active:translate-y-[4px] active:shadow-none"
    : "group inline-flex min-w-[15rem] items-center justify-center rounded-xl bg-[#2d3436] px-10 py-3 text-[1.1rem] font-black text-white shadow-[0_4px_0_0_#111827] transition-all hover:brightness-105 active:translate-y-[4px] active:shadow-none";
  const builderActionTooltipClass = hudTooltipClass("action");
  const builderSceneFrameClass = isPortraitLayout
    ? "fixed left-0 right-0 top-0 z-0 h-[51dvh] overflow-hidden"
    : "fixed inset-0 z-0";
  const builderPanelInnerClass = isPortraitLayout
    ? "flex min-h-0 flex-1 flex-col overflow-hidden bg-[#f7f1ee]"
    : `flex min-h-0 flex-1 flex-col overflow-visible ${hudInnerSurfaceClass(false)}`;
  const builderPanelHeaderClass = isPortraitLayout
    ? "px-2 py-1"
    : "border-b border-[#eadfd9] px-4 py-3";
  const markerMapHeight = isPortraitLayout
    ? "100%"
    : "clamp(170px, 32dvh, 320px)";
  const loadingMessage =
    loadingTips[loadingTipIndex] ?? "Происходит загрузка страницы...";
  const mainStyle: CSSProperties = {
    minHeight: "100dvh",
    marginTop:
      isBuilderStep || isInitialStep ? `calc(-1 * ${headerOffset})` : 0,
    paddingTop: isBuilderStep
      ? 0
      : isInitialStep
        ? 0
        : `calc(${headerOffset} + 24px)`,
  };
  const mobileOverlayTabs: Array<{
    id: BuilderOverlayId;
    label: string;
    disabled: boolean;
    highlight: boolean;
  }> = [
    {
      id: "details",
      label: "Редактор",
      disabled: false,
      highlight: false,
    },
    {
      id: "base",
      label: "Основные данные",
      disabled: false,
      highlight: !isEditMode && isBuilderStep && !visitedOverlays.base,
    },
    {
      id: "story",
      label: "История",
      disabled: false,
      highlight: !isEditMode && isBuilderStep && !visitedOverlays.story,
    },
    {
      id: "marker",
      label: "Маркер на карте",
      disabled: false,
      highlight: !isEditMode && isBuilderStep && !visitedOverlays.marker,
    },
    {
      id: "photos",
      label: "Фотографии",
      disabled: false,
      highlight: !isEditMode && isBuilderStep && !visitedOverlays.photos,
    },
    {
      id: "soul",
      label: "Цвет души",
      disabled: false,
      highlight: !isEditMode && isBuilderStep && !visitedOverlays.soul,
    },
  ];

  if (isEditMode && (!authReady || !editReady)) {
    return (
      <main className="min-h-[calc(100vh-var(--app-header-height,0px))] bg-[var(--bg)]">
        <div className="flex min-h-[calc(100vh-var(--app-header-height,0px))] items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-sm font-semibold text-[#8d6e63]">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#d8cfc9] border-t-[#5d4037]" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className={`relative bg-[var(--bg)] ${
        isBuilderStep
          ? "h-[100dvh] overflow-hidden"
          : isInitialStep
            ? "h-[100dvh] overflow-y-auto overscroll-contain"
            : "px-4 pb-8"
      }`}
      style={mainStyle}
    >
      {detailTooltip ? (
        <div
          className="pointer-events-none fixed z-[5000] rounded-[14px] border-2 border-white bg-[#fffcf9] px-3 py-2 text-left shadow-[0_18px_38px_-22px_rgba(93,64,55,0.55)] backdrop-blur"
          style={{
            left: detailTooltip.left,
            top: detailTooltip.top,
            width: detailTooltip.width,
          }}
        >
          <p className="text-[10px] font-black uppercase leading-tight tracking-[0.08em] text-[#5d4037]">
            {detailTooltip.name}
          </p>
          <p className="mt-1 text-[10px] font-bold leading-snug text-[#8d6e63]">
            {detailTooltip.description}
          </p>
        </div>
      ) : null}
      {isInitialStep && !soulPreviewReady ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#f7f1ee]/72 px-4 backdrop-blur-lg">
          <div className="rounded-[28px] border-[4px] border-white bg-white/[0.92] px-7 py-6 text-center shadow-[0_24px_70px_-28px_rgba(93,64,55,0.5)]">
            <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-[#eadfd9] border-t-[#5d4037]" />
            <p className="mt-4 text-xs font-semibold text-[#8d6e63]">
              {loadingMessage}
            </p>
          </div>
        </div>
      ) : null}
      {isTransitioning ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-[var(--bg)]">
          <div className="flex flex-col items-center gap-3 text-center text-sm font-semibold text-[#8d6e63]">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#d8cfc9] border-t-[#5d4037]" />
            {loadingMessage}
            <div className="h-2 w-48 overflow-hidden rounded-full bg-[#eadfd9]">
              <div
                className="h-full bg-[#5d4037] transition-[width] duration-200"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
          </div>
        </div>
      ) : null}
      {!isBuilderStep ? (
        <div
          className={
            isInitialStep ? "w-full" : "mx-auto w-full max-w-none lg:w-[90vw]"
          }
        >
          <section
            className={
              isInitialStep ? "h-full" : "mt-6 rounded-2xl bg-[#f6efea]/82 p-5"
            }
          >
            {step === 0 ? (
              <div
                className={`relative box-border flex min-h-[100dvh] overflow-visible bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.92),_rgba(244,236,231,0.98)_36%,_rgba(238,228,222,1)_100%)] px-3 py-4 sm:px-4 ${
                  isPortraitLayout
                    ? "flex-col items-center justify-start gap-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]"
                    : "items-center justify-center pt-[calc(var(--app-header-height,56px)+0.8rem)]"
                }`}
              >
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.3),transparent_35%,rgba(214,190,176,0.18)_100%)]" />
                {isPortraitLayout ? (
                  <button
                    type="button"
                    onClick={() => router.push("/")}
                    className="relative z-20 shrink-0 rounded-full border-[3px] border-white bg-[#fffcf9] px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#5d4037] shadow-[0_12px_28px_-18px_rgba(93,64,55,0.55)] transition hover:bg-[#fff7f2]"
                  >
                    На главную
                  </button>
                ) : null}
                <div className="relative z-10 w-full max-w-[1120px] px-1 sm:px-0">
                  <div className="relative overflow-visible rounded-[38px] border-[3px] border-white/80 bg-[#efe6e2] p-3 shadow-[0_32px_64px_rgba(89,71,65,0.2)] transition-transform duration-300 ease-out hover:scale-[1.006] sm:rounded-[46px] sm:p-4 lg:p-5">
                    <div className="pointer-events-none absolute left-1/2 top-0 hidden h-24 w-[44%] -translate-x-1/2 -translate-y-[46%] rounded-t-[140px] border border-b-0 border-white/70 bg-[#efe6e2] shadow-[0_-6px_18px_rgba(255,255,255,0.35)] md:block" />
                    <div className="relative grid w-full items-stretch gap-4 md:grid-cols-[minmax(280px,0.9fr)_minmax(390px,1fr)] lg:gap-5">
                      {renderSoulPicker()}
                      <div className="relative grid h-full w-full grid-rows-[auto_minmax(1rem,1fr)_auto_minmax(1rem,1fr)_auto_minmax(1rem,1fr)_auto_minmax(1rem,1fr)_auto] rounded-[30px] border border-white/70 bg-[#f7f1ee] px-5 py-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_8px_18px_rgba(126,102,93,0.08)] sm:min-h-[500px] sm:rounded-[34px] sm:px-7 sm:py-7 [&_input]:!rounded-[20px] [&_input]:!border-[#d8cfc9] [&_input]:!bg-[#f1ebe9] [&_input]:!text-[16px] [&_input]:!font-semibold [&_input]:!text-[#6f6360] [&_label]:!text-[13px] [&_label]:!font-medium [&_label]:!text-[#8a7c77] [&_select]:!rounded-[20px] [&_select]:!border-[#d8cfc9] [&_select]:!bg-[#f1ebe9] [&_select]:!text-[16px] [&_select]:!font-semibold [&_select]:!text-[#6f6360]">
                        {renderNameField(true)}
                        <div aria-hidden />
                        {renderSpeciesField(true)}
                        <div aria-hidden />
                        {renderBirthDateField(true)}
                        <div aria-hidden />
                        {renderDeathDateField(true)}
                        <div aria-hidden />
                        {renderDateValidationMessage(
                          "pointer-events-none absolute bottom-[5.35rem] left-0 right-0 min-h-[16px] text-center sm:bottom-[5.65rem]",
                        )}
                        <div className="grid gap-2">
                          <span
                            aria-hidden
                            className="invisible text-[13px] font-medium leading-normal"
                          >
                            Продолжить
                          </span>
                          {renderNavButtons(
                            "shrink-0",
                            "w-full rounded-[24px] bg-[#111827] px-8 py-4 text-[13px] font-black uppercase tracking-[0.22em] text-white shadow-[0_12px_24px_-8px_rgba(17,24,39,0.5)] transition-all duration-300 hover:scale-[1.03] hover:bg-[#1f2937] active:scale-[0.98]",
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : (
        <>
          <div
            className={builderSceneFrameClass}
            onPointerDown={handleBuilderScenePointerDown}
            onPointerUp={handleBuilderScenePointerUp}
            onPointerCancel={handleBuilderScenePointerCancel}
          >
            <MemorialPreview
              className="h-full w-full rounded-none border-transparent bg-transparent"
              terrainUrl={environmentUrl}
              terrainId={environmentPreviewId}
              houseUrl={houseUrl}
              houseId={housePreviewId}
              suppressLoadingOverlay
              cameraPosition={isPortraitLayout ? [10, 6, 10] : [8, 5, 8]}
              houseOffsetX={previewHousePlacement.x}
              houseOffsetZ={previewHousePlacement.z}
              houseRotationY={previewHousePlacement.rotY}
              houseScaleMultiplier={previewHouseScale}
              soulColor={soulPreviewColor}
              soulPath={activeSoulPath}
              showSoulPathMarkers={
                canUseCalibration(accessLevel) && activeOverlay === "soul"
              }
              showMeterGrid={canUseCalibration(accessLevel) && showMeterGrid}
              soulMode={soulSceneMode}
              parts={partList}
              detailPartOverrides={previewDetailPartOverrides}
              gifts={
                !mapPreviewCaptureWithoutGifts && giftPreviewEnabled
                  ? previewGifts
                  : undefined
              }
              giftSlots={
                !mapPreviewCaptureWithoutGifts &&
                giftPreviewEnabled &&
                previewPlaceholderSlots.length > 0
                  ? previewPlaceholderSlots
                  : undefined
              }
              showGiftSlots={
                !mapPreviewCaptureWithoutGifts &&
                giftPreviewEnabled &&
                previewPlaceholderSlots.length > 0
              }
              enableHoverHighlight
              colors={colorOverrides}
              focusSlot={focusSlot}
              focusRequestId={focusRequestId}
              showControls={false}
              controlsEnabled={!farewellPlaying}
              preserveDrawingBuffer={false}
              onControlsReady={(controls) => {
                previewControlsRef.current = controls;
              }}
              onRenderContextReady={(context) => {
                previewRenderRef.current = context;
              }}
              cameraOffsetAdjustments={cameraOffsetAdjustments}
              cameraAdjustmentKey={activeCameraKey}
              onHouseSlotsDetected={setDetectedHouseSlots}
              onGiftSlotsDetected={setDetectedGiftSlots}
              onDetailClick={handlePreviewDetailClick}
            />
          </div>

          {farewellPlaying ? (
            <div className="pointer-events-none fixed inset-x-0 bottom-8 z-20 flex justify-center px-4">
              <div className="rounded-[24px] border-[3px] border-white bg-[#fffcf9] px-5 py-3 text-center text-[11px] font-black uppercase tracking-[0.16em] text-[#5d4037] shadow-[0_18px_42px_-24px_rgba(93,64,55,0.55)] backdrop-blur">
                Душа облетает мемориал
              </div>
            </div>
          ) : (
            <div className="pointer-events-none fixed inset-0 z-10">
              {isPortraitLayout &&
              activeOverlay === "marker" &&
              markerPanelTab === "map"
                ? renderFloatingMapControls()
                : null}

              <div className={builderEditorPanelClass}>
                <div className={builderPanelInnerClass}>
                  <div className={builderPanelHeaderClass}>
                    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                      <h3
                        className={
                          isPortraitLayout
                            ? "text-[10px] font-black uppercase tracking-[0.16em] text-[#8d6e63]"
                            : "text-[11px] font-black uppercase tracking-[0.24em] text-[#8d6e63]"
                        }
                      >
                        Редактор мемориала
                      </h3>
                      <div
                        className={
                          isPortraitLayout
                            ? "flex min-w-0 flex-wrap items-center justify-end gap-1.5"
                            : "flex min-w-0 flex-wrap items-center justify-end gap-3"
                        }
                      >
                        {isEditMode ? (
                          <span
                            className={
                              isPortraitLayout
                                ? "rounded-full bg-[#fffcf9] px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-[#3bceac]"
                                : "rounded-full bg-[#fffcf9] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#3bceac]"
                            }
                          >
                            Только оформление
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={randomizeMemorialModels}
                          className={
                            isPortraitLayout
                              ? "group relative z-[120] flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#fffcf9] text-[#5d4037] shadow-[0_10px_22px_-18px_rgba(93,64,55,0.5)] transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5d4037]"
                              : "group relative z-[120] flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#fffcf9] text-[#5d4037] shadow-[0_10px_22px_-18px_rgba(93,64,55,0.5)] transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5d4037]"
                          }
                          title="Собрать случайный мемориал"
                          aria-label="Собрать случайный мемориал"
                        >
                          <svg
                            viewBox="0 0 24 24"
                            className={
                              isPortraitLayout ? "h-3.5 w-3.5" : "h-4 w-4"
                            }
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            aria-hidden="true"
                          >
                            <rect x="4" y="4" width="16" height="16" rx="4" />
                            <path d="M9 9h.01M15 9h.01M12 12h.01M9 15h.01M15 15h.01" />
                          </svg>
                          <span
                            className={
                              isPortraitLayout
                                ? "pointer-events-none fixed right-3 top-20 z-[9999] w-56 rounded-lg border border-[#eadfd9] bg-white px-3 py-2 text-[11px] font-normal normal-case tracking-normal text-[#6f6360] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                                : "pointer-events-none fixed right-8 top-24 z-[9999] w-64 rounded-lg border border-[#eadfd9] bg-white px-3 py-2 text-[11px] font-normal normal-case tracking-normal text-[#6f6360] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                            }
                          >
                            Случайно выбирает поверхность, домик, текстуру и
                            детали. Данные питомца не меняются.
                          </span>
                        </button>
                        <label
                          className={
                            isPortraitLayout
                              ? "group relative z-[120] flex max-w-full items-center gap-1.5 rounded-full bg-[#fffcf9] px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-[#3b8d76]"
                              : "group relative z-[120] flex items-center gap-2 rounded-full bg-[#fffcf9] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#3b8d76]"
                          }
                        >
                          <input
                            type="checkbox"
                            className={
                              isPortraitLayout
                                ? "h-3.5 w-3.5 shrink-0 rounded border-[#d8cfc9]"
                                : "h-4 w-4 shrink-0 rounded border-[#d8cfc9]"
                            }
                            checked={giftPreviewEnabled}
                            onChange={(event) =>
                              setGiftPreviewEnabled(event.target.checked)
                            }
                          />
                          <span className="truncate">Посмотреть</span>
                          <span className="pointer-events-none absolute right-0 top-full z-[1000] mt-2 w-56 rounded-lg border border-[#eadfd9] bg-white px-3 py-2 text-[11px] font-normal normal-case tracking-normal text-[#6f6360] opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                            При включении показываем мемориал с примерами
                            подарков, чтобы было видно, как они размещаются.
                          </span>
                        </label>
                        {canUseCalibration(accessLevel) ? (
                          <label
                            className={
                              isPortraitLayout
                                ? "group relative z-[120] flex max-w-full items-center gap-1.5 rounded-full bg-[#fffcf9] px-2 py-1 text-[9px] font-black uppercase tracking-[0.08em] text-[#3b8d76]"
                                : "group relative z-[120] flex items-center gap-2 rounded-full bg-[#fffcf9] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#3b8d76]"
                            }
                          >
                            <input
                              type="checkbox"
                              className={
                                isPortraitLayout
                                  ? "h-3.5 w-3.5 shrink-0 rounded border-[#d8cfc9]"
                                  : "h-4 w-4 shrink-0 rounded border-[#d8cfc9]"
                              }
                              checked={showMeterGrid}
                              onChange={(event) =>
                                setShowMeterGrid(event.target.checked)
                              }
                            />
                            <span className="truncate">Сетка 1 м</span>
                            <span className="pointer-events-none absolute right-0 top-full z-[1000] mt-2 w-56 rounded-lg border border-[#eadfd9] bg-white px-3 py-2 text-[11px] font-normal normal-case tracking-normal text-[#6f6360] opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                              Полупрозрачный объемный куб с сеткой 1 метр для
                              проверки размеров и расстояний.
                            </span>
                          </label>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className={builderEditorBodyClass}>
                    {isPortraitLayout ? (
                      <>
                        <div className={builderTabRailClass}>
                          {mobileOverlayTabs.map((tab) => {
                            const isActive = activeOverlay === tab.id;
                            return (
                              <div key={tab.id} className="relative">
                                <button
                                  type="button"
                                  onClick={() => toggleOverlay(tab.id)}
                                  disabled={tab.disabled}
                                  aria-label={tab.label}
                                  title={tab.label}
                                  className={`${builderTabButtonClass(isActive, tab.disabled)} ${tab.disabled ? "pointer-events-none cursor-not-allowed opacity-40" : ""}`}
                                >
                                  <BuilderOverlayIcon id={tab.id} />
                                  <span className="sr-only">{tab.label}</span>
                                  {tab.highlight ? (
                                    <span
                                      className={builderAttentionBadgeClass}
                                    >
                                      !
                                    </span>
                                  ) : null}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div className={builderTabRailClass}>
                        {step3Tabs.map((tab) => {
                          const isActive = activeStep3Tab === tab.id;
                          const isDisabled = false;
                          const isTooltipVisible = tooltipTabId === tab.id;
                          const description = STEP3_TAB_DESCRIPTIONS[tab.id];
                          return (
                            <div key={tab.id} className="relative">
                              <button
                                type="button"
                                onClick={() => handleStep3TabSelect(tab)}
                                disabled={isDisabled}
                                onMouseEnter={() => {
                                  if (isDisabled) {
                                    return;
                                  }
                                  clearStep3TooltipTimer();
                                  setTooltipTabId(tab.id);
                                }}
                                onMouseLeave={() => {
                                  clearStep3TooltipTimer();
                                  setTooltipTabId((prev) =>
                                    prev === tab.id ? null : prev,
                                  );
                                }}
                                onFocus={() => {
                                  if (isDisabled) {
                                    return;
                                  }
                                  clearStep3TooltipTimer();
                                  setTooltipTabId(tab.id);
                                }}
                                onBlur={() => {
                                  clearStep3TooltipTimer();
                                  setTooltipTabId((prev) =>
                                    prev === tab.id ? null : prev,
                                  );
                                }}
                                aria-label={tab.label}
                                title={tab.label}
                                className={builderTabButtonClass(
                                  isActive,
                                  isDisabled,
                                )}
                              >
                                <Step3TabIcon id={tab.id} />
                                <span className="sr-only">{tab.label}</span>
                              </button>
                              {isTooltipVisible ? (
                                <div className="pointer-events-none absolute left-full top-1/2 z-30 ml-4 w-56 -translate-y-1/2 rounded-xl border border-[#eadfd9] bg-[#fffcf9] px-3 py-2 text-[11px] text-[#6f6360] shadow-lg">
                                  <div className="font-semibold text-[#5d4037]">
                                    {tab.label}
                                  </div>
                                  <div className="mt-1 text-[#8d6e63]">
                                    {description}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden">
                      <div
                        key={
                          isPortraitLayout &&
                          activeOverlay &&
                          activeOverlay !== "details"
                            ? `overlay-${activeOverlay}`
                            : `detail-${activeStep3Tab}`
                        }
                        className="relative z-10 min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain pr-1 pb-3"
                      >
                        {isPortraitLayout
                          ? activeOverlay
                            ? renderActiveOverlayContent()
                            : null
                          : renderStep3TabContent()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {activeOverlay &&
              activeOverlay !== "details" &&
              !isPortraitLayout ? (
                <div
                  className={overlayPanelClass(
                    activeOverlay === "marker"
                      ? "marker"
                      : activeOverlay === "soul"
                        ? "soul"
                        : undefined,
                  )}
                >
                  {renderActiveOverlayContent()}
                </div>
              ) : null}

              <div className={builderOverlayButtonsWrapClass}>
                <div className={builderOverlayButtonsClass}>
                  <div className="group/control relative">
                    <button
                      type="button"
                      onClick={() => toggleOverlay("soul")}
                      aria-label="Цвет души"
                      title="Цвет души"
                      className={panelButtonClass(
                        activeOverlay === "soul",
                        !isEditMode && isBuilderStep && !visitedOverlays.soul,
                      )}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-7 w-7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 3c1.2 3.4 2.9 5.1 6 6-3.1.9-4.8 2.6-6 6-1.2-3.4-2.9-5.1-6-6 3.1-.9 4.8-2.6 6-6z" />
                        <path d="M18 14c.7 1.7 1.6 2.6 3 3-.4.2-2.2.8-3 3-.8-2.2-2.6-2.8-3-3 1.4-.4 2.3-1.3 3-3z" />
                        <path d="M6 15c.5 1.3 1.2 2 2.4 2.4C7.2 17.8 6.5 18.5 6 20c-.5-1.5-1.2-2.2-2.4-2.6C4.8 17 5.5 16.3 6 15z" />
                      </svg>
                      {!isEditMode && isBuilderStep && !visitedOverlays.soul ? (
                        <span className={builderAttentionBadgeClass}>!</span>
                      ) : null}
                    </button>
                    <span className={builderControlTooltipClass}>
                      Цвет души
                    </span>
                  </div>
                  <div className="group/control relative">
                    <button
                      type="button"
                      onClick={() => toggleOverlay("base")}
                      aria-label="Основные данные"
                      title="Основные данные"
                      className={`${panelButtonClass(
                        activeOverlay === "base",
                        !isEditMode && isBuilderStep && !visitedOverlays.base,
                      )}`}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-7 w-7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 11v5" />
                        <circle cx="12" cy="8" r="1" />
                      </svg>
                      {!isEditMode && isBuilderStep && !visitedOverlays.base ? (
                        <span className={builderAttentionBadgeClass}>!</span>
                      ) : null}
                    </button>
                    <span className={builderControlTooltipClass}>
                      Основные данные
                    </span>
                  </div>
                  <div className="group/control relative">
                    <button
                      type="button"
                      onClick={() => toggleOverlay("story")}
                      aria-label="История"
                      title="История"
                      className={`${panelButtonClass(
                        activeOverlay === "story",
                        !isEditMode && isBuilderStep && !visitedOverlays.story,
                      )}`}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-7 w-7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M4 5h8a3 3 0 0 1 3 3v11" />
                        <path d="M20 19H10a3 3 0 0 0-3 3V6a3 3 0 0 1 3-3h10z" />
                      </svg>
                      {!isEditMode &&
                      isBuilderStep &&
                      !visitedOverlays.story ? (
                        <span className={builderAttentionBadgeClass}>!</span>
                      ) : null}
                    </button>
                    <span className={builderControlTooltipClass}>История</span>
                  </div>
                  <div className="group/control relative">
                    <button
                      type="button"
                      onClick={() => toggleOverlay("marker")}
                      aria-label="Маркер"
                      title="Маркер"
                      className={`${panelButtonClass(
                        activeOverlay === "marker",
                        !isEditMode && isBuilderStep && !visitedOverlays.marker,
                      )}`}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-7 w-7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 21s-6-6.5-6-11a6 6 0 1 1 12 0c0 4.5-6 11-6 11z" />
                        <circle cx="12" cy="10" r="2.5" />
                      </svg>
                      {!isEditMode &&
                      isBuilderStep &&
                      !visitedOverlays.marker ? (
                        <span className={builderAttentionBadgeClass}>!</span>
                      ) : null}
                    </button>
                    <span className={builderControlTooltipClass}>
                      Маркер на карте
                    </span>
                  </div>
                  <div className="group/control relative">
                    <button
                      type="button"
                      onClick={() => toggleOverlay("photos")}
                      aria-label="Фотографии"
                      title="Фотографии"
                      className={`${panelButtonClass(
                        activeOverlay === "photos",
                        !isEditMode && isBuilderStep && !visitedOverlays.photos,
                      )}`}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-7 w-7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="3" y="5" width="18" height="14" rx="2" />
                        <circle cx="9" cy="11" r="2" />
                        <path d="M21 15l-4-4-4 4-3-3-5 5" />
                      </svg>
                      {!isEditMode &&
                      isBuilderStep &&
                      !visitedOverlays.photos ? (
                        <span className={builderAttentionBadgeClass}>!</span>
                      ) : null}
                    </button>
                    <span className={builderControlTooltipClass}>
                      Фотографии
                    </span>
                  </div>
                </div>
              </div>

              <div className={builderActionBarClass}>
                {isPortraitLayout ? (
                  <div className="relative flex h-11 items-start justify-center px-2">
                    <button
                      type="button"
                      onClick={openMobileBuilderActions}
                      className="group inline-flex w-[min(47vw,13rem)] min-w-0 items-center justify-center rounded-xl bg-[#2d3436] px-3 py-1.5 text-center text-[0.68rem] font-black leading-tight text-white shadow-[0_2px_0_0_#111827] transition-all hover:brightness-105 active:translate-y-[2px] active:shadow-none"
                    >
                      {isEditMode ? "Сохранить" : "Сохранить/Продолжить"}
                    </button>
                    <button
                      type="button"
                      onClick={openMobileBuilderMenu}
                      className="absolute right-2 top-0 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-[3px] border-white bg-[#fffcf9] text-[#8d6e63] shadow-[0_8px_20px_-14px_rgba(93,64,55,0.42)] transition hover:bg-[#fdf2e9]"
                      aria-label="Меню"
                      title="Меню"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                      >
                        <path d="M5 7h14M5 12h14M5 17h14" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    {isEditMode && editId ? (
                      <button
                        type="button"
                        onClick={() => router.push(`/pets/${editId}`)}
                        className={builderCancelButtonClass}
                      >
                        Отмена
                      </button>
                    ) : null}
                    {!isEditMode ? (
                      <div className="group/draft-action relative shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            void saveCurrentDraft({ redirectToMyPets: true })
                          }
                          className={builderDraftButtonClass}
                          disabled={draftLoading}
                        >
                          {draftLoading ? (
                            "Сохраняем..."
                          ) : (
                            <>
                              Сохранить
                              <br />
                              черновик
                            </>
                          )}
                        </button>
                        <span
                          className={`${builderActionTooltipClass} group-hover/draft-action:opacity-100 group-focus-within/draft-action:opacity-100`}
                        >
                          Фотографии не сохраняются в черновике. Они будут
                          загружены только при публикации мемориала.
                        </span>
                      </div>
                    ) : null}
                    <div className="group/finish-action relative min-w-0 flex-1 sm:flex-none">
                      <button
                        type="button"
                        onClick={openReview}
                        className={builderFinishButtonClass}
                      >
                        <span className="transition-transform duration-300 group-hover:-translate-x-1">
                          {isEditMode ? "Сохранить" : "Завершить"}
                        </span>
                        {renderArrowIcon()}
                      </button>
                      <span
                        className={`${builderActionTooltipClass} group-hover/finish-action:opacity-100 group-focus-within/finish-action:opacity-100`}
                      >
                        Далее откроется проверка мемориала, после которой можно
                        будет оплатить и опубликовать его.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {mobileBuilderMenuOpen ? (
            <div
              className={`fixed inset-0 z-[980] flex items-center justify-center px-4 transition-opacity duration-200 ${
                mobileBuilderMenuVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              <button
                type="button"
                aria-label="Закрыть меню"
                className="absolute inset-0 bg-[#111827]/30 backdrop-blur-md"
                onClick={closeMobileBuilderMenu}
              />
              <div
                className={`relative grid w-full max-w-sm gap-2 rounded-[28px] border-[3px] border-white bg-[#f7f1ee] p-3 shadow-[0_28px_70px_-24px_rgba(93,64,55,0.55)] transition-transform duration-200 ${
                  mobileBuilderMenuVisible
                    ? "translate-y-0 scale-100"
                    : "translate-y-4 scale-95"
                }`}
              >
                <div className="flex items-center justify-between gap-3 rounded-[22px] bg-[#fffcf9] px-4 py-3">
                  <button
                    type="button"
                    onClick={() => navigateFromMobileMenu("/")}
                    className="text-xl font-black uppercase tracking-[0.02em] text-[#5d4037]"
                  >
                    МЯУГАВ
                  </button>
                  <button
                    type="button"
                    onClick={closeMobileBuilderMenu}
                    className="grid h-10 w-10 place-items-center rounded-full border-2 border-white bg-[#f7f1ee] text-xl font-black text-[#8d6e63]"
                    aria-label="Закрыть"
                  >
                    ×
                  </button>
                </div>
                {form.ownerId ? (
                  <button
                    type="button"
                    onClick={() => navigateFromMobileMenu("/my-pets")}
                    className="rounded-[18px] bg-[#fffcf9] px-4 py-3 text-left text-sm font-black uppercase tracking-[0.12em] text-[#5d4037]"
                  >
                    Мои питомцы
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      closeMobileBuilderMenu();
                      window.setTimeout(() => openAuthPrompt("draft"), 120);
                    }}
                    className="rounded-[18px] bg-[#fffcf9] px-4 py-3 text-left text-sm font-black uppercase tracking-[0.12em] text-[#5d4037]"
                  >
                    Войти
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => navigateFromMobileMenu("/map")}
                  className="rounded-[18px] bg-[#fffcf9] px-4 py-3 text-left text-sm font-black uppercase tracking-[0.12em] text-[#5d4037]"
                >
                  Карта
                </button>
                {form.ownerId ? (
                  <button
                    type="button"
                    onClick={() => navigateFromMobileMenu("/profile")}
                    className="rounded-[18px] bg-[#fffcf9] px-4 py-3 text-left text-sm font-black uppercase tracking-[0.12em] text-[#5d4037]"
                  >
                    Профиль
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => navigateFromMobileMenu("/news")}
                  className="rounded-[18px] bg-[#fffcf9] px-4 py-3 text-left text-sm font-black uppercase tracking-[0.12em] text-[#5d4037]"
                >
                  Новости
                </button>
                <button
                  type="button"
                  onClick={() => navigateFromMobileMenu("/about")}
                  className="rounded-[18px] bg-[#fffcf9] px-4 py-3 text-left text-sm font-black uppercase tracking-[0.12em] text-[#5d4037]"
                >
                  О проекте
                </button>
                <button
                  type="button"
                  onClick={() => navigateFromMobileMenu("/charity")}
                  className="rounded-[18px] bg-[#fffcf9] px-4 py-3 text-left text-sm font-black uppercase tracking-[0.12em] text-[#5d4037]"
                >
                  Благотворительность
                </button>
                {canAccessAdmin(accessLevel) ? (
                  <button
                    type="button"
                    onClick={() => navigateFromMobileMenu("/admin/sql")}
                    className="rounded-[18px] bg-[#fffcf9] px-4 py-3 text-left text-sm font-black uppercase tracking-[0.12em] text-[#5d4037]"
                  >
                    Админ-панель
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {mobileBuilderActionsOpen ? (
            <div
              className={`fixed inset-0 z-[980] flex items-center justify-center px-4 transition-opacity duration-200 ${
                mobileBuilderActionsVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              <button
                type="button"
                aria-label="Закрыть выбор действия"
                className="absolute inset-0 bg-[#111827]/30 backdrop-blur-md"
                onClick={closeMobileBuilderActions}
              />
              <div
                className={`relative grid w-full max-w-sm gap-3 rounded-[28px] border-[3px] border-white bg-[#f7f1ee] p-3 shadow-[0_28px_70px_-24px_rgba(93,64,55,0.55)] transition-transform duration-200 ${
                  mobileBuilderActionsVisible
                    ? "translate-y-0 scale-100"
                    : "translate-y-4 scale-95"
                }`}
              >
                <div className="rounded-[22px] bg-[#fffcf9] px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8d6e63]">
                    Действие
                  </p>
                  <h3 className="text-xl font-black text-[#5d4037]">
                    {isEditMode
                      ? "Сохранить изменения?"
                      : "Что сделать дальше?"}
                  </h3>
                </div>
                {!isEditMode ? (
                  <button
                    type="button"
                    onClick={handleMobileSaveDraftAction}
                    disabled={draftLoading}
                    className="rounded-[20px] border-[3px] border-white bg-[#fffcf9] px-4 py-4 text-left text-sm font-black uppercase tracking-[0.12em] text-[#5d4037] shadow-[0_10px_24px_-18px_rgba(93,64,55,0.45)] disabled:cursor-wait disabled:opacity-70"
                  >
                    {draftLoading ? "Сохраняем..." : "Сохранить черновик"}
                    <span className="mt-1 block text-[11px] font-semibold normal-case tracking-normal text-[#8d6e63]">
                      Фотографии сохраняются только при публикации.
                    </span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleMobileFinishAction}
                  className="rounded-[20px] bg-[#2d3436] px-4 py-4 text-left text-sm font-black uppercase tracking-[0.12em] text-white shadow-[0_5px_0_0_#111827] active:translate-y-[4px] active:shadow-none"
                >
                  {isEditMode ? "Сохранить" : "Завершить"}
                  <span className="mt-1 block text-[11px] font-semibold normal-case tracking-normal text-white/75">
                    {isEditMode
                      ? "Откроется проверка изменений перед сохранением."
                      : "Откроется проверка мемориала перед публикацией."}
                  </span>
                </button>
                {isEditMode && editId ? (
                  <button
                    type="button"
                    onClick={() => {
                      closeMobileBuilderActions();
                      window.setTimeout(
                        () => router.push(`/pets/${editId}`),
                        120,
                      );
                    }}
                    className="rounded-[18px] bg-[#fffcf9] px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-[#8d6e63]"
                  >
                    Отмена
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {reviewOpen ? (
            <div
              className={`fixed inset-0 z-[950] flex items-center justify-center px-4 transition-opacity duration-200 ${
                reviewVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              <button
                type="button"
                aria-label="Закрыть"
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={closeReview}
              />
              <div
                className={`relative w-full max-w-5xl max-h-[85vh] overflow-y-auto rounded-3xl border border-[#eadfd9] bg-white p-6 shadow-2xl transition-transform duration-200 ${
                  reviewVisible
                    ? "translate-y-0 scale-100"
                    : "translate-y-4 scale-95"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-[#5d4037]">
                    Проверка мемориала
                  </h3>
                  <button
                    type="button"
                    className="btn btn-ghost px-3 py-2"
                    onClick={closeReview}
                  >
                    Закрыть
                  </button>
                </div>

                <div className="mt-4 grid gap-6">
                  <div className="rounded-2xl border border-[#eadfd9] bg-[#fcf8f5] p-5">
                    <div className="grid gap-2 text-sm text-[#6f6360]">
                      <p>Имя: {form.name || "—"}</p>
                      <p>Дата рождения: {form.birthDate || "—"}</p>
                      <p>Дата ухода: {form.deathDate || "—"}</p>
                      <p className="break-words">
                        Эпитафия:{" "}
                        <span className="break-all">{form.epitaph || "—"}</span>
                      </p>
                      <p className="break-words">
                        История:{" "}
                        <span className="whitespace-pre-wrap break-all">
                          {form.story || "—"}
                        </span>
                      </p>
                    </div>
                    {photos.length > 0 ? (
                      <div className="mt-4">
                        <div className="flex gap-3 overflow-x-auto pb-2">
                          {photos.map((photo) => (
                            <img
                              key={photo.id}
                              src={photo.url}
                              alt="Фото питомца"
                              className="rounded-xl object-cover"
                              style={{ width: 260, height: 200 }}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="grid gap-3">
                    <MemorialPreview
                      terrainUrl={environmentUrl}
                      terrainId={form.environmentId}
                      houseUrl={houseUrl}
                      houseId={form.houseId}
                      houseOffsetX={activeHousePlacement.x}
                      houseOffsetZ={activeHousePlacement.z}
                      houseRotationY={activeHousePlacement.rotY}
                      houseScaleMultiplier={activeHouseScale}
                      soulColor={soulPreviewColor}
                      soulPath={activeSoulPath}
                      showSoulPathMarkers={canUseCalibration(accessLevel)}
                      soulMode="idle"
                      parts={partList}
                      detailPartOverrides={currentDetailPartOverrides}
                      colors={colorOverrides}
                      softEdges
                      className="h-[420px]"
                    />
                    <div className="rounded-2xl border border-[#eadfd9] bg-white p-5">
                      <div className="grid gap-3 text-sm text-[#6f6360]">
                        <p className="font-semibold text-[#5d4037]">
                          {isEditMode
                            ? "Сохранение изменений"
                            : "Оплата мемориала"}
                        </p>
                        {isEditMode ? (
                          <p className="text-xs text-[#8d6e63]">
                            Сохраним оформление, основные данные, историю и
                            фотографии, которые вы изменили.
                          </p>
                        ) : (
                          <>
                            <p className="text-xs text-[#8d6e63]">
                              {form.ownerId
                                ? `Баланс: ${walletLoading ? "Загрузка..." : (walletBalance ?? "—")} монет`
                                : "Вы собрали мемориал без входа. Для публикации нужно войти или зарегистрироваться."}
                            </p>
                            <div className="grid gap-2">
                              {memorialPlans.map((plan) => {
                                const isSelected = plan.id === memorialPlanId;
                                return (
                                  <button
                                    key={plan.id}
                                    type="button"
                                    onClick={() => setMemorialPlanId(plan.id)}
                                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm transition ${
                                      isSelected
                                        ? "border-[#3bceac] bg-[#f0fffb] text-[#5d4037]"
                                        : "border-[#eadfd9] text-[#6f6360] hover:border-[#d3a27f]"
                                    }`}
                                  >
                                    <span className="font-semibold">
                                      {plan.label}
                                    </span>
                                    <span className="text-[#8d6e63]">
                                      {plan.price} монет
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleSubmit()}
                          className="group mt-2 inline-flex items-center justify-center rounded-2xl bg-[#111827] px-6 py-3 text-sm font-semibold text-white shadow-[0_6px_0_0_#000] transition-all hover:-translate-y-[1px] hover:shadow-[0_7px_0_0_#000] active:translate-y-[4px] active:shadow-none"
                          disabled={loading}
                        >
                          <span className="transition-transform duration-300 group-hover:-translate-x-1">
                            {loading
                              ? isEditMode
                                ? "Сохранение..."
                                : "Публикация..."
                              : isEditMode
                                ? "Сохранить"
                                : form.ownerId
                                  ? `Опубликовать мемориал • ${memorialPrice} монет`
                                  : "Войти / зарегистрироваться и опубликовать"}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}

      <ConfirmDialog
        open={publishModerationConfirmOpen}
        eyebrow="Модерация"
        title="Отправить мемориал на проверку?"
        message="После подтверждения мы спишем монеты, опубликуем мемориал только для вас и отправим его на модерацию."
        helperText="После проверки вам придет письмо. Публичный мемориал появится на карте только после одобрения, а приватный останется виден только вам."
        cancelAction={{
          label: "Вернуться",
          onClick: () => setPublishModerationConfirmOpen(false),
          variant: "secondary",
        }}
        confirmAction={{
          label: loading ? "Публикация..." : "Подтвердить",
          onClick: () => void handleSubmit({ confirmedModeration: true }),
          disabled: loading,
          variant: "primary",
        }}
        onClose={() => setPublishModerationConfirmOpen(false)}
      />

      <ConfirmDialog
        open={editModerationConfirmOpen}
        eyebrow="Модерация"
        title="Отправить изменения на проверку?"
        message={
          editModerationStatus === "NEEDS_CHANGES"
            ? "После сохранения мемориал снова перейдет в статус «На проверке», чтобы модератор увидел исправления."
            : "Вы изменили основные данные, историю или фотографии. После сохранения мемориал снова перейдет на модерацию."
        }
        helperText="Пока проверка не завершится, мемориал будет виден только вам. После модерации мы отправим уведомление на почту."
        cancelAction={{
          label: "Вернуться",
          onClick: () => setEditModerationConfirmOpen(false),
          variant: "secondary",
        }}
        confirmAction={{
          label: loading ? "Сохранение..." : "Сохранить",
          onClick: () => void handleSubmit({ confirmedEditModeration: true }),
          disabled: loading,
          variant: "primary",
        }}
        onClose={() => setEditModerationConfirmOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(leaveConfirmHref)}
        eyebrow="Черновик"
        title="Сохранить перед переходом?"
        message="Вы начали собирать мемориал. Можно остаться на странице, перейти без сохранения или сохранить черновик в аккаунте."
        helperText="Для сохранения нужно войти или зарегистрироваться. Фотографии сохраняются только при публикации мемориала."
        cancelAction={{
          label: "Остаться",
          onClick: closeLeaveConfirm,
          variant: "secondary",
        }}
        extraAction={{
          label: "Без сохранения",
          onClick: continueWithoutDraft,
          variant: "secondary",
        }}
        confirmAction={{
          label: draftLoading ? "Сохранение..." : "Сохранить",
          onClick: saveDraftBeforeNavigation,
          disabled: draftLoading,
          variant: "primary",
        }}
        onClose={closeLeaveConfirm}
      />

      <AuthModal
        open={authPromptOpen}
        visible={authPromptVisible}
        title={
          authPromptPurpose === "draft"
            ? "Сохранение черновика"
            : "Публикация мемориала"
        }
        helperText={
          authPromptPurpose === "draft"
            ? "Войдите или зарегистрируйтесь, чтобы сохранить черновик в аккаунте. Фотографии сохраняются только при публикации."
            : "Войдите или зарегистрируйтесь, чтобы сохранить готовый мемориал в аккаунте и опубликовать его."
        }
        successRedirect={null}
        onClose={closeAuthPrompt}
        onSuccess={(payload: AuthUser) => {
          setForm((prev) => ({ ...prev, ownerId: payload.id }));
          setCurrentUserLogin(payload.login ?? null);
          setAccessLevel(payload.accessLevel ?? "USER");
          setWalletBalance(
            typeof payload.coinBalance === "number"
              ? payload.coinBalance
              : null,
          );
          setAuthReady(true);
          closeAuthPrompt();
          if (authPromptPurpose === "draft") {
            setPendingDraftAfterAuth(true);
          } else {
            setPendingPublishAfterAuth(true);
          }
        }}
      />

      <ErrorToast message={error} onClose={() => setError(null)} />
      <ErrorToast
        message={draftNotice}
        onClose={() => setDraftNotice(null)}
        variant="success"
        offset={72}
      />

      {topUpOpen ? (
        <div
          className={`fixed inset-0 z-[999] flex items-center justify-center px-4 transition-opacity duration-200 ${
            topUpVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <button
            type="button"
            aria-label="Закрыть"
            className="absolute inset-0 bg-[#111827]/30 backdrop-blur-md"
            onClick={closeTopUp}
          />
          <div
            className={`relative w-full max-w-md rounded-[36px] border-[4px] border-white bg-[#efe6e2] p-3 shadow-[0_28px_70px_-24px_rgba(93,64,55,0.55)] transition-transform duration-200 ${
              topUpVisible
                ? "translate-y-0 scale-100"
                : "translate-y-4 scale-95"
            }`}
          >
            <div className="rounded-[28px] border border-white/80 bg-white/[0.86] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_24px_rgba(126,102,93,0.08)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d3a27f]">
                    Баланс
                  </p>
                  <h3 className="mt-1 text-lg font-black text-[#5d4037]">
                    Пополнение баланса
                  </h3>
                </div>
                <button
                  type="button"
                  className="rounded-[16px] border-[3px] border-white bg-[#f1e7e0] px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#8d6e63] shadow-[0_10px_24px_-18px_rgba(93,64,55,0.55)] transition hover:bg-white"
                  onClick={closeTopUp}
                >
                  Закрыть
                </button>
              </div>
              <p className="mt-3 rounded-[18px] bg-[#f7f1ee] px-4 py-3 text-sm font-semibold text-[#8d6e63]">
                Баланс:{" "}
                {walletLoading
                  ? "Загрузка..."
                  : walletBalance !== null
                    ? `${walletBalance} монет`
                    : "—"}
              </p>
              <div className="mt-4 flex gap-2 rounded-[20px] bg-[#f1e7e0] p-1.5">
                {(["RUB", "USD"] as const).map((currency) => {
                  const isActive = topUpCurrency === currency;
                  return (
                    <button
                      key={currency}
                      type="button"
                      onClick={() => setTopUpCurrency(currency)}
                      className={`flex-1 rounded-[15px] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] transition ${
                        isActive
                          ? "bg-[#111827] text-white shadow-[0_3px_0_0_#000]"
                          : "text-[#8d6e63] hover:bg-white/70"
                      }`}
                    >
                      {currency}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 grid gap-2">
                {topUpOptions.map((option) => {
                  const isSelected = topUpPlan === option.coins;
                  const price =
                    topUpCurrency === "RUB"
                      ? `${option.rub} ₽`
                      : `${option.usd} USD`;
                  return (
                    <button
                      key={option.coins}
                      type="button"
                      onClick={() => setTopUpPlan(option.coins)}
                      className={`flex items-center justify-between rounded-[22px] border-[3px] px-4 py-3 text-sm transition ${
                        isSelected
                          ? "border-[#3bceac] bg-[#f0fffb] text-[#5d4037] shadow-[0_10px_24px_-18px_rgba(59,206,172,0.55)]"
                          : "border-white bg-white text-[#6f6360] hover:border-[#d3a27f]/40"
                      }`}
                    >
                      <span className="font-black">{option.coins} монет</span>
                      <span className="font-semibold text-[#8d6e63]">
                        {price}
                      </span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                className="mt-5 inline-flex w-full items-center justify-center rounded-[18px] bg-[#111827] px-6 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-white shadow-[0_5px_0_0_#000] transition-all hover:-translate-y-[1px] hover:shadow-[0_6px_0_0_#000] active:translate-y-[4px] active:shadow-none disabled:cursor-not-allowed disabled:bg-[#c8d0da] disabled:text-white/85 disabled:shadow-none"
                onClick={() => {
                  if (!topUpPlan) {
                    return;
                  }
                  router.push(
                    `/payment?coins=${topUpPlan}&currency=${topUpCurrency}`,
                  );
                  closeTopUp();
                }}
                disabled={!topUpPlan}
              >
                Продолжить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
