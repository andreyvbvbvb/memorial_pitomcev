"use client";

import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { useEffect, useMemo, useRef, useState, useCallback, type CSSProperties } from "react";
import { useGLTF } from "@react-three/drei";
import { useRouter } from "next/navigation";
import { API_BASE } from "../../lib/config";
import {
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
import {
  firstMarkerVariantId,
  markerAnchor,
  markerIconUrl,
  markerSize,
  markerStyleById,
  markerStyles,
  markerVariantsForSpecies
} from "../../lib/markers";
import MemorialPreview, { MEMORIAL_PRELOAD_URLS } from "./MemorialPreview";
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
  environmentOptions,
  houseOptions,
  optionById,
  roofOptions,
  wallOptions,
  signOptions,
  frameLeftOptions,
  frameRightOptions,
  matOptions,
  bowlFoodOptions,
  bowlWaterOptions
} from "../../lib/memorial-options";

type Step = 0 | 1;

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
  environmentId: environmentOptions[0]?.id ?? "summer",
  environmentSeason: getSeasonForDate(),
  environmentSeasonAuto: false,
  houseId: houseOptions[0]?.id ?? "budka_1",
  roofId: roofOptions[0]?.id ?? "roof_1",
  wallId: wallOptions[0]?.id ?? "wall_1",
  signId: signOptions[1]?.id ?? "sign_1",
  frameLeftId: frameLeftOptions[1]?.id ?? "frame_left_1",
  frameRightId: frameRightOptions[1]?.id ?? "frame_right_1",
  matId: matOptions[1]?.id ?? "mat_1",
  bowlFoodId: bowlFoodOptions[1]?.id ?? "bowl_food_1",
  bowlWaterId: bowlWaterOptions[1]?.id ?? "bowl_water_1",
  roofColor: colorPalette[0] ?? "#F36C6C",
  wallColor: colorPalette[1] ?? "#F2B476",
  signColor: colorPalette[16] ?? "#E9D1B3",
  frameLeftColor: colorPalette[16] ?? "#E9D1B3",
  frameRightColor: colorPalette[16] ?? "#E9D1B3",
  matColor: colorPalette[9] ?? "#5DADE2",
  bowlFoodColor: colorPalette[3] ?? "#FFD166",
  bowlWaterColor: colorPalette[7] ?? "#8ECAE6"
};

export default function CreateMemorialClient() {
  const [step, setStep] = useState<Step>(0);
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);
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
  const [markerCategory, setMarkerCategory] = useState(form.species);
  const [focusSlot, setFocusSlot] = useState<string | null>(null);
  const [focusRequestId, setFocusRequestId] = useState(0);
  const [hoveredOption, setHoveredOption] = useState<{ category: string; id: string } | null>(null);
  const [tooltipTabId, setTooltipTabId] = useState<Step3TabId | null>(null);
  const tooltipTimerRef = useRef<number | null>(null);
  const [, setAssetsReady] = useState(false);
  const assetsLoadStartedRef = useRef(false);
  const [giftPreviewEnabled, setGiftPreviewEnabled] = useState(false);
  const [detectedGiftSlots, setDetectedGiftSlots] = useState<string[] | null>(null);
  const [activeOverlay, setActiveOverlay] = useState<
    "marker" | "photos" | "story" | "base" | null
  >(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [cameraOffsetAdjustments] = useState<Record<string, CameraOffset>>({
    dom_slot_environment: { x: 0.75, y: 4.94, z: 8.85 },
    dom_slot_house: { x: 2.11, y: 2.94, z: 3.3 },
    sign_slot: { x: 0, y: 0, z: 2.85 }
  });

  const router = useRouter();
  const apiUrl = useMemo(() => API_BASE, []);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const { isLoaded, loadError } = useJsApiLoader({ googleMapsApiKey: apiKey });

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
  const selectedHouseVariant = splitHouseVariantId(form.houseId);
  const selectedHouseBaseId =
    selectedHouseVariant.baseId || houseVariantGroup.baseOptions[0]?.id || form.houseId;
  const houseBaseOptions = houseVariantGroup.baseOptions;
  const houseTextureOptions =
    houseVariantGroup.textureOptionsByBase[selectedHouseBaseId] ?? [];
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
  const roofPreviewId = hoveredId("roof") ?? form.roofId;
  const wallPreviewId = hoveredId("wall") ?? form.wallId;
  const signPreviewId = hoveredId("sign") ?? form.signId;
  const frameLeftPreviewId = hoveredId("frame-left") ?? form.frameLeftId;
  const frameRightPreviewId = hoveredId("frame-right") ?? form.frameRightId;
  const matPreviewId = hoveredId("mat") ?? form.matId;
  const bowlFoodPreviewId = hoveredId("bowl-food") ?? form.bowlFoodId;
  const bowlWaterPreviewId = hoveredId("bowl-water") ?? form.bowlWaterId;
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
        const data = (await response.json()) as { id: string };
        setForm((prev) => (prev.ownerId ? prev : { ...prev, ownerId: data.id }));
      } catch {
        router.replace("/auth");
      } finally {
        setAuthReady(true);
      }
    };
    loadMe();
  }, [apiUrl, router]);

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

  const todayInputValue = useMemo(() => today.toISOString().slice(0, 10), [today]);

  const validateStep = (current: Step) => {
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

  const handleNext = async () => {
    const message = validateStep(step);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    if (step === 0) {
      setIsTransitioning(true);
      await preloadAssets();
      setIsTransitioning(false);
      setStep(1);
      return;
    }
    setStep((prev) => clampStep(prev + 1));
  };

  const handleChange = (field: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

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

  const handleSubmit = async () => {
    const step0Message = validateStep(0);
    const step1Message = validateStep(1);
    const message = step0Message ?? step1Message;
    if (message) {
      setError(message);
      setStep(step1Message ? 1 : 0);
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
    setActiveOverlay((prev) => (prev === panel ? null : panel));
  };

  const openReview = () => {
    const message = validateStep(1);
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

  const renderNavButtons = (className?: string) => (
    <div className={`flex items-center justify-center ${className ?? ""}`}>
      {step < 1 ? (
        <button
          type="button"
          onClick={handleNext}
          className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white"
          disabled={!authReady || isTransitioning}
        >
          Продолжить
        </button>
      ) : null}
    </div>
  );

  const optionImage = (category: string, id: string) =>
    `/memorial/options/${category}/${id}.png`;

  const preloadImageUrls = useMemo(() => {
    const urls = new Set<string>();
    const add = (category: string, id: string) => {
      if (!id || id === "none") {
        return;
      }
      urls.add(optionImage(category, id));
    };
    environmentOptions.forEach((option) => add("environment", option.id));
    houseVariantGroup.baseOptions.forEach((option) => add("house", option.id));
    houseOptions.forEach((option) => add("house-texture", option.id));
    roofOptions.forEach((option) => add("roof", option.id));
    wallOptions.forEach((option) => add("wall", option.id));
    signOptions.forEach((option) => add("sign", option.id));
    frameLeftOptions.forEach((option) => add("frame-left", option.id));
    frameRightOptions.forEach((option) => add("frame-right", option.id));
    matOptions.forEach((option) => add("mat", option.id));
    bowlFoodOptions.forEach((option) => add("bowl-food", option.id));
    bowlWaterOptions.forEach((option) => add("bowl-water", option.id));
    return Array.from(urls.values());
  }, [houseVariantGroup.baseOptions]);

  const preloadAssets = useCallback(async () => {
    if (assetsLoadStartedRef.current) {
      return;
    }
    assetsLoadStartedRef.current = true;
    MEMORIAL_PRELOAD_URLS.forEach((url) => useGLTF.preload(url));
    const imagePromises = preloadImageUrls.map(
      (url) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = url;
        })
    );
    try {
      await Promise.all(imagePromises);
    } finally {
      setAssetsReady(true);
    }
  }, [preloadImageUrls]);

  useEffect(() => {
    if (step >= 1) {
      void preloadAssets();
    }
  }, [step, preloadAssets]);

  const renderOptionGrid = (
    category: string,
    options: typeof environmentOptions,
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
            onClick={() => onSelect(option.id)}
            onMouseEnter={() => setHoveredOption({ category, id: option.id })}
            onMouseLeave={() =>
              setHoveredOption((prev) => (prev?.category === category ? null : prev))
            }
            onFocus={() => setHoveredOption({ category, id: option.id })}
            onBlur={() =>
              setHoveredOption((prev) => (prev?.category === category ? null : prev))
            }
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
                        onClick={() => handleChange("environmentSeason", season)}
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

  const renderBaseInfoForm = () => (
    <div className="grid gap-4">
      <label className="grid gap-1 text-sm text-slate-700">
        Имя питомца
        <input
          className="rounded-2xl border border-slate-200 px-4 py-2"
          value={form.name}
          onChange={(event) => handleChange("name", event.target.value)}
          placeholder="Барсик"
        />
      </label>
      <label className="grid gap-1 text-sm text-slate-700">
        Вид питомца
        <select
          className="rounded-2xl border border-slate-200 px-4 py-2"
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
      <div className="grid gap-4">
        <label className="grid gap-1 text-sm text-slate-700">
          Дата рождения
          <input
            type="date"
            className={`rounded-2xl border px-4 py-2 ${
              dateValidationMessage ? "border-red-400" : "border-slate-200"
            }`}
            value={form.birthDate}
            onChange={(event) => handleChange("birthDate", event.target.value)}
            max={form.deathDate || todayInputValue}
          />
        </label>
        <label className="grid gap-1 text-sm text-slate-700">
          Дата ухода
          <input
            type="date"
            className={`rounded-2xl border px-4 py-2 ${
              dateValidationMessage ? "border-red-400" : "border-slate-200"
            }`}
            value={form.deathDate}
            onChange={(event) => handleChange("deathDate", event.target.value)}
            min={form.birthDate || undefined}
            max={todayInputValue}
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
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
      <div className="grid gap-3">
        <div className="overflow-hidden rounded-2xl border border-slate-200">
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
            mapContainerStyle={{ width: "100%", height: "440px" }}
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
            className="rounded-2xl border border-slate-200 px-2.5 py-1 text-[11px] text-slate-700"
          >
            Моё местоположение
          </button>
          <button
            type="button"
            onClick={() => setForm((prev) => ({ ...prev, lat: "", lng: "" }))}
            className="rounded-2xl border border-slate-200 px-2.5 py-1 text-[11px] text-slate-700"
          >
            Очистить
          </button>
        </div>

        <label className="group relative flex items-center gap-2 text-xs text-slate-700">
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

      <div className="grid gap-3">
        <p className="text-sm font-semibold text-slate-900">Маркер на карте</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {markerStyles.map((style) => {
            const isActive = markerCategory === style.id;
            return (
              <button
                key={style.id}
                type="button"
                onClick={() => {
                  setMarkerCategory(style.id);
                  if (markerStyleById(form.markerStyle).id !== style.id) {
                    handleChange("markerStyle", firstMarkerVariantId(style.id));
                  }
                }}
                className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2 text-[10px] transition ${
                  isActive
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                }`}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/80">
                  <img
                    src={markerIconUrl(style.id)}
                    alt={style.name}
                    className="h-6 w-6 object-contain"
                  />
                </span>
                <span className="whitespace-nowrap">{style.name}</span>
              </button>
            );
          })}
        </div>
        <div className="grid gap-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
            Маркеры выбранного вида
          </p>
          <div className="flex flex-wrap gap-1">
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
    );
  };

  const renderStoryPanel = () => (
    <div className="grid gap-4">
      <label className="grid gap-1 text-sm text-slate-700">
        Эпитафия (до 200 символов)
        <input
          className="rounded-2xl border border-slate-200 px-4 py-2"
          value={form.epitaph}
          maxLength={200}
          onChange={(event) => handleChange("epitaph", event.target.value)}
          placeholder="Самый лучший друг"
        />
      </label>
      <label className="grid gap-1 text-sm text-slate-700">
        История питомца
        <textarea
          className="min-h-[160px] rounded-2xl border border-slate-200 px-4 py-2"
          value={form.story}
          maxLength={2000}
          onChange={(event) => handleChange("story", event.target.value)}
          placeholder="Короткая история о жизни питомца"
        />
      </label>
    </div>
  );

  const renderPhotosPanel = () => (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Фотографии (до 10)</h3>
        <span className="text-xs text-slate-500">{photos.length}/10</span>
      </div>
      <input
        type="file"
        accept="image/*"
        multiple
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
    <div className="grid gap-4">
      {renderBaseInfoForm()}
    </div>
  );

  const isBuilderStep = step === 1;
  const overlayPanelClass =
    "pointer-events-auto absolute bottom-[calc(5rem+env(safe-area-inset-bottom))] left-6 lg:left-20 w-[520px] max-w-[92vw] max-h-[70vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur";
  const panelButtonClass = (active: boolean) =>
    `flex h-12 w-12 items-center justify-center rounded-2xl border transition ${
      active
        ? "border-white/80 bg-white text-slate-900 shadow-lg"
        : "border-white/60 bg-white/70 text-slate-600 hover:bg-white/90"
    }`;
  const mainStyle: CSSProperties = {
    minHeight: "100dvh",
    marginTop: isBuilderStep ? 0 : "calc(-1 * var(--app-header-height, 56px))",
    paddingTop: isBuilderStep
      ? 0
      : "calc(var(--app-header-height, 56px) + 24px)"
  };

  return (
    <main
      className={`relative bg-slate-50 ${
        isBuilderStep ? "h-[100dvh] overflow-hidden" : "px-4 pb-8"
      }`}
      style={mainStyle}
    >
      {!isBuilderStep ? (
        <div className="mx-auto w-full max-w-none lg:w-[90vw]">
          <section className="mt-6 rounded-2xl bg-transparent p-5">
            {step === 0 ? (
              <div className="mx-auto w-[90vw] max-w-[420px] min-w-[280px] sm:w-[70vw] md:w-[45vw] lg:w-[25vw]">
                {renderBaseInfoForm()}
              </div>
            ) : null}
          </section>

          <div className="mt-6">{renderNavButtons()}</div>

          {isTransitioning ? (
            <div className="fixed inset-0 z-40 grid place-items-center bg-white">
              <div className="flex flex-col items-center gap-3 text-sm text-slate-600">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                Происходит загрузка страницы...
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
              houseUrl={houseUrl}
              houseId={housePreviewId}
              cameraPosition={[12, 8, 12]}
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

            <div className="pointer-events-auto absolute right-6 top-[calc(var(--app-header-height,56px)+16px)] bottom-24 w-[320px] max-w-[85vw] lg:max-w-[32vw] rounded-3xl border border-white/60 bg-white/90 p-4 shadow-xl backdrop-blur">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Редактор мемориала</h3>
              </div>
              <div className="mt-3 flex h-full gap-2 overflow-hidden">
                <div className="flex w-12 flex-col items-center gap-2 overflow-visible">
                  {step3Tabs.map((tab) => {
                    const isActive = activeStep3Tab === tab.id;
                    const isTooltipVisible = tooltipTabId === tab.id;
                    const description = STEP3_TAB_DESCRIPTIONS[tab.id];
                    return (
                      <div key={tab.id} className="relative">
                        <button
                          type="button"
                          onClick={() => handleStep3TabSelect(tab)}
                          onMouseEnter={() => {
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
                          className={`flex h-12 w-12 items-center justify-center rounded-2xl border text-sm transition ${
                            isActive
                              ? "border-sky-400 bg-sky-50 text-sky-700"
                              : "border-slate-200 bg-white text-slate-500 hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700"
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

                <div className="flex min-w-0 flex-1 flex-col">
                  <label className="group relative mb-2 flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={giftPreviewEnabled}
                      onChange={(event) => setGiftPreviewEnabled(event.target.checked)}
                    />
                    Посмотреть с подарками
                    <span className="pointer-events-none absolute left-0 top-full z-10 mt-2 w-64 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                      При включении показываем мемориал с примерами подарков, чтобы было видно, как они размещаются.
                    </span>
                  </label>
                  <div className="relative z-10 min-w-0 flex-1 overflow-y-auto pr-1">
                    {renderStep3TabContent()}
                  </div>
                </div>
              </div>
            </div>

            {activeOverlay ? (
              <div className={overlayPanelClass}>
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
                  className={panelButtonClass(activeOverlay === "base")}
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 11v5" />
                    <circle cx="12" cy="8" r="1" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => toggleOverlay("story")}
                  aria-label="История"
                  className={panelButtonClass(activeOverlay === "story")}
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 5h8a3 3 0 0 1 3 3v11" />
                    <path d="M20 19H10a3 3 0 0 0-3 3V6a3 3 0 0 1 3-3h10z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => toggleOverlay("marker")}
                  aria-label="Маркер"
                  className={panelButtonClass(activeOverlay === "marker")}
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 21s-6-6.5-6-11a6 6 0 1 1 12 0c0 4.5-6 11-6 11z" />
                    <circle cx="12" cy="10" r="2.5" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => toggleOverlay("photos")}
                  aria-label="Фотографии"
                  className={panelButtonClass(activeOverlay === "photos")}
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <circle cx="9" cy="11" r="2" />
                    <path d="M21 15l-4-4-4 4-3-3-5 5" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="pointer-events-auto absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] right-6">
              <button
                type="button"
                onClick={openReview}
                className="rounded-2xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
              >
                Завершить
              </button>
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
                      houseUrl={houseUrl}
                      houseId={form.houseId}
                      parts={partList}
                      colors={colorOverrides}
                      softEdges
                      className="h-[420px]"
                    />
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="grid gap-3 text-sm text-slate-700">
                        <p className="font-semibold text-slate-900">Оплата мемориала</p>
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
                        <button
                          type="button"
                          onClick={handleSubmit}
                          className="mt-2 rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white"
                          disabled={loading}
                        >
                          {loading ? "Публикация..." : `Опубликовать мемориал • ${memorialPrice} монет`}
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
