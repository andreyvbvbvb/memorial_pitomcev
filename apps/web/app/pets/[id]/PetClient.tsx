"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import { API_BASE } from "../../../lib/config";
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
import { splitHouseVariantId } from "../../../lib/house-variants";

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

  const houseSlots = getHouseSlots(pet?.memorial?.houseId);
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

  const capturePreviewImage = useCallback(async () => {
    const renderContext = previewRenderRef.current;
    if (!renderContext) {
      return null;
    }
    const controls = previewControlsRef.current;
    const camera =
      (controls?.object as THREE.PerspectiveCamera | undefined) ??
      (renderContext.camera as THREE.PerspectiveCamera | undefined);
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
      camera.updateProjectionMatrix();
      restore = () => {
        camera.position.copy(prevPos);
        if (prevTarget && target && controls) {
          controls.target.copy(prevTarget);
          controls.update();
        } else if (prevTarget) {
          camera.lookAt(prevTarget);
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
    const size = new THREE.Vector2();
    gl.getDrawingBufferSize(size);
    const width = Math.max(1, Math.round(size.x * 0.5));
    const height = Math.max(1, Math.round(size.y * 0.5));
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
    () => buildDirtModelUrls(pet?.memorial?.houseId),
    [pet?.memorial?.houseId]
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

  const sceneJson = (pet?.memorial?.sceneJson ?? {}) as {
    parts?: {
      roof?: string;
      wall?: string;
      sign?: string;
      frameLeft?: string;
      frameRight?: string;
      mat?: string;
      bowlFood?: string;
      bowlWater?: string;
    };
    colors?: Record<string, string>;
    memorialPaidUntil?: string | null;
  };
  const partList = [
    houseSlots.roof ? { slot: houseSlots.roof, url: resolveRoofModel(sceneJson.parts?.roof) } : null,
    houseSlots.wall ? { slot: houseSlots.wall, url: resolveWallModel(sceneJson.parts?.wall) } : null,
    houseSlots.sign ? { slot: houseSlots.sign, url: resolveSignModel(sceneJson.parts?.sign) } : null,
    houseSlots.frameLeft
      ? { slot: houseSlots.frameLeft, url: resolveFrameLeftModel(sceneJson.parts?.frameLeft) }
      : null,
    houseSlots.frameRight
      ? { slot: houseSlots.frameRight, url: resolveFrameRightModel(sceneJson.parts?.frameRight) }
      : null,
    houseSlots.mat ? { slot: houseSlots.mat, url: resolveMatModel(sceneJson.parts?.mat) } : null,
    houseSlots.bowlFood
      ? { slot: houseSlots.bowlFood, url: resolveBowlFoodModel(sceneJson.parts?.bowlFood) }
      : null,
    houseSlots.bowlWater
      ? { slot: houseSlots.bowlWater, url: resolveBowlWaterModel(sceneJson.parts?.bowlWater) }
      : null
  ].filter((part): part is { slot: string; url: string } => Boolean(part?.url));
  const fullPartList = partList;
  const colorOverrides = sceneJson.colors ?? undefined;
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
  const activeUntil = pet.memorial?.activeUntil ?? sceneJson.memorialPaidUntil ?? null;
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
    "w-[280px] max-w-[80vw] rounded-2xl border border-white/60 bg-white/90 p-4 shadow-xl backdrop-blur sm:w-[320px]";
  const panelButtonClass = (active: boolean) =>
    `flex h-12 w-12 items-center justify-center rounded-2xl border transition ${
      active
        ? "border-white/80 bg-white text-slate-900 shadow-lg"
        : "border-white/60 bg-white/70 text-slate-600 hover:bg-white/90"
    }`;

  return (
    <main className="relative min-h-[calc(100vh-var(--app-header-height,0px))] overflow-hidden bg-[#e9f2fb]">
      <div className="fixed inset-0 z-0">
        <MemorialPreview
          className="h-full w-full rounded-none border-transparent bg-transparent"
          terrainUrl={resolveEnvironmentModel(pet.memorial?.environmentId, "auto")}
          terrainId={pet.memorial?.environmentId ?? null}
          houseUrl={resolveHouseModel(pet.memorial?.houseId)}
          houseId={pet.memorial?.houseId ?? null}
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

      <div className="fixed inset-0 z-10 pointer-events-none">
        <div className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 text-center top-[calc(var(--app-header-height,0px)+0.75rem)]">
          <div className="rounded-full bg-white/60 px-4 py-2 backdrop-blur">
            <div className="text-lg font-semibold text-slate-900">{pet.name}</div>
            <div className="text-xs text-slate-600">{dateRange}</div>
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
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
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
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
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
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3l2.5 5 5.5.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.5-.8z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => togglePanel("memorials")}
                aria-label="Другие мемориалы"
                className={panelButtonClass(activePanel === "memorials")}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
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
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.6 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
                  </svg>
                </button>
              ) : null}
            </div>

            {activePanel === "info" ? (
              <div className={`absolute bottom-0 left-16 ${panelBaseClass}`}>
                <div className="grid gap-3 text-sm text-slate-700">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                      Эпитафия
                    </p>
                    <p className="mt-2 text-sm text-slate-800">
                      {pet.epitaph ?? "Без эпитафии"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                      История
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">
                      {pet.story ?? "История пока не заполнена."}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-white/70 p-3">
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span className="font-semibold text-slate-800">Чистота мемориала</span>
                      <span>
                        {dirtLevel}/{DIRT_SLOTS.length}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCleanDirt}
                      disabled={dirtLevel === 0}
                      className={`mt-3 w-full rounded-full px-3 py-2 text-xs font-semibold transition ${
                        dirtLevel === 0
                          ? "cursor-not-allowed bg-slate-200 text-slate-500"
                          : "bg-slate-900 text-white hover:bg-slate-800"
                      }`}
                    >
                      Почистить мемориал
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {activePanel === "photos" ? (
              <div className={`absolute bottom-0 left-16 ${panelBaseClass}`}>
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                  Фотографии
                </p>
                {photos.length > 0 ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {photos.map((photo, index) => (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => openLightbox(index)}
                        className="overflow-hidden rounded-xl"
                      >
                        <img
                          src={photo.url.startsWith("http") ? photo.url : `${apiUrl}${photo.url}`}
                          alt="Фото питомца"
                          className="h-28 w-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">Фотографии пока не добавлены.</p>
                )}
              </div>
            ) : null}

            {activePanel === "gifts" ? (
              <div className={`absolute bottom-0 left-16 ${panelBaseClass}`}>
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                  Подарки
                </p>
                <div className="mt-3 max-h-[50vh] overflow-y-auto pr-1">
                  {activeGifts.length > 0 ? (
                    <div className="grid gap-2 text-sm text-slate-700">
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
                            className="group relative flex gap-3 rounded-xl border border-transparent bg-white p-3 transition hover:border-slate-200 hover:bg-slate-50"
                          >
                            <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
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
                                <p className="font-semibold">{gift.gift.name}</p>
                              </div>
                              <p className="mt-1 text-xs text-slate-500">
                                От хозяина:{" "}
                                {ownerPets.length > 0 ? (
                                  <span className="inline-flex flex-wrap gap-1">
                                    {ownerPets.map((petItem, index) => (
                                      <span key={petItem.id} className="inline-flex items-center gap-1">
                                        <a
                                          href={`/pets/${petItem.id}`}
                                          className="text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
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
                                <p className="text-xs text-slate-500">До: {expiresLabel}</p>
                              ) : null}
                            </div>
                            <div className="pointer-events-none absolute right-3 top-3 z-10 hidden w-48 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-lg group-hover:block">
                              <p className="font-semibold text-slate-800">{gift.gift.name}</p>
                              <p className="mt-1">От: {ownerLabel}</p>
                              {expiresLabel ? <p className="mt-1">До: {expiresLabel}</p> : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Пока нет подарков.</p>
                  )}
                </div>
              </div>
            ) : null}

            {activePanel === "memorials" ? (
              <div className={`absolute bottom-0 left-16 ${panelBaseClass}`}>
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                  Мемориалы хозяина
                </p>
                {otherMemorials.length > 0 ? (
                  <div className="mt-3 max-h-[50vh] overflow-y-auto pr-1">
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
                            className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 transition hover:border-slate-300"
                          >
                            <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100">
                              {url ? (
                                <img src={url} alt="" className="h-full w-full object-cover" />
                              ) : null}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                              <p className="text-xs text-slate-500">
                                {formatDate(item.birthDate)}-{formatDate(item.deathDate)}
                              </p>
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    Других мемориалов пока нет.
                  </p>
                )}
              </div>
            ) : null}

            {isOwner && activePanel === "manage" ? (
              <div className={`absolute bottom-0 left-16 ${panelBaseClass}`}>
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                  Управление
                </p>
                <div className="mt-3 rounded-2xl border border-slate-200/80 bg-white/75 p-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    Активен до
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {activeUntilLabel}
                  </p>
                </div>
                {lifecycleError ? (
                  <p className="mt-3 text-xs font-semibold text-red-600">{lifecycleError}</p>
                ) : null}
                <div className="mt-3 grid gap-2">
                  <button
                    type="button"
                    onClick={openExtensionDialog}
                    disabled={!canExtendMemorial}
                    className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-[0_6px_0_0_#000] transition-all hover:-translate-y-[1px] hover:shadow-[0_7px_0_0_#000] active:translate-y-[4px] active:shadow-none disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                  >
                    {canExtendMemorial ? "Продлить" : "Бессрочно"}
                  </button>
                  <button
                    type="button"
                    onClick={openDeleteDialog}
                    disabled={deletingMemorial}
                    className="w-1/2 justify-self-start rounded-xl border border-red-100 bg-white px-3 py-1.5 text-[11px] font-semibold text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingMemorial ? "Удаление..." : "Удалить"}
                  </button>
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
              className={`flex h-14 w-14 items-center justify-center rounded-2xl border transition ${
                giftPanelOpen
                  ? "border-white/80 bg-white text-slate-900 shadow-lg"
                  : "border-white/60 bg-white/70 text-slate-600 hover:bg-white/90"
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
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                      Подарки
                    </p>
                    <p className="text-sm font-semibold text-slate-900">Сделать подарок</p>
                  </div>
                  <button
                    type="button"
                    onClick={toggleGiftPanel}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600"
                  >
                    Закрыть
                  </button>
                </div>
                {currentUser ? (
                  <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
                    <div className="flex min-h-0 flex-1 flex-col gap-2 text-sm text-slate-700">
                      <span>Подарок</span>
                      <div className="grid min-h-0 flex-1 grid-cols-3 content-start gap-3 overflow-y-auto pr-1">
                        {giftCatalogLoading ? (
                          Array.from({ length: 8 }).map((_, index) => (
                            <div
                              key={`gift-skeleton-${index}`}
                              className="relative h-28 w-full animate-pulse overflow-hidden rounded-2xl border border-slate-200 bg-white"
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
                                className={`relative flex h-28 w-full items-center justify-center overflow-hidden rounded-2xl border transition ${
                                  selectedGiftId === gift.id
                                    ? "border-sky-400/70 bg-sky-50 text-slate-900 shadow-sm"
                                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
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
                                <span className="pointer-events-none absolute bottom-2 left-1/2 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full bg-slate-900 text-[9px] font-semibold text-white shadow-md">
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

                    <div className="grid gap-2 text-sm text-slate-700">
                      <label className="flex items-center gap-2 text-sm text-slate-700">
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
                      <div className="grid gap-2 text-sm text-slate-700">
                        Размер звезды
                        <div className="flex flex-wrap gap-2">
                          {starSizeOptions.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => setSelectedGiftSize(option.id)}
                              className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs ${
                                selectedGiftSize === option.id
                                  ? "border-sky-400 bg-sky-50 text-slate-900"
                                  : "border-slate-200 bg-white text-slate-600"
                              }`}
                            >
                              <span className="text-sm font-semibold">{option.label}</span>
                              <span className="text-[11px] text-slate-400">{option.helper}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="grid gap-2 text-sm text-slate-700">
                      Срок подарка
                      <div className="grid gap-2">
                        <div className="text-sm font-semibold text-slate-900">
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
                          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200"
                        />
                        <div className="flex justify-between text-[11px] text-slate-400">
                          {DURATION_OPTIONS.map((value) => (
                            <span key={value}>{value}м</span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2 text-sm text-slate-700">
                      Слот
                      {filteredAvailableSlots.length === 0 ? (
                        <p className="text-sm text-slate-500">Выберите подарок.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {filteredAvailableSlots.map((slot, index) => (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => handleSelectSlot(slot)}
                              className={`h-10 w-10 rounded-full border text-sm ${
                                selectedSlot === slot
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-slate-200 bg-white text-slate-700"
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
                      className={`rounded-2xl px-4 py-2 text-sm font-semibold ${
                        selectedGiftId && selectedSlot && selectedDuration && !giftLoading
                          ? "bg-slate-900 text-white"
                          : "cursor-not-allowed bg-slate-300 text-slate-500"
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
                  <p className="mt-3 text-sm text-slate-600">
                    Войдите, чтобы дарить подарки.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

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
            className={`relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl transition-transform duration-200 ${
              extensionDialogVisible ? "translate-y-0 scale-100" : "translate-y-4 scale-95"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                  Продление
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">
                  Выберите срок
                </h3>
              </div>
              <button
                type="button"
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600"
                onClick={closeExtensionDialog}
              >
                Закрыть
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-600">
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
            {lifecycleError ? (
              <p className="mt-3 text-xs font-semibold text-red-600">{lifecycleError}</p>
            ) : null}
            <button
              type="button"
              onClick={() => handleExtendMemorial(selectedExtensionYears)}
              disabled={extendingMemorial || !canExtendMemorial}
              className="mt-5 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-[0_6px_0_0_#000] transition-all hover:-translate-y-[1px] hover:shadow-[0_7px_0_0_#000] active:translate-y-[4px] active:shadow-none disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            >
              {extendingMemorial
                ? "Продление..."
                : `Продлить на ${selectedExtensionPlan.label} • ${selectedExtensionPlan.price} монет`}
            </button>
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
            className={`relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl transition-transform duration-200 ${
              deleteDialogVisible ? "translate-y-0 scale-100" : "translate-y-4 scale-95"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-red-400">
                  Удаление
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">
                  Подтвердите действие
                </h3>
              </div>
              <button
                type="button"
                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600"
                onClick={closeDeleteDialog}
              >
                Закрыть
              </button>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Мемориал исчезнет из списков и карты, но данные останутся в базе. Для
              подтверждения введите имя:{" "}
              <span className="font-semibold text-slate-900">{pet.name}</span>
            </p>
            <input
              type="text"
              value={deleteConfirmationName}
              onChange={(event) => setDeleteConfirmationName(event.target.value)}
              className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-red-300 focus:ring-4 focus:ring-red-100"
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
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleDeleteMemorial}
                disabled={!canConfirmDelete}
                className="rounded-2xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {deletingMemorial ? "Удаление..." : "Удалить"}
              </button>
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
            className={`relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl transition-transform duration-200 ${
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
              Баланс: {walletBalance ?? 0} монет
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
              disabled={!topUpPlan || walletLoading}
            >
              Продолжить
            </button>
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
    </main>
  );
}
