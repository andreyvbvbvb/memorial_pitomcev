"use client";

import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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

type Step = 0 | 1 | 2 | 3 | 4;

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

const steps = [
  "Основные данные",
  "Маркер и точка",
  "3D мемориал",
  "Фото и история",
  "Проверка"
];
const MEMORIAL_PLANS = [
  { id: "1y", years: 1, label: "1 год", price: 100 },
  { id: "2y", years: 2, label: "2 года", price: 200 },
  { id: "5y", years: 5, label: "5 лет", price: 500 },
  { id: "lifetime", years: 0, label: "Бессрочно", price: 1500 }
] as const;
type MemorialPlanId = (typeof MEMORIAL_PLANS)[number]["id"];
const defaultCenter = { lat: 55.751244, lng: 37.618423 };
const mapContainerStyle = { width: "100%", height: "60vh" };

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
  const [layoutMode, setLayoutMode] = useState<"desktop" | "mobile">("desktop");
  const photosRef = useRef<PhotoDraft[]>([]);
  const [showOtherMarkers, setShowOtherMarkers] = useState(false);
  const [focusSlot, setFocusSlot] = useState<string | null>(null);
  const [focusRequestId, setFocusRequestId] = useState(0);
  const [hoveredOption, setHoveredOption] = useState<{ category: string; id: string } | null>(null);
  const [tooltipTabId, setTooltipTabId] = useState<Step3TabId | null>(null);
  const tooltipTimerRef = useRef<number | null>(null);
  const [assetsReady, setAssetsReady] = useState(false);
  const assetsLoadStartedRef = useRef(false);
  const [giftPreviewEnabled, setGiftPreviewEnabled] = useState(false);
  const [detectedGiftSlots, setDetectedGiftSlots] = useState<string[] | null>(null);
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
  const markerGroups = useMemo(
    () => markerVariantsForSpecies(form.species),
    [form.species]
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

  const isMobile = layoutMode === "mobile" ? true : false;

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
    const loadWallet = async () => {
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
    };
    void loadWallet();
  }, [apiUrl, form.ownerId]);

  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url));
    };
  }, []);

  useEffect(() => {
    if (step !== 2) {
      setFocusSlot(null);
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
    if (value >= 4) {
      return 4;
    }
    return value as Step;
  };

  const handleNext = () => {
    const message = validateStep(step);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setStep((prev) => clampStep(prev + 1));
  };

  const handleBack = () => {
    setError(null);
    setStep((prev) => clampStep(prev - 1));
  };

  const handleChange = (field: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSpeciesChange = (value: string) => {
    setShowOtherMarkers(false);
    setForm((prev) => {
      const nextMarker = firstMarkerVariantId(value) ?? prev.markerStyle;
      return { ...prev, species: value, markerStyle: nextMarker };
    });
  };

  const handlePhotosSelected = (files: FileList | null) => {
    if (!files) {
      return;
    }
    const available = Math.max(0, 5 - photos.length);
    const selected = Array.from(files).slice(0, available);
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

  const renderNavButtons = (className?: string) => (
    <div className={`flex items-center justify-between ${className ?? ""}`}>
      <button
        type="button"
        onClick={handleBack}
        className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700"
        disabled={step === 0}
      >
        Назад
      </button>
      {step < 4 ? (
        <button
          type="button"
          onClick={handleNext}
          className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white"
          disabled={step === 0 && !authReady}
        >
          Дальше
        </button>
      ) : (
        <button
          type="button"
          onClick={handleSubmit}
          className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white"
          disabled={loading}
        >
          {loading ? "Публикация..." : `Опубликовать мемориал • ${memorialPrice} монет`}
        </button>
      )}
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
    <div className="grid grid-cols-2 gap-2">
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
            className={`flex w-full aspect-square items-center justify-center rounded-xl border p-2 transition ${
              isSelected
                ? "border-sky-400 bg-sky-50"
                : "border-slate-200 bg-transparent hover:border-sky-400 hover:bg-sky-50"
            }`}
          >
            <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-lg bg-slate-100">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={option.name}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="text-xs text-slate-500">Нет</div>
              )}
            </div>
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
                    return (
                      <button
                        key={season}
                        type="button"
                        onClick={() => handleChange("environmentSeason", season)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                          isActive
                            ? "border-sky-400 bg-sky-50 text-sky-700"
                            : "border-slate-200 text-slate-600 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
                        }`}
                      >
                        {SEASON_LABELS[season]}
                      </button>
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

  return (
    <main
      className="bg-gradient-to-b from-slate-50 to-slate-200 px-4 pb-8 pt-6"
      style={{ minHeight: "calc(100vh - var(--app-header-height, 56px))" }}
    >
      <div className="mx-auto w-full max-w-none lg:w-[90vw]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {steps.map((label, index) => {
              const isActive = index === step;
              const isClickable = index <= step;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    if (isClickable) {
                      setError(null);
                      setStep(index as Step);
                    }
                  }}
                  className={`rounded-full px-4 py-2 text-xs font-semibold ${
                    isActive
                      ? "bg-slate-900 text-white"
                      : isClickable
                        ? "bg-white text-slate-700 hover:border-slate-300"
                        : "bg-slate-100 text-slate-400"
                  }`}
                  disabled={!isClickable}
                >
                  {index + 1}. {label}
                </button>
              );
            })}
          </div>
          {step === 2 ? (
            <button
              type="button"
              onClick={() =>
                setLayoutMode((prev) => (prev === "mobile" ? "desktop" : "mobile"))
              }
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
            >
              {isMobile ? "Переключить на десктоп" : "Переключить на мобильную"}
            </button>
          ) : null}
        </div>

        <section className="mt-6 rounded-2xl bg-transparent p-5">
          {step === 0 ? (
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
              <div className="grid gap-4 md:grid-cols-2">
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
              {dateValidationMessage ? (
                <p className="text-xs text-red-600">{dateValidationMessage}</p>
              ) : null}
            </div>
          ) : null}

          {step === 1 ? (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <p className="text-sm font-semibold text-slate-900">Маркер на карте</p>
                <div className="grid gap-3">
                  {markerGroups.primary.length > 0 ? (
                    <div className="grid gap-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Маркеры выбранного вида
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {markerGroups.primary.map((marker) => {
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
                                style={{ width: 72, height: 72 }}
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
                  ) : null}

                  {markerGroups.secondary.length > 0 ? (
                    <div className="grid gap-2">
                      <button
                        type="button"
                        onClick={() => setShowOtherMarkers((prev) => !prev)}
                        className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs uppercase tracking-[0.2em] text-slate-500"
                      >
                        Остальные маркеры
                        <span className="text-base leading-none text-slate-400">
                          {showOtherMarkers ? "−" : "+"}
                        </span>
                      </button>
                      {showOtherMarkers ? (
                        <div className="flex flex-wrap gap-1">
                          {markerGroups.secondary.map((marker) => {
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
                                  style={{ width: 72, height: 72 }}
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
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
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
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700"
                >
                  Использовать моё местоположение
                </button>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, lat: "", lng: "" }))}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700"
                >
                  Очистить координаты
                </button>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200">
                {!apiKey ? (
                  <div className="flex min-h-[300px] items-center justify-center bg-slate-50 text-sm text-slate-500">
                    Укажи NEXT_PUBLIC_GOOGLE_MAPS_API_KEY в .env.local
                  </div>
                ) : loadError ? (
                  <div className="flex min-h-[300px] items-center justify-center bg-slate-50 text-sm text-red-600">
                    Ошибка загрузки карты
                  </div>
                ) : !isLoaded ? (
                  <div className="flex min-h-[300px] items-center justify-center bg-slate-50 text-sm text-slate-500">
                    Загрузка карты...
                  </div>
                ) : (
                  <GoogleMap
                    mapContainerStyle={mapContainerStyle}
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
              <label className="flex items-center gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={form.isPublic}
                  onChange={(event) => handleChange("isPublic", event.target.checked)}
                />
                Публичный мемориал
              </label>
              <p className="text-xs text-slate-500">
                Кликни на карте, чтобы выбрать точку для мемориала. Приватные мемориалы остаются скрытыми на
                глобальной карте.
              </p>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="relative grid gap-3">
              {!assetsReady ? (
                <div className="absolute inset-0 z-30 grid place-items-center rounded-2xl bg-white/80">
                  <div className="flex flex-col items-center gap-3 text-sm text-slate-600">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                    Происходит загрузка страницы...
                  </div>
                </div>
              ) : null}
              <div
                className={isMobile ? "flex flex-col gap-4" : "grid gap-4"}
                style={
                  isMobile
                    ? undefined
                    : {
                        gridTemplateColumns: "72% 24%",
                        columnGap: "4%"
                      }
                }
              >
                {isMobile ? (
                  <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 py-3 backdrop-blur">
                    {renderNavButtons("px-4")}
                  </div>
                ) : null}
                <div className={`grid gap-3 ${isMobile ? "px-4" : "sticky top-24 self-start"}`}>
                  <MemorialPreview
                    terrainUrl={environmentUrl}
                    houseUrl={houseUrl}
                    houseId={housePreviewId}
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
                    softEdges
                    cameraOffsetAdjustments={cameraOffsetAdjustments}
                    cameraAdjustmentKey={activeCameraKey}
                    onHouseSlotsDetected={setDetectedHouseSlots}
                    onGiftSlotsDetected={setDetectedGiftSlots}
                    onDetailClick={handlePreviewDetailClick}
                    style={
                      isMobile
                        ? { height: "34vh", minHeight: "240px" }
                        : { height: "calc(100vh - 320px)", minHeight: "440px" }
                    }
                  />
                </div>

                <div
                  className={`flex gap-4 overflow-visible ${
                    isMobile
                      ? "min-h-[38vh] max-h-[38vh] px-4 pb-6"
                      : "min-h-[60vh] max-h-[60vh]"
                  }`}
                >
                  <div className="relative z-20 flex w-14 flex-col items-center gap-3 self-start overflow-visible">
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
                              className={`flex h-14 w-14 items-center justify-center rounded-2xl border text-sm transition ${
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

                  <div
                    className={`flex min-w-0 flex-1 flex-col ${
                      isMobile ? "max-h-[38vh]" : "max-h-[60vh]"
                    }`}
                  >
                    <label className="mb-2 flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={giftPreviewEnabled}
                        onChange={(event) => setGiftPreviewEnabled(event.target.checked)}
                      />
                      Посмотреть с подарками
                    </label>
                    <div className="relative z-10 min-w-0 flex-1 overflow-y-auto pr-2">
                      {renderStep3TabContent()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
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
                Здесь вы можете поделиться историей питомца и дополнительной информацией
                <textarea
                  className="min-h-[160px] rounded-2xl border border-slate-200 px-4 py-2"
                  value={form.story}
                  maxLength={2000}
                  onChange={(event) => handleChange("story", event.target.value)}
                  placeholder="Короткая история о жизни питомца"
                />
              </label>

              <div className="mt-4 grid gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">Фотографии (до 5)</h3>
                  <span className="text-xs text-slate-500">{photos.length}/5</span>
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
                <p className="text-xs text-slate-500">Максимум 5 фото, до 10 МБ каждое.</p>
                {photos.length > 0 ? (
                  <div
                    className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                      gap: "8px"
                    }}
                  >
                    {photos.map((photo) => (
                      <div
                        key={photo.id}
                        className="relative rounded-2xl border border-slate-200 bg-white p-2"
                        style={{ maxWidth: "220px" }}
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
                          className="w-full rounded-lg bg-slate-100 object-contain"
                          style={{ height: "120px", width: "100%", objectFit: "contain" }}
                        />
                        <div className="mt-3 flex items-center justify-center">
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
                    Добавь фотографии питомца и выбери одну для мини‑окна на карте.
                  </p>
                )}
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="grid gap-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <div className="grid gap-2 text-sm text-slate-700">
                  <p>Имя: {form.name || "—"}</p>
                  <p>Дата рождения: {form.birthDate || "—"}</p>
                  <p>Дата ухода: {form.deathDate || "—"}</p>
                  <p className="break-words">
                    Эпитафия: <span className="break-all">{form.epitaph || "—"}</span>
                  </p>
                  <p className="break-words">
                    История:{" "}
                    <span className="whitespace-pre-wrap break-all">{form.story || "—"}</span>
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
                          style={{ width: 324, height: 252 }}
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
                  className="h-[648px]"
                />
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="grid gap-3 text-sm text-slate-700">
                    <p className="font-semibold text-slate-900">Оплата мемориала</p>
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
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <ErrorToast message={error} onClose={() => setError(null)} />

        <div className={`mt-6 ${step === 2 && isMobile ? "hidden" : ""}`}>
          {renderNavButtons()}
        </div>
      </div>

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
