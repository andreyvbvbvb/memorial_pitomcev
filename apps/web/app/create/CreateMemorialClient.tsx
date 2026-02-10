"use client";

import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../../lib/config";
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
} from "../../lib/memorial-models";
import {
  firstMarkerVariantId,
  markerAnchor,
  markerIconUrl,
  markerSize,
  markerStyleById,
  markerStyles,
  markerVariantsForSpecies
} from "../../lib/markers";
import MemorialPreview from "./MemorialPreview";
import { getHouseSlots } from "../../lib/memorial-config";
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
const defaultCenter = { lat: 55.751244, lng: 37.618423 };
const mapContainerStyle = { width: "100%", height: "60vh" };
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
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [previewPhotoId, setPreviewPhotoId] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<"desktop" | "mobile">("desktop");
  const photosRef = useRef<PhotoDraft[]>([]);

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
  const environmentUrl = resolveEnvironmentModel(form.environmentId);
  const houseUrl = resolveHouseModel(form.houseId);
  const houseSlots = getHouseSlots(form.houseId);
  const roofUrl = resolveRoofModel(form.roofId);
  const wallUrl = resolveWallModel(form.wallId);
  const signUrl = resolveSignModel(form.signId);
  const frameLeftUrl = resolveFrameLeftModel(form.frameLeftId);
  const frameRightUrl = resolveFrameRightModel(form.frameRightId);
  const matUrl = resolveMatModel(form.matId);
  const bowlFoodUrl = resolveBowlFoodModel(form.bowlFoodId);
  const bowlWaterUrl = resolveBowlWaterModel(form.bowlWaterId);
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
    return () => {
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url));
    };
  }, []);

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
      environmentId: form.environmentId,
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
          {loading ? "Публикация..." : "Опубликовать мемориал"}
        </button>
      )}
    </div>
  );

  const optionImage = (category: string, id: string) =>
    `/memorial/options/${category}/${id}.png`;

  const renderOptionGrid = (
    category: string,
    options: typeof environmentOptions,
    selectedId: string,
    onSelect: (id: string) => void
  ) => (
    <div className="flex flex-wrap gap-3">
      {options.map((option) => {
        const isSelected = selectedId === option.id;
        const imageUrl = option.id === "none" ? null : optionImage(category, option.id);
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            aria-label={option.name}
            title={option.name}
            className={`rounded-2xl border p-2 ${
              isSelected ? "border-slate-900 bg-slate-900" : "border-slate-200 bg-white"
            }`}
            style={{ width: 112, height: 112 }}
          >
            <div className="flex h-[100px] w-[100px] items-center justify-center overflow-hidden rounded-xl bg-slate-100">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={option.name}
                  className="h-[100px] w-[100px] object-contain"
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

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-200 px-6 py-16">
      <div
        className={`mx-auto ${
          step === 2 ? "w-full max-w-none lg:w-[75vw]" : "max-w-5xl"
        }`}
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Создание мемориала</p>
          <h1 className="text-3xl font-semibold text-slate-900">
            Пошаговый мастер
          </h1>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
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

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
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
                    className="rounded-2xl border border-slate-200 px-4 py-2"
                    value={form.birthDate}
                    onChange={(event) => handleChange("birthDate", event.target.value)}
                  />
                </label>
                <label className="grid gap-1 text-sm text-slate-700">
                  Дата ухода
                  <input
                    type="date"
                    className="rounded-2xl border border-slate-200 px-4 py-2"
                    value={form.deathDate}
                    onChange={(event) => handleChange("deathDate", event.target.value)}
                  />
                </label>
              </div>
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
                      <div className="flex flex-wrap gap-2">
                        {markerGroups.primary.map((marker) => {
                          const markerName = markerStyleById(marker.baseId).name;
                          return (
                            <button
                              key={marker.id}
                              type="button"
                              onClick={() => handleChange("markerStyle", marker.id)}
                              className={`flex items-center justify-center rounded-2xl border px-3 py-3 ${
                                form.markerStyle === marker.id
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-slate-200 bg-white text-slate-700"
                              }`}
                            >
                              <span
                                className="overflow-hidden rounded-2xl bg-slate-100"
                                style={{ width: 80, height: 80 }}
                              >
                                <img
                                  src={marker.url}
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
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Остальные виды
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {markerGroups.secondary.map((marker) => {
                          const markerName = markerStyleById(marker.baseId).name;
                          return (
                            <button
                              key={marker.id}
                              type="button"
                              onClick={() => handleChange("markerStyle", marker.id)}
                              className={`flex items-center justify-center rounded-2xl border px-3 py-3 ${
                                form.markerStyle === marker.id
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-slate-200 bg-white text-slate-700"
                              }`}
                            >
                              <span
                                className="overflow-hidden rounded-2xl bg-slate-100"
                                style={{ width: 80, height: 80 }}
                              >
                                <img
                                  src={marker.url}
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
            <div className="grid gap-3">
              <div className="flex justify-end px-4 lg:px-[2.5%]">
                <button
                  type="button"
                  onClick={() =>
                    setLayoutMode((prev) => (prev === "mobile" ? "desktop" : "mobile"))
                  }
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  {isMobile ? "Переключить на десктоп" : "Переключить на мобильную"}
                </button>
              </div>
              <div
                className={isMobile ? "flex flex-col gap-4" : "grid gap-6"}
                style={
                  isMobile
                    ? undefined
                    : {
                        gridTemplateColumns: "60% 35%",
                        columnGap: "5%",
                        paddingLeft: "2.5%",
                        paddingRight: "2.5%"
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
                    parts={partList}
                    colors={colorOverrides}
                    style={
                      isMobile
                        ? { height: "40vh", minHeight: "280px" }
                        : { height: "calc(100vh - 240px)", minHeight: "520px" }
                    }
                  />
                </div>

                <div
                  className={`grid gap-6 overflow-y-auto ${
                    isMobile ? "max-h-[45vh] px-4 pb-6" : "max-h-[70vh] pr-2"
                  }`}
                >
                <div className="grid gap-3">
                  <h2 className="text-base font-semibold text-slate-900">Поверхность</h2>
                  {renderOptionGrid("environment", environmentOptions, form.environmentId, (id) =>
                    handleChange("environmentId", id)
                  )}
                </div>

                <div className="grid gap-3">
                  <h2 className="text-base font-semibold text-slate-900">Домик</h2>
                  {renderOptionGrid("house", houseOptions, form.houseId, (id) =>
                    handleChange("houseId", id)
                  )}
                </div>

                {houseSlots.roof ? (
                  <div className="grid gap-3">
                    <h2 className="text-base font-semibold text-slate-900">Крыша домика</h2>
                    {renderOptionGrid("roof", roofOptions, form.roofId, (id) =>
                      handleChange("roofId", id)
                    )}
                  </div>
                ) : null}

                {houseSlots.roof ? (
                  <div className="grid gap-3">
                    <h2 className="text-base font-semibold text-slate-900">Цвет крыши домика</h2>
                    <div className="flex flex-wrap gap-2">
                      {colorPalette.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => handleChange("roofColor", color)}
                          className={`h-[35px] w-[35px] rounded-lg border-2 ${
                            form.roofColor === color ? "border-slate-900" : "border-transparent"
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {houseSlots.wall ? (
                  <div className="grid gap-3">
                    <h2 className="text-base font-semibold text-slate-900">Стены домика</h2>
                    {renderOptionGrid("wall", wallOptions, form.wallId, (id) =>
                      handleChange("wallId", id)
                    )}
                  </div>
                ) : null}

                {houseSlots.wall ? (
                  <div className="grid gap-3">
                    <h2 className="text-base font-semibold text-slate-900">Цвет стен домика</h2>
                    <div className="flex flex-wrap gap-2">
                      {colorPalette.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => handleChange("wallColor", color)}
                          className={`h-[35px] w-[35px] rounded-lg border-2 ${
                            form.wallColor === color ? "border-slate-900" : "border-transparent"
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {houseSlots.sign ? (
                  <div className="grid gap-3">
                    <h2 className="text-base font-semibold text-slate-900">Украшение над входом</h2>
                    {renderOptionGrid("sign", signOptions, form.signId, (id) =>
                      handleChange("signId", id)
                    )}
                  </div>
                ) : null}

                {houseSlots.sign ? (
                  <div className="grid gap-3">
                    <h2 className="text-base font-semibold text-slate-900">Цвет украшения</h2>
                    <div className="flex flex-wrap gap-2">
                      {colorPalette.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => handleChange("signColor", color)}
                          className={`h-[35px] w-[35px] rounded-lg border-2 ${
                            form.signColor === color ? "border-slate-900" : "border-transparent"
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {houseSlots.frameLeft ? (
                  <div className="grid gap-3">
                    <h2 className="text-base font-semibold text-slate-900">Рамка слева</h2>
                    {renderOptionGrid("frame-left", frameLeftOptions, form.frameLeftId, (id) =>
                      handleChange("frameLeftId", id)
                    )}
                  </div>
                ) : null}

                {houseSlots.frameLeft ? (
                  <div className="grid gap-3">
                    <h2 className="text-base font-semibold text-slate-900">Цвет рамки слева</h2>
                    <div className="flex flex-wrap gap-2">
                      {colorPalette.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => handleChange("frameLeftColor", color)}
                          className={`h-[35px] w-[35px] rounded-lg border-2 ${
                            form.frameLeftColor === color ? "border-slate-900" : "border-transparent"
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {houseSlots.frameRight ? (
                  <div className="grid gap-3">
                    <h2 className="text-base font-semibold text-slate-900">Рамка справа</h2>
                    {renderOptionGrid("frame-right", frameRightOptions, form.frameRightId, (id) =>
                      handleChange("frameRightId", id)
                    )}
                  </div>
                ) : null}

                {houseSlots.frameRight ? (
                  <div className="grid gap-3">
                    <h2 className="text-base font-semibold text-slate-900">Цвет рамки справа</h2>
                    <div className="flex flex-wrap gap-2">
                      {colorPalette.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => handleChange("frameRightColor", color)}
                          className={`h-[35px] w-[35px] rounded-lg border-2 ${
                            form.frameRightColor === color ? "border-slate-900" : "border-transparent"
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {houseSlots.mat ? (
                  <div className="grid gap-3">
                    <h2 className="text-base font-semibold text-slate-900">Коврик</h2>
                    {renderOptionGrid("mat", matOptions, form.matId, (id) =>
                      handleChange("matId", id)
                    )}
                  </div>
                ) : null}

                {houseSlots.mat ? (
                  <div className="grid gap-3">
                    <h2 className="text-base font-semibold text-slate-900">Цвет коврика</h2>
                    <div className="flex flex-wrap gap-2">
                      {colorPalette.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => handleChange("matColor", color)}
                          className={`h-[35px] w-[35px] rounded-lg border-2 ${
                            form.matColor === color ? "border-slate-900" : "border-transparent"
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {houseSlots.bowlFood ? (
                  <div className="grid gap-3">
                    <h2 className="text-base font-semibold text-slate-900">Миска с едой</h2>
                    {renderOptionGrid("bowl-food", bowlFoodOptions, form.bowlFoodId, (id) =>
                      handleChange("bowlFoodId", id)
                    )}
                  </div>
                ) : null}

                {houseSlots.bowlFood ? (
                  <div className="grid gap-3">
                    <h2 className="text-base font-semibold text-slate-900">Цвет миски с едой</h2>
                    <div className="flex flex-wrap gap-2">
                      {colorPalette.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => handleChange("bowlFoodColor", color)}
                          className={`h-[35px] w-[35px] rounded-lg border-2 ${
                            form.bowlFoodColor === color ? "border-slate-900" : "border-transparent"
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {houseSlots.bowlWater ? (
                  <div className="grid gap-3">
                    <h2 className="text-base font-semibold text-slate-900">Миска с водой</h2>
                    {renderOptionGrid("bowl-water", bowlWaterOptions, form.bowlWaterId, (id) =>
                      handleChange("bowlWaterId", id)
                    )}
                  </div>
                ) : null}

                {houseSlots.bowlWater ? (
                  <div className="grid gap-3">
                    <h2 className="text-base font-semibold text-slate-900">Цвет миски с водой</h2>
                    <div className="flex flex-wrap gap-2">
                      {colorPalette.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => handleChange("bowlWaterColor", color)}
                          className={`h-[35px] w-[35px] rounded-lg border-2 ${
                            form.bowlWaterColor === color ? "border-slate-900" : "border-transparent"
                          }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
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
                  parts={partList}
                  colors={colorOverrides}
                  className="h-[648px]"
                />
              </div>
            </div>
          ) : null}
        </section>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <div className={`mt-6 ${step === 2 && isMobile ? "hidden" : ""}`}>
          {renderNavButtons()}
        </div>
      </div>
    </main>
  );
}
