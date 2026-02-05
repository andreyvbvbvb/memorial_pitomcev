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
import { markerAnchor, markerIconUrl, markerSize, markerStyles } from "../../lib/markers";

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

const defaultCenter = { lat: 55.751244, lng: 37.618423 };
const containerStyle = { width: "100%", height: "676px" };
const petTypeOptions = [{ id: "all", name: "Все виды" }, ...markerStyles];

const matchesFilters = (marker: MarkerDto, typeFilter: string, nameFilter: string) => {
  const normalizedName = nameFilter.trim().toLowerCase();
  const markerType = (marker.markerStyle ?? "other").toLowerCase();
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
  const hasAutoFitRef = useRef(false);

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

  const listMarkers = useMemo(() => {
    const source = boundsReady ? visibleMarkers : markers;
    return source.filter((marker) => matchesFilters(marker, typeFilter, nameFilter));
  }, [boundsReady, visibleMarkers, markers, typeFilter, nameFilter]);

  const hasFilters = typeFilter !== "all" || nameFilter.trim().length > 0;

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

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-200 px-6 py-16">
      <div className="mx-auto w-full max-w-none">
        <div className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Глобальная карта</p>
          <h1 className="text-3xl font-semibold text-slate-900">Мемориалы по всему миру</h1>
          <p className="text-slate-600">
            Это живая карта Google Maps. Маркеры показывают публичные мемориалы.
          </p>
        </div>

        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
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
              className="h-[42px] rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60 md:mt-6"
            >
              Сбросить
            </button>
          </div>
        </div>

        <section className="mt-10 grid gap-6 lg:justify-center lg:grid-cols-[minmax(400px,55%)_minmax(360px,25%)]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Карта</h2>
              <span className="text-xs text-slate-500">Google Maps</span>
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              {!apiKey ? (
                <div className="flex min-h-[676px] items-center justify-center bg-slate-50 text-sm text-slate-500">
                  Укажи NEXT_PUBLIC_GOOGLE_MAPS_API_KEY в .env.local
                </div>
              ) : loadError ? (
                <div className="flex min-h-[676px] items-center justify-center bg-slate-50 text-sm text-red-600">
                  Ошибка загрузки Google Maps
                </div>
              ) : !isLoaded ? (
                <div className="flex min-h-[676px] items-center justify-center bg-slate-50 text-sm text-slate-500">
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
                            className="mb-2 rounded-md object-cover"
                            style={{ width: 180, height: 135 }}
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
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Публичные мемориалы</h2>
              <span className="text-xs text-slate-500">{listMarkers.length}</span>
            </div>
            <div className="mt-4 grid gap-3">
              {loading ? <p className="text-sm text-slate-500">Загрузка...</p> : null}
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
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
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300"
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
                        <span className="text-xs text-slate-400">
                          {marker.lat.toFixed(3)}, {marker.lng.toFixed(3)}
                        </span>
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
        </section>
      </div>
    </main>
  );
}
