"use client";

import {
  GoogleMap,
  InfoWindow,
  Marker,
  MarkerClusterer,
  useJsApiLoader
} from "@react-google-maps/api";
import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../lib/config";
import { markerAnchor, markerIconUrl, markerSize, markerStyleById } from "../../lib/markers";

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
const containerStyle = { width: "100%", height: "520px" };

export default function MapClient() {
  const [markers, setMarkers] = useState<MarkerDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<MarkerDto | null>(null);
  const [map, setMap] = useState<any>(null);

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

  const center = markers.length
    ? { lat: markers[0].lat, lng: markers[0].lng }
    : defaultCenter;


  useEffect(() => {
    if (!map || markers.length === 0) {
      return;
    }
    const bounds = new window.google.maps.LatLngBounds();
    markers.forEach((marker) => {
      bounds.extend({ lat: marker.lat, lng: marker.lng });
    });
    map.fitBounds(bounds);
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
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Глобальная карта</p>
          <h1 className="text-3xl font-semibold text-slate-900">Мемориалы по всему миру</h1>
          <p className="text-slate-600">
            Это живая карта Google Maps. Маркеры показывают публичные мемориалы.
          </p>
        </div>

        <section className="mt-10 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Карта</h2>
              <span className="text-xs text-slate-500">Google Maps</span>
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              {!apiKey ? (
                <div className="flex min-h-[520px] items-center justify-center bg-slate-50 text-sm text-slate-500">
                  Укажи NEXT_PUBLIC_GOOGLE_MAPS_API_KEY в .env.local
                </div>
              ) : loadError ? (
                <div className="flex min-h-[520px] items-center justify-center bg-slate-50 text-sm text-red-600">
                  Ошибка загрузки Google Maps
                </div>
              ) : !isLoaded ? (
                <div className="flex min-h-[520px] items-center justify-center bg-slate-50 text-sm text-slate-500">
                  Загрузка карты...
                </div>
              ) : (
                <GoogleMap
                  mapContainerStyle={containerStyle}
                  center={center}
                  zoom={4}
                  onLoad={(loadedMap) => setMap(loadedMap)}
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
                    {(clusterer) =>
                      markers.map((marker) => (
                        <Marker
                          key={marker.id}
                          position={{ lat: marker.lat, lng: marker.lng }}
                          clusterer={clusterer}
                          icon={{
                            url:
                              marker.markerStyle
                                ? markerIconUrl(marker.markerStyle)
                                : markerIconUrl(markerStyleById(marker.markerStyle).color),
                            scaledSize: new window.google.maps.Size(
                              markerSize(marker.markerStyle, 43).width,
                              markerSize(marker.markerStyle, 43).height
                            ),
                            anchor: new window.google.maps.Point(
                              markerAnchor(marker.markerStyle, 43).x,
                              markerAnchor(marker.markerStyle, 43).y
                            )
                          }}
                          onClick={() => setActive(marker)}
                        />
                      ))
                    }
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
              <span className="text-xs text-slate-500">{markers.length}</span>
            </div>
            <div className="mt-4 grid gap-3">
              {loading ? <p className="text-sm text-slate-500">Загрузка...</p> : null}
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              {!loading && !error && markers.length === 0 ? (
                <p className="text-sm text-slate-500">Пока нет публичных мемориалов.</p>
              ) : null}
              {markers.map((marker) => (
                <a
                  key={marker.id}
                  href={`/pets/${marker.petId}`}
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
