"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  } | null;
  photos?: { id: string; url: string }[];
  gifts?: {
    id: string;
    slotName: string;
    placedAt: string;
    expiresAt: string | null;
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
  const [giftLoading, setGiftLoading] = useState(false);
  const [selectedGiftId, setSelectedGiftId] = useState<string | null>(null);
  const [selectedGiftSize, setSelectedGiftSize] = useState<GiftSize>("m");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState(1);
  const [giftPreviewEnabled, setGiftPreviewEnabled] = useState(false);
  const [giftCatalogLoading, setGiftCatalogLoading] = useState(true);
  const [preloadedGiftUrls, setPreloadedGiftUrls] = useState<Record<string, true>>({});
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [giftPanelOpen, setGiftPanelOpen] = useState(true);
  const [detectedSlots, setDetectedSlots] = useState<string[] | null>(null);
  const [slotManuallyCleared, setSlotManuallyCleared] = useState(false);

  const apiUrl = useMemo(() => API_BASE, []);
  const router = useRouter();

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
    if (currentUser?.id) {
      loadWallet(currentUser.id);
    }
  }, [currentUser, loadWallet]);

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
    pet?.gifts?.filter((gift) => !gift.expiresAt || new Date(gift.expiresAt) > new Date()) ?? [];
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
  };

  const toggleGiftPanel = () => setGiftPanelOpen((prev) => !prev);

  const handlePlaceGift = async () => {
    if (!selectedGiftId || !selectedSlot) {
      setGiftError("Выбери подарок и слот");
      return;
    }
    if (!currentUser?.id) {
      setGiftError("Войдите, чтобы подарить подарок");
      return;
    }
    setGiftLoading(true);
    setGiftError(null);
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
      await loadPet();
      if (currentUser?.id) {
        loadWallet(currentUser.id);
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
  const starSizeOptions: { id: GiftSize; label: string; helper: string }[] = [
    { id: "s", label: "S", helper: "Маленькая" },
    { id: "m", label: "M", helper: "Средняя" },
    { id: "l", label: "L", helper: "Большая" }
  ];

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
  const totalPrice = selectedGift ? selectedGift.price * selectedDuration : null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-200 px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Мемориал</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">{pet.name}</h1>
              <p className="mt-2 text-sm text-slate-500">
                Владелец: {pet.owner?.login ?? pet.owner?.email ?? pet.ownerId}
              </p>
            </div>
            <span className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-600">
              {pet.isPublic ? "Публичный" : "Приватный"}
            </span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Рождение</p>
              <p className="mt-2 text-sm text-slate-700">
                {pet.birthDate ? new Date(pet.birthDate).toLocaleDateString() : "—"}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Уход</p>
              <p className="mt-2 text-sm text-slate-700">
                {pet.deathDate ? new Date(pet.deathDate).toLocaleDateString() : "—"}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Эпитафия</p>
            <p className="mt-2 text-base text-slate-800">{pet.epitaph ?? "Без эпитафии"}</p>
          </div>

          {photos.length > 0 ? (
            <div className="mt-6">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Фотографии</p>
              <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
                {photos.map((photo, index) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => openLightbox(index)}
                    className="shrink-0 cursor-zoom-in"
                  >
                    <img
                      src={photo.url.startsWith("http") ? photo.url : `${apiUrl}${photo.url}`}
                      alt="Фото питомца"
                      className="rounded-xl object-cover"
                      style={{ width: 324, height: 252 }}
                      loading="lazy"
                      onClick={() => openLightbox(index)}
                    />
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-6">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">История</p>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              {pet.story ?? "История пока не заполнена."}
            </p>
          </div>

        </div>

        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={toggleGiftPanel}
              className="flex items-center text-xs font-semibold text-slate-700"
            >
              <span
                className={`inline-flex items-center justify-center transition-transform ${
                  giftPanelOpen ? "rotate-180" : ""
                }`}
                aria-hidden
              >
                ▾
              </span>
            </button>
          </div>
          {currentUser ? (
            <div
              className={`mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 transition-all ${
                giftPanelOpen ? "opacity-100" : "pointer-events-none max-h-0 overflow-hidden p-0 opacity-0"
              }`}
            >
              <div className="grid gap-3">
                <div className="grid gap-2 text-sm text-slate-700">
                  Подарок
                  <div className="flex max-h-52 flex-wrap gap-3 overflow-y-auto pr-1">
                    {giftCatalogLoading ? (
                      Array.from({ length: 8 }).map((_, index) => (
                        <div
                          key={`gift-skeleton-${index}`}
                          className="h-24 w-full animate-pulse rounded-2xl border border-slate-200 bg-white"
                        >
                          <div className="m-2 h-16 rounded-xl bg-slate-200" />
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
                        className={`relative flex h-24 w-24 items-center justify-center rounded-xl border ${
                          selectedGiftId === gift.id
                            ? "border-sky-400/70 bg-sky-50 text-slate-900"
                            : "border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        <span className="relative flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-lg bg-slate-100">
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
                        </span>
                        <span className="absolute bottom-1 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full bg-slate-900 text-[9px] font-semibold text-white">
                          {gift.price}
                        </span>
                      </button>
                    );
                  })
                    )}
                  </div>
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
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 6, 12].map((months) => (
                      <button
                        key={months}
                        type="button"
                        onClick={() => setSelectedDuration(months)}
                        className={`rounded-2xl border px-4 py-2 text-sm ${
                          selectedDuration === months
                            ? "border-rose-500 bg-rose-500 text-white"
                            : "border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        {months} мес
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-2 text-sm text-slate-700">
                  Слот
                  {filteredAvailableSlots.length === 0 ? (
                    <p className="text-sm text-slate-500">Нет свободных слотов.</p>
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

                <button
                  type="button"
                  onClick={handlePlaceGift}
                  className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  disabled={giftLoading}
                >
                  {giftLoading
                    ? "Покупка..."
                    : selectedGift && totalPrice !== null
                      ? `Подарить (${totalPrice} монет)`
                      : "Подарить"}
                </button>
              </div>
            </div>
          ) : null}
          <div className="mt-6">
            <MemorialPreview
              className="h-[660px]"
              terrainUrl={resolveEnvironmentModel(pet.memorial?.environmentId, "auto")}
              houseUrl={resolveHouseModel(pet.memorial?.houseId)}
              parts={partList}
              gifts={previewGifts}
              giftSlots={filteredAvailableSlots}
              selectedSlot={selectedSlot}
              onSelectSlot={handleSelectSlot}
              onGiftSlotsDetected={setDetectedSlots}
              preloadGiftUrl={pendingPreviewUrl}
              onGiftPreloaded={handleGiftPreloaded}
              colors={colorOverrides}
            />
          </div>
        </div>

        {currentUser ? (
          <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Подарки</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
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
                    return (
                      <div
                        key={gift.id}
                        className="group relative rounded-xl border border-transparent bg-white p-3 transition hover:border-slate-200 hover:bg-slate-50"
                      >
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
