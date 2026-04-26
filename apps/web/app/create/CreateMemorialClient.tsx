"use client";

import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { useEffect, useMemo, useRef, useState, useCallback, type CSSProperties } from "react";
import { useGLTF } from "@react-three/drei";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ensureDracoLoader } from "../../lib/draco";
import { API_BASE } from "../../lib/config";
import { MAP_PREVIEW_CAPTURE_HEIGHT, MAP_PREVIEW_CAPTURE_WIDTH } from "../../lib/map-preview";
import { canUseCalibration, type AccessLevel } from "../../lib/access";
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
  resolveBowlWaterModel
} from "../../lib/memorial-models";
import type { SeasonKey } from "../../lib/memorial-models";
import {
  buildHouseVariantGroup,
  splitHouseVariantId
} from "../../lib/house-variants";
import { buildHouseLayoutKey, getHouseTransform, normalizeTerrainLayoutId } from "../../lib/house-layout";
import {
  firstMarkerVariantId,
  markerAnchor,
  markerIconUrl,
  markerSize,
  markerStyleById,
  markerVariants,
  markerStyles,
  markerVariantsForSpecies
} from "../../lib/markers";
import MemorialPreview from "./MemorialPreview";
import ErrorToast from "../../components/ErrorToast";
import { getConfiguredHouseSlots, getTerrainGiftSlots } from "../../lib/memorial-config";
import type { HouseSlots } from "../../lib/memorial-config";
import {
  getGiftAvailableTypes,
  getGiftSlotType,
  resolveGiftModelUrl
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
  type OptionItem
} from "../../lib/memorial-options";

ensureDracoLoader();

type Step = 0 | 1;

const DEFAULT_LOADING_TIPS = [
  "Создавайте памятные мемориалы — мы бережно сохраняем каждую историю.",
  "Подарки в мемориале помогают показать заботу и любовь.",
  "Вы можете менять оформление мемориала в любое время.",
  "Фотографии питомца можно добавить позже в личном кабинете.",
  "Мы храним данные безопасно и используем резервное копирование."
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
};

type PhotoDraft = {
  id: string;
  file: File;
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
  marker?: {
    lat: number;
    lng: number;
    markerStyle?: string | null;
  } | null;
  memorial?: {
    environmentId: string | null;
    houseId: string | null;
    sceneJson: Record<string, unknown> | null;
  } | null;
};

type CreateMemorialClientProps = {
  editId?: string | null;
};

const MEMORIAL_PLANS = [
  { id: "1y", years: 1, label: "1 год", price: 100 },
  { id: "2y", years: 2, label: "2 года", price: 200 },
  { id: "5y", years: 5, label: "5 лет", price: 500 },
  { id: "lifetime", years: 0, label: "Бессрочно", price: 1500 }
] as const;
type MemorialPlanId = (typeof MEMORIAL_PLANS)[number]["id"];
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

type CameraOffset = {
  x: number;
  y: number;
  z: number;
};

const SEASON_LABELS: Record<SeasonKey, string> = {
  spring: "Весна",
  summer: "Лето",
  autumn: "Осень",
  winter: "Зима"
};
const SEASON_SWATCHES: Record<SeasonKey, { color: string; label: string }> = {
  spring: { color: "#F3A4D8", label: SEASON_LABELS.spring },
  summer: { color: "#6BCB77", label: SEASON_LABELS.summer },
  autumn: { color: "#F2B84B", label: SEASON_LABELS.autumn },
  winter: { color: "#A7D8FF", label: SEASON_LABELS.winter }
};

const STEP3_ICON_CLASS = "h-6 w-6";

const Step3TabIcon = ({ id }: { id: Step3TabId }) => {
  switch (id) {
    case "environment":
      return (
        <svg viewBox="0 0 24 24" className={STEP3_ICON_CLASS} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="7" cy="7" r="2" />
          <path d="M3 19l6-7 4 5 3-4 5 6" />
        </svg>
      );
    case "house":
      return (
        <svg viewBox="0 0 24 24" className={STEP3_ICON_CLASS} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 11l9-7 9 7" />
          <path d="M5 10v9h14v-9" />
          <path d="M9 19v-6h6v6" />
        </svg>
      );
    case "roof":
      return (
        <svg viewBox="0 0 24 24" className={STEP3_ICON_CLASS} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 14l8-7 8 7" />
          <path d="M6 14h12" />
        </svg>
      );
    case "wall":
      return (
        <svg viewBox="0 0 24 24" className={STEP3_ICON_CLASS} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="6" width="16" height="12" rx="1.5" />
          <path d="M4 11h16" />
          <path d="M10 6v12" />
        </svg>
      );
    case "sign":
      return (
        <svg viewBox="0 0 24 24" className={STEP3_ICON_CLASS} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 4v16" />
          <rect x="8" y="6" width="10" height="6" rx="1" />
        </svg>
      );
    case "frameLeft":
      return (
        <svg viewBox="0 0 24 24" className={STEP3_ICON_CLASS} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="5" width="14" height="14" rx="2" />
          <path d="M9 5v14" />
        </svg>
      );
    case "frameRight":
      return (
        <svg viewBox="0 0 24 24" className={STEP3_ICON_CLASS} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="5" width="14" height="14" rx="2" />
          <path d="M15 5v14" />
        </svg>
      );
    case "mat":
      return (
        <svg viewBox="0 0 24 24" className={STEP3_ICON_CLASS} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="6" width="14" height="12" rx="2" />
          <path d="M9 6v12" />
        </svg>
      );
    case "bowlFood":
      return (
        <svg viewBox="0 0 24 24" className={STEP3_ICON_CLASS} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 11h16" />
          <path d="M6 11l2 6h8l2-6" />
          <circle cx="12" cy="7.5" r="1.5" />
        </svg>
      );
    case "bowlWater":
      return (
        <svg viewBox="0 0 24 24" className={STEP3_ICON_CLASS} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 4l6 6" />
          <path d="M12 4l-6 6" />
          <path d="M6 10c0 4 3 7 6 7s6-3 6-7" />
        </svg>
      );
    default:
      return null;
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
  bowlWater: "Миска с водой."
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
  "#422913"
];

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
  bowlWaterColor: colorPalette[7] ?? "#8ECAE6"
};

const SEASON_SUFFIXES: SeasonKey[] = ["spring", "summer", "autumn", "winter"];

const parseEnvironmentDraft = (
  rawEnvironmentId?: string | null
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
        environmentSeasonAuto: false
      };
    }
  }
  return {
    environmentId: value,
    environmentSeason: getSeasonForDate(),
    environmentSeasonAuto: true
  };
};

const buildEditFormState = (pet: EditMemorialPet, ownerId: string): FormState => {
  const memorial = pet.memorial;
  const marker = pet.marker;
  const sceneJson =
    memorial?.sceneJson && typeof memorial.sceneJson === "object" && !Array.isArray(memorial.sceneJson)
      ? memorial.sceneJson
      : {};
  const parts =
    sceneJson.parts && typeof sceneJson.parts === "object" && !Array.isArray(sceneJson.parts)
      ? (sceneJson.parts as Record<string, unknown>)
      : {};
  const colors =
    sceneJson.colors && typeof sceneJson.colors === "object" && !Array.isArray(sceneJson.colors)
      ? (sceneJson.colors as Record<string, unknown>)
      : {};
  const environmentDraft = parseEnvironmentDraft(memorial?.environmentId ?? null);
  const pickId = (key: string, fallback: string) =>
    typeof parts[key] === "string" && parts[key] ? String(parts[key]) : fallback;
  const pickColor = (key: string, fallback: string) =>
    typeof colors[key] === "string" && colors[key] ? String(colors[key]) : fallback;

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
    markerStyle: marker?.markerStyle ?? firstMarkerVariantId(pet.species ?? initialState.species),
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
    frameRightColor: pickColor("frame_right_paint", initialState.frameRightColor),
    matColor: pickColor("mat_paint", initialState.matColor),
    bowlFoodColor: pickColor("bowl_food_paint", initialState.bowlFoodColor),
    bowlWaterColor: pickColor("bowl_water_paint", initialState.bowlWaterColor)
  };
};

export default function CreateMemorialClient({
  editId = null
}: CreateMemorialClientProps) {
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
  const [detectedHouseSlots, setDetectedHouseSlots] = useState<HouseSlots | null>(null);
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [previewPhotoId, setPreviewPhotoId] = useState<string | null>(null);
  const photosRef = useRef<PhotoDraft[]>([]);
  const birthDateInputRef = useRef<HTMLInputElement | null>(null);
  const deathDateInputRef = useRef<HTMLInputElement | null>(null);
  const [markerCategory, setMarkerCategory] = useState(form.species);
  const [focusSlot, setFocusSlot] = useState<string | null>(null);
  const [focusRequestId, setFocusRequestId] = useState(0);
  const [hoveredOption, setHoveredOption] = useState<{ category: string; id: string } | null>(null);
  const hoverIntentRef = useRef<{ category: string; id: string } | null>(null);
  const [tooltipTabId, setTooltipTabId] = useState<Step3TabId | null>(null);
  const tooltipTimerRef = useRef<number | null>(null);
  const [, setAssetsReady] = useState(false);
  const assetsLoadStartedRef = useRef(false);
  const gltfLoaderRef = useRef<GLTFLoader | null>(null);
  const gltfLoadCacheRef = useRef<Map<string, Promise<void>>>(new Map());
  const gltfQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [giftPreviewEnabled, setGiftPreviewEnabled] = useState(false);
  const [detectedGiftSlots, setDetectedGiftSlots] = useState<string[] | null>(null);
  const previewControlsRef = useRef<any>(null);
  const previewRenderRef = useRef<{
    gl: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.Camera;
  } | null>(null);
  const [activeOverlay, setActiveOverlay] = useState<
    "marker" | "photos" | "story" | "base" | null
  >(null);
  const [visitedOverlays, setVisitedOverlays] = useState({
    marker: false,
    photos: false,
    story: false,
    base: false
  });
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [reviewAttempted, setReviewAttempted] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const loadingProgressRef = useRef<number | null>(null);
  const [loadingTips, setLoadingTips] = useState<string[]>(DEFAULT_LOADING_TIPS);
  const [loadingTipIndex, setLoadingTipIndex] = useState(0);
  const loadingTipTimerRef = useRef<number | null>(null);
  const [housePlacementOverrides, setHousePlacementOverrides] = useState<
    Record<string, { x: number; z: number; rotY: number }>
  >({});
  const [houseScaleOverrides, setHouseScaleOverrides] = useState<Record<string, number>>({});
  const [cameraOffsetAdjustments] = useState<Record<string, CameraOffset>>({
    dom_slot_environment: { x: 0.75, y: 4.94, z: 8.85 },
    dom_slot_house: { x: 2.11, y: 2.94, z: 3.3 },
    sign_slot: { x: 0, y: 0, z: 2.85 }
  });

  const router = useRouter();
  const apiUrl = useMemo(() => API_BASE, []);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const { isLoaded, loadError } = useJsApiLoader({ googleMapsApiKey: apiKey });

  useEffect(() => {
    let isMounted = true;
    const loadTips = async () => {
      try {
        const response = await fetch(`${apiUrl}/content/loading-tips`, {
          credentials: "include"
        });
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as { tips?: { text?: string }[] };
        const nextTips = Array.isArray(data.tips)
          ? data.tips
              .map((tip) => (typeof tip.text === "string" ? tip.text.trim() : ""))
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
  const markerIconId = form.markerStyle === "other" ? "other" : form.markerStyle;
  const markerPreviewSize = markerSize(form.markerStyle, 43);
  const markerPreviewAnchor = markerAnchor(form.markerStyle, 43);
  useEffect(() => {
    setMarkerCategory(form.species);
  }, [form.species]);
  const markerGroups = useMemo(
    () => markerVariantsForSpecies(markerCategory),
    [markerCategory]
  );
  const environmentOptions = useMemo(
    () => filterOptionsForUser(allEnvironmentOptions, currentUserLogin),
    [currentUserLogin]
  );
  const houseOptions = useMemo(
    () => filterOptionsForUser(allHouseOptions, currentUserLogin),
    [currentUserLogin]
  );
  const roofOptions = useMemo(
    () => filterOptionsForUser(allRoofOptions, currentUserLogin),
    [currentUserLogin]
  );
  const wallOptions = useMemo(
    () => filterOptionsForUser(allWallOptions, currentUserLogin),
    [currentUserLogin]
  );
  const signOptions = useMemo(
    () => filterOptionsForUser(allSignOptions, currentUserLogin),
    [currentUserLogin]
  );
  const frameLeftOptions = useMemo(
    () => filterOptionsForUser(allFrameLeftOptions, currentUserLogin),
    [currentUserLogin]
  );
  const frameRightOptions = useMemo(
    () => filterOptionsForUser(allFrameRightOptions, currentUserLogin),
    [currentUserLogin]
  );
  const matOptions = useMemo(
    () => filterOptionsForUser(allMatOptions, currentUserLogin),
    [currentUserLogin]
  );
  const bowlFoodOptions = useMemo(
    () => filterOptionsForUser(allBowlFoodOptions, currentUserLogin),
    [currentUserLogin]
  );
  const bowlWaterOptions = useMemo(
    () => filterOptionsForUser(allBowlWaterOptions, currentUserLogin),
    [currentUserLogin]
  );
  const memorialPlan = useMemo(
    () => MEMORIAL_PLANS.find((plan) => plan.id === memorialPlanId) ?? MEMORIAL_PLANS[0],
    [memorialPlanId]
  );
  const memorialPrice = memorialPlan.price;
  const environmentSeasons = useMemo(
    () => getEnvironmentSeasons(form.environmentId),
    [form.environmentId]
  );
  const houseVariantGroup = useMemo(
    () => buildHouseVariantGroup(houseOptions),
    [houseOptions]
  );
  useEffect(() => {
    const firstId = (options: OptionItem[]) => options[0]?.id ?? "";
    setForm((prev) => {
      const nextEnvironmentId = environmentOptions.some((option) => option.id === prev.environmentId)
        ? prev.environmentId
        : firstId(environmentOptions);
      const nextHouseId = houseOptions.some((option) => option.id === prev.houseId)
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
      const nextFrameLeftId = frameLeftOptions.some((option) => option.id === prev.frameLeftId)
        ? prev.frameLeftId
        : firstId(frameLeftOptions);
      const nextFrameRightId = frameRightOptions.some((option) => option.id === prev.frameRightId)
        ? prev.frameRightId
        : firstId(frameRightOptions);
      const nextMatId = matOptions.some((option) => option.id === prev.matId)
        ? prev.matId
        : firstId(matOptions);
      const nextBowlFoodId = bowlFoodOptions.some((option) => option.id === prev.bowlFoodId)
        ? prev.bowlFoodId
        : firstId(bowlFoodOptions);
      const nextBowlWaterId = bowlWaterOptions.some((option) => option.id === prev.bowlWaterId)
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
        bowlWaterId: nextBowlWaterId
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
    wallOptions
  ]);
  const selectedHouseVariant = splitHouseVariantId(form.houseId);
  const selectedHouseBaseId =
    selectedHouseVariant.baseId || houseVariantGroup.baseOptions[0]?.id || form.houseId;
  const selectedTerrainLayoutId = normalizeTerrainLayoutId(form.environmentId);
  const selectedHouseLayoutKey = buildHouseLayoutKey(selectedTerrainLayoutId, selectedHouseBaseId);
  const houseBaseOptions = houseVariantGroup.baseOptions;
  const houseTextureOptions =
    houseVariantGroup.textureOptionsByBase[selectedHouseBaseId] ?? [];
  const defaultHouseTransform = useMemo(
    () => getHouseTransform(selectedHouseBaseId, selectedTerrainLayoutId),
    [selectedHouseBaseId, selectedTerrainLayoutId]
  );
  const activeHousePlacement =
    housePlacementOverrides[selectedHouseLayoutKey] ?? {
      x: defaultHouseTransform.offsetX,
      z: defaultHouseTransform.offsetZ,
      rotY: defaultHouseTransform.rotationY
    };
  const activeHouseScale =
    houseScaleOverrides[selectedHouseLayoutKey] ?? defaultHouseTransform.scale;
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
          ...patch
        }
      }));
    },
    [
      defaultHouseTransform.offsetX,
      defaultHouseTransform.offsetZ,
      defaultHouseTransform.rotationY,
      selectedHouseLayoutKey
    ]
  );
  const updateHouseScale = useCallback(
    (value: number) => {
      if (!selectedHouseLayoutKey) {
        return;
      }
      setHouseScaleOverrides((prev) => ({
        ...prev,
        [selectedHouseLayoutKey]: value
      }));
    },
    [selectedHouseLayoutKey]
  );
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
      ? houseVariantGroup.defaultVariantByBase[hoveredHouseBaseId] ?? hoveredHouseBaseId
      : null) ??
    form.houseId;
  const previewHouseVariant = splitHouseVariantId(housePreviewId);
  const previewHouseBaseId =
    previewHouseVariant.baseId || hoveredHouseBaseId || selectedHouseBaseId || housePreviewId;
  const previewTerrainLayoutId = normalizeTerrainLayoutId(environmentPreviewId);
  const previewHouseLayoutKey = buildHouseLayoutKey(previewTerrainLayoutId, previewHouseBaseId);
  const previewHouseTransform = useMemo(
    () => getHouseTransform(previewHouseBaseId, previewTerrainLayoutId),
    [previewHouseBaseId, previewTerrainLayoutId]
  );
  const previewHousePlacement =
    housePlacementOverrides[previewHouseLayoutKey] ?? {
      x: previewHouseTransform.offsetX,
      z: previewHouseTransform.offsetZ,
      rotY: previewHouseTransform.rotationY
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
    [environmentPreviewSeason, houseVariantGroup.defaultVariantByBase]
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
      selectedHouseBaseId
    ]
  );
  const environmentUrl = resolveEnvironmentModel(
    environmentPreviewId,
    environmentPreviewSeason
  );
  const houseUrl = resolveHouseModel(housePreviewId);
  const configuredHouseSlots = getConfiguredHouseSlots(housePreviewId);
  const houseSlots: Partial<HouseSlots> = detectedHouseSlots ?? configuredHouseSlots ?? {};
  const terrainGiftSlots = useMemo(
    () => detectedGiftSlots ?? getTerrainGiftSlots(environmentPreviewId),
    [detectedGiftSlots, environmentPreviewId]
  );
  const previewGiftCandidates = useMemo(() => Object.keys(giftModelsGenerated), []);
  const previewGiftByType = useMemo(() => {
    const map = new Map<string, string>();
    previewGiftCandidates.forEach((code) => {
      getGiftAvailableTypes({ code }).forEach((type) => {
        if (!map.has(type)) {
          map.set(type, code);
        }
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
    const fallbackCode = previewGiftCandidates[0] ?? null;
    return terrainGiftSlots
      .map((slot) => {
        const slotType = getGiftSlotType(slot);
        let code: string | null = null;
        let resolveType: string | null = null;
        if (slotType === "default") {
          code = fallbackCode;
          if (code) {
            const types = getGiftAvailableTypes({ code });
            resolveType = types[0] ?? null;
          }
        } else if (slotType) {
          code = previewGiftByType.get(slotType) ?? null;
          resolveType = slotType;
        }
        if (!code || !resolveType) {
          return null;
        }
        const url = resolveGiftModelUrl({
          gift: { code },
          slotType: resolveType,
          fallbackUrl: null
        });
        if (!url) {
          return null;
        }
        return { slot, url, name: "Подарок" };
      })
      .filter(
        (gift): gift is { slot: string; url: string; name: string } => Boolean(gift)
      );
  }, [giftPreviewEnabled, previewGiftByType, previewGiftCandidates, terrainGiftSlots]);
  const previewPlaceholderSlots = useMemo(() => {
    if (!giftPreviewEnabled) {
      return [];
    }
    const filled = new Set(previewGifts.map((gift) => gift.slot));
    return terrainGiftSlots.filter((slot) => !filled.has(slot));
  }, [giftPreviewEnabled, previewGifts, terrainGiftSlots]);
  const [activeStep3Tab, setActiveStep3Tab] = useState<Step3TabId>("environment");
  const step3Tabs = useMemo<Step3Tab[]>(() => {
    const tabs: Step3Tab[] = [
      { id: "environment", label: "Поверхность", focusSlot: "dom_slot" },
      { id: "house", label: "Домик", focusSlot: "dom_slot" }
    ];
    if (houseSlots.roof) tabs.push({ id: "roof", label: "Крыша", focusSlot: houseSlots.roof });
    if (houseSlots.wall) tabs.push({ id: "wall", label: "Стены", focusSlot: houseSlots.wall });
    if (houseSlots.sign) tabs.push({ id: "sign", label: "Украшение", focusSlot: houseSlots.sign });
    if (houseSlots.frameLeft)
      tabs.push({ id: "frameLeft", label: "Рамка слева", focusSlot: houseSlots.frameLeft });
    if (houseSlots.frameRight)
      tabs.push({ id: "frameRight", label: "Рамка справа", focusSlot: houseSlots.frameRight });
    if (houseSlots.mat) tabs.push({ id: "mat", label: "Коврик", focusSlot: houseSlots.mat });
    if (houseSlots.bowlFood)
      tabs.push({ id: "bowlFood", label: "Миска (еда)", focusSlot: houseSlots.bowlFood });
    if (houseSlots.bowlWater)
      tabs.push({ id: "bowlWater", label: "Миска (вода)", focusSlot: houseSlots.bowlWater });
    return tabs;
  }, [houseSlots]);
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
  const activeFocusSlot = useMemo(
    () => step3Tabs.find((tab) => tab.id === activeStep3Tab)?.focusSlot ?? null,
    [activeStep3Tab, step3Tabs]
  );
  const activeCameraKey = useMemo(() => {
    if (!activeFocusSlot) {
      return null;
    }
    if (activeStep3Tab === "environment") {
      return "dom_slot_environment";
    }
    if (activeStep3Tab === "house") {
      return "dom_slot_house";
    }
    return activeFocusSlot;
  }, [activeFocusSlot, activeStep3Tab]);
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
    houseSlots.frameLeft ? { slot: houseSlots.frameLeft, url: frameLeftUrl } : null,
    houseSlots.frameRight ? { slot: houseSlots.frameRight, url: frameRightUrl } : null,
    houseSlots.mat ? { slot: houseSlots.mat, url: matUrl } : null,
    houseSlots.bowlFood ? { slot: houseSlots.bowlFood, url: bowlFoodUrl } : null,
    houseSlots.bowlWater ? { slot: houseSlots.bowlWater, url: bowlWaterUrl } : null
  ].filter(
    (part): part is { slot: string; url: string } => Boolean(part && part.url)
  );
  const colorOverrides = {
    roof_paint: form.roofColor,
    wall_paint: form.wallColor,
    sign_paint: form.signColor,
    frame_left_paint: form.frameLeftColor,
    frame_right_paint: form.frameRightColor,
    mat_paint: form.matColor,
    bowl_food_paint: form.bowlFoodColor,
    bowl_water_paint: form.bowlWaterColor
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
        environmentSeason: environmentSeasons[0] ?? getSeasonForDate()
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

  const requestFocus = (slot: string | null) => {
    setFocusSlot(slot);
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
    if (isEditMode && tab.id === "environment") {
      return;
    }
    setActiveStep3Tab(tab.id);
    requestFocus(tab.focusSlot ?? null);
  };

  const handlePreviewDetailClick = (detail: { slot?: string; area?: "environment" | "house" }) => {
    if (detail.slot) {
      const tabId = step3TabBySlot.get(detail.slot);
      if (tabId) {
        setActiveStep3Tab(tabId);
        requestFocus(detail.slot);
        return;
      }
    }
    if (detail.area === "environment") {
      if (isEditMode) {
        return;
      }
      setActiveStep3Tab("environment");
      requestFocus("dom_slot");
      return;
    }
    if (detail.area === "house") {
      setActiveStep3Tab("house");
      requestFocus("dom_slot");
    }
  };


  const topUpOptions = [
    { coins: 100, rub: 100, usd: 1 },
    { coins: 200, rub: 200, usd: 2 },
    { coins: 500, rub: 500, usd: 500 },
    { coins: 1000, rub: 1000, usd: 10 }
  ];


  const fetchWalletBalance = useCallback(async () => {
    if (!form.ownerId) {
      return;
    }
    setWalletLoading(true);
    try {
      const response = await fetch(`${apiUrl}/wallet/${form.ownerId}`);
      if (!response.ok) {
        throw new Error("Не удалось загрузить баланс");
      }
      const data = (await response.json()) as { coinBalance: number };
      setWalletBalance(typeof data.coinBalance === "number" ? data.coinBalance : null);
    } catch {
      setWalletBalance(null);
    } finally {
      setWalletLoading(false);
    }
  }, [apiUrl, form.ownerId]);

  useEffect(() => {
    const loadMe = async () => {
      try {
        const response = await fetch(`${apiUrl}/auth/me`, { credentials: "include" });
        if (!response.ok) {
          router.replace("/auth");
          return;
        }
        const data = (await response.json()) as {
          id: string;
          login?: string | null;
          accessLevel?: AccessLevel;
        };
        if (isEditMode && editId) {
          const petResponse = await fetch(`${apiUrl}/pets/${editId}`, {
            credentials: "include"
          });
          if (!petResponse.ok) {
            router.replace(`/pets/${editId}`);
            return;
          }
          const pet = (await petResponse.json()) as EditMemorialPet;
          if (pet.ownerId !== data.id) {
            router.replace(`/pets/${editId}`);
            return;
          }
          if (!pet.memorial) {
            router.replace(`/pets/${editId}`);
            return;
          }
          setForm(buildEditFormState(pet, data.id));
          setStep(1);
          setActiveStep3Tab("house");
          requestFocus("dom_slot");
          setVisitedOverlays({
            marker: true,
            photos: true,
            story: true,
            base: true
          });
          setEditReady(true);
        } else {
          setForm((prev) => (prev.ownerId ? prev : { ...prev, ownerId: data.id }));
        }
        setCurrentUserLogin(data.login ?? null);
        setAccessLevel(data.accessLevel ?? "USER");
      } catch {
        if (!isEditMode) {
          router.replace("/auth");
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
  }, [apiUrl, editId, isEditMode, router]);

  useEffect(() => {
    if (!form.ownerId) {
      return;
    }
    void fetchWalletBalance();
  }, [fetchWalletBalance, form.ownerId]);

  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url));
    };
  }, []);

  useEffect(() => {
    if (step !== 1) {
      setFocusSlot(null);
    }
  }, [step]);

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
    const birth = form.birthDate ? new Date(form.birthDate) : null;
    const death = form.deathDate ? new Date(form.deathDate) : null;
    if (birth && Number.isNaN(birth.getTime())) {
      return "Проверь дату рождения";
    }
    if (death && Number.isNaN(death.getTime())) {
      return "Проверь дату ухода";
    }
    if (birth && birth > today) {
      return "Дата рождения не может быть позже текущей даты";
    }
    if (death && death > today) {
      return "Дата ухода не может быть позже текущей даты";
    }
    if (birth && death && birth > death) {
      return "Дата рождения должна быть раньше даты ухода";
    }
    return null;
  }, [form.birthDate, form.deathDate, today]);
  const hasRequiredDateError =
    reviewAttempted && (!form.birthDate.trim() || !form.deathDate.trim());
  const hasDateFieldError = hasRequiredDateError || Boolean(dateValidationMessage);

  const todayInputValue = useMemo(() => today.toISOString().slice(0, 10), [today]);

  const validateStep = (current: Step) => {
    if (isEditMode) {
      return null;
    }
    if (current === 0) {
      if (!authReady) {
        return "Проверяем авторизацию...";
      }
      if (!form.ownerId.trim()) {
        return "Нужно войти в аккаунт";
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
    []
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
    const maxPhotos = 10;
    const maxSize = 6 * 1024 * 1024;
    const available = Math.max(0, maxPhotos - photos.length);
    const picked = Array.from(files);
    const oversized = picked.some((file) => file.size > maxSize);
    if (oversized) {
      setError("Максимальный размер фото — 6 МБ");
    }
    const selected = picked.filter((file) => file.size <= maxSize).slice(0, available);
    if (selected.length === 0) {
      return;
    }
    const mapped = selected.map((file) => ({
      id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      url: URL.createObjectURL(file)
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
        URL.revokeObjectURL(removed.url);
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
    const perspectiveCamera = camera instanceof THREE.PerspectiveCamera ? camera : null;
    const prevAspect = perspectiveCamera?.aspect ?? null;
    const target = controls?.target as THREE.Vector3 | undefined;
    let restore: (() => void) | null = null;
    if (camera) {
      const prevPos = camera.position.clone();
      const prevTarget = target?.clone();
      const baseTarget = new THREE.Vector3(0, 0.6, 0);
      const basePosition = new THREE.Vector3(8, 5, 8);
      const baseOffset = basePosition.sub(baseTarget);
      const rotatedOffset = baseOffset.clone().applyAxisAngle(
        new THREE.Vector3(0, 1, 0),
        THREE.MathUtils.degToRad(-30)
      );
      rotatedOffset.multiplyScalar(0.84);
      rotatedOffset.y -= 0.85;
      const nextPos = baseTarget.clone().add(rotatedOffset);
      const distance = nextPos.distanceTo(baseTarget);
      const tiltOffset = Math.tan(THREE.MathUtils.degToRad(5)) * distance;
      const nextTarget = baseTarget.clone().add(new THREE.Vector3(0, tiltOffset, 0));
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
      stencilBuffer: false
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
      const snapshot = await capturePreviewImage();
      if (!snapshot) {
        return;
      }
      const formData = new FormData();
      formData.append("file", snapshot, "map-preview.png");
      await fetch(`${apiUrl}/pets/${petId}/map-preview`, {
        method: "POST",
        body: formData
      });
    },
    [apiUrl, capturePreviewImage]
  );

  const handleSubmit = async () => {
    if (isEditMode && editId) {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${apiUrl}/pets/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            houseId: form.houseId,
            sceneJson: {
              parts: {
                roof: form.roofId,
                wall: form.wallId,
                sign: form.signId,
                frameLeft: form.frameLeftId,
                frameRight: form.frameRightId,
                mat: form.matId,
                bowlFood: form.bowlFoodId,
                bowlWater: form.bowlWaterId
              },
              colors: {
                roof_paint: form.roofColor,
                wall_paint: form.wallColor,
                sign_paint: form.signColor,
                frame_left_paint: form.frameLeftColor,
                frame_right_paint: form.frameRightColor,
                mat_paint: form.matColor,
                bowl_food_paint: form.bowlFoodColor,
                bowl_water_paint: form.bowlWaterColor
              },
              version: 3
            }
          })
        });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || "Ошибка сохранения");
        }
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

    if (walletBalance === null) {
      setError("Не удалось загрузить баланс для оплаты мемориала");
      return;
    }
    if (walletBalance < memorialPrice) {
      setError(null);
      openTopUp();
      return;
    }

    setLoading(true);
    setError(null);

    const environmentId = form.environmentSeasonAuto
      ? form.environmentId
      : `${form.environmentId}_${form.environmentSeason}`;

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
      environmentId,
      houseId: form.houseId,
      memorialPlanYears: memorialPlan.years,
      sceneJson: {
        parts: {
          roof: form.roofId,
          wall: form.wallId,
          sign: form.signId,
          frameLeft: form.frameLeftId,
          frameRight: form.frameRightId,
          mat: form.matId,
          bowlFood: form.bowlFoodId,
          bowlWater: form.bowlWaterId
        },
        colors: {
          roof_paint: form.roofColor,
          wall_paint: form.wallColor,
          sign_paint: form.signColor,
          frame_left_paint: form.frameLeftColor,
          frame_right_paint: form.frameRightColor,
          mat_paint: form.matColor,
          bowl_food_paint: form.bowlFoodColor,
          bowl_water_paint: form.bowlWaterColor
        },
        version: 3
      }
    };

    try {
      const response = await fetch(`${apiUrl}/pets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Ошибка создания");
      }
      const created = (await response.json()) as { id: string };
      if (photos.length > 0) {
        const uploaded: { localId: string; id: string }[] = [];
        for (const photo of photos) {
          const formData = new FormData();
          formData.append("file", photo.file);
          const uploadResponse = await fetch(`${apiUrl}/pets/${created.id}/photos`, {
            method: "POST",
            body: formData
          });
          if (!uploadResponse.ok) {
            const text = await uploadResponse.text();
            throw new Error(text || "Ошибка загрузки фото");
          }
          const saved = (await uploadResponse.json()) as { id: string };
          uploaded.push({ localId: photo.id, id: saved.id });
        }
        if (previewPhotoId) {
          const previewMatch = uploaded.find((item) => item.localId === previewPhotoId);
          if (previewMatch) {
            const previewResponse = await fetch(
              `${apiUrl}/pets/${created.id}/preview-photo`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ photoId: previewMatch.id })
              }
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
        typeof prev === "number" ? Math.max(prev - memorialPrice, 0) : prev
      );
      router.push(`/pets/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка создания");
    } finally {
      setLoading(false);
    }
  };

  const toggleOverlay = (panel: "marker" | "photos" | "story" | "base") => {
    if (isEditMode) {
      return;
    }
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

  const renderArrowIcon = (className?: string) => (
    <span className={`ml-0 inline-flex max-w-0 items-center overflow-hidden opacity-0 transition-all duration-300 group-hover:ml-2 group-hover:max-w-5 group-hover:opacity-100 ${className ?? ""}`}>
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
          className={`group inline-flex items-center justify-center rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white ${buttonClassName ?? ""}`}
          disabled={!authReady || isTransitioning}
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
      "bowl-water"
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
    signOptions
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
          signal: controller.signal
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
    [warmAsset]
  );

  const queueGltfLoad = useCallback(
    async (url: string) => {
      const task = gltfQueueRef.current.then(() => ensureGltfReady(url));
      gltfQueueRef.current = task.catch(() => {});
      return task;
    },
    [ensureGltfReady]
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
    [warmAsset]
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
    [ensureGltfReady]
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
    const activeSeason = form.environmentSeasonAuto ? getSeasonForDate() : form.environmentSeason;
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
      resolveBowlWaterModel(form.bowlWaterId)
    ].forEach((url) => {
      if (url) {
        modelUrls.add(url);
      }
    });

    try {
      await Promise.all([
        warmAssetsWithLimit(preloadImageUrls, preloadConcurrency),
        loadGltfsWithLimit([...modelUrls.values()], preloadConcurrency)
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
    warmAssetsWithLimit
  ]);

  useEffect(() => {
    if (step >= 1) {
      void preloadAssets();
    }
  }, [step, preloadAssets]);

  const preloadOptionModel = useCallback(
    async (category: string, id: string) => {
      const url = resolveHoverModelUrl(category, id);
      if (!url) {
        return;
      }
      await queueGltfLoad(url);
    },
    [queueGltfLoad, resolveHoverModelUrl]
  );

  const handleOptionHover = useCallback(
    async (category: string, id: string) => {
      hoverIntentRef.current = { category, id };
      if (category !== "house-base" && id === selectedIdForCategory(category)) {
        setHoveredOption({ category, id });
        return;
      }
      await preloadOptionModel(category, id);
      if (hoverIntentRef.current?.category === category && hoverIntentRef.current?.id === id) {
        setHoveredOption({ category, id });
      }
    },
    [preloadOptionModel, selectedIdForCategory]
  );

  const handleOptionLeave = useCallback((category: string) => {
    if (hoverIntentRef.current?.category === category) {
      hoverIntentRef.current = null;
    }
    setHoveredOption((prev) => (prev?.category === category ? null : prev));
  }, []);

  const handleOptionSelect = useCallback(
    async (category: string, id: string, apply: () => void) => {
      await preloadOptionModel(category, id);
      apply();
    },
    [preloadOptionModel]
  );

  const preloadEnvironmentSeason = useCallback(
    async (season: SeasonKey) => {
      const url = resolveEnvironmentModel(form.environmentId, season);
      if (!url) {
        return;
      }
      await queueGltfLoad(url);
    },
    [form.environmentId, queueGltfLoad]
  );

  const renderOptionGrid = (
    category: string,
    options: OptionItem[],
    selectedId: string,
    onSelect: (id: string) => void,
    imageCategory: string = category
  ) => (
    <div className="grid grid-cols-2 place-items-center gap-0.5">
      {options.map((option) => {
        const isSelected = selectedId === option.id;
        const imageUrl = option.id === "none" ? null : optionImage(imageCategory, option.id);
        return (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                void handleOptionSelect(category, option.id, () => onSelect(option.id));
              }}
              onMouseEnter={() => {
                void handleOptionHover(category, option.id);
              }}
            onMouseLeave={() => handleOptionLeave(category)}
            onFocus={() => {
              void handleOptionHover(category, option.id);
            }}
            onBlur={() => handleOptionLeave(category)}
            aria-label={option.name}
            title={option.name}
            className={`flex w-full aspect-square items-center justify-center rounded-xl border-[0.33px] p-0 transition ${
              isSelected
                ? "border-sky-400 bg-sky-50"
                : "border-slate-200 bg-transparent hover:border-sky-400 hover:bg-sky-50"
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
              <div className="text-xs text-slate-500">Нет</div>
            )}
          </button>
        );
      })}
    </div>
  );

  const renderStep3TabContent = () => {
    switch (activeStep3Tab) {
      case "environment":
        return (
          <div className="grid gap-3">
            {renderOptionGrid("environment", environmentOptions, form.environmentId, (id) => {
              handleChange("environmentId", id);
              requestFocus("dom_slot");
            })}
            {environmentSeasons.length > 0 ? (
              <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3">
                <div className="text-sm font-semibold text-slate-900">Время года</div>
                <div className="flex flex-wrap gap-2">
                  {environmentSeasons.map((season) => {
                    const isActive = form.environmentSeason === season;
                    const swatch = SEASON_SWATCHES[season];
                    return (
                      <button
                        key={season}
                        type="button"
                        onClick={() => {
                          void preloadEnvironmentSeason(season).then(() =>
                            handleChange("environmentSeason", season)
                          );
                        }}
                        aria-label={swatch.label}
                        title={swatch.label}
                        className={`h-8 w-8 rounded-lg border transition ${
                          isActive
                            ? "border-slate-900 ring-2 ring-sky-300"
                            : "border-slate-200 hover:border-slate-400"
                        }`}
                        style={{ backgroundColor: swatch.color }}
                      />
                    );
                  })}
                </div>
                <label className="group relative flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={form.environmentSeasonAuto}
                    onChange={(event) =>
                      handleChange("environmentSeasonAuto", event.target.checked)
                    }
                  />
                  Автосмена сезонов
                  <span className="pointer-events-none absolute left-0 top-full z-10 mt-2 w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                    Если включить, поверхность будет меняться по текущей дате.
                  </span>
                </label>
              </div>
            ) : null}
          </div>
        );
      case "house":
        return (
          <div className="grid gap-4">
            <div className="grid gap-3">
              {renderOptionGrid("house-base", houseBaseOptions, selectedHouseBaseId, (id) => {
                const nextVariant = houseVariantGroup.defaultVariantByBase[id] ?? id;
                handleChange("houseId", nextVariant);
                requestFocus("dom_slot");
              }, "house")}
            </div>
            {houseTextureOptions.length > 0 ? (
              <div className="grid gap-3">
                <h2 className="text-base font-semibold text-slate-900">Текстура домика</h2>
                {renderOptionGrid(
                  "house-texture",
                  houseTextureOptions,
                  form.houseId,
                  (id) => {
                    handleChange("houseId", id);
                    requestFocus("dom_slot");
                  },
                  "house-texture"
                )}
              </div>
            ) : null}
            {canUseCalibration(accessLevel) ? (
            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white/90 p-3 text-xs text-slate-600">
              <div className="text-xs font-semibold text-slate-800">
                Временная настройка положения домика
              </div>
              <div className="text-[11px] text-slate-500">
                Поверхность: <span className="font-semibold text-slate-700">{selectedTerrainLayoutId || "default"}</span>
              </div>
              <div className="text-[11px] text-slate-500">
                Домик: <span className="font-semibold text-slate-700">{selectedHouseBaseId}</span>
              </div>
              <div className="grid gap-2">
                <label className="flex items-center justify-between">
                  <span>Сдвиг X</span>
                  <span className="font-semibold text-slate-700">
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
                  <span className="font-semibold text-slate-700">
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
                  <span className="font-semibold text-slate-700">
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
                  <span className="font-semibold text-slate-700">
                    {activeHouseScale.toFixed(2)}
                  </span>
                </label>
                <input
                  type="range"
                  min={0.25}
                  max={3}
                  step={0.01}
                  value={activeHouseScale}
                  onChange={(event) => updateHouseScale(Number(event.target.value))}
                />
              </div>
            </div>
            ) : null}
          </div>
        );
      case "roof":
        return (
          <div className="grid gap-3">
            {renderOptionGrid("roof", roofOptions, form.roofId, (id) => {
              handleChange("roofId", id);
              requestFocus(houseSlots.roof ?? null);
            })}
          </div>
        );
      case "wall":
        return (
          <div className="grid gap-3">
            {renderOptionGrid("wall", wallOptions, form.wallId, (id) => {
              handleChange("wallId", id);
              requestFocus(houseSlots.wall ?? null);
            })}
          </div>
        );
      case "sign":
        return (
          <div className="grid gap-3">
            {renderOptionGrid("sign", signOptions, form.signId, (id) => {
              handleChange("signId", id);
              requestFocus(houseSlots.sign ?? null);
            })}
          </div>
        );
      case "frameLeft":
        return (
          <div className="grid gap-3">
            {renderOptionGrid("frame-left", frameLeftOptions, form.frameLeftId, (id) => {
              handleChange("frameLeftId", id);
              requestFocus(houseSlots.frameLeft ?? null);
            })}
          </div>
        );
      case "frameRight":
        return (
          <div className="grid gap-3">
            {renderOptionGrid("frame-right", frameRightOptions, form.frameRightId, (id) => {
              handleChange("frameRightId", id);
              requestFocus(houseSlots.frameRight ?? null);
            })}
          </div>
        );
      case "mat":
        return (
          <div className="grid gap-3">
            {renderOptionGrid("mat", matOptions, form.matId, (id) => {
              handleChange("matId", id);
              requestFocus(houseSlots.mat ?? null);
            })}
          </div>
        );
      case "bowlFood":
        return (
          <div className="grid gap-3">
            {renderOptionGrid("bowl-food", bowlFoodOptions, form.bowlFoodId, (id) => {
              handleChange("bowlFoodId", id);
              requestFocus(houseSlots.bowlFood ?? null);
            })}
          </div>
        );
      case "bowlWater":
        return (
          <div className="grid gap-3">
            {renderOptionGrid("bowl-water", bowlWaterOptions, form.bowlWaterId, (id) => {
              handleChange("bowlWaterId", id);
              requestFocus(houseSlots.bowlWater ?? null);
            })}
          </div>
        );
      default:
        return null;
    }
  };

  const overlaySectionTitleClass =
    "mb-1 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.28em] text-[#8d6e63]";
  const overlayLabelClass =
    "text-[10px] font-black uppercase tracking-widest text-[#adb5bd]";
  const overlayInputClass =
    "w-full rounded-2xl border-b-4 border-transparent bg-[#f8f9fa] px-4 py-3 text-sm font-bold text-[#5d4037] shadow-inner outline-none transition-all focus:border-[#3bceac]";
  const overlayTextareaClass =
    "min-h-[170px] w-full rounded-2xl border-b-4 border-transparent bg-[#f8f9fa] px-4 py-3.5 text-sm font-bold text-[#5d4037] shadow-inner outline-none transition-all focus:border-[#3bceac]";
  const overlayShellClass =
    "grid gap-4 rounded-[32px] border-[4px] border-white bg-white/95 p-4 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] sm:p-5";

  const renderBaseInfoForm = (centered = false) => (
    <div className={`grid gap-4 ${centered ? "text-center justify-items-center" : ""}`}>
      <label className={`grid gap-2 ${centered ? "w-full text-center text-sm text-slate-700" : ""}`}>
        {!centered ? <span className={overlayLabelClass}>Имя питомца</span> : null}
        {centered ? "Имя питомца" : null}
        <input
          className={centered
            ? `rounded-2xl border border-slate-200 px-4 py-2 min-h-[52px] bg-[#fbf7f4] text-center text-base font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]`
            : overlayInputClass}
          value={form.name}
          onChange={(event) => handleChange("name", event.target.value)}
          placeholder="Барсик"
          required
          aria-invalid={!form.name.trim()}
          maxLength={80}
        />
      </label>
      <label className={`grid gap-2 ${centered ? "w-full text-center text-sm text-slate-700" : ""}`}>
        {!centered ? <span className={overlayLabelClass}>Вид питомца</span> : null}
        {centered ? "Вид питомца" : null}
        <select
          className={centered
            ? `rounded-2xl border border-slate-200 px-4 py-2 min-h-[52px] bg-[#fbf7f4] text-center text-base font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]`
            : overlayInputClass}
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
      <div className={`grid gap-4 ${centered ? "w-full" : ""}`}>
        <label
          className={`grid gap-2 cursor-pointer ${centered ? "text-center text-sm text-slate-700" : ""}`}
          onClick={() => openDatePicker(birthDateInputRef.current)}
        >
          {!centered ? <span className={overlayLabelClass}>Дата рождения</span> : null}
          {centered ? "Дата рождения" : null}
          <input
            ref={birthDateInputRef}
            type="date"
            className={centered
              ? `rounded-2xl border px-4 py-2 text-center text-base font-semibold ${
                  hasDateFieldError ? "border-red-400" : "border-slate-200"
                } min-h-[52px] bg-[#fbf7f4] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]`
              : `${overlayInputClass} ${hasDateFieldError ? "!border-red-400" : ""}`}
            value={form.birthDate}
            onChange={(event) => handleChange("birthDate", event.target.value)}
            max={form.deathDate || todayInputValue}
            aria-invalid={hasDateFieldError}
          />
        </label>
        <label
          className={`grid gap-2 cursor-pointer ${centered ? "text-center text-sm text-slate-700" : ""}`}
          onClick={() => openDatePicker(deathDateInputRef.current)}
        >
          {!centered ? <span className={overlayLabelClass}>Дата ухода</span> : null}
          {centered ? "Дата ухода" : null}
          <input
            ref={deathDateInputRef}
            type="date"
            className={centered
              ? `rounded-2xl border px-4 py-2 text-center text-base font-semibold ${
                  hasDateFieldError ? "border-red-400" : "border-slate-200"
                } min-h-[52px] bg-[#fbf7f4] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]`
              : `${overlayInputClass} ${hasDateFieldError ? "!border-red-400" : ""}`}
            value={form.deathDate}
            onChange={(event) => handleChange("deathDate", event.target.value)}
            min={form.birthDate || undefined}
            max={todayInputValue}
            aria-invalid={hasDateFieldError}
          />
        </label>
      </div>
      <div className="min-h-[16px]">
        {dateValidationMessage ? (
          <p className="text-xs text-red-600">{dateValidationMessage}</p>
        ) : null}
      </div>
    </div>
  );

  const renderMarkerPanel = () => {
    const markerDisplay = markerGroups.primary.length > 0
      ? markerGroups.primary
      : markerGroups.all;
    return (
      <div className={overlayShellClass}>
        <h3 className={overlaySectionTitleClass}>
          <span className="h-2 w-2 rounded-full bg-[#3bceac]" />
          Маркер и карта
        </h3>
        <div className="grid h-full gap-3 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,0.95fr)]">
        <div className="grid content-start gap-3">
          <div className="overflow-hidden rounded-[24px] border-[3px] border-white bg-[#f8f9fa] shadow-inner">
            {!apiKey ? (
              <div className="flex min-h-[220px] items-center justify-center bg-slate-50 text-xs text-slate-500">
                Укажи NEXT_PUBLIC_GOOGLE_MAPS_API_KEY в .env.local
              </div>
            ) : loadError ? (
              <div className="flex min-h-[220px] items-center justify-center bg-slate-50 text-xs text-red-600">
                Ошибка загрузки карты
              </div>
            ) : !isLoaded ? (
              <div className="flex min-h-[220px] items-center justify-center bg-slate-50 text-xs text-slate-500">
                Загрузка карты...
              </div>
            ) : (
              <GoogleMap
                mapContainerStyle={{
                  width: "100%",
                  height: "clamp(230px, 34vh, 340px)"
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
                    lng: lngValue.toFixed(6)
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
                        markerPreviewSize.height
                      ),
                      anchor: new window.google.maps.Point(
                        markerPreviewAnchor.x,
                        markerPreviewAnchor.y
                      )
                    }}
                  />
                ) : null}
              </GoogleMap>
            )}
          </div>

          <div className="grid gap-2 rounded-[24px] border-[3px] border-white bg-[#fcf8f5] p-3 shadow-inner">
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-2">
                <span className={overlayLabelClass}>Широта</span>
                <input
                  inputMode="decimal"
                  className={overlayInputClass}
                  placeholder="55.755826"
                  value={form.lat}
                  onChange={(event) => handleChange("lat", event.target.value)}
                />
              </label>
              <label className="grid gap-2">
                <span className={overlayLabelClass}>Долгота</span>
                <input
                  inputMode="decimal"
                  className={overlayInputClass}
                  placeholder="37.617299"
                  value={form.lng}
                  onChange={(event) => handleChange("lng", event.target.value)}
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
                        lng: pos.coords.longitude.toFixed(6)
                      }));
                    },
                    () => setError("Не удалось получить геолокацию")
                  );
                }}
                className="rounded-xl border border-slate-200 px-2 py-1 text-[10px] text-slate-700"
              >
                Моё местоположение
              </button>
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, lat: "", lng: "" }))}
                className="rounded-xl border border-slate-200 px-2 py-1 text-[10px] text-slate-700"
              >
                Очистить
              </button>
            </div>

            <label className="group relative flex items-center gap-2 text-xs font-bold text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={form.isPublic}
                onChange={(event) => handleChange("isPublic", event.target.checked)}
              />
              Публичный мемориал
              <span className="pointer-events-none absolute left-0 top-full z-10 mt-2 w-64 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                Публичный мемориал виден на карте всем пользователям. Приватные доступны только по ссылке.
              </span>
            </label>
            <p className="text-[11px] text-slate-500">
              Кликни на карте, чтобы выбрать точку. Приватные мемориалы остаются скрытыми.
            </p>
          </div>
        </div>

        <div className="grid min-w-0 content-start gap-2">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-[#5d4037]">Маркер на карте</p>
          <div className="grid grid-cols-[56px_minmax(0,1fr)] gap-3">
            <div className="flex w-14 flex-col items-center gap-2">
              {markerStyles.map((style) => {
                const isActive = markerCategory === style.id;
                const categoryIconUrl =
                  markerVariants.find((variant) => variant.id === style.id)?.iconUrl ??
                  markerIconUrl(style.id);
                return (
                  <div key={style.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => {
                        setMarkerCategory(style.id);
                        if (markerStyleById(form.markerStyle).id !== style.id) {
                          handleChange("markerStyle", firstMarkerVariantId(style.id));
                        }
                      }}
                      className={`flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border p-0 transition sm:h-14 sm:w-14 ${
                        isActive
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                      }`}
                      aria-label={style.name}
                    >
                      <img
                        src={categoryIconUrl}
                        alt={style.name}
                        className="h-full w-full scale-[1.12] object-contain p-0.5"
                      />
                    </button>
                    <span className="pointer-events-none absolute left-full top-1/2 z-10 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-600 opacity-0 shadow-sm transition group-hover:opacity-100">
                      {style.name}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                Маркеры выбранного вида
              </p>
              <div className="flex w-full flex-wrap gap-1">
                {markerDisplay.map((marker) => {
                  const markerName = markerStyleById(marker.baseId).name;
                  return (
                    <button
                      key={marker.id}
                      type="button"
                      onClick={() => handleChange("markerStyle", marker.id)}
                      className={`flex items-center justify-center rounded-lg border p-0.5 ${
                        form.markerStyle === marker.id
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      <span
                        className="overflow-hidden rounded-lg bg-slate-100"
                        style={{ width: 56, height: 56 }}
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

  const renderStoryPanel = () => (
    <div className={overlayShellClass}>
      <h3 className={overlaySectionTitleClass}>
        <span className="h-2 w-2 rounded-full bg-[#3bceac]" />
        История и эпитафия
      </h3>
      <label className="grid gap-2">
        <span className={overlayLabelClass}>Эпитафия (до 200 символов)</span>
        <input
          className={overlayInputClass}
          value={form.epitaph}
          maxLength={200}
          onChange={(event) => handleChange("epitaph", event.target.value)}
          placeholder="Самый лучший друг"
        />
      </label>
      <label className="grid gap-2">
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
        <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[#5d4037]">Фотографии (до 10)</h3>
        <span className="rounded-full bg-[#d3a27f]/10 px-3 py-1 text-[10px] font-black text-[#d3a27f]">{photos.length}/10</span>
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
      <p className="text-xs text-slate-500">Максимум 10 фото, до 6 МБ каждое.</p>
      {photos.length > 0 ? (
        <div
          className="grid gap-2"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
            gap: "6px"
          }}
        >
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="relative rounded-2xl border border-slate-200 bg-white p-2"
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
                className="h-24 w-full rounded-lg bg-slate-100 object-contain"
              />
              <div className="mt-2 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setPreviewPhotoId(photo.id)}
                  className={`rounded-full px-3 py-1 text-xs ${
                    previewPhotoId === photo.id
                      ? "bg-slate-900 text-white"
                      : "border border-slate-200 text-slate-600"
                  }`}
                >
                  {previewPhotoId === photo.id ? "На обложке" : "На обложку"}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500">
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

  const isBuilderStep = step === 1;
  const isInitialStep = step === 0;
  const headerOffset = "var(--app-header-height, 56px)";
  const overlayPanelBase =
    "pointer-events-auto absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] left-[6.75rem] overflow-hidden rounded-[30px] border-[4px] border-white bg-white/95 p-2.5 shadow-[0_20px_46px_-18px_rgba(0,0,0,0.22)] backdrop-blur sm:left-[7.35rem] sm:p-3 xl:left-[7.95rem]";
  const overlayPanelClass = (variant?: "marker") =>
    `${overlayPanelBase} ${
      variant === "marker"
        ? "w-[min(1080px,calc(100vw-8.75rem))] max-h-[min(74vh,700px)]"
        : "w-[min(500px,calc(100vw-8.75rem))] max-h-[70vh] overflow-y-auto"
    }`;
  const panelButtonClass = (active: boolean, highlight: boolean) =>
    `group relative flex h-14 w-14 items-center justify-center rounded-[22px] border-2 shadow-md transition-all sm:h-16 sm:w-16 xl:h-[4.5rem] xl:w-[4.5rem] ${
      active
        ? "border-[#3bceac] bg-[#f0fffb] text-[#3bceac]"
        : "border-white bg-white/90 text-[#d3a27f] hover:border-[#d3a27f] hover:bg-[#d3a27f] hover:text-white"
    } ${
      highlight
        ? "ring-2 ring-emerald-400/80 shadow-[0_0_0_4px_rgba(52,211,153,0.18)]"
        : ""
      }`;
  const loadingMessage =
    loadingTips[loadingTipIndex] ?? "Происходит загрузка страницы...";
  const mainStyle: CSSProperties = {
    minHeight: "100dvh",
    marginTop: isBuilderStep || isInitialStep ? `calc(-1 * ${headerOffset})` : 0,
    paddingTop: isBuilderStep
      ? 0
      : isInitialStep
        ? 0
        : `calc(${headerOffset} + 24px)`
  };

  if (isEditMode && (!authReady || !editReady)) {
    return (
      <main className="min-h-[calc(100vh-var(--app-header-height,0px))] bg-[var(--bg)]">
        <div className="flex min-h-[calc(100vh-var(--app-header-height,0px))] items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-sm text-slate-600">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
            Загружаем мемориал для редактирования...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className={`relative bg-[var(--bg)] ${
        isBuilderStep || isInitialStep
          ? "h-[100dvh] overflow-hidden"
          : "px-4 pb-8"
      }`}
      style={mainStyle}
    >
      {!isBuilderStep ? (
        <div className={isInitialStep ? "w-full" : "mx-auto w-full max-w-none lg:w-[90vw]"}>
          <section className={isInitialStep ? "h-full" : "mt-6 rounded-2xl bg-transparent p-5"}>
            {step === 0 ? (
              <div className="relative box-border flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.92),_rgba(244,236,231,0.98)_36%,_rgba(238,228,222,1)_100%)] px-4 pt-[var(--app-header-height,56px)]">
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.3),transparent_35%,rgba(214,190,176,0.18)_100%)]" />
                <div className="relative z-10 flex w-full max-w-[560px] flex-col items-center px-2 sm:px-0">
                  <div className="relative w-full rounded-[36px] border border-white/70 bg-[#efe6e2] p-3 shadow-[0_32px_60px_rgba(89,71,65,0.22)] transition-transform duration-300 ease-out hover:scale-[1.018] sm:rounded-[42px] sm:p-4">
                    <div className="absolute left-1/2 top-0 h-20 w-[72%] -translate-x-1/2 -translate-y-[42%] rounded-t-[120px] border border-b-0 border-white/70 bg-[#efe6e2] shadow-[0_-6px_18px_rgba(255,255,255,0.35)]" />
                    <div className="relative min-h-[460px] rounded-[30px] border border-white/60 bg-[#f7f1ee] px-5 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_8px_18px_rgba(126,102,93,0.08)] sm:min-h-[500px] sm:rounded-[34px] sm:px-7 sm:py-7">
                      <div className="grid gap-3 text-center [&_label]:!text-[13px] [&_label]:!font-medium [&_label]:!text-[#8a7c77] [&_input]:!rounded-[20px] [&_input]:!border-[#d8cfc9] [&_input]:!bg-[#f1ebe9] [&_input]:!text-[16px] [&_input]:!font-semibold [&_input]:!text-[#6f6360] [&_select]:!rounded-[20px] [&_select]:!border-[#d8cfc9] [&_select]:!bg-[#f1ebe9] [&_select]:!text-[16px] [&_select]:!font-semibold [&_select]:!text-[#6f6360]">
                        {renderBaseInfoForm(true)}
                      </div>
                      {renderNavButtons(
                        "mt-6",
                        "w-full rounded-[24px] bg-[#111827] px-8 py-4 text-[13px] font-black uppercase tracking-[0.22em] text-white shadow-[0_12px_24px_-8px_rgba(17,24,39,0.5)] transition-all duration-300 hover:scale-[1.03] hover:bg-[#1f2937] active:scale-[0.98]"
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          {isTransitioning ? (
            <div className="fixed inset-0 z-40 grid place-items-center bg-[var(--bg)]">
              <div className="flex flex-col items-center gap-3 text-sm text-slate-600">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                {loadingMessage}
                <div className="h-2 w-48 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full bg-slate-600 transition-[width] duration-200"
                    style={{ width: `${loadingProgress}%` }}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div className="fixed inset-0 z-0">
              <MemorialPreview
                className="h-full w-full rounded-none border-transparent bg-transparent"
                terrainUrl={environmentUrl}
                terrainId={environmentPreviewId}
                houseUrl={houseUrl}
                houseId={housePreviewId}
                suppressLoadingOverlay
                cameraPosition={[8, 5, 8]}
                houseOffsetX={previewHousePlacement.x}
                houseOffsetZ={previewHousePlacement.z}
                houseRotationY={previewHousePlacement.rotY}
                houseScaleMultiplier={previewHouseScale}
                parts={partList}
                gifts={giftPreviewEnabled ? previewGifts : undefined}
              giftSlots={
                giftPreviewEnabled && previewPlaceholderSlots.length > 0
                  ? previewPlaceholderSlots
                  : undefined
              }
              showGiftSlots={giftPreviewEnabled && previewPlaceholderSlots.length > 0}
              enableHoverHighlight
              colors={colorOverrides}
              focusSlot={focusSlot}
              focusRequestId={focusRequestId}
              showControls={false}
              controlsEnabled={!activeOverlay}
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
          {activeOverlay ? (
            <button
              type="button"
              aria-label="Закрыть окно"
              className="fixed inset-0 z-5 pointer-events-auto"
              onClick={() => setActiveOverlay(null)}
            />
          ) : null}

          <div className="pointer-events-none fixed inset-0 z-10">

            <div className="pointer-events-auto absolute right-3 top-[calc(var(--app-header-height,56px)+10px)] bottom-[5.2rem] flex w-[min(340px,calc(100vw-1.25rem))] max-w-[90vw] flex-col rounded-[32px] border-[4px] border-white bg-[#efe6e2]/95 p-2.5 shadow-[0_24px_70px_-22px_rgba(0,0,0,0.28)] sm:right-5 sm:top-[calc(var(--app-header-height,56px)+12px)] sm:bottom-[5.5rem] sm:w-[min(358px,calc(100vw-1.75rem))] sm:p-3 xl:w-[378px]">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[26px] border border-white/70 bg-[#f7f1ee]/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_10px_24px_rgba(126,102,93,0.08)]">
                <div className="border-b border-[#eadfd9] px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.24em] text-[#8d6e63]">
                      Редактор мемориала
                    </h3>
                    <div className="flex items-center gap-3">
                      {isEditMode ? (
                        <span className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#3bceac]">
                          Только оформление
                        </span>
                      ) : null}
                      <label className="group relative z-[120] flex items-center gap-2 text-[10px] font-bold text-green-600">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300"
                          checked={giftPreviewEnabled}
                          onChange={(event) => setGiftPreviewEnabled(event.target.checked)}
                        />
                        <span>Посмотреть</span>
                        <span className="pointer-events-none absolute right-0 top-full z-[130] mt-2 w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-normal text-slate-600 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                          При включении показываем мемориал с примерами подарков, чтобы было видно, как они размещаются.
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
                <div className="flex min-h-0 flex-1 gap-2.5 overflow-hidden px-3 py-3">
                  <div className="flex w-[56px] flex-col items-center gap-2 overflow-visible sm:w-[60px] sm:gap-2.5">
                  {step3Tabs.map((tab) => {
                    const isActive = activeStep3Tab === tab.id;
                    const isDisabled = isEditMode && tab.id === "environment";
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
                            setTooltipTabId(null);
                            tooltipTimerRef.current = window.setTimeout(() => {
                              setTooltipTabId(tab.id);
                            }, 500);
                          }}
                          onMouseLeave={() => {
                            clearStep3TooltipTimer();
                            setTooltipTabId((prev) => (prev === tab.id ? null : prev));
                          }}
                          onFocus={() => {
                            if (isDisabled) {
                              return;
                            }
                            clearStep3TooltipTimer();
                            setTooltipTabId(null);
                            tooltipTimerRef.current = window.setTimeout(() => {
                              setTooltipTabId(tab.id);
                            }, 500);
                          }}
                          onBlur={() => {
                            clearStep3TooltipTimer();
                            setTooltipTabId((prev) => (prev === tab.id ? null : prev));
                          }}
                          aria-label={tab.label}
                            className={`flex h-12 w-12 items-center justify-center rounded-[18px] border-2 text-sm shadow-sm transition-all sm:h-14 sm:w-14 ${
                            isDisabled
                              ? "pointer-events-none cursor-not-allowed border-gray-100 bg-[#f3efec] text-[#c8beb8] opacity-55"
                              : isActive
                              ? "border-[#3bceac] bg-[#f0fffb] text-[#3bceac]"
                              : "border-gray-100 bg-white text-gray-400 hover:border-[#d3a27f] hover:bg-[#fff7f2] hover:text-[#d3a27f]"
                          }`}
                        >
                          <Step3TabIcon id={tab.id} />
                          <span className="sr-only">{tab.label}</span>
                        </button>
                        {isTooltipVisible ? (
                          <div className="pointer-events-none absolute left-full top-1/2 z-30 ml-4 w-56 -translate-y-1/2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-[11px] text-slate-700 shadow-lg">
                            <div className="font-semibold text-slate-900">{tab.label}</div>
                            <div className="mt-1 text-slate-500">{description}</div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                <div className="flex min-w-0 min-h-0 flex-1 flex-col overflow-hidden">
                  <div className="relative z-10 min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain pr-1 pb-3">
                    {renderStep3TabContent()}
                  </div>
                </div>
              </div>
            </div>
            </div>

            {activeOverlay ? (
              <div className={overlayPanelClass(activeOverlay === "marker" ? "marker" : undefined)}>
                {activeOverlay === "base"
                  ? renderBaseInfoPanel()
                  : activeOverlay === "marker"
                    ? renderMarkerPanel()
                    : activeOverlay === "photos"
                      ? renderPhotosPanel()
                      : renderStoryPanel()}
              </div>
            ) : null}

            <div className="pointer-events-auto absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] left-6">
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => toggleOverlay("base")}
                  aria-label="Основные данные"
                  disabled={isEditMode}
                  className={`${panelButtonClass(
                    activeOverlay === "base",
                    !isEditMode && isBuilderStep && !visitedOverlays.base
                  )} ${isEditMode ? "pointer-events-none cursor-not-allowed opacity-40" : ""}`}
                >
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 11v5" />
                    <circle cx="12" cy="8" r="1" />
                  </svg>
                  {!isEditMode && isBuilderStep && !visitedOverlays.base ? (
                    <span className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-[13px] font-bold text-white shadow">
                      !
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => toggleOverlay("story")}
                  aria-label="История"
                  disabled={isEditMode}
                  className={`${panelButtonClass(
                    activeOverlay === "story",
                    !isEditMode && isBuilderStep && !visitedOverlays.story
                  )} ${isEditMode ? "pointer-events-none cursor-not-allowed opacity-40" : ""}`}
                >
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 5h8a3 3 0 0 1 3 3v11" />
                    <path d="M20 19H10a3 3 0 0 0-3 3V6a3 3 0 0 1 3-3h10z" />
                  </svg>
                  {!isEditMode && isBuilderStep && !visitedOverlays.story ? (
                    <span className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-[13px] font-bold text-white shadow">
                      !
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => toggleOverlay("marker")}
                  aria-label="Маркер"
                  disabled={isEditMode}
                  className={`${panelButtonClass(
                    activeOverlay === "marker",
                    !isEditMode && isBuilderStep && !visitedOverlays.marker
                  )} ${isEditMode ? "pointer-events-none cursor-not-allowed opacity-40" : ""}`}
                >
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 21s-6-6.5-6-11a6 6 0 1 1 12 0c0 4.5-6 11-6 11z" />
                    <circle cx="12" cy="10" r="2.5" />
                  </svg>
                  {!isEditMode && isBuilderStep && !visitedOverlays.marker ? (
                    <span className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-[13px] font-bold text-white shadow">
                      !
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => toggleOverlay("photos")}
                  aria-label="Фотографии"
                  disabled={isEditMode}
                  className={`${panelButtonClass(
                    activeOverlay === "photos",
                    !isEditMode && isBuilderStep && !visitedOverlays.photos
                  )} ${isEditMode ? "pointer-events-none cursor-not-allowed opacity-40" : ""}`}
                >
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <circle cx="9" cy="11" r="2" />
                    <path d="M21 15l-4-4-4 4-3-3-5 5" />
                  </svg>
                  {!isEditMode && isBuilderStep && !visitedOverlays.photos ? (
                    <span className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-[13px] font-bold text-white shadow">
                      !
                    </span>
                  ) : null}
                </button>
              </div>
            </div>

            <div className="pointer-events-auto absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] right-6">
              <div className="flex items-center gap-3">
                {isEditMode && editId ? (
                  <button
                    type="button"
                    onClick={() => router.push(`/pets/${editId}`)}
                    className="inline-flex min-w-[9rem] items-center justify-center rounded-xl border-[3px] border-white bg-white/92 px-6 py-3 text-[0.95rem] font-black uppercase tracking-[0.14em] text-[#8d6e63] shadow-[0_10px_24px_-14px_rgba(93,64,55,0.42)] transition hover:-translate-y-[1px] hover:bg-[#fdf2e9]"
                  >
                    Отмена
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={openReview}
                  className="group inline-flex min-w-[11rem] items-center justify-center rounded-xl bg-[#2d3436] px-8 py-3 text-[1.1rem] font-black text-white shadow-[0_4px_0_0_#111827] transition-all hover:brightness-105 active:translate-y-[4px] active:shadow-none"
                >
                  <span className="transition-transform duration-300 group-hover:-translate-x-1">
                    {isEditMode ? "Сохранить" : "Завершить"}
                  </span>
                  {renderArrowIcon()}
                </button>
              </div>
            </div>
          </div>

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
                className={`relative w-full max-w-5xl max-h-[85vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl transition-transform duration-200 ${
                  reviewVisible ? "translate-y-0 scale-100" : "translate-y-4 scale-95"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">Проверка мемориала</h3>
                  <button type="button" className="btn btn-ghost px-3 py-2" onClick={closeReview}>
                    Закрыть
                  </button>
                </div>

                <div className="mt-4 grid gap-6">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <div className="grid gap-2 text-sm text-slate-700">
                      <p>Имя: {form.name || "—"}</p>
                      <p>Дата рождения: {form.birthDate || "—"}</p>
                      <p>Дата ухода: {form.deathDate || "—"}</p>
                      <p className="break-words">
                        Эпитафия: <span className="break-all">{form.epitaph || "—"}</span>
                      </p>
                      <p className="break-words">
                        История: <span className="whitespace-pre-wrap break-all">{form.story || "—"}</span>
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
                      parts={partList}
                      colors={colorOverrides}
                      softEdges
                      className="h-[420px]"
                    />
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="grid gap-3 text-sm text-slate-700">
                        <p className="font-semibold text-slate-900">
                          {isEditMode ? "Сохранение изменений" : "Оплата мемориала"}
                        </p>
                        {isEditMode ? (
                          <p className="text-xs text-slate-500">
                            Сохраним только домик и его детали. Остальные данные мемориала не изменятся.
                          </p>
                        ) : (
                          <>
                            <p className="text-xs text-slate-500">
                              Баланс: {walletLoading ? "Загрузка..." : walletBalance ?? "—"} монет
                            </p>
                            <div className="grid gap-2">
                              {MEMORIAL_PLANS.map((plan) => {
                                const isSelected = plan.id === memorialPlanId;
                                return (
                                  <button
                                    key={plan.id}
                                    type="button"
                                    onClick={() => setMemorialPlanId(plan.id)}
                                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm transition ${
                                      isSelected
                                        ? "border-sky-400 bg-sky-50 text-slate-900"
                                        : "border-slate-200 text-slate-700 hover:border-slate-300"
                                    }`}
                                  >
                                    <span className="font-semibold">{plan.label}</span>
                                    <span className="text-slate-500">{plan.price} монет</span>
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={handleSubmit}
                          className="group mt-2 inline-flex items-center justify-center rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-[0_6px_0_0_#000] transition-all hover:-translate-y-[1px] hover:shadow-[0_7px_0_0_#000] active:translate-y-[4px] active:shadow-none"
                          disabled={loading}
                        >
                          <span className="transition-transform duration-300 group-hover:-translate-x-1">
                            {loading
                              ? isEditMode
                                ? "Сохранение..."
                                : "Публикация..."
                              : isEditMode
                                ? "Сохранить"
                                : `Опубликовать мемориал • ${memorialPrice} монет`}
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

      <ErrorToast message={error} onClose={() => setError(null)} />

      {topUpOpen ? (
        <div
          className={`fixed inset-0 z-[999] flex items-center justify-center px-4 transition-opacity duration-200 ${
            topUpVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <button
            type="button"
            aria-label="Закрыть"
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={closeTopUp}
          />
          <div
            className={`relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl transition-transform duration-200 ${
              topUpVisible ? "translate-y-0 scale-100" : "translate-y-4 scale-95"
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Пополнение баланса</h3>
              <button type="button" className="btn btn-ghost px-3 py-2" onClick={closeTopUp}>
                Закрыть
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Баланс:{" "}
              {walletLoading
                ? "Загрузка..."
                : walletBalance !== null
                  ? `${walletBalance} монет`
                  : "—"}
            </p>
            <div className="mt-4 flex gap-2 rounded-full bg-slate-100 p-1">
              {(["RUB", "USD"] as const).map((currency) => {
                const isActive = topUpCurrency === currency;
                return (
                  <button
                    key={currency}
                    type="button"
                    onClick={() => setTopUpCurrency(currency)}
                    className={`flex-1 rounded-full px-4 py-2 text-xs font-semibold ${
                      isActive ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
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
                const price = topUpCurrency === "RUB" ? `${option.rub} ₽` : `${option.usd} USD`;
                return (
                  <button
                    key={option.coins}
                    type="button"
                    onClick={() => setTopUpPlan(option.coins)}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm transition ${
                      isSelected
                        ? "border-sky-400 bg-sky-50 text-slate-900"
                        : "border-slate-200 text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <span className="font-semibold">{option.coins} монет</span>
                    <span className="text-slate-500">{price}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className="mt-5 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              onClick={() => {
                if (!topUpPlan) {
                  return;
                }
                router.push(`/payment?coins=${topUpPlan}&currency=${topUpCurrency}`);
                closeTopUp();
              }}
              disabled={!topUpPlan}
            >
              Продолжить
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
