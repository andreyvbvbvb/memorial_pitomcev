"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../../lib/config";
import MemorialPreview from "../../create/MemorialPreview";
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

type Pet = {
  id: string;
  ownerId: string;
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
    gift: { id: string; name: string; price: number; modelUrl: string };
    owner: { id: string; email: string | null };
  }[];
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
  const [giftCatalog, setGiftCatalog] = useState<
    { id: string; name: string; price: number; modelUrl: string }[]
  >([]);
  const [giftError, setGiftError] = useState<string | null>(null);
  const [giftLoading, setGiftLoading] = useState(false);
  const [gifterId, setGifterId] = useState("");
  const [selectedGiftId, setSelectedGiftId] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState(1);

  const apiUrl = useMemo(() => API_BASE, []);

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
      setGifterId((prev) => prev || data.ownerId);
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

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const response = await fetch(`${apiUrl}/gifts`);
        if (!response.ok) {
          throw new Error("Не удалось загрузить подарки");
        }
        const data = (await response.json()) as {
          id: string;
          name: string;
          price: number;
          modelUrl: string;
        }[];
        setGiftCatalog(data);
        setSelectedGiftId((prev) => prev ?? data[0]?.id ?? null);
      } catch (err) {
        setGiftError(err instanceof Error ? err.message : "Ошибка загрузки подарков");
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
  const terrainGiftSlots = getTerrainGiftSlots(pet?.memorial?.environmentId);
  const activeGifts =
    pet?.gifts?.filter((gift) => !gift.expiresAt || new Date(gift.expiresAt) > new Date()) ?? [];
  const occupiedSlots = new Set(activeGifts.map((gift) => gift.slotName));
  const availableSlots = terrainGiftSlots.filter((slot) => !occupiedSlots.has(slot));

  useEffect(() => {
    if (availableSlots.length === 0) {
      setSelectedSlot(null);
      return;
    }
    if (!selectedSlot || !availableSlots.includes(selectedSlot)) {
      setSelectedSlot(availableSlots[0] ?? null);
    }
  }, [availableSlots, selectedSlot]);

  const handlePlaceGift = async () => {
    if (!selectedGiftId || !selectedSlot) {
      setGiftError("Выбери подарок и слот");
      return;
    }
    if (!gifterId.trim()) {
      setGiftError("Укажи, кто дарит подарок (ownerId)");
      return;
    }
    setGiftLoading(true);
    setGiftError(null);
    try {
      const response = await fetch(`${apiUrl}/pets/${id}/gifts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId: gifterId.trim(),
          giftId: selectedGiftId,
          slotName: selectedSlot,
          months: selectedDuration
        })
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Ошибка покупки подарка");
      }
      await loadPet();
    } catch (err) {
      setGiftError(err instanceof Error ? err.message : "Ошибка покупки подарка");
    } finally {
      setGiftLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-slate-500">Загрузка мемориала...</p>
        </div>
      </main>
    );
  }

  if (error || !pet) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
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
  const giftInstances = activeGifts.map((gift) => ({
    slot: gift.slotName,
    url: gift.gift.modelUrl
  }));
  const selectedGift =
    giftCatalog.find((gift) => gift.id === selectedGiftId) ?? giftCatalog[0] ?? null;
  const previewGift =
    selectedGift && selectedSlot && !occupiedSlots.has(selectedSlot)
      ? { slot: selectedSlot, url: selectedGift.modelUrl }
      : null;
  const previewGifts = previewGift ? [...giftInstances, previewGift] : giftInstances;
  const totalPrice = selectedGift ? selectedGift.price * selectedDuration : null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-200 px-6 py-16">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Мемориал</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">{pet.name}</h1>
              <p className="mt-2 text-sm text-slate-500">Owner: {pet.ownerId}</p>
            </div>
            <span className="rounded-full border border-slate-200 px-4 py-2 text-xs text-slate-600">
              {pet.isPublic ? "Публичный" : "Приватный"}
            </span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
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
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Создан</p>
              <p className="mt-2 text-sm text-slate-700">
                {new Date(pet.createdAt).toLocaleDateString()}
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

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Подарки</p>
            {activeGifts.length > 0 ? (
              <div className="mt-3 grid gap-2 text-sm text-slate-700">
                {activeGifts.map((gift) => (
                  <div key={gift.id} className="rounded-xl bg-white p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{gift.gift.name}</p>
                      <span className="text-xs text-slate-400">{gift.slotName}</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      От: {gift.owner?.email ?? gift.owner?.id ?? "—"}
                    </p>
                    {gift.expiresAt ? (
                      <p className="text-xs text-slate-500">
                        До: {new Date(gift.expiresAt).toLocaleDateString()}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500">Пока нет подарков.</p>
            )}

            <div className="mt-4 grid gap-3">
              <div className="grid gap-1 text-sm text-slate-700">
                Кто дарит (ownerId)
                <input
                  className="rounded-2xl border border-slate-200 px-4 py-2"
                  value={gifterId}
                  onChange={(event) => setGifterId(event.target.value)}
                  placeholder="user_123"
                />
              </div>

              <div className="grid gap-2 text-sm text-slate-700">
                Подарок
                <div className="flex flex-wrap gap-2">
                  {giftCatalog.map((gift) => (
                    <button
                      key={gift.id}
                      type="button"
                      onClick={() => setSelectedGiftId(gift.id)}
                      className={`rounded-2xl border px-4 py-2 text-sm ${
                        selectedGiftId === gift.id
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      {gift.name} · {gift.price} монет/мес
                    </button>
                  ))}
                </div>
              </div>

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
                {availableSlots.length === 0 ? (
                  <p className="text-sm text-slate-500">Нет свободных слотов.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`rounded-2xl border px-4 py-2 text-sm ${
                          selectedSlot === slot
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-700"
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {giftError ? <p className="text-sm text-red-600">{giftError}</p> : null}

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

        </div>

        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Мемориал 3D</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900">Визуализация</h2>
            </div>
          </div>
          <div className="mt-6">
            <MemorialPreview
              className="h-[360px]"
              terrainUrl={resolveEnvironmentModel(pet.memorial?.environmentId)}
              houseUrl={resolveHouseModel(pet.memorial?.houseId)}
              parts={partList}
              gifts={previewGifts}
              giftSlots={availableSlots}
              selectedSlot={selectedSlot}
              onSelectSlot={setSelectedSlot}
              colors={colorOverrides}
            />
          </div>
        </div>
      </div>

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
