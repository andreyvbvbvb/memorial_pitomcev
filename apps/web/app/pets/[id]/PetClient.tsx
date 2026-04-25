"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import { API_BASE } from "../../../lib/config";
import { MAP_PREVIEW_CAPTURE_HEIGHT, MAP_PREVIEW_CAPTURE_WIDTH } from "../../../lib/map-preview";
import MemorialPreview from "../../create/MemorialPreview";
import ErrorToast from "../../../components/ErrorToast";
import {
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
} from "../../../lib/memorial-models";
import { getHouseSlots, getTerrainGiftSlots } from "../../../lib/memorial-config";
import {
  GiftSize,
  getGiftAvailableTypes,
  getGiftSlotType,
  giftSupportsSize,
  getGiftCode,
  resolveGiftModelUrl,
  resolveGiftIconUrl
} from "../../../lib/gifts";
import {
  buildHouseVariantGroup,
  splitHouseVariantId
} from "../../../lib/house-variants";
import {
  bowlFoodOptions as allBowlFoodOptions,
  bowlWaterOptions as allBowlWaterOptions,
  filterOptionsForUser,
  frameLeftOptions as allFrameLeftOptions,
  frameRightOptions as allFrameRightOptions,
  houseOptions as allHouseOptions,
  matOptions as allMatOptions,
  roofOptions as allRoofOptions,
  signOptions as allSignOptions,
  wallOptions as allWallOptions,
  type OptionItem
} from "../../../lib/memorial-options";

const DIRT_SLOTS = ["dirt_slot_1", "dirt_slot_2", "dirt_slot_3", "dirt_slot_4"] as const;
const DURATION_OPTIONS = [1, 2, 3, 6, 12] as const;
const MEMORIAL_EXTENSION_PLANS = [
  { id: "1y", years: 1, label: "1 год", price: 100 },
  { id: "2y", years: 2, label: "2 года", price: 200 },
  { id: "5y", years: 5, label: "5 лет", price: 500 }
] as const;

const buildDirtModelUrls = (houseId?: string | null): string[] => {
  const baseId = splitHouseVariantId(houseId).baseId || houseId || "";
  const prefix = baseId ? `/models/dirt/${baseId}` : "/models/dirt";
  return [1, 2, 3, 4].map((index) => `${prefix}/dirt_${index}.glb`);
};

const formatMonthsLabel = (months: number) => {
  const mod10 = months % 10;
  const mod100 = months % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return `${months} месяц`;
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${months} месяца`;
  }
  return `${months} месяцев`;
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
] as const;

type AppearanceTabId =
  | "house"
  | "roof"
  | "wall"
  | "sign"
  | "frameLeft"
  | "frameRight"
  | "mat"
  | "bowlFood"
  | "bowlWater";

type AppearanceDraft = {
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

type Pet = {
  id: string;
  ownerId: string;
  owner?: { id: string; email: string | null; login: string | null } | null;
  name: string;
  species?: string | null;
  birthDate: string | null;
  deathDate: string | null;
  epitaph: string | null;
  story: string | null;
  isPublic: boolean;
  createdAt: string;
  memorial?: {
    environmentId: string | null;
    houseId: string | null;
    sceneJson: Record<string, unknown> | null;
    dustStage?: number | null;
    dustUpdatedAt?: string | null;
    activeUntil?: string | null;
    needsPreviewRefresh?: boolean | null;
  } | null;
  photos?: { id: string; url: string }[];
  gifts?: {
    id: string;
    slotName: string;
    placedAt: string;
    expiresAt: string | null;
    isActive?: boolean;
    size?: string | null;
    gift: { id: string; code?: string | null; name: string; price: number; modelUrl: string };
    owner?: {
      id: string;
      email: string | null;
      login: string | null;
      pets?: { id: string; name: string }[];
    };
  }[];
};

type OwnerMemorial = {
  id: string;
  name: string;
  birthDate: string | null;
  deathDate: string | null;
  photos?: { id: string; url: string }[];
  memorial?: {
    environmentId: string | null;
    houseId: string | null;
    sceneJson: Record<string, unknown> | null;
    dustStage?: number | null;
    dustUpdatedAt?: string | null;
    activeUntil?: string | null;
  } | null;
};

type AuthUser = {
  id: string;
  login?: string | null;
  email: string;
  coinBalance?: number;
};

type Props = {
  id: string;
};

export default function PetClient({ id }: Props) {
  const [pet, setPet] = useState<Pet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpVisible, setTopUpVisible] = useState(false);
  const [topUpCurrency, setTopUpCurrency] = useState<"RUB" | "USD">("RUB");
  const [topUpPlan, setTopUpPlan] = useState<number | null>(null);
  const [giftCatalog, setGiftCatalog] = useState<
    { id: string; code?: string | null; name: string; price: number; modelUrl: string }[]
  >([]);
  const [giftError, setGiftError] = useState<string | null>(null);
  const [giftSuccess, setGiftSuccess] = useState<string | null>(null);
  const [cleanSuccess, setCleanSuccess] = useState<string | null>(null);
  const [giftLoading, setGiftLoading] = useState(false);
  const [selectedGiftId, setSelectedGiftId] = useState<string | null>(null);
  const [selectedGiftSize, setSelectedGiftSize] = useState<GiftSize>("m");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [giftPreviewEnabled, setGiftPreviewEnabled] = useState(false);
  const [giftCatalogLoading, setGiftCatalogLoading] = useState(true);
  const [preloadedGiftUrls, setPreloadedGiftUrls] = useState<Record<string, true>>({});
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [giftPanelOpen, setGiftPanelOpen] = useState(false);
  const [giftSlotsVisible, setGiftSlotsVisible] = useState(false);
  const [activePanel, setActivePanel] = useState<
    "info" | "photos" | "gifts" | "memorials" | "manage" | null
  >(null);
  const [detectedSlots, setDetectedSlots] = useState<string[] | null>(null);
  const [slotManuallyCleared, setSlotManuallyCleared] = useState(false);
  const [ownerMemorials, setOwnerMemorials] = useState<OwnerMemorial[]>([]);
  const [dirtLevel, setDirtLevel] = useState(0);
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);
  const [extendingMemorial, setExtendingMemorial] = useState(false);
  const [deletingMemorial, setDeletingMemorial] = useState(false);
  const [extensionDialogOpen, setExtensionDialogOpen] = useState(false);
  const [extensionDialogVisible, setExtensionDialogVisible] = useState(false);
  const [selectedExtensionYears, setSelectedExtensionYears] = useState<1 | 2 | 5>(1);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [deleteConfirmationName, setDeleteConfirmationName] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editDialogVisible, setEditDialogVisible] = useState(false);
  const [appearanceDraft, setAppearanceDraft] = useState<AppearanceDraft | null>(null);
  const [appearanceTab, setAppearanceTab] = useState<AppearanceTabId>("house");
  const [appearanceError, setAppearanceError] = useState<string | null>(null);
  const [appearanceSuccess, setAppearanceSuccess] = useState<string | null>(null);
  const [savingAppearance, setSavingAppearance] = useState(false);
  const [previewContextReady, setPreviewContextReady] = useState(false);
  const previewControlsRef = useRef<any>(null);
  const previewRenderRef = useRef<{
    gl: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.Camera;
  } | null>(null);
  const previewRefreshInFlightRef = useRef(false);

  const apiUrl = useMemo(() => API_BASE, []);
  const router = useRouter();
  const handleCleanDirt = useCallback(async () => {
    try {
      setCleanSuccess(null);
      const response = await fetch(`${apiUrl}/pets/${id}/memorial/clean`, {
        method: "PATCH"
      });
      if (!response.ok) {
        throw new Error("Не удалось очистить мемориал");
      }
      const data = (await response.json()) as {
        dustStage?: number | null;
        dustUpdatedAt?: string | null;
      };
      const nextStage = typeof data.dustStage === "number" ? data.dustStage : 0;
      setDirtLevel(nextStage);
      setPet((prev) =>
        prev?.memorial
          ? {
              ...prev,
              memorial: {
                ...prev.memorial,
                dustStage: nextStage,
                dustUpdatedAt: data.dustUpdatedAt ?? prev.memorial.dustUpdatedAt ?? null
              }
            }
          : prev
      );
      setCleanSuccess("Спасибо, что поддерживаете мемориал в чистоте.");
    } catch {
      setDirtLevel(0);
    }
  }, [apiUrl, id]);

  const handleMemorialDetailClick = useCallback(
    (detail: { slot?: string }) => {
      if (detail.slot && detail.slot.startsWith("dirt_slot")) {
        handleCleanDirt();
      }
    },
    [handleCleanDirt]
  );

  const loadPet = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl}/pets/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          setError("Мемориал не найден или недоступен");
          return;
        }
        throw new Error("Ошибка загрузки мемориала");
      }
      const data = (await response.json()) as Pet;
      setPet(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, id]);

  useEffect(() => {
    setMounted(true);
    loadPet();
  }, [loadPet]);

  const loadCurrentUser = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/auth/me`, { credentials: "include" });
      if (!response.ok) {
        setCurrentUser(null);
        setWalletBalance(null);
        return;
      }
      const data = (await response.json()) as AuthUser;
      setCurrentUser(data);
    } catch {
      setCurrentUser(null);
      setWalletBalance(null);
    }
  }, [apiUrl]);

  const loadWallet = useCallback(
    async (ownerId: string) => {
      setWalletLoading(true);
      try {
        const response = await fetch(`${apiUrl}/wallet/${ownerId}`);
        if (!response.ok) {
          throw new Error("Не удалось загрузить баланс");
        }
        const data = (await response.json()) as { coinBalance: number };
        setWalletBalance(data.coinBalance ?? 0);
      } catch {
        setWalletBalance(null);
      } finally {
        setWalletLoading(false);
      }
    },
    [apiUrl]
  );

  useEffect(() => {
    loadCurrentUser();
  }, [loadCurrentUser]);

  useEffect(() => {
    setDirtLevel(pet?.memorial?.dustStage ?? 0);
  }, [pet?.memorial?.dustStage]);

  useEffect(() => {
    if (currentUser?.id) {
      loadWallet(currentUser.id);
    }
  }, [currentUser, loadWallet]);

  useEffect(() => {
    if (!pet?.ownerId) {
      setOwnerMemorials([]);
      return;
    }
    const loadOwnerMemorials = async () => {
      try {
        const response = await fetch(`${apiUrl}/pets?ownerId=${pet.ownerId}`);
        if (!response.ok) {
          throw new Error("Не удалось загрузить мемориалы владельца");
        }
        const data = (await response.json()) as OwnerMemorial[];
        setOwnerMemorials(Array.isArray(data) ? data : []);
      } catch {
        setOwnerMemorials([]);
      }
    };
    loadOwnerMemorials();
  }, [apiUrl, pet?.ownerId]);

  useEffect(() => {
    if (!topUpOpen) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeTopUp();
      }
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [topUpOpen]);

  useEffect(() => {
    const loadCatalog = async () => {
      setGiftCatalogLoading(true);
      try {
        const response = await fetch(`${apiUrl}/gifts`);
        if (!response.ok) {
          throw new Error("Не удалось загрузить подарки");
        }
        const data = (await response.json()) as {
          id: string;
          code?: string | null;
          name: string;
          price: number;
          modelUrl: string;
        }[];
        const sorted = [...data].sort((a, b) => {
          const aCode = (getGiftCode(a) ?? a.code ?? a.name ?? "").toLowerCase();
          const bCode = (getGiftCode(b) ?? b.code ?? b.name ?? "").toLowerCase();
          const aType = aCode.split("_")[0] ?? "";
          const bType = bCode.split("_")[0] ?? "";
          const typeDiff = aType.localeCompare(bType, "ru");
          if (typeDiff !== 0) {
            return typeDiff;
          }
          return aCode.localeCompare(bCode, "ru");
        });
        setGiftCatalog(sorted);
        setSelectedGiftId((prev) =>
          prev && sorted.some((gift) => gift.id === prev) ? prev : null
        );
      } catch (err) {
        setGiftError(err instanceof Error ? err.message : "Ошибка загрузки подарков");
      } finally {
        setGiftCatalogLoading(false);
      }
    };
    loadCatalog();
  }, [apiUrl]);

  const photos = pet?.photos ?? [];
  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);
  const goPrev = useCallback(() => {
    if (photos.length === 0) {
      return;
    }
    setLightboxIndex((prev) => {
      if (prev === null) return 0;
      return (prev - 1 + photos.length) % photos.length;
    });
  }, [photos.length]);

  const goNext = useCallback(() => {
    if (photos.length === 0) {
      return;
    }
    setLightboxIndex((prev) => {
      if (prev === null) return 0;
      return (prev + 1) % photos.length;
    });
  }, [photos.length]);

  useEffect(() => {
    if (lightboxIndex === null) {
      if (mounted) {
        document.body.style.overflow = "";
      }
      return;
    }
    if (mounted) {
      document.body.style.overflow = "hidden";
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLightboxIndex(null);
      }
      if (event.key === "ArrowRight") {
        goNext();
      }
      if (event.key === "ArrowLeft") {
        goPrev();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxIndex, goNext, goPrev, mounted]);

  const currentUserLogin = currentUser?.login ?? pet?.owner?.login ?? null;
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
  const sceneJson = useMemo(() => {
    const value = pet?.memorial?.sceneJson;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }, [pet?.memorial?.sceneJson]);
  const currentAppearance = useMemo<AppearanceDraft>(() => {
    const parts =
      sceneJson.parts && typeof sceneJson.parts === "object" && !Array.isArray(sceneJson.parts)
        ? (sceneJson.parts as Record<string, unknown>)
        : {};
    const colors =
      sceneJson.colors && typeof sceneJson.colors === "object" && !Array.isArray(sceneJson.colors)
        ? (sceneJson.colors as Record<string, unknown>)
        : {};
    const firstId = (options: OptionItem[], fallback = "none") => options[0]?.id ?? fallback;
    const colorValue = (key: string, fallback: string) =>
      typeof colors[key] === "string" && colors[key] ? String(colors[key]) : fallback;
    const partId = (key: string, options: OptionItem[], fallback = "none") =>
      typeof parts[key] === "string" && parts[key]
        ? String(parts[key])
        : firstId(options, fallback);
    return {
      houseId: pet?.memorial?.houseId ?? houseOptions[0]?.id ?? "",
      roofId: partId("roof", roofOptions, allRoofOptions[0]?.id ?? ""),
      wallId: partId("wall", wallOptions, allWallOptions[0]?.id ?? ""),
      signId: partId("sign", signOptions),
      frameLeftId: partId("frameLeft", frameLeftOptions),
      frameRightId: partId("frameRight", frameRightOptions),
      matId: partId("mat", matOptions),
      bowlFoodId: partId("bowlFood", bowlFoodOptions),
      bowlWaterId: partId("bowlWater", bowlWaterOptions),
      roofColor: colorValue("roof_paint", colorPalette[0]),
      wallColor: colorValue("wall_paint", colorPalette[1]),
      signColor: colorValue("sign_paint", colorPalette[16]),
      frameLeftColor: colorValue("frame_left_paint", colorPalette[16]),
      frameRightColor: colorValue("frame_right_paint", colorPalette[16]),
      matColor: colorValue("mat_paint", colorPalette[9]),
      bowlFoodColor: colorValue("bowl_food_paint", colorPalette[3]),
      bowlWaterColor: colorValue("bowl_water_paint", colorPalette[7])
    };
  }, [
    bowlFoodOptions,
    bowlWaterOptions,
    frameLeftOptions,
    frameRightOptions,
    houseOptions,
    matOptions,
    pet?.memorial?.houseId,
    roofOptions,
    sceneJson,
    signOptions,
    wallOptions
  ]);
  const draftAppearance = appearanceDraft ?? currentAppearance;
  const effectiveHouseId = draftAppearance.houseId || pet?.memorial?.houseId || null;
  const houseVariantGroup = useMemo(
    () => buildHouseVariantGroup(houseOptions),
    [houseOptions]
  );
  const selectedHouseVariant = splitHouseVariantId(draftAppearance.houseId);
  const selectedHouseBaseId =
    selectedHouseVariant.baseId || houseVariantGroup.baseOptions[0]?.id || draftAppearance.houseId;
  const houseBaseOptions = houseVariantGroup.baseOptions;
  const houseTextureOptions =
    houseVariantGroup.textureOptionsByBase[selectedHouseBaseId] ?? [];
  const houseSlots = getHouseSlots(effectiveHouseId);
  useEffect(() => {
    setDetectedSlots(null);
    setSlotManuallyCleared(false);
  }, [pet?.id]);

  const terrainGiftSlots = detectedSlots ?? getTerrainGiftSlots(pet?.memorial?.environmentId);
  const activeGifts =
    pet?.gifts?.filter(
      (gift) =>
        gift.isActive !== false &&
        (!gift.expiresAt || new Date(gift.expiresAt) > new Date())
    ) ?? [];
  const occupiedSlots = new Set(activeGifts.map((gift) => gift.slotName));
  const availableSlots = terrainGiftSlots.filter((slot) => !occupiedSlots.has(slot));
  const giftsWithSlots = useMemo(() => {
    if (availableSlots.length === 0) {
      return [];
    }
    const slotTypes = new Set(
      availableSlots
        .map((slot) => getGiftSlotType(slot))
        .filter((type): type is string => Boolean(type))
    );
    const hasDefaultSlots = slotTypes.has("default");
    return giftCatalog.filter((gift) => {
      if (hasDefaultSlots) {
        return true;
      }
      return getGiftAvailableTypes(gift).some((type) => slotTypes.has(type));
    });
  }, [availableSlots, giftCatalog]);

  const selectedGift = giftsWithSlots.find((gift) => gift.id === selectedGiftId) ?? null;
  const selectedGiftSupportsSize = giftSupportsSize(selectedGift ?? undefined);
  const selectedGiftCode = getGiftCode(selectedGift ?? undefined);
  const selectedGiftTypes = selectedGift ? getGiftAvailableTypes(selectedGift) : [];
  const filteredAvailableSlots = selectedGift
    ? availableSlots.filter((slot) => {
        const slotType = getGiftSlotType(slot);
        if (slotType === "default" || selectedGiftTypes.includes("default")) {
          return true;
        }
        return selectedGiftTypes.includes(slotType);
      })
    : [];
  const highlightSlots = selectedGift ? filteredAvailableSlots : availableSlots;
  const shouldShowGiftSlots =
    giftPanelOpen && highlightSlots.length > 0 && (giftSlotsVisible || Boolean(selectedGift));

  useEffect(() => {
    if (giftsWithSlots.length === 0) {
      setSelectedGiftId(null);
      return;
    }
    setSelectedGiftId((prev) => {
      if (prev && giftsWithSlots.some((gift) => gift.id === prev)) {
        return prev;
      }
      return null;
    });
  }, [giftsWithSlots]);

  useEffect(() => {
    if (!selectedGiftSupportsSize) {
      setSelectedGiftSize("m");
      return;
    }
    setSelectedGiftSize((prev) => prev ?? "m");
  }, [selectedGiftSupportsSize, selectedGiftCode]);

  useEffect(() => {
    if (!selectedGiftId) {
      setSelectedDuration(null);
    }
  }, [selectedGiftId]);

  useEffect(() => {
    if (selectedGiftId && selectedDuration === null) {
      setSelectedDuration(DURATION_OPTIONS[0]);
    }
  }, [selectedGiftId, selectedDuration]);

  useEffect(() => {
    if (filteredAvailableSlots.length === 0) {
      setSelectedSlot(null);
      return;
    }
    if (selectedSlot && !filteredAvailableSlots.includes(selectedSlot)) {
      setSelectedSlot(filteredAvailableSlots[0] ?? null);
      setSlotManuallyCleared(false);
      return;
    }
    if (!selectedSlot && !slotManuallyCleared) {
      setSelectedSlot(filteredAvailableSlots[0] ?? null);
    }
  }, [filteredAvailableSlots, selectedSlot, slotManuallyCleared]);

  useEffect(() => {
    if (!giftPanelOpen) {
      setGiftSlotsVisible(false);
    }
  }, [giftPanelOpen]);

  const handleSelectSlot = (slot: string) => {
    if (selectedSlot === slot) {
      setSelectedSlot(null);
      setGiftPreviewEnabled(false);
      setSlotManuallyCleared(true);
      return;
    }
    setSelectedSlot(slot);
    setGiftPreviewEnabled(true);
    setSlotManuallyCleared(false);
  };

  const handleSelectGift = (giftId: string) => {
    setSelectedGiftId(giftId);
    setGiftPreviewEnabled(true);
    setSelectedDuration(null);
  };

  const toggleGiftPanel = () => setGiftPanelOpen((prev) => !prev);
  const togglePanel = (panel: "info" | "photos" | "gifts" | "memorials" | "manage") =>
    setActivePanel((prev) => (prev === panel ? null : panel));
  const openEditDialog = () => {
    setAppearanceError(null);
    setAppearanceDraft(currentAppearance);
    setAppearanceTab("house");
    setEditDialogOpen(true);
    requestAnimationFrame(() => setEditDialogVisible(true));
  };

  const closeEditDialog = () => {
    setEditDialogVisible(false);
    setTimeout(() => {
      setEditDialogOpen(false);
      setAppearanceDraft(null);
    }, 180);
  };

  const updateAppearanceDraft = <K extends keyof AppearanceDraft>(
    field: K,
    value: AppearanceDraft[K]
  ) => {
    setAppearanceDraft((prev) =>
      prev
        ? {
            ...prev,
            [field]: value
          }
        : prev
    );
  };

  const openExtensionDialog = () => {
    setLifecycleError(null);
    setExtensionDialogOpen(true);
    requestAnimationFrame(() => setExtensionDialogVisible(true));
  };

  const closeExtensionDialog = () => {
    setExtensionDialogVisible(false);
    setTimeout(() => setExtensionDialogOpen(false), 180);
  };

  const openDeleteDialog = () => {
    setLifecycleError(null);
    setDeleteConfirmationName("");
    setDeleteDialogOpen(true);
    requestAnimationFrame(() => setDeleteDialogVisible(true));
  };

  const closeDeleteDialog = () => {
    setDeleteDialogVisible(false);
    setTimeout(() => setDeleteDialogOpen(false), 180);
  };

  useEffect(() => {
    if (!editDialogOpen) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeEditDialog();
      }
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [editDialogOpen]);

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

  const uploadMapPreview = useCallback(async () => {
    if (previewRefreshInFlightRef.current) {
      return;
    }
    previewRefreshInFlightRef.current = true;
    try {
      const snapshot = await capturePreviewImage();
      if (!snapshot) {
        return;
      }
      const formData = new FormData();
      formData.append("file", snapshot, "map-preview.png");
      const response = await fetch(`${apiUrl}/pets/${id}/map-preview`, {
        method: "POST",
        body: formData
      });
      if (!response.ok) {
        throw new Error("Не удалось обновить обложку карты");
      }
      const data = (await response.json()) as { url?: string };
      setPet((prev) =>
        prev?.memorial
          ? {
              ...prev,
              memorial: {
                ...prev.memorial,
                needsPreviewRefresh: false,
                sceneJson: {
                  ...(prev.memorial.sceneJson ?? {}),
                  ...(data.url ? { previewImageUrl: data.url } : {})
                }
              }
            }
          : prev
      );
    } finally {
      previewRefreshInFlightRef.current = false;
    }
  }, [apiUrl, capturePreviewImage, id]);

  const handlePlaceGift = async () => {
    if (!selectedGiftId || !selectedSlot || !selectedDuration) {
      setGiftError("Выбери подарок, срок и слот");
      return;
    }
    if (!currentUser?.id) {
      setGiftError("Войдите, чтобы подарить подарок");
      return;
    }
    setGiftLoading(true);
    setGiftError(null);
    setGiftSuccess(null);
    const purchasedGift = selectedGift;
    const purchasedSlot = selectedSlot;
    const purchasedDuration = selectedDuration;
    const purchasedGiftSize = selectedGiftSupportsSize ? selectedGiftSize : null;
    try {
      const response = await fetch(`${apiUrl}/pets/${id}/gifts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId: currentUser.id,
          giftId: selectedGiftId,
          slotName: selectedSlot,
          months: selectedDuration,
          size: selectedGiftSupportsSize ? selectedGiftSize : undefined
        })
      });
      if (!response.ok) {
        const text = await response.text();
        if (text.toLowerCase().includes("недостаточно")) {
          openTopUp();
          return;
        }
        throw new Error(text || "Ошибка покупки подарка");
      }
      const data = (await response.json()) as {
        coinBalance?: number;
        placement?: {
          id: string;
          slotName: string;
          placedAt: string;
          expiresAt: string | null;
          size?: string | null;
          gift?: { id: string; code?: string | null; name: string; price: number; modelUrl: string };
          owner?: {
            id: string;
            email?: string | null;
            login?: string | null;
          } | null;
        };
      };
      setSelectedGiftId(null);
      setSelectedSlot(null);
      setSelectedDuration(null);
      setGiftPreviewEnabled(false);
      setSlotManuallyCleared(false);
      if (typeof data.coinBalance === "number") {
        setWalletBalance(data.coinBalance);
      } else if (currentUser?.id) {
        void loadWallet(currentUser.id);
      }
      if (data.placement) {
        const placement = data.placement;
        const giftPayload =
          placement.gift ??
          (purchasedGift
            ? {
                id: purchasedGift.id,
                code: purchasedGift.code ?? null,
                name: purchasedGift.name,
                price: purchasedGift.price,
                modelUrl: purchasedGift.modelUrl
              }
            : null);
        if (giftPayload) {
          setPet((prev) =>
            prev
              ? {
                  ...prev,
                  gifts: [
                    {
                      id: placement.id,
                      slotName: placement.slotName,
                      placedAt: placement.placedAt,
                      expiresAt: placement.expiresAt,
                      isActive: true,
                      size: placement.size ?? purchasedGiftSize,
                      gift: giftPayload,
                      owner: {
                        id: placement.owner?.id ?? currentUser.id,
                        email: placement.owner?.email ?? currentUser.email ?? null,
                        login: placement.owner?.login ?? currentUser.login ?? null,
                        pets: []
                      }
                    },
                    ...((prev.gifts ?? []).filter((gift) => gift.slotName !== placement.slotName))
                  ],
                  memorial: prev.memorial
                    ? {
                        ...prev.memorial,
                        needsPreviewRefresh: true
                      }
                    : prev.memorial
                }
              : prev
          );
        }
      }
      if (purchasedGift) {
        setGiftSuccess(
          `Вы подарили ${purchasedGift.name} ${pet?.name ?? "мемориалу"} на ${formatMonthsLabel(purchasedDuration)}.`
        );
      }
    } catch (err) {
      setGiftError(err instanceof Error ? err.message : "Ошибка покупки подарка");
    } finally {
      setGiftLoading(false);
    }
  };

  const openTopUp = () => {
    setTopUpOpen(true);
    requestAnimationFrame(() => setTopUpVisible(true));
  };

  const closeTopUp = () => {
    setTopUpVisible(false);
    setTimeout(() => setTopUpOpen(false), 180);
  };

  const topUpOptions = [
    { coins: 100, rub: 100, usd: 1 },
    { coins: 200, rub: 200, usd: 2 },
    { coins: 500, rub: 500, usd: 500 },
    { coins: 1000, rub: 1000, usd: 10 }
  ];

  const isOwner = Boolean(currentUser?.id && pet?.ownerId === currentUser.id);
  const handleExtendMemorial = async (years: 1 | 2 | 5) => {
    if (!currentUser?.id) {
      setLifecycleError("Войдите, чтобы продлить мемориал");
      return;
    }
    setLifecycleError(null);
    setExtendingMemorial(true);
    try {
      const response = await fetch(`${apiUrl}/pets/${id}/memorial/extend`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: currentUser.id, years })
      });
      if (!response.ok) {
        const text = await response.text();
        if (text.toLowerCase().includes("недостаточно")) {
          openTopUp();
          return;
        }
        throw new Error(text || "Не удалось продлить мемориал");
      }
      const data = (await response.json()) as {
        activeUntil?: string | null;
        coinBalance?: number;
      };
      if (typeof data.coinBalance === "number") {
        setWalletBalance(data.coinBalance);
      }
      setPet((prev) =>
        prev?.memorial
          ? {
              ...prev,
              memorial: {
                ...prev.memorial,
                activeUntil: data.activeUntil ?? prev.memorial.activeUntil ?? null
              }
            }
          : prev
      );
      if (currentUser.id) {
        void loadWallet(currentUser.id);
      }
      closeExtensionDialog();
    } catch (err) {
      setLifecycleError(err instanceof Error ? err.message : "Ошибка продления");
    } finally {
      setExtendingMemorial(false);
    }
  };

  const handleDeleteMemorial = async () => {
    if (!pet) {
      return;
    }
    if (deleteConfirmationName.trim() !== pet.name.trim()) {
      setLifecycleError("Введите имя мемориала точно как в заголовке");
      return;
    }
    setLifecycleError(null);
    setDeletingMemorial(true);
    try {
      const response = await fetch(`${apiUrl}/pets/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Не удалось удалить мемориал");
      }
      router.replace("/my-pets");
    } catch (err) {
      setLifecycleError(err instanceof Error ? err.message : "Ошибка удаления");
    } finally {
      setDeletingMemorial(false);
    }
  };

  const appearanceTabs = useMemo<
    { id: AppearanceTabId; label: string; imageCategory: string }[]
  >(() => {
    const tabs: { id: AppearanceTabId; label: string; imageCategory: string }[] = [
      { id: "house", label: "Домик", imageCategory: "house" }
    ];
    if (houseSlots.roof) tabs.push({ id: "roof", label: "Крыша", imageCategory: "roof" });
    if (houseSlots.wall) tabs.push({ id: "wall", label: "Стены", imageCategory: "wall" });
    if (houseSlots.sign) tabs.push({ id: "sign", label: "Украшение", imageCategory: "sign" });
    if (houseSlots.frameLeft)
      tabs.push({ id: "frameLeft", label: "Рамка слева", imageCategory: "frame-left" });
    if (houseSlots.frameRight)
      tabs.push({ id: "frameRight", label: "Рамка справа", imageCategory: "frame-right" });
    if (houseSlots.mat) tabs.push({ id: "mat", label: "Коврик", imageCategory: "mat" });
    if (houseSlots.bowlFood)
      tabs.push({ id: "bowlFood", label: "Миска с кормом", imageCategory: "bowl-food" });
    if (houseSlots.bowlWater)
      tabs.push({ id: "bowlWater", label: "Миска с водой", imageCategory: "bowl-water" });
    return tabs;
  }, [houseSlots]);

  useEffect(() => {
    if (!appearanceTabs.some((tab) => tab.id === appearanceTab)) {
      setAppearanceTab("house");
    }
  }, [appearanceTab, appearanceTabs]);

  const handleSaveAppearance = async () => {
    if (!appearanceDraft || !pet?.memorial) {
      return;
    }
    setAppearanceError(null);
    setSavingAppearance(true);
    const nextSceneJson = {
      parts: {
        roof: appearanceDraft.roofId,
        wall: appearanceDraft.wallId,
        sign: appearanceDraft.signId,
        frameLeft: appearanceDraft.frameLeftId,
        frameRight: appearanceDraft.frameRightId,
        mat: appearanceDraft.matId,
        bowlFood: appearanceDraft.bowlFoodId,
        bowlWater: appearanceDraft.bowlWaterId
      },
      colors: {
        roof_paint: appearanceDraft.roofColor,
        wall_paint: appearanceDraft.wallColor,
        sign_paint: appearanceDraft.signColor,
        frame_left_paint: appearanceDraft.frameLeftColor,
        frame_right_paint: appearanceDraft.frameRightColor,
        mat_paint: appearanceDraft.matColor,
        bowl_food_paint: appearanceDraft.bowlFoodColor,
        bowl_water_paint: appearanceDraft.bowlWaterColor
      },
      version: 3
    };
    try {
      const response = await fetch(`${apiUrl}/pets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          houseId: appearanceDraft.houseId,
          sceneJson: nextSceneJson
        })
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Не удалось обновить оформление");
      }
      setPet((prev) =>
        prev?.memorial
          ? {
              ...prev,
              memorial: {
                ...prev.memorial,
                houseId: appearanceDraft.houseId,
                sceneJson: {
                  ...(prev.memorial.sceneJson ?? {}),
                  ...nextSceneJson
                },
                needsPreviewRefresh: true
              }
            }
          : prev
      );
      setAppearanceSuccess("Оформление мемориала обновлено.");
      closeEditDialog();
    } catch (err) {
      setAppearanceError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSavingAppearance(false);
    }
  };

  useEffect(() => {
    if (
      !previewContextReady ||
      !pet?.memorial?.needsPreviewRefresh ||
      giftPreviewEnabled ||
      selectedGiftId
    ) {
      return;
    }
    void uploadMapPreview().catch(() => {
      // Preview refresh is best-effort; the server flag remains true until a later successful upload.
    });
  }, [giftPreviewEnabled, pet?.id, pet?.memorial?.needsPreviewRefresh, previewContextReady, selectedGiftId, uploadMapPreview]);

  const starSizeOptions: { id: GiftSize; label: string; helper: string }[] = [
    { id: "s", label: "S", helper: "Маленькая" },
    { id: "m", label: "M", helper: "Средняя" },
    { id: "l", label: "L", helper: "Большая" }
  ];
  const durationIndex = Math.max(
    0,
    DURATION_OPTIONS.indexOf(
      (selectedDuration ?? DURATION_OPTIONS[0]) as (typeof DURATION_OPTIONS)[number]
    )
  );

  const selectedSlotType = selectedSlot ? getGiftSlotType(selectedSlot) : null;
  const previewGiftUrl =
    resolveGiftModelUrl({ gift: selectedGift ?? undefined, slotType: selectedSlotType }) ??
    selectedGift?.modelUrl ??
    null;
  const handleGiftPreloaded = useCallback((url: string) => {
    setPreloadedGiftUrls((prev) => {
      if (prev[url]) {
        return prev;
      }
      return { ...prev, [url]: true };
    });
  }, []);
  const previewReady = previewGiftUrl ? Boolean(preloadedGiftUrls[previewGiftUrl]) : false;
  const dirtModelUrls = useMemo(
    () => buildDirtModelUrls(effectiveHouseId),
    [effectiveHouseId]
  );

  useEffect(() => {
    if (
      !previewGiftUrl ||
      !giftPreviewEnabled ||
      !selectedGift ||
      !selectedSlot ||
      occupiedSlots.has(selectedSlot)
    ) {
      setPendingPreviewUrl(null);
      return;
    }
    if (preloadedGiftUrls[previewGiftUrl]) {
      setPendingPreviewUrl(null);
      return;
    }
    setPendingPreviewUrl(previewGiftUrl);
  }, [
    giftPreviewEnabled,
    occupiedSlots,
    preloadedGiftUrls,
    previewGiftUrl,
    selectedGift,
    selectedSlot
  ]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-16">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="animate-pulse rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="h-5 w-32 rounded-full bg-slate-200" />
            <div className="mt-4 h-8 w-64 rounded-full bg-slate-200" />
            <div className="mt-3 h-4 w-48 rounded-full bg-slate-200" />
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={`info-skeleton-${index}`} className="h-20 rounded-2xl bg-slate-100" />
              ))}
            </div>
          </div>
          <div className="animate-pulse rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="h-4 w-40 rounded-full bg-slate-200" />
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="h-[320px] rounded-2xl bg-slate-100" />
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={`gift-skeleton-${index}`} className="h-10 rounded-xl bg-slate-100" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error || !pet) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-16">
        <div className="mx-auto max-w-6xl text-center">
          <h1 className="text-2xl font-semibold text-slate-900">Мемориал не найден</h1>
          <p className="mt-3 text-slate-600">{error ?? "Проверь ссылку"}</p>
        </div>
      </main>
    );
  }

  const appearanceParts = {
    roof: draftAppearance.roofId,
    wall: draftAppearance.wallId,
    sign: draftAppearance.signId,
    frameLeft: draftAppearance.frameLeftId,
    frameRight: draftAppearance.frameRightId,
    mat: draftAppearance.matId,
    bowlFood: draftAppearance.bowlFoodId,
    bowlWater: draftAppearance.bowlWaterId
  };
  const partList = [
    houseSlots.roof ? { slot: houseSlots.roof, url: resolveRoofModel(appearanceParts.roof) } : null,
    houseSlots.wall ? { slot: houseSlots.wall, url: resolveWallModel(appearanceParts.wall) } : null,
    houseSlots.sign ? { slot: houseSlots.sign, url: resolveSignModel(appearanceParts.sign) } : null,
    houseSlots.frameLeft
      ? { slot: houseSlots.frameLeft, url: resolveFrameLeftModel(appearanceParts.frameLeft) }
      : null,
    houseSlots.frameRight
      ? { slot: houseSlots.frameRight, url: resolveFrameRightModel(appearanceParts.frameRight) }
      : null,
    houseSlots.mat ? { slot: houseSlots.mat, url: resolveMatModel(appearanceParts.mat) } : null,
    houseSlots.bowlFood
      ? { slot: houseSlots.bowlFood, url: resolveBowlFoodModel(appearanceParts.bowlFood) }
      : null,
    houseSlots.bowlWater
      ? { slot: houseSlots.bowlWater, url: resolveBowlWaterModel(appearanceParts.bowlWater) }
      : null
  ].filter((part): part is { slot: string; url: string } => Boolean(part?.url));
  const fullPartList = partList;
  const colorOverrides = {
    roof_paint: draftAppearance.roofColor,
    wall_paint: draftAppearance.wallColor,
    sign_paint: draftAppearance.signColor,
    frame_left_paint: draftAppearance.frameLeftColor,
    frame_right_paint: draftAppearance.frameRightColor,
    mat_paint: draftAppearance.matColor,
    bowl_food_paint: draftAppearance.bowlFoodColor,
    bowl_water_paint: draftAppearance.bowlWaterColor
  };
  const giftInstances = activeGifts.map((gift) => {
    const ownerPets = gift.owner?.pets ?? [];
    const ownerLabel =
      ownerPets.length > 0
        ? ownerPets.map((petItem) => petItem.name).join(", ")
        : gift.owner?.login ?? gift.owner?.email ?? "—";
    const slotType = getGiftSlotType(gift.slotName);
    const resolvedUrl =
      resolveGiftModelUrl({ gift: gift.gift, slotType, fallbackUrl: gift.gift.modelUrl }) ??
      gift.gift.modelUrl;
    return {
      slot: gift.slotName,
      url: resolvedUrl,
      name: gift.gift.name,
      owner: ownerLabel,
      expiresAt: gift.expiresAt ?? undefined,
      size: gift.size ?? null
    };
  });
  const previewGift =
    giftPreviewEnabled &&
    selectedGift &&
    selectedSlot &&
    !occupiedSlots.has(selectedSlot) &&
    previewGiftUrl &&
    previewReady
      ? {
          slot: selectedSlot,
          url: previewGiftUrl,
          name: selectedGift.name,
          owner: currentUser?.login ?? currentUser?.email ?? "—",
          expiresAt: null,
          size: selectedGiftSupportsSize ? selectedGiftSize : null
        }
      : null;
  const previewGifts = previewGift ? [...giftInstances, previewGift] : giftInstances;
  const totalPrice =
    selectedGift && selectedDuration ? selectedGift.price * selectedDuration : null;

  const formatDate = (value?: string | null) =>
    value ? new Date(value).toLocaleDateString("ru-RU") : "—";
  const memorialPaidUntil =
    typeof sceneJson.memorialPaidUntil === "string" ? sceneJson.memorialPaidUntil : null;
  const activeUntil = pet.memorial?.activeUntil ?? memorialPaidUntil ?? null;
  const activeUntilLabel = activeUntil ? formatDate(activeUntil) : "Бессрочно";
  const canExtendMemorial = Boolean(activeUntil);
  const selectedExtensionPlan =
    MEMORIAL_EXTENSION_PLANS.find((plan) => plan.years === selectedExtensionYears) ??
    MEMORIAL_EXTENSION_PLANS[0];
  const canConfirmDelete =
    deleteConfirmationName.trim() === pet.name.trim() && !deletingMemorial;
  const dateRange = `${formatDate(pet.birthDate)}-${formatDate(pet.deathDate)}`;
  const otherMemorials = ownerMemorials.filter((item) => item.id !== pet.id);

  const panelBaseClass =
    "w-[290px] max-w-[82vw] rounded-[32px] border-[4px] border-white bg-[#efe6e2]/95 p-3 shadow-[0_24px_56px_-26px_rgba(93,64,55,0.52)] backdrop-blur sm:w-[340px]";
  const panelSectionClass =
    "grid gap-3 rounded-[26px] border border-white/70 bg-[#f7f1ee]/95 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.86),0_10px_24px_rgba(126,102,93,0.08)]";
  const panelLabelClass =
    "text-[10px] font-black uppercase tracking-[0.24em] text-[#adb5bd]";
  const panelButtonClass = (active: boolean) =>
    `group relative flex h-14 w-14 items-center justify-center rounded-[24px] border-[3px] shadow-md transition-all sm:h-16 sm:w-16 ${
      active
        ? "border-[#3bceac] bg-[#f0fffb] text-[#3bceac]"
        : "border-white bg-white/90 text-[#d3a27f] hover:border-[#d3a27f] hover:bg-[#d3a27f] hover:text-white"
    }`;
  const primaryActionClass =
    "rounded-[22px] bg-[#111827] px-4 py-3 text-sm font-black uppercase tracking-[0.14em] text-white shadow-[0_5px_0_0_#000] transition-all hover:-translate-y-[1px] hover:shadow-[0_6px_0_0_#000] active:translate-y-[3px] active:shadow-none disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none";
  const secondaryActionClass =
    "rounded-[18px] border-2 border-[#fdf2e9] bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#8d6e63] transition hover:bg-[#fdf2e9] disabled:cursor-not-allowed disabled:opacity-60";
  const sidePanelAnchorClass = "absolute bottom-0 left-[4.5rem] sm:left-20";
  const appearanceOptionImage = (category: string, optionId: string) =>
    optionId === "none" ? null : `/memorial/options/${category}/${optionId}.png`;
  const appearanceColorField =
    appearanceTab === "roof"
      ? "roofColor"
      : appearanceTab === "wall"
        ? "wallColor"
        : appearanceTab === "sign"
          ? "signColor"
          : appearanceTab === "frameLeft"
            ? "frameLeftColor"
            : appearanceTab === "frameRight"
              ? "frameRightColor"
              : appearanceTab === "mat"
                ? "matColor"
                : appearanceTab === "bowlFood"
                  ? "bowlFoodColor"
                  : appearanceTab === "bowlWater"
                    ? "bowlWaterColor"
                    : null;
  const renderAppearanceTabIcon = (tabId: AppearanceTabId) => {
    switch (tabId) {
      case "house":
        return (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 11.5 12 4l9 7.5" />
            <path d="M5.5 10.5V20h13V10.5" />
            <path d="M9 20v-5h6v5" />
          </svg>
        );
      case "roof":
        return (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12 12 4l9 8" />
            <path d="M6 12h12" />
          </svg>
        );
      case "wall":
        return (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 7h14v12H5z" />
            <path d="M5 11h14" />
            <path d="M9 7v12" />
            <path d="M15 7v12" />
          </svg>
        );
      case "sign":
        return (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 6h10l-2 4 2 4H7z" />
            <path d="M7 6v12" />
          </svg>
        );
      case "frameLeft":
      case "frameRight":
        return (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <rect x="6" y="5" width="12" height="14" rx="2" />
            <path d="M9 8h6v8H9z" />
          </svg>
        );
      case "mat":
        return (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="9" width="16" height="7" rx="2" />
          </svg>
        );
      case "bowlFood":
      case "bowlWater":
        return (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 11h14l-1 5a3 3 0 0 1-3 2H9a3 3 0 0 1-3-2z" />
            <path d="M7 11V9h10v2" />
          </svg>
        );
      default:
        return null;
    }
  };
  const renderAppearanceOptionGrid = (
    category: string,
    options: OptionItem[],
    selectedId: string,
    onSelect: (id: string) => void,
    imageCategory: string = category
  ) => (
    <div className="grid grid-cols-2 place-items-center gap-0.5">
      {options.map((option) => {
        const isSelected = selectedId === option.id;
        const imageUrl = appearanceOptionImage(imageCategory, option.id);
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            aria-label={option.name}
            title={option.name}
            className={`flex aspect-square w-full items-center justify-center rounded-xl border-[0.33px] p-0 transition ${
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

  return (
    <main className="relative min-h-[calc(100vh-var(--app-header-height,0px))] overflow-hidden bg-[#fcf8f5]">
      <div className="fixed inset-0 z-0">
        <MemorialPreview
          className="h-full w-full rounded-none border-transparent bg-transparent"
          terrainUrl={resolveEnvironmentModel(pet.memorial?.environmentId, "auto")}
          terrainId={pet.memorial?.environmentId ?? null}
          houseUrl={resolveHouseModel(effectiveHouseId)}
          houseId={effectiveHouseId}
          parts={fullPartList}
          dirtUrls={dirtModelUrls}
          dirtLevel={dirtLevel}
          gifts={previewGifts}
          giftSlots={giftPanelOpen ? highlightSlots : undefined}
          selectedSlot={giftPanelOpen ? selectedSlot : null}
          onSelectSlot={giftPanelOpen ? handleSelectSlot : undefined}
          onGiftSlotsDetected={setDetectedSlots}
          preloadGiftUrl={pendingPreviewUrl}
          onGiftPreloaded={handleGiftPreloaded}
          colors={colorOverrides}
          onDetailClick={handleMemorialDetailClick}
          showControls={false}
          showGiftSlots={shouldShowGiftSlots}
          cameraPosition={[8, 6, 8]}
          onControlsReady={(controls) => {
            previewControlsRef.current = controls;
          }}
          onRenderContextReady={(context) => {
            previewRenderRef.current = context;
            setPreviewContextReady(true);
          }}
        />
      </div>
      <div className="pointer-events-none fixed right-0 top-0 z-[1] h-80 w-80 rounded-full bg-[#3bceac]/10 blur-[120px]" />
      <div className="pointer-events-none fixed bottom-0 left-0 z-[1] h-80 w-80 rounded-full bg-[#d3a27f]/14 blur-[120px]" />

      <div className="fixed inset-0 z-10 pointer-events-none">
        <div className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 text-center top-[calc(var(--app-header-height,0px)+0.75rem)]">
          <div className="rounded-[28px] border-[4px] border-white bg-[#efe6e2]/95 px-4 py-3 shadow-[0_16px_38px_-20px_rgba(93,64,55,0.42)] backdrop-blur">
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#d3a27f]">
              Мемориал
            </div>
            <div className="mt-1 text-lg font-black text-[#5d4037]">{pet.name}</div>
            <div className="text-xs font-semibold text-[#8d6e63]">{dateRange}</div>
          </div>
        </div>

        <div className="pointer-events-auto absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4">
          <div className="relative">
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => togglePanel("info")}
                aria-label="Информация"
                className={panelButtonClass(activePanel === "info")}
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 11v5" />
                  <circle cx="12" cy="8" r="1" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => togglePanel("photos")}
                aria-label="Фотографии"
                className={panelButtonClass(activePanel === "photos")}
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <circle cx="9" cy="11" r="2" />
                  <path d="M21 15l-4-4-4 4-3-3-5 5" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => togglePanel("gifts")}
                aria-label="Подарки"
                className={panelButtonClass(activePanel === "gifts")}
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3l2.5 5 5.5.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.5-.8z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => togglePanel("memorials")}
                aria-label="Другие мемориалы"
                className={panelButtonClass(activePanel === "memorials")}
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="8" cy="9" r="3" />
                  <circle cx="16" cy="9" r="3" />
                  <path d="M3 20c0-3 3-5 5-5" />
                  <path d="M21 20c0-3-3-5-5-5" />
                </svg>
              </button>
              {isOwner ? (
                <button
                  type="button"
                  onClick={() => togglePanel("manage")}
                  aria-label="Управление мемориалом"
                  className={panelButtonClass(activePanel === "manage")}
                >
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
                  </svg>
                </button>
              ) : null}
            </div>

            {activePanel === "info" ? (
              <div className={`${sidePanelAnchorClass} ${panelBaseClass}`}>
                <div className={`${panelSectionClass} text-sm text-[#6f6360]`}>
                  <div>
                    <p className={panelLabelClass}>Эпитафия</p>
                    <p className="mt-2 text-sm font-semibold text-[#5d4037]">
                      {pet.epitaph ?? "Без эпитафии"}
                    </p>
                  </div>
                  <div>
                    <p className={panelLabelClass}>История</p>
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-[#6f6360]">
                      {pet.story ?? "История пока не заполнена."}
                    </p>
                  </div>
                  <div className="rounded-[22px] border-[3px] border-white bg-[#fcf8f5] p-3 shadow-inner">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#8d6e63]">
                      <span className="font-black uppercase tracking-[0.16em] text-[#5d4037]">
                        Чистота мемориала
                      </span>
                      <span>
                        {dirtLevel}/{DIRT_SLOTS.length}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCleanDirt}
                      disabled={dirtLevel === 0}
                      className={`mt-3 w-full ${primaryActionClass} ${
                        dirtLevel === 0
                          ? "cursor-not-allowed bg-slate-300 text-slate-500 shadow-none"
                          : ""
                      }`}
                    >
                      Почистить мемориал
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {activePanel === "photos" ? (
              <div className={`${sidePanelAnchorClass} ${panelBaseClass}`}>
                <div className={panelSectionClass}>
                  <p className={panelLabelClass}>Фотографии</p>
                  {photos.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {photos.map((photo, index) => (
                        <button
                          key={photo.id}
                          type="button"
                          onClick={() => openLightbox(index)}
                          className="group overflow-hidden rounded-[22px] border-[3px] border-white bg-[#f8f9fa] shadow-inner"
                        >
                          <img
                            src={photo.url.startsWith("http") ? photo.url : `${apiUrl}${photo.url}`}
                            alt="Фото питомца"
                            className="h-28 w-full object-cover transition duration-300 group-hover:scale-[1.04]"
                            loading="lazy"
                          />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-[#8d6e63]">
                      Фотографии пока не добавлены.
                    </p>
                  )}
                </div>
              </div>
            ) : null}

            {activePanel === "gifts" ? (
              <div className={`${sidePanelAnchorClass} ${panelBaseClass}`}>
                <div className={panelSectionClass}>
                  <p className={panelLabelClass}>Подарки</p>
                  <div className="max-h-[50vh] overflow-y-auto pr-1">
                  {activeGifts.length > 0 ? (
                    <div className="grid gap-2 text-sm text-[#6f6360]">
                      {activeGifts.map((gift) => {
                        const ownerPets = gift.owner?.pets ?? [];
                        const ownerName =
                          gift.owner?.login ?? gift.owner?.email ?? gift.owner?.id ?? "—";
                        const ownerLabel =
                          ownerPets.length > 0
                            ? ownerPets.map((petItem) => petItem.name).join(", ")
                            : ownerName;
                        const expiresLabel = gift.expiresAt
                          ? new Date(gift.expiresAt).toLocaleDateString()
                          : null;
                        const iconUrl = resolveGiftIconUrl(gift.gift);
                        const fallbackIcon =
                          "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'><rect width='128' height='128' rx='24' fill='%23e2e8f0'/><path d='M64 28l10 20 22 3-16 15 4 22-20-10-20 10 4-22-16-15 22-3 10-20z' fill='%2394a3b8'/></svg>";
                        return (
                          <div
                            key={gift.id}
                            className="group relative flex gap-3 rounded-[22px] border border-white bg-white/90 p-3 transition hover:-translate-y-0.5 hover:border-[#fdf2e9] hover:bg-white"
                          >
                            <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-[16px] bg-[#f8f9fa] shadow-inner">
                              {iconUrl ? (
                                <img
                                  src={iconUrl ?? undefined}
                                  alt=""
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                  onError={(event) => {
                                    event.currentTarget.onerror = null;
                                    event.currentTarget.src = fallbackIcon;
                                  }}
                                />
                              ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between">
                                <p className="font-black text-[#5d4037]">{gift.gift.name}</p>
                              </div>
                              <p className="mt-1 text-xs font-semibold text-[#8d6e63]">
                                От хозяина:{" "}
                                {ownerPets.length > 0 ? (
                                  <span className="inline-flex flex-wrap gap-1">
                                    {ownerPets.map((petItem, index) => (
                                      <span key={petItem.id} className="inline-flex items-center gap-1">
                                        <a
                                          href={`/pets/${petItem.id}`}
                                          className="text-[#5d4037] underline decoration-[#d3a27f]/50 underline-offset-2 hover:text-[#111827]"
                                        >
                                          {petItem.name}
                                        </a>
                                        {index < ownerPets.length - 1 ? "," : null}
                                      </span>
                                    ))}
                                  </span>
                                ) : (
                                  ownerName
                                )}
                              </p>
                              {expiresLabel ? (
                                <p className="text-xs font-semibold text-[#8d6e63]">
                                  До: {expiresLabel}
                                </p>
                              ) : null}
                            </div>
                            <div className="pointer-events-none absolute right-3 top-3 z-10 hidden w-48 rounded-[18px] border border-white bg-white/95 p-3 text-xs font-semibold text-[#8d6e63] shadow-lg group-hover:block">
                              <p className="font-black text-[#5d4037]">{gift.gift.name}</p>
                              <p className="mt-1">От: {ownerLabel}</p>
                              {expiresLabel ? <p className="mt-1">До: {expiresLabel}</p> : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-[#8d6e63]">Пока нет подарков.</p>
                  )}
                </div>
                </div>
              </div>
            ) : null}

            {activePanel === "memorials" ? (
              <div className={`${sidePanelAnchorClass} ${panelBaseClass}`}>
                <div className={panelSectionClass}>
                  <p className={panelLabelClass}>Мемориалы хозяина</p>
                  {otherMemorials.length > 0 ? (
                  <div className="max-h-[50vh] overflow-y-auto pr-1">
                    <div className="grid gap-3">
                      {otherMemorials.map((item) => {
                        const photo = item.photos?.[0];
                        const url = photo
                          ? photo.url.startsWith("http")
                            ? photo.url
                            : `${apiUrl}${photo.url}`
                          : null;
                        return (
                          <a
                            key={item.id}
                            href={`/pets/${item.id}`}
                            className="group flex items-center gap-3 rounded-[22px] border border-white bg-white/90 px-3 py-2 transition hover:-translate-y-0.5 hover:border-[#fdf2e9]"
                          >
                            <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-[16px] bg-[#f8f9fa] shadow-inner">
                              {url ? (
                                <img src={url} alt="" className="h-full w-full object-cover" />
                              ) : null}
                            </div>
                            <div>
                              <p className="text-sm font-black text-[#5d4037]">{item.name}</p>
                              <p className="text-xs font-semibold text-[#8d6e63]">
                                {formatDate(item.birthDate)}-{formatDate(item.deathDate)}
                              </p>
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-[#8d6e63]">
                    Других мемориалов пока нет.
                  </p>
                )}
                </div>
              </div>
            ) : null}

            {isOwner && activePanel === "manage" ? (
              <div className={`${sidePanelAnchorClass} ${panelBaseClass}`}>
                <div className={panelSectionClass}>
                  <p className={panelLabelClass}>Управление</p>
                  <div className="rounded-[22px] border-[3px] border-white bg-[#fcf8f5] p-3 shadow-inner">
                    <p className={panelLabelClass}>Активен до</p>
                    <p className="mt-1 text-lg font-black text-[#5d4037]">
                      {activeUntilLabel}
                    </p>
                  </div>
                  {lifecycleError ? (
                    <p className="text-xs font-semibold text-red-600">{lifecycleError}</p>
                  ) : null}
                  <div className="grid gap-2">
                    <button
                      type="button"
                      onClick={openEditDialog}
                      className={secondaryActionClass}
                    >
                      Редактировать домик
                    </button>
                    <button
                      type="button"
                      onClick={openExtensionDialog}
                      disabled={!canExtendMemorial}
                      className={primaryActionClass}
                    >
                      {canExtendMemorial ? "Продлить" : "Бессрочно"}
                    </button>
                    <button
                      type="button"
                      onClick={openDeleteDialog}
                      disabled={deletingMemorial}
                      className="w-1/2 justify-self-start rounded-[16px] border-2 border-red-100 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingMemorial ? "Удаление..." : "Удалить"}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="pointer-events-auto absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4">
          <div className="relative">
            <button
              type="button"
              onClick={toggleGiftPanel}
              aria-label="Подарки"
              className={`flex h-14 w-14 items-center justify-center rounded-[24px] border-[3px] shadow-md transition-all sm:h-16 sm:w-16 ${
                giftPanelOpen
                  ? "border-[#3bceac] bg-[#f0fffb] text-[#3bceac]"
                  : "border-white bg-white/90 text-[#d3a27f] hover:border-[#d3a27f] hover:bg-[#d3a27f] hover:text-white"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="8" width="18" height="12" rx="2" />
                <path d="M12 8v12" />
                <path d="M3 12h18" />
                <path d="M7 8c-1.5 0-2.5-1-2.5-2s1-2 2.5-2c1.5 0 3 2 3 4" />
                <path d="M17 8c1.5 0 2.5-1 2.5-2s-1-2-2.5-2c-1.5 0-3 2-3 4" />
              </svg>
            </button>
            {giftPanelOpen ? (
              <div
                className={`fixed right-4 top-[calc(var(--app-header-height,0px)+0.75rem)] bottom-[calc(1rem+env(safe-area-inset-bottom)+4rem)] z-40 ${panelBaseClass} flex w-[320px] max-w-[90vw] flex-col overflow-hidden sm:w-[380px]`}
              >
                <div className={`flex min-h-0 flex-1 flex-col ${panelSectionClass}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className={panelLabelClass}>Подарки</p>
                      <p className="text-sm font-black text-[#5d4037]">Сделать подарок</p>
                    </div>
                    <button
                      type="button"
                      onClick={toggleGiftPanel}
                      className={secondaryActionClass}
                    >
                      Закрыть
                    </button>
                  </div>
                {currentUser ? (
                  <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
                    <div className="flex min-h-0 flex-1 flex-col gap-2 text-sm font-semibold text-[#6f6360]">
                      <span>Подарок</span>
                      <div className="grid min-h-0 flex-1 grid-cols-3 content-start gap-3 overflow-y-auto pr-1">
                        {giftCatalogLoading ? (
                          Array.from({ length: 8 }).map((_, index) => (
                            <div
                              key={`gift-skeleton-${index}`}
                              className="relative h-28 w-full animate-pulse overflow-hidden rounded-[22px] border border-white bg-white"
                            >
                              <div className="absolute inset-0 bg-slate-100" />
                              <div className="absolute bottom-2 left-1/2 h-7 w-7 -translate-x-1/2 rounded-full bg-slate-200" />
                            </div>
                          ))
                        ) : giftsWithSlots.length === 0 ? (
                          <p className="text-sm text-slate-500">Нет доступных подарков.</p>
                        ) : (
                          giftsWithSlots.map((gift) => {
                            const iconUrl = resolveGiftIconUrl(gift);
                            const fallbackIcon =
                              "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'><rect width='128' height='128' rx='24' fill='%23e2e8f0'/><path d='M64 28l10 20 22 3-16 15 4 22-20-10-20 10 4-22-16-15 22-3 10-20z' fill='%2394a3b8'/></svg>";
                            return (
                              <button
                                key={gift.id}
                                type="button"
                                onClick={() => handleSelectGift(gift.id)}
                                className={`relative flex h-28 w-full items-center justify-center overflow-hidden rounded-[22px] border-[3px] transition ${
                                  selectedGiftId === gift.id
                                    ? "border-[#3bceac] bg-[#f0fffb] text-[#5d4037] shadow-sm"
                                    : "border-white bg-white text-[#6f6360] hover:border-[#d3a27f]/50"
                                }`}
                              >
                                {iconUrl ? (
                                  <img
                                    src={iconUrl ?? undefined}
                                    alt=""
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                    onError={(event) => {
                                      event.currentTarget.onerror = null;
                                      event.currentTarget.src = fallbackIcon;
                                    }}
                                  />
                                ) : null}
                                <span className="pointer-events-none absolute bottom-2 left-1/2 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full bg-[#111827] text-[9px] font-black text-white shadow-md">
                                  {gift.price}
                                </span>
                                <span className="pointer-events-none absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border border-white/70 bg-white/60 text-[10px] font-semibold text-slate-700 opacity-0">
                                  0
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="grid gap-2 text-sm font-semibold text-[#6f6360]">
                      <label className="flex items-center gap-2 text-sm font-semibold text-[#6f6360]">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={giftSlotsVisible}
                          onChange={(event) => setGiftSlotsVisible(event.target.checked)}
                          disabled={highlightSlots.length === 0}
                        />
                        Подсвечивать места для подарков
                      </label>
                      {highlightSlots.length === 0 ? (
                        <p className="text-sm text-slate-500">Свободных мест нет.</p>
                      ) : null}
                    </div>

                      {selectedGiftSupportsSize ? (
                      <div className="grid gap-2 text-sm font-semibold text-[#6f6360]">
                        Размер звезды
                        <div className="flex flex-wrap gap-2">
                          {starSizeOptions.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => setSelectedGiftSize(option.id)}
                              className={`flex items-center gap-2 rounded-[18px] border-[3px] px-3 py-2 text-xs ${
                                selectedGiftSize === option.id
                                  ? "border-[#3bceac] bg-[#f0fffb] text-[#5d4037]"
                                  : "border-white bg-white text-[#8d6e63]"
                              }`}
                            >
                              <span className="text-sm font-black">{option.label}</span>
                              <span className="text-[11px] text-[#adb5bd]">{option.helper}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="grid gap-2 text-sm font-semibold text-[#6f6360]">
                      Срок подарка
                      <div className="grid gap-2">
                        <div className="text-sm font-black text-[#5d4037]">
                          {selectedDuration ? `${selectedDuration} мес` : "Выберите срок"}
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={DURATION_OPTIONS.length - 1}
                          step={1}
                          value={durationIndex}
                          onChange={(event) => {
                            const index = Number(event.target.value);
                            setSelectedDuration(DURATION_OPTIONS[index] ?? DURATION_OPTIONS[0]);
                          }}
                          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#eadfd9]"
                        />
                        <div className="flex justify-between text-[11px] font-semibold text-[#adb5bd]">
                          {DURATION_OPTIONS.map((value) => (
                            <span key={value}>{value}м</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2 text-sm font-semibold text-[#6f6360]">
                      Слот
                      {filteredAvailableSlots.length === 0 ? (
                        <p className="text-sm text-[#8d6e63]">Выберите подарок.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {filteredAvailableSlots.map((slot, index) => (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => handleSelectSlot(slot)}
                              className={`h-10 w-10 rounded-full border-[3px] text-sm font-black ${
                                selectedSlot === slot
                                  ? "border-[#111827] bg-[#111827] text-white"
                                  : "border-white bg-white text-[#8d6e63]"
                              }`}
                              aria-label={`Слот ${index + 1}`}
                            >
                              {index + 1}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <ErrorToast message={giftError} onClose={() => setGiftError(null)} offset={0} />
                    <ErrorToast
                      message={giftSuccess}
                      onClose={() => setGiftSuccess(null)}
                      offset={88}
                      variant="success"
                    />

                    <button
                      type="button"
                      onClick={handlePlaceGift}
                      className={`px-4 py-3 ${
                        selectedGiftId && selectedSlot && selectedDuration && !giftLoading
                          ? primaryActionClass
                          : "cursor-not-allowed rounded-[22px] bg-slate-300 text-sm font-black uppercase tracking-[0.14em] text-slate-500 shadow-none"
                      }`}
                      disabled={!selectedGiftId || !selectedSlot || !selectedDuration || giftLoading}
                    >
                      {giftLoading
                        ? "Покупка..."
                        : selectedGift && totalPrice !== null
                          ? `Подарить (${totalPrice} монет)`
                          : "Подарить"}
                    </button>
                  </div>
                ) : (
                  <p className="mt-3 text-sm font-semibold text-[#8d6e63]">
                    Войдите, чтобы дарить подарки.
                  </p>
                )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {editDialogOpen && appearanceDraft ? (
        <div
          className={`fixed inset-0 z-[999] flex items-center justify-center px-4 transition-opacity duration-200 ${
            editDialogVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <button
            type="button"
            aria-label="Закрыть"
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={closeEditDialog}
          />
          <div
            className={`relative flex w-full max-w-3xl flex-col rounded-[36px] border-[4px] border-white bg-[#efe6e2]/95 p-3 shadow-[0_28px_70px_-24px_rgba(93,64,55,0.55)] transition-transform duration-200 ${
              editDialogVisible ? "translate-y-0 scale-100" : "translate-y-4 scale-95"
            }`}
          >
            <div className={`${panelSectionClass} min-h-[min(72vh,760px)]`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={panelLabelClass}>Редактирование</p>
                  <h3 className="mt-1 text-lg font-black text-[#5d4037]">
                    Домик и детали мемориала
                  </h3>
                </div>
                <button
                  type="button"
                  className={secondaryActionClass}
                  onClick={closeEditDialog}
                >
                  Закрыть
                </button>
              </div>

              <div className="flex min-h-0 flex-1 gap-2.5 overflow-hidden">
                <div className="flex w-[56px] flex-col items-center gap-2 overflow-visible sm:w-[60px] sm:gap-2.5">
                  {appearanceTabs.map((tab) => {
                    const isActive = appearanceTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setAppearanceTab(tab.id)}
                        aria-label={tab.label}
                        title={tab.label}
                        className={`flex h-12 w-12 items-center justify-center rounded-[18px] border-2 text-sm shadow-sm transition-all sm:h-14 sm:w-14 ${
                          isActive
                            ? "border-[#3bceac] bg-[#f0fffb] text-[#3bceac]"
                            : "border-gray-100 bg-white text-gray-400 hover:border-[#d3a27f] hover:bg-[#fff7f2] hover:text-[#d3a27f]"
                        }`}
                      >
                        {renderAppearanceTabIcon(tab.id)}
                        <span className="sr-only">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                  <div className="relative min-h-0 min-w-0 flex-1 overflow-y-auto pr-1 pb-3">
                    {appearanceTab === "house" ? (
                      <div className="grid gap-4">
                        <div className="grid gap-3">
                          {renderAppearanceOptionGrid(
                            "house-base",
                            houseBaseOptions,
                            selectedHouseBaseId,
                            (baseId) => {
                              const nextVariant =
                                houseVariantGroup.defaultVariantByBase[baseId] ?? baseId;
                              updateAppearanceDraft("houseId", nextVariant);
                            },
                            "house"
                          )}
                        </div>
                        {houseTextureOptions.length > 0 ? (
                          <div className="grid gap-3">
                            <h4 className="text-base font-semibold text-slate-900">
                              Текстура домика
                            </h4>
                            {renderAppearanceOptionGrid(
                              "house-texture",
                              houseTextureOptions,
                              appearanceDraft.houseId,
                              (variantId) => updateAppearanceDraft("houseId", variantId),
                              "house-texture"
                            )}
                          </div>
                        ) : null}
                      </div>
                    ) : appearanceTab === "roof" ? (
                      renderAppearanceOptionGrid(
                        "roof",
                        roofOptions,
                        appearanceDraft.roofId,
                        (id) => updateAppearanceDraft("roofId", id)
                      )
                    ) : appearanceTab === "wall" ? (
                      renderAppearanceOptionGrid(
                        "wall",
                        wallOptions,
                        appearanceDraft.wallId,
                        (id) => updateAppearanceDraft("wallId", id)
                      )
                    ) : appearanceTab === "sign" ? (
                      renderAppearanceOptionGrid(
                        "sign",
                        signOptions,
                        appearanceDraft.signId,
                        (id) => updateAppearanceDraft("signId", id)
                      )
                    ) : appearanceTab === "frameLeft" ? (
                      renderAppearanceOptionGrid(
                        "frame-left",
                        frameLeftOptions,
                        appearanceDraft.frameLeftId,
                        (id) => updateAppearanceDraft("frameLeftId", id)
                      )
                    ) : appearanceTab === "frameRight" ? (
                      renderAppearanceOptionGrid(
                        "frame-right",
                        frameRightOptions,
                        appearanceDraft.frameRightId,
                        (id) => updateAppearanceDraft("frameRightId", id)
                      )
                    ) : appearanceTab === "mat" ? (
                      renderAppearanceOptionGrid(
                        "mat",
                        matOptions,
                        appearanceDraft.matId,
                        (id) => updateAppearanceDraft("matId", id)
                      )
                    ) : appearanceTab === "bowlFood" ? (
                      renderAppearanceOptionGrid(
                        "bowl-food",
                        bowlFoodOptions,
                        appearanceDraft.bowlFoodId,
                        (id) => updateAppearanceDraft("bowlFoodId", id)
                      )
                    ) : appearanceTab === "bowlWater" ? (
                      renderAppearanceOptionGrid(
                        "bowl-water",
                        bowlWaterOptions,
                        appearanceDraft.bowlWaterId,
                        (id) => updateAppearanceDraft("bowlWaterId", id)
                      )
                    ) : null}

                    {appearanceColorField ? (
                      <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-3">
                        <div className="text-sm font-semibold text-slate-900">Цвет детали</div>
                        <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
                          {colorPalette.map((color) => {
                            const isActive = appearanceDraft[appearanceColorField] === color;
                            return (
                              <button
                                key={color}
                                type="button"
                                onClick={() => updateAppearanceDraft(appearanceColorField, color)}
                                className={`h-10 w-full rounded-xl border-2 transition ${
                                  isActive
                                    ? "border-slate-900 ring-2 ring-sky-200"
                                    : "border-white hover:border-slate-300"
                                }`}
                                style={{ backgroundColor: color }}
                                aria-label={color}
                                title={color}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {appearanceError ? (
                <p className="text-xs font-semibold text-red-600">{appearanceError}</p>
              ) : null}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEditDialog}
                  className={secondaryActionClass}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleSaveAppearance}
                  disabled={savingAppearance}
                  className={primaryActionClass}
                >
                  {savingAppearance ? "Сохраняем..." : "Сохранить"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {extensionDialogOpen ? (
        <div
          className={`fixed inset-0 z-[999] flex items-center justify-center px-4 transition-opacity duration-200 ${
            extensionDialogVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <button
            type="button"
            aria-label="Закрыть"
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={closeExtensionDialog}
          />
          <div
            className={`relative w-full max-w-lg rounded-[36px] border-[4px] border-white bg-[#efe6e2]/95 p-3 shadow-[0_28px_70px_-24px_rgba(93,64,55,0.55)] transition-transform duration-200 ${
              extensionDialogVisible ? "translate-y-0 scale-100" : "translate-y-4 scale-95"
            }`}
          >
            <div className={panelSectionClass}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={panelLabelClass}>
                  Продление
                </p>
                <h3 className="mt-1 text-lg font-black text-[#5d4037]">
                  Выберите срок
                </h3>
              </div>
              <button
                type="button"
                className={secondaryActionClass}
                onClick={closeExtensionDialog}
              >
                Закрыть
              </button>
            </div>
            <p className="mt-2 text-sm font-semibold text-[#8d6e63]">
              Текущий срок: {activeUntilLabel}. Баланс:{" "}
              {walletLoading ? "Загрузка..." : walletBalance ?? "—"} монет
            </p>
            <div className="mt-4 grid gap-2">
              {MEMORIAL_EXTENSION_PLANS.map((plan) => {
                const isSelected = plan.years === selectedExtensionYears;
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedExtensionYears(plan.years)}
                    className={`flex items-center justify-between rounded-[22px] border-[3px] px-4 py-3 text-sm transition ${
                      isSelected
                        ? "border-[#3bceac] bg-[#f0fffb] text-[#5d4037]"
                        : "border-white bg-white text-[#6f6360] hover:border-[#d3a27f]/40"
                    }`}
                  >
                    <span className="font-black">{plan.label}</span>
                    <span className="font-semibold text-[#8d6e63]">{plan.price} монет</span>
                  </button>
                );
              })}
            </div>
            {lifecycleError ? (
              <p className="mt-3 text-xs font-semibold text-red-600">{lifecycleError}</p>
            ) : null}
            <button
              type="button"
              onClick={() => handleExtendMemorial(selectedExtensionYears)}
              disabled={extendingMemorial || !canExtendMemorial}
              className={`mt-5 w-full ${primaryActionClass}`}
            >
              {extendingMemorial
                ? "Продление..."
                : `Продлить на ${selectedExtensionPlan.label} • ${selectedExtensionPlan.price} монет`}
            </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteDialogOpen ? (
        <div
          className={`fixed inset-0 z-[999] flex items-center justify-center px-4 transition-opacity duration-200 ${
            deleteDialogVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <button
            type="button"
            aria-label="Закрыть"
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={closeDeleteDialog}
          />
          <div
            className={`relative w-full max-w-md rounded-[36px] border-[4px] border-white bg-[#efe6e2]/95 p-3 shadow-[0_28px_70px_-24px_rgba(93,64,55,0.55)] transition-transform duration-200 ${
              deleteDialogVisible ? "translate-y-0 scale-100" : "translate-y-4 scale-95"
            }`}
          >
            <div className={panelSectionClass}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-red-400">
                  Удаление
                </p>
                <h3 className="mt-1 text-lg font-black text-[#5d4037]">
                  Подтвердите действие
                </h3>
              </div>
              <button
                type="button"
                className={secondaryActionClass}
                onClick={closeDeleteDialog}
              >
                Закрыть
              </button>
            </div>
            <p className="mt-3 text-sm font-semibold leading-relaxed text-[#8d6e63]">
              Мемориал исчезнет из списков и карты, но данные останутся в базе. Для
              подтверждения введите имя:{" "}
              <span className="font-black text-[#5d4037]">{pet.name}</span>
            </p>
            <input
              type="text"
              value={deleteConfirmationName}
              onChange={(event) => setDeleteConfirmationName(event.target.value)}
              className="mt-4 w-full rounded-[22px] border-b-4 border-transparent bg-[#f8f9fa] px-4 py-3 text-sm font-bold text-[#5d4037] shadow-inner outline-none transition focus:border-red-300"
              placeholder={pet.name}
              autoComplete="off"
            />
            {lifecycleError ? (
              <p className="mt-3 text-xs font-semibold text-red-600">{lifecycleError}</p>
            ) : null}
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeDeleteDialog}
                className={secondaryActionClass}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleDeleteMemorial}
                disabled={!canConfirmDelete}
                className="rounded-[22px] bg-red-500 px-4 py-3 text-sm font-black uppercase tracking-[0.14em] text-white shadow-[0_5px_0_0_#c0392b] transition-all hover:-translate-y-[1px] hover:bg-red-600 hover:shadow-[0_6px_0_0_#b91c1c] active:translate-y-[3px] active:shadow-none disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              >
                {deletingMemorial ? "Удаление..." : "Удалить"}
              </button>
            </div>
            </div>
          </div>
        </div>
      ) : null}

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
            className={`relative w-full max-w-md rounded-[36px] border-[4px] border-white bg-[#efe6e2]/95 p-3 shadow-[0_28px_70px_-24px_rgba(93,64,55,0.55)] transition-transform duration-200 ${
              topUpVisible ? "translate-y-0 scale-100" : "translate-y-4 scale-95"
            }`}
          >
            <div className={panelSectionClass}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={panelLabelClass}>Баланс</p>
                <h3 className="text-lg font-black text-[#5d4037]">Пополнение баланса</h3>
              </div>
              <button type="button" className={secondaryActionClass} onClick={closeTopUp}>
                Закрыть
              </button>
            </div>
            <p className="mt-1 text-sm font-semibold text-[#8d6e63]">
              Баланс: {walletBalance ?? 0} монет
            </p>
            <div className="mt-4 flex gap-2 rounded-full bg-[#fdf2e9] p-1.5">
              {(["RUB", "USD"] as const).map((currency) => {
                const isActive = topUpCurrency === currency;
                return (
                  <button
                    key={currency}
                    type="button"
                    onClick={() => setTopUpCurrency(currency)}
                    className={`flex-1 rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.14em] ${
                      isActive ? "bg-white text-[#5d4037] shadow-sm" : "text-[#8d6e63]"
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
                    className={`flex items-center justify-between rounded-[22px] border-[3px] px-4 py-3 text-sm transition ${
                      isSelected
                        ? "border-[#3bceac] bg-[#f0fffb] text-[#5d4037]"
                        : "border-white bg-white text-[#6f6360] hover:border-[#d3a27f]/40"
                    }`}
                  >
                    <span className="font-black">{option.coins} монет</span>
                    <span className="font-semibold text-[#8d6e63]">{price}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              className={`mt-5 w-full ${primaryActionClass}`}
              onClick={() => {
                if (!topUpPlan) {
                  return;
                }
                router.push(`/payment?coins=${topUpPlan}&currency=${topUpCurrency}`);
                closeTopUp();
              }}
              disabled={!topUpPlan || walletLoading}
            >
              Продолжить
            </button>
            </div>
          </div>
        </div>
      ) : null}

      {mounted && lightboxIndex !== null ? (
        <div
          onClick={closeLightbox}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.75)",
            padding: "24px"
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "900px",
              background: "rgba(15,23,42,0.95)",
              borderRadius: "24px",
              padding: "16px",
              position: "relative"
            }}
          >
            {photos[lightboxIndex] ? (
              <img
                src={
                  photos[lightboxIndex].url.startsWith("http")
                    ? photos[lightboxIndex].url
                    : `${apiUrl}${photos[lightboxIndex].url}`
                }
                alt="Фото питомца"
                style={{
                  width: "100%",
                  maxHeight: "70vh",
                  objectFit: "contain",
                  borderRadius: "16px"
                }}
              />
            ) : (
              <div style={{ color: "#e2e8f0", textAlign: "center", padding: "40px 0" }}>
                Фото не найдено
              </div>
            )}
            <div
              style={{
                marginTop: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                color: "#e2e8f0",
                fontSize: "14px"
              }}
            >
              <button
                type="button"
                onClick={goPrev}
                style={{
                  border: "1px solid #475569",
                  borderRadius: "999px",
                  padding: "8px 16px",
                  color: "#e2e8f0"
                }}
              >
                Назад
              </button>
              <span>
                {Math.min(lightboxIndex + 1, photos.length)} / {photos.length}
              </span>
              <button
                type="button"
                onClick={goNext}
                style={{
                  border: "1px solid #475569",
                  borderRadius: "999px",
                  padding: "8px 16px",
                  color: "#e2e8f0"
                }}
              >
                Вперёд
              </button>
            </div>
            <button
              type="button"
              onClick={closeLightbox}
              style={{
                position: "absolute",
                top: "12px",
                right: "12px",
                border: "1px solid #475569",
                borderRadius: "999px",
                padding: "6px 10px",
                color: "#e2e8f0",
                fontSize: "12px"
              }}
            >
              Закрыть
            </button>
          </div>
        </div>
      ) : null}
      <ErrorToast
        message={cleanSuccess}
        onClose={() => setCleanSuccess(null)}
        offset={88}
        variant="success"
      />
      <ErrorToast
        message={appearanceSuccess}
        onClose={() => setAppearanceSuccess(null)}
        offset={152}
        variant="success"
      />
      <ErrorToast message={error} onClose={() => setError(null)} />
    </main>
  );
}
