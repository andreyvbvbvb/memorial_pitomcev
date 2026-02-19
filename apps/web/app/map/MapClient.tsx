"use client";

import {
  GoogleMap,
  InfoWindow,
  Marker,
  MarkerClusterer,
  useJsApiLoader
} from "@react-google-maps/api";
import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "../../lib/config";
import ErrorToast from "../../components/ErrorToast";
import { markerAnchor, markerBaseId, markerIconUrl, markerSize, markerStyles } from "../../lib/markers";
import MemorialPreview from "../create/MemorialPreview";
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
import { getHouseSlots } from "../../lib/memorial-config";

type MarkerDto = {
  id: string;
  petId: string;
  name: string;
  epitaph: string | null;
  lat: number;
  lng: number;
  markerStyle?: string | null;
  previewPhotoUrl?: string | null;
};

type PetDetail = {
  id: string;
  name: string;
  epitaph: string | null;
  story?: string | null;
  photos?: { id: string; url: string }[];
  memorial?: {
    environmentId: string | null;
    houseId: string | null;
    sceneJson: Record<string, unknown> | null;
  } | null;
};

const defaultCenter = { lat: 55.751244, lng: 37.618423 };
const containerStyle = { width: "100%", height: "100%" };
const petTypeOptions = [{ id: "all", name: "Все виды" }, ...markerStyles];

const matchesFilters = (marker: MarkerDto, typeFilter: string, nameFilter: string) => {
  const normalizedName = nameFilter.trim().toLowerCase();
  const markerType = markerBaseId(marker.markerStyle ?? "other");
  if (typeFilter !== "all" && markerType !== typeFilter) {
    return false;
  }
  if (normalizedName && !marker.name.toLowerCase().includes(normalizedName)) {
    return false;
  }
  return true;
};

export default function MapClient() {
  const [markers, setMarkers] = useState<MarkerDto[]>([]);
  const [visibleMarkers, setVisibleMarkers] = useState<MarkerDto[]>([]);
  const [boundsReady, setBoundsReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<MarkerDto | null>(null);
  const [map, setMap] = useState<any>(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [nameFilter, setNameFilter] = useState("");
  const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<"map" | "carousel">("map");
  const [carouselOrder, setCarouselOrder] = useState<MarkerDto[]>([]);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [carouselAnimating, setCarouselAnimating] = useState<null | "prev" | "next">(null);
  const [petCache, setPetCache] = useState<Record<string, PetDetail>>({});
  const hasAutoFitRef = useRef(false);
  const carouselTimerRef = useRef<number | null>(null);

  const apiUrl = useMemo(() => API_BASE, []);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${apiUrl}/map/markers`);
        if (!response.ok) {
          throw new Error("Не удалось загрузить маркеры");
        }
        const data = (await response.json()) as MarkerDto[];
        setMarkers(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка загрузки");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [apiUrl]);

  const updateVisibleMarkers = (targetMap = map) => {
    if (!targetMap) {
      return;
    }
    const bounds = targetMap.getBounds();
    if (!bounds) {
      return;
    }
    const next = markers.filter((marker) =>
      bounds.contains(new window.google.maps.LatLng(marker.lat, marker.lng))
    );
    setBoundsReady(true);
    setVisibleMarkers(next);
  };

  useEffect(() => {
    if (!map) {
      return;
    }
    updateVisibleMarkers();
  }, [map, markers]);

  const filteredMarkers = useMemo(
    () => markers.filter((marker) => matchesFilters(marker, typeFilter, nameFilter)),
    [markers, typeFilter, nameFilter]
  );

  useEffect(() => {
    if (filteredMarkers.length === 0) {
      setCarouselOrder([]);
      setCarouselIndex(0);
      setCarouselAnimating(null);
      if (carouselTimerRef.current) {
        window.clearTimeout(carouselTimerRef.current);
        carouselTimerRef.current = null;
      }
      return;
    }
    const shuffled = [...filteredMarkers].sort(() => Math.random() - 0.5);
    setCarouselOrder(shuffled);
    setCarouselIndex(0);
    setCarouselAnimating(null);
    if (carouselTimerRef.current) {
      window.clearTimeout(carouselTimerRef.current);
      carouselTimerRef.current = null;
    }
  }, [filteredMarkers]);

  const activeCarouselMarker =
    carouselOrder.length > 0 ? carouselOrder[carouselIndex % carouselOrder.length] ?? null : null;
  const leftCarouselMarker =
    carouselOrder.length > 1
      ? carouselOrder[(carouselIndex - 1 + carouselOrder.length) % carouselOrder.length] ?? null
      : null;
  const rightCarouselMarker =
    carouselOrder.length > 1
      ? carouselOrder[(carouselIndex + 1) % carouselOrder.length] ?? null
      : null;

  const listMarkers = useMemo(() => {
    const source = boundsReady ? visibleMarkers : markers;
    return source.filter((marker) => matchesFilters(marker, typeFilter, nameFilter));
  }, [boundsReady, visibleMarkers, markers, typeFilter, nameFilter]);

  const hasFilters = typeFilter !== "all" || nameFilter.trim().length > 0;

  const modeToggle = (
    <div className="flex rounded-full border border-slate-200 bg-white/80 p-1 text-[11px] text-slate-600 shadow-sm">
      <button
        type="button"
        onClick={() => setMapMode("map")}
        className={`rounded-full px-3 py-1 transition ${
          mapMode === "map" ? "bg-slate-900 text-white" : "hover:bg-slate-100"
        }`}
      >
        Карта
      </button>
      <button
        type="button"
        onClick={() => setMapMode("carousel")}
        className={`rounded-full px-3 py-1 transition ${
          mapMode === "carousel" ? "bg-slate-900 text-white" : "hover:bg-slate-100"
        }`}
      >
        3D
      </button>
    </div>
  );

  useEffect(() => {
    if (active && !filteredMarkers.some((marker) => marker.id === active.id)) {
      setActive(null);
    }
  }, [active, filteredMarkers]);

  useEffect(() => {
    if (!map || markers.length === 0 || hasAutoFitRef.current) {
      return;
    }
    const bounds = new window.google.maps.LatLngBounds();
    markers.forEach((marker) => {
      bounds.extend({ lat: marker.lat, lng: marker.lng });
    });
    map.fitBounds(bounds);
    hasAutoFitRef.current = true;
  }, [map, markers]);

  const smoothZoom = (targetZoom: number) => {
    if (!map) {
      return;
    }
    const current = map.getZoom() ?? 3;
    if (current === targetZoom) {
      return;
    }
    const step = current < targetZoom ? 1 : -1;
    const tick = () => {
      const zoom = map.getZoom() ?? current;
      if ((step > 0 && zoom >= targetZoom) || (step < 0 && zoom <= targetZoom)) {
        return;
      }
      map.setZoom(zoom + step);
      window.setTimeout(tick, 80);
    };
    tick();
  };

  const handleClusterClick = (cluster: any) => {
    if (!map || !cluster?.getBounds) {
      return;
    }
    const bounds = cluster.getBounds();
    const center = bounds.getCenter();
    map.panTo(center);
    window.setTimeout(() => {
      map.fitBounds(bounds, 80);
      window.setTimeout(() => {
        const zoom = map.getZoom();
        if (typeof zoom === "number") {
          smoothZoom(Math.min(zoom + 1, 18));
        }
      }, 250);
    }, 150);
  };

  const loadPetDetail = async (petId: string) => {
    if (petCache[petId]) {
      return;
    }
    try {
      const response = await fetch(`${apiUrl}/pets/${petId}`);
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as PetDetail;
      setPetCache((prev) => ({ ...prev, [petId]: data }));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (mapMode !== "carousel") {
      return;
    }
    const ids = [activeCarouselMarker, leftCarouselMarker, rightCarouselMarker]
      .map((item) => item?.petId)
      .filter((id): id is string => Boolean(id));
    ids.forEach((id) => {
      void loadPetDetail(id);
    });
  }, [mapMode, activeCarouselMarker, leftCarouselMarker, rightCarouselMarker]);

  const renderMemorialPreview = (
    marker: MarkerDto | null,
    className: string,
    dimmed?: boolean
  ) => {
    if (!marker) {
      return (
        <div className={`flex h-full items-center justify-center rounded-3xl bg-white/60 ${className}`}>
          <span className="text-xs text-slate-500">Нет мемориалов</span>
        </div>
      );
    }
    const pet = petCache[marker.petId];
    const memorial = pet?.memorial;
    const environmentUrl = resolveEnvironmentModel(memorial?.environmentId);
    const houseUrl = resolveHouseModel(memorial?.houseId);
    if (!environmentUrl || !houseUrl) {
      return (
        <div className={`flex h-full items-center justify-center rounded-3xl bg-white/60 ${className}`}>
          <span className="text-xs text-slate-500">Загрузка модели...</span>
        </div>
      );
    }
    const houseSlots = getHouseSlots(memorial?.houseId);
    const sceneJson = (memorial?.sceneJson ?? {}) as {
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
    const parts = [
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

    return (
      <div className={`${className} ${dimmed ? "opacity-40" : ""}`}>
        <MemorialPreview
          terrainUrl={environmentUrl}
          houseUrl={houseUrl}
          parts={parts}
          colors={sceneJson.colors ?? undefined}
          softEdges
          showControls={false}
          controlsEnabled={false}
          className="h-full"
        />
      </div>
    );
  };

  const startCarouselAnimation = (direction: "prev" | "next") => {
    if (carouselOrder.length < 2 || carouselAnimating) {
      return;
    }
    setCarouselAnimating(direction);
    if (carouselTimerRef.current) {
      window.clearTimeout(carouselTimerRef.current);
    }
    carouselTimerRef.current = window.setTimeout(() => {
      setCarouselIndex((prev) =>
        direction === "next"
          ? (prev + 1) % carouselOrder.length
          : (prev - 1 + carouselOrder.length) % carouselOrder.length
      );
      setCarouselAnimating(null);
    }, 520);
  };

  useEffect(() => {
    return () => {
      if (carouselTimerRef.current) {
        window.clearTimeout(carouselTimerRef.current);
        carouselTimerRef.current = null;
      }
    };
  }, []);

  const handleCarouselPrev = () => startCarouselAnimation("prev");
  const handleCarouselNext = () => startCarouselAnimation("next");

  const activeCarouselPet = activeCarouselMarker ? petCache[activeCarouselMarker.petId] : null;
  const activePreviewUrl = activeCarouselMarker?.previewPhotoUrl;
  const activePreviewSrc = activePreviewUrl
    ? activePreviewUrl.startsWith("http")
      ? activePreviewUrl
      : `${apiUrl}${activePreviewUrl}`
    : null;
  const carouselTranslate =
    carouselAnimating === "prev"
      ? "translateX(0%)"
      : carouselAnimating === "next"
        ? "translateX(-66.6667%)"
        : "translateX(-33.3333%)";

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-slate-50">
      <div className="absolute inset-0">
        {mapMode === "map" ? (
          !apiKey ? (
            <div className="flex h-full items-center justify-center bg-slate-50 text-sm text-slate-500">
              Укажи NEXT_PUBLIC_GOOGLE_MAPS_API_KEY в .env.local
            </div>
          ) : loadError ? (
            <div className="flex h-full items-center justify-center bg-slate-50 text-sm text-red-600">
              Ошибка загрузки Google Maps
            </div>
          ) : !isLoaded ? (
            <div className="flex h-full items-center justify-center bg-slate-50 text-sm text-slate-500">
              Загрузка карты...
            </div>
          ) : (
            <GoogleMap
              mapContainerStyle={containerStyle}
              onLoad={(loadedMap) => {
                setMap(loadedMap);
                loadedMap.setCenter(defaultCenter);
                loadedMap.setZoom(4);
                updateVisibleMarkers(loadedMap);
              }}
              onIdle={() => {
                updateVisibleMarkers();
              }}
              options={{
                mapTypeControl: false,
                fullscreenControl: false,
                streetViewControl: false
              }}
            >
              <MarkerClusterer
                options={{
                  averageCenter: true,
                  minimumClusterSize: 4,
                  zoomOnClick: false
                }}
                onClick={handleClusterClick}
              >
                {(clusterer) => (
                  <>
                    {filteredMarkers.map((marker) => (
                      <Marker
                        key={marker.id}
                        position={{ lat: marker.lat, lng: marker.lng }}
                        clusterer={clusterer}
                        animation={
                          hoveredMarkerId === marker.id && typeof window !== "undefined" && window.google
                            ? window.google.maps.Animation.BOUNCE
                            : undefined
                        }
                        icon={{
                          url: markerIconUrl(marker.markerStyle ?? "other"),
                          scaledSize: new window.google.maps.Size(
                            markerSize(marker.markerStyle ?? "other", 43).width,
                            markerSize(marker.markerStyle ?? "other", 43).height
                          ),
                          anchor: new window.google.maps.Point(
                            markerAnchor(marker.markerStyle ?? "other", 43).x,
                            markerAnchor(marker.markerStyle ?? "other", 43).y
                          )
                        }}
                        onClick={() => setActive(marker)}
                      />
                    ))}
                  </>
                )}
              </MarkerClusterer>
              {active ? (
                <InfoWindow
                  position={{ lat: active.lat, lng: active.lng }}
                  onCloseClick={() => setActive(null)}
                  options={{ maxWidth: 260 }}
                >
                  <div className="max-w-[240px] text-sm">
                    {active.previewPhotoUrl ? (
                      <img
                        src={
                          active.previewPhotoUrl.startsWith("http")
                            ? active.previewPhotoUrl
                            : `${apiUrl}${active.previewPhotoUrl}`
                        }
                        alt="Фото питомца"
                        className="mb-2 w-full rounded-md object-contain"
                        style={{ maxHeight: 160 }}
                        loading="lazy"
                      />
                    ) : null}
                    <p className="font-semibold text-slate-900">{active.name}</p>
                    <p className="text-slate-600">{active.epitaph ?? "Без эпитафии"}</p>
                    <a className="mt-2 inline-block text-slate-900 underline" href={`/pets/${active.petId}`}>
                      Открыть мемориал
                    </a>
                  </div>
                </InfoWindow>
              ) : null}
            </GoogleMap>
          )
        ) : (
          <div className="h-full w-full bg-gradient-to-b from-slate-50 via-white to-slate-100" />
        )}
      </div>

      <div className="relative z-10 h-full w-full pointer-events-none">
        {mapMode === "map" ? (
          <div className="flex h-full w-full flex-col gap-6 p-6 lg:flex-row lg:items-start">
            <div className="pointer-events-auto flex h-full flex-col gap-4">
              <div className="flex min-h-[260px] w-full max-w-[320px] flex-col gap-4 rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-sm backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-slate-900">Фильтры</h2>
                  {modeToggle}
                </div>
                <label className="grid gap-1 text-sm text-slate-700">
                  Вид питомца
                  <select
                    className="rounded-2xl border border-slate-200 px-4 py-2"
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value)}
                  >
                    {petTypeOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm text-slate-700">
                  Имя питомца
                  <input
                    className="rounded-2xl border border-slate-200 px-4 py-2"
                    value={nameFilter}
                    onChange={(event) => setNameFilter(event.target.value)}
                    placeholder="Барсик"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setTypeFilter("all");
                    setNameFilter("");
                  }}
                  disabled={!hasFilters}
                  className="mt-auto self-start rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Сбросить
                </button>
              </div>
            </div>
            <div className="hidden flex-1 lg:flex" />
            <div className="pointer-events-auto relative z-10 flex max-h-[78vh] w-full max-w-[360px] flex-col self-start rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Мемориалы</h2>
                <span className="text-xs text-slate-500">{listMarkers.length}</span>
              </div>
              <div className="mt-4 flex-1 overflow-y-auto pr-1">
                <div className="grid gap-3">
                  {loading ? <p className="text-sm text-slate-500">Загрузка...</p> : null}
                  {!loading && !error && listMarkers.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      {hasFilters
                        ? "По заданным фильтрам ничего не найдено."
                        : boundsReady
                          ? "В выбранной области нет мемориалов."
                          : "Пока нет публичных мемориалов."}
                    </p>
                  ) : null}
                  {listMarkers.map((marker) => (
                    <a
                      key={marker.id}
                      href={`/pets/${marker.petId}`}
                      onMouseEnter={() => setHoveredMarkerId(marker.id)}
                      onMouseLeave={() => setHoveredMarkerId(null)}
                      onFocus={() => setHoveredMarkerId(marker.id)}
                      onBlur={() => setHoveredMarkerId(null)}
                      className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4 transition hover:border-slate-300"
                    >
                      <div className="flex items-center gap-3">
                        {marker.previewPhotoUrl ? (
                          <img
                            src={
                              marker.previewPhotoUrl.startsWith("http")
                                ? marker.previewPhotoUrl
                                : `${apiUrl}${marker.previewPhotoUrl}`
                            }
                            alt="Фото питомца"
                            className="rounded-xl object-cover"
                            style={{ width: 44, height: 44 }}
                            loading="lazy"
                          />
                        ) : (
                          <div className="rounded-xl bg-slate-200" style={{ width: 44, height: 44 }} />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold text-slate-900">{marker.name}</h3>
                          </div>
                          <p className="mt-1 text-xs text-slate-600">
                            {marker.epitaph ?? "Без эпитафии"}
                          </p>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full w-full flex-col gap-6 p-6">
            <div className="pointer-events-auto mx-auto w-full max-w-4xl rounded-3xl border border-slate-200 bg-white/85 p-4 shadow-sm backdrop-blur">
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
                <label className="grid gap-1 text-sm text-slate-700">
                  Вид питомца
                  <select
                    className="rounded-2xl border border-slate-200 px-4 py-2"
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value)}
                  >
                    {petTypeOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm text-slate-700">
                  Имя питомца
                  <input
                    className="rounded-2xl border border-slate-200 px-4 py-2"
                    value={nameFilter}
                    onChange={(event) => setNameFilter(event.target.value)}
                    placeholder="Барсик"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setTypeFilter("all");
                    setNameFilter("");
                  }}
                  disabled={!hasFilters}
                  className="h-[42px] rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Сбросить
                </button>
                <div className="flex justify-start md:justify-end">{modeToggle}</div>
              </div>
            </div>
            <div className="flex flex-1 items-center justify-center gap-8">
              <div className="flex flex-1 flex-col items-center justify-center">
                <div className="relative h-[60vh] w-full max-w-5xl overflow-hidden">
                  <div
                    className={`flex h-full w-[300%] ${
                      carouselAnimating ? "transition-transform duration-500 ease-out" : ""
                    }`}
                    style={{ transform: carouselTranslate }}
                  >
                    <div className="flex h-full w-1/3 items-center justify-center px-4">
                      <button
                        type="button"
                        aria-label="Предыдущий мемориал"
                        onClick={handleCarouselPrev}
                        className="pointer-events-auto h-[80%] w-full max-w-[260px] cursor-pointer rounded-3xl border-0 bg-transparent p-0 transition-transform duration-300 hover:scale-[0.98]"
                      >
                        {renderMemorialPreview(leftCarouselMarker, "h-full pointer-events-none", true)}
                      </button>
                    </div>
                    <div className="flex h-full w-1/3 items-center justify-center px-4">
                      <div className="pointer-events-none h-full w-full max-w-[420px]">
                        {renderMemorialPreview(activeCarouselMarker, "h-full", false)}
                      </div>
                    </div>
                    <div className="flex h-full w-1/3 items-center justify-center px-4">
                      <button
                        type="button"
                        aria-label="Следующий мемориал"
                        onClick={handleCarouselNext}
                        className="pointer-events-auto h-[80%] w-full max-w-[260px] cursor-pointer rounded-3xl border-0 bg-transparent p-0 transition-transform duration-300 hover:scale-[0.98]"
                      >
                        {renderMemorialPreview(rightCarouselMarker, "h-full pointer-events-none", true)}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="pointer-events-auto mt-4 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={handleCarouselPrev}
                    className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm text-slate-700 shadow-sm transition hover:border-slate-300"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={handleCarouselNext}
                    className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm text-slate-700 shadow-sm transition hover:border-slate-300"
                  >
                    →
                  </button>
                </div>
              </div>
              <div className="pointer-events-auto w-[320px] rounded-3xl border border-slate-200 bg-white/85 p-5 shadow-sm backdrop-blur">
                {activeCarouselMarker ? (
                  <div className="grid gap-3">
                    {activePreviewSrc ? (
                      <img
                        src={activePreviewSrc}
                        alt="Фото питомца"
                        className="h-44 w-full rounded-2xl object-contain"
                        loading="lazy"
                      />
                    ) : null}
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        {activeCarouselMarker.name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {activeCarouselMarker.epitaph ?? "Без эпитафии"}
                      </p>
                    </div>
                    {activeCarouselPet?.story ? (
                      <p className="text-xs text-slate-500 line-clamp-4">{activeCarouselPet.story}</p>
                    ) : null}
                    <a
                      className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white"
                      href={`/pets/${activeCarouselMarker.petId}`}
                    >
                      Открыть мемориал
                    </a>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Нет мемориалов</p>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="pointer-events-auto absolute bottom-6 right-6">
          <ErrorToast message={error} onClose={() => setError(null)} />
        </div>
      </div>
    </main>
  );
}
