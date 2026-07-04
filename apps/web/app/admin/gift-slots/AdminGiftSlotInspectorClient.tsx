"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as THREE from "three";
import { API_BASE } from "../../../lib/config";
import { canAccessAdmin, type AccessLevel } from "../../../lib/access";
import { ensureDracoLoader } from "../../../lib/draco";
import { environmentOptions } from "../../../lib/memorial-options";
import {
  getEnvironmentSeasons,
  resolveEnvironmentModel,
  type SeasonKey,
} from "../../../lib/memorial-models";
import {
  getGiftAvailableTypes,
  getGiftCode,
  getGiftSlotType,
  giftSupportsSize,
  isGiftSlotName,
  resolveGiftIconUrl,
  resolveGiftModelUrl,
  resolveGiftScaleMultiplier,
  resolveGiftSizeMultiplier,
  resolveGiftTargetWidth,
  type GiftSize,
} from "../../../lib/gifts";
import { resolveObjectTransformInParent } from "../../../lib/three-transforms";
import ErrorToast from "../../../components/ErrorToast";
import GiftFlames from "../../../components/GiftFlames";
import TunedSkyDome from "../../../components/TunedSkyDome";
import AdminGiftPlacementManager from "./AdminGiftPlacementManager";

ensureDracoLoader();

const Primitive = "primitive" as unknown as React.ComponentType<any>;
const Color = "color" as unknown as React.ComponentType<any>;
const AmbientLight = "ambientLight" as unknown as React.ComponentType<any>;
const DirectionalLight =
  "directionalLight" as unknown as React.ComponentType<any>;
const HemisphereLight =
  "hemisphereLight" as unknown as React.ComponentType<any>;

type GiftCatalogItem = {
  id: string;
  code?: string | null;
  name: string;
  description?: string | null;
  price: number;
  modelUrl: string;
};

type GiftTypeFilter = "all" | "flower" | "candle" | "meal" | "toy" | "star";

const GIFT_TYPE_FILTERS: { id: GiftTypeFilter; label: string }[] = [
  { id: "all", label: "Все подарки" },
  { id: "flower", label: "Цветы" },
  { id: "candle", label: "Свечи" },
  { id: "meal", label: "Угощения" },
  { id: "toy", label: "Игрушки" },
  { id: "star", label: "Звёзды" },
];

const SEASON_LABELS: Record<SeasonKey, string> = {
  spring: "Весна",
  summer: "Лето",
  autumn: "Осень",
  winter: "Зима",
};

const FALLBACK_GIFT_ICON =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'><rect width='128' height='128' rx='22' fill='%23f7f1ee'/><path d='M64 27l10 21 23 3-17 16 4 23-20-11-20 11 4-23-17-16 23-3 10-21z' fill='%23d3a27f'/></svg>";

const isGiftCompatibleWithSlot = (
  gift: GiftCatalogItem | null,
  slot: string,
) => {
  if (!gift) {
    return false;
  }
  const slotType = getGiftSlotType(slot);
  const giftTypes = getGiftAvailableTypes(gift);
  return (
    !slotType ||
    slotType === "default" ||
    giftTypes.includes("default") ||
    giftTypes.includes(slotType)
  );
};

const applyGiftScale = (target: THREE.Object3D, width: number) => {
  if (!Number.isFinite(width) || width <= 0) {
    return;
  }
  const box = new THREE.Box3().setFromObject(target);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (size.x <= 0) {
    return;
  }
  target.scale.setScalar(width / size.x);
};

function GiftAtSlot({
  terrain,
  slot,
  url,
  gift,
  size,
}: {
  terrain: THREE.Object3D;
  slot: string;
  url: string;
  gift: GiftCatalogItem;
  size: GiftSize;
}) {
  const { scene } = useGLTF(url);
  const model = useMemo(() => {
    const cloned = scene.clone(true);
    const targetWidth = resolveGiftTargetWidth(gift);
    if (targetWidth) {
      applyGiftScale(cloned, targetWidth);
    }
    const sizeMultiplier = resolveGiftSizeMultiplier({ gift, size });
    if (sizeMultiplier !== 1) {
      cloned.scale.multiplyScalar(sizeMultiplier);
    }
    const configuredMultiplier = resolveGiftScaleMultiplier(gift);
    if (configuredMultiplier !== 1) {
      cloned.scale.multiplyScalar(configuredMultiplier);
    }
    return cloned;
  }, [gift, scene, size]);
  const baseQuaternion = useMemo(() => model.quaternion.clone(), [model]);

  useEffect(() => {
    const anchor = terrain.getObjectByName(slot);
    if (!anchor) {
      return;
    }
    const { position, quaternion } = resolveObjectTransformInParent(
      anchor,
      terrain,
    );
    model.position.copy(position);
    model.quaternion.copy(quaternion).multiply(baseQuaternion);
    terrain.add(model);
    return () => {
      terrain.remove(model);
    };
  }, [baseQuaternion, model, slot, terrain]);

  return <GiftFlames root={model} />;
}

function InspectorTerrain({
  terrainUrl,
  gift,
  size,
  onSlotsDetected,
  onReady,
}: {
  terrainUrl: string;
  gift: GiftCatalogItem | null;
  size: GiftSize;
  onSlotsDetected: (slots: string[]) => void;
  onReady: () => void;
}) {
  const { scene } = useGLTF(terrainUrl);
  const terrain = useMemo(() => scene.clone(true), [scene]);
  const slots = useMemo(() => {
    const detected: string[] = [];
    terrain.traverse((node) => {
      if (isGiftSlotName(node.name)) {
        detected.push(node.name);
      }
    });
    return Array.from(new Set(detected)).sort((left, right) =>
      left.localeCompare(right, "ru", { numeric: true }),
    );
  }, [terrain]);
  const placements = useMemo(() => {
    if (!gift) {
      return [];
    }
    return slots
      .filter((slot) => isGiftCompatibleWithSlot(gift, slot))
      .map((slot) => {
        const slotType = getGiftSlotType(slot);
        const url = resolveGiftModelUrl({
          gift,
          slotType,
          fallbackUrl: gift.modelUrl,
        });
        return url ? { slot, url } : null;
      })
      .filter(
        (placement): placement is { slot: string; url: string } =>
          Boolean(placement),
      );
  }, [gift, slots]);

  useEffect(() => {
    onSlotsDetected(slots);
    onReady();
  }, [onReady, onSlotsDetected, slots]);

  return (
    <>
      <Primitive object={terrain} />
      {gift
        ? placements.map((placement) => (
            <GiftAtSlot
              key={`${gift.id}:${placement.slot}:${placement.url}:${size}`}
              terrain={terrain}
              slot={placement.slot}
              url={placement.url}
              gift={gift}
              size={size}
            />
          ))
        : null}
    </>
  );
}

export default function AdminGiftSlotInspectorClient() {
  const apiUrl = API_BASE;
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [catalog, setCatalog] = useState<GiftCatalogItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState(
    environmentOptions[0]?.id ?? "",
  );
  const [season, setSeason] = useState<SeasonKey>("summer");
  const [selectedGiftId, setSelectedGiftId] = useState<string | null>(null);
  const [giftTypeFilter, setGiftTypeFilter] =
    useState<GiftTypeFilter>("all");
  const [search, setSearch] = useState("");
  const [giftSize, setGiftSize] = useState<GiftSize>("m");
  const [detectedSlots, setDetectedSlots] = useState<string[]>([]);
  const [sceneReady, setSceneReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    const checkAccess = async () => {
      try {
        const response = await fetch(`${apiUrl}/auth/me`, {
          credentials: "include",
        });
        if (!response.ok) {
          router.replace(
            `/auth?next=${encodeURIComponent("/admin/gift-slots")}`,
          );
          return;
        }
        const data = (await response.json()) as {
          accessLevel?: AccessLevel;
        };
        if (!canAccessAdmin(data.accessLevel ?? "USER")) {
          router.replace("/");
          return;
        }
        if (mounted) {
          setIsAdmin(true);
        }
      } catch {
        if (mounted) {
          setError("Не удалось проверить доступ");
        }
      } finally {
        if (mounted) {
          setAuthChecked(true);
        }
      }
    };
    void checkAccess();
    return () => {
      mounted = false;
    };
  }, [apiUrl, router]);

  useEffect(() => {
    if (!authChecked || !isAdmin) {
      return;
    }
    let mounted = true;
    const loadCatalog = async () => {
      setLoadingCatalog(true);
      try {
        const response = await fetch(`${apiUrl}/gifts`, {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error(
            (await response.text()) || "Не удалось загрузить подарки",
          );
        }
        const data = (await response.json()) as GiftCatalogItem[];
        if (mounted) {
          setCatalog(data);
          setSelectedGiftId((current) => current ?? data[0]?.id ?? null);
        }
      } catch (loadError) {
        if (mounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Не удалось загрузить подарки",
          );
        }
      } finally {
        if (mounted) {
          setLoadingCatalog(false);
        }
      }
    };
    void loadCatalog();
    return () => {
      mounted = false;
    };
  }, [apiUrl, authChecked, isAdmin]);

  const selectedGift =
    catalog.find((gift) => gift.id === selectedGiftId) ?? null;
  const availableSeasons = useMemo(
    () => getEnvironmentSeasons(selectedEnvironmentId),
    [selectedEnvironmentId],
  );
  const terrainUrl = resolveEnvironmentModel(
    selectedEnvironmentId,
    availableSeasons.length > 0 ? season : null,
  );
  const visibleGifts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return catalog.filter((gift) => {
      const types = getGiftAvailableTypes(gift);
      if (
        giftTypeFilter !== "all" &&
        !types.includes(giftTypeFilter)
      ) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      return `${gift.name} ${gift.description ?? ""} ${gift.code ?? ""}`
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [catalog, giftTypeFilter, search]);
  const compatibleSlots = useMemo(
    () =>
      selectedGift
        ? detectedSlots.filter((slot) =>
            isGiftCompatibleWithSlot(selectedGift, slot),
          )
        : [],
    [detectedSlots, selectedGift],
  );
  const handleSlotsDetected = useCallback((slots: string[]) => {
    setDetectedSlots(slots);
  }, []);
  const handleSceneReady = useCallback(() => {
    setSceneReady(true);
  }, []);

  useEffect(() => {
    if (availableSeasons.length === 0) {
      return;
    }
    if (!availableSeasons.includes(season)) {
      setSeason(availableSeasons[0] ?? "summer");
    }
  }, [availableSeasons, season]);

  useEffect(() => {
    setDetectedSlots([]);
    setSceneReady(false);
  }, [selectedEnvironmentId, season]);

  useEffect(() => {
    if (!giftSupportsSize(selectedGift ?? undefined)) {
      setGiftSize("m");
    }
  }, [selectedGift]);

  if (!authChecked) {
    return (
      <main className="grid min-h-[calc(100vh-var(--app-header-height,56px))] place-items-center bg-[#f5efe9] px-6 text-sm font-semibold text-[#8d6e63]">
        Проверяем доступ...
      </main>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <main className="w-screen max-w-full min-h-[calc(100vh-var(--app-header-height,56px))] overflow-x-hidden bg-[#f5efe9] px-3 py-4 text-[#5d4037] sm:px-6 sm:py-5">
      <div className="mx-auto grid w-[calc(100vw-1.5rem)] min-w-0 max-w-[1680px] gap-4 sm:w-[calc(100vw-3rem)]">
        <header className="flex min-w-0 max-w-full flex-wrap items-center justify-between gap-3 overflow-hidden rounded-[24px] bg-[#fffcf9] px-4 py-4 shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_18px_46px_-34px_rgba(93,64,55,0.55)] sm:px-5">
          <div className="min-w-0 max-w-full">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#d3a27f]">
              Админ · 3D
            </p>
            <h1 className="break-words text-balance text-2xl font-black">
              Проверка подарочных слотов
            </h1>
            <p className="mt-1 max-w-3xl text-pretty text-sm text-[#8d6e63]">
              Выберите поверхность и подарок. Модель появится одновременно во
              всех совместимых слотах этой поверхности.
            </p>
          </div>
          <nav
            className="flex min-w-0 max-w-full flex-wrap gap-2"
            aria-label="Разделы админки"
          >
            <Link
              href="/admin/sql"
              className="inline-flex min-h-10 items-center rounded-[16px] bg-white px-3 text-[10px] font-black uppercase tracking-[0.1em] shadow-sm transition-transform duration-150 active:scale-[0.96] sm:px-4 sm:text-xs"
            >
              Админка
            </Link>
            <Link
              href="/admin/video"
              className="inline-flex min-h-10 items-center rounded-[16px] bg-white px-3 text-[10px] font-black uppercase tracking-[0.1em] shadow-sm transition-transform duration-150 active:scale-[0.96] sm:px-4 sm:text-xs"
            >
              Видео
            </Link>
            <Link
              href="/admin/moderation"
              className="inline-flex min-h-10 items-center rounded-[16px] bg-white px-3 text-[10px] font-black uppercase tracking-[0.1em] shadow-sm transition-transform duration-150 active:scale-[0.96] sm:px-4 sm:text-xs"
            >
              Модерация
            </Link>
          </nav>
        </header>

        <div className="grid min-h-0 min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_410px]">
          <section className="relative min-h-[520px] min-w-0 overflow-hidden rounded-[28px] bg-[#dcecff] shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_24px_60px_-40px_rgba(93,64,55,0.65)] sm:min-h-[640px]">
            {terrainUrl ? (
              <Canvas
                camera={{ position: [8, 7, 10], fov: 45 }}
                dpr={[1, 1.6]}
                gl={{ antialias: true, alpha: false }}
                className="h-full w-full"
              >
                <Color attach="background" args={["#dfeefe"]} />
                <TunedSkyDome radius={90} renderOrder={-20} />
                <AmbientLight intensity={0.9} />
                <HemisphereLight
                  intensity={0.65}
                  color="#ffffff"
                  groundColor="#d5dbe5"
                />
                <DirectionalLight intensity={1} position={[6, 8, 4]} />
                <DirectionalLight intensity={0.55} position={[-6, 5, -4]} />
                <Suspense fallback={null}>
                  <InspectorTerrain
                    key={terrainUrl}
                    terrainUrl={terrainUrl}
                    gift={selectedGift}
                    size={giftSize}
                    onSlotsDetected={handleSlotsDetected}
                    onReady={handleSceneReady}
                  />
                </Suspense>
                <OrbitControls
                  enableDamping
                  dampingFactor={0.08}
                  enablePan={false}
                  target={[0, 0.6, 0]}
                  minDistance={3}
                  maxDistance={30}
                  maxPolarAngle={Math.PI / 2.02}
                />
              </Canvas>
            ) : null}
            {!sceneReady ? (
              <div className="pointer-events-none absolute inset-0 grid place-items-center bg-[#dcecff]/82 text-sm font-semibold text-[#8d6e63] backdrop-blur-sm">
                Загружаем поверхность...
              </div>
            ) : null}
            <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-2">
              <span className="rounded-xl bg-white/90 px-3 py-2 text-xs font-bold shadow-sm backdrop-blur">
                Всего слотов:{" "}
                <span className="tabular-nums">{detectedSlots.length}</span>
              </span>
              <span className="rounded-xl bg-white/90 px-3 py-2 text-xs font-bold shadow-sm backdrop-blur">
                Совместимых:{" "}
                <span className="tabular-nums">{compatibleSlots.length}</span>
              </span>
              {selectedGift && sceneReady && compatibleSlots.length === 0 ? (
                <span className="rounded-xl bg-[#fff1e6]/95 px-3 py-2 text-xs font-bold text-[#9a5f3b] shadow-sm backdrop-blur">
                  Для подарка нет подходящих слотов
                </span>
              ) : null}
            </div>
          </section>

          <aside className="grid min-h-0 min-w-0 max-w-full content-start gap-4 overflow-hidden rounded-[24px] bg-[#fffcf9] p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_18px_46px_-34px_rgba(93,64,55,0.55)]">
            <section className="grid gap-2 border-b border-[#eadfd9] pb-4">
              <h2 className="text-sm font-black">Поверхность</h2>
              <select
                value={selectedEnvironmentId}
                onChange={(event) =>
                  setSelectedEnvironmentId(event.target.value)
                }
                className="min-h-11 w-full rounded-xl bg-[#f7f1ee] px-3 text-sm font-semibold outline-none ring-[#3bceac]/45 transition-[box-shadow] focus-visible:ring-2"
              >
                {environmentOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
              {availableSeasons.length > 0 ? (
                <div className="grid grid-cols-4 gap-1.5">
                  {availableSeasons.map((seasonOption) => (
                    <button
                      key={seasonOption}
                      type="button"
                      onClick={() => setSeason(seasonOption)}
                      aria-pressed={season === seasonOption}
                      className={`min-h-10 rounded-xl px-2 text-[10px] font-black uppercase transition-[background-color,color,transform] duration-150 active:scale-[0.96] ${
                        season === seasonOption
                          ? "bg-[#111827] text-white"
                          : "bg-[#f7f1ee] text-[#8d6e63]"
                      }`}
                    >
                      {SEASON_LABELS[seasonOption]}
                    </button>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="grid min-h-0 gap-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-black">Подарок</h2>
                <span className="text-xs font-bold tabular-nums text-[#8d6e63]">
                  {visibleGifts.length}
                </span>
              </div>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Название или код"
                className="min-h-11 w-full rounded-xl bg-[#f7f1ee] px-3 text-sm outline-none ring-[#3bceac]/45 transition-[box-shadow] focus-visible:ring-2"
              />
              <select
                value={giftTypeFilter}
                onChange={(event) =>
                  setGiftTypeFilter(event.target.value as GiftTypeFilter)
                }
                className="min-h-11 w-full rounded-xl bg-[#f7f1ee] px-3 text-sm font-semibold outline-none ring-[#3bceac]/45 transition-[box-shadow] focus-visible:ring-2"
              >
                {GIFT_TYPE_FILTERS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>

              {selectedGift && giftSupportsSize(selectedGift) ? (
                <div className="grid grid-cols-3 gap-1.5">
                  {(["s", "m", "l"] as GiftSize[]).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setGiftSize(size)}
                      aria-pressed={giftSize === size}
                      className={`min-h-10 rounded-xl text-xs font-black uppercase transition-[background-color,color,transform] duration-150 active:scale-[0.96] ${
                        giftSize === size
                          ? "bg-[#111827] text-white"
                          : "bg-[#f7f1ee] text-[#8d6e63]"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="grid max-h-[430px] grid-cols-3 gap-2 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-4 xl:grid-cols-3">
                {loadingCatalog
                  ? Array.from({ length: 9 }).map((_, index) => (
                      <div
                        key={`gift-loading-${index}`}
                        className="aspect-square animate-pulse rounded-xl bg-[#f7f1ee]"
                      />
                    ))
                  : visibleGifts.map((gift) => {
                      const iconUrl = resolveGiftIconUrl(gift);
                      const selected = selectedGiftId === gift.id;
                      return (
                        <button
                          key={gift.id}
                          type="button"
                          onClick={() => setSelectedGiftId(gift.id)}
                          aria-pressed={selected}
                          aria-label={gift.name}
                          className={`grid min-w-0 gap-1 rounded-[14px] p-1.5 text-left shadow-sm transition-[background-color,box-shadow,transform] duration-150 active:scale-[0.96] ${
                            selected
                              ? "bg-[#e8fff8] shadow-[0_0_0_2px_#3bceac]"
                              : "bg-white hover:shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_4px_12px_rgba(93,64,55,0.08)]"
                          }`}
                        >
                          <img
                            src={iconUrl ?? FALLBACK_GIFT_ICON}
                            alt=""
                            loading="lazy"
                            className="aspect-square w-full rounded-[10px] object-cover outline outline-1 -outline-offset-1 outline-black/10"
                            onError={(event) => {
                              event.currentTarget.onerror = null;
                              event.currentTarget.src = FALLBACK_GIFT_ICON;
                            }}
                          />
                          <span className="truncate px-0.5 text-[10px] font-bold">
                            {gift.name}
                          </span>
                        </button>
                      );
                    })}
              </div>
            </section>

            {selectedGift ? (
              <section className="grid gap-2 border-t border-[#eadfd9] pt-4">
                <div>
                  <p className="text-sm font-black">{selectedGift.name}</p>
                  <p className="text-xs text-[#8d6e63]">
                    {selectedGift.code ?? getGiftCode(selectedGift) ?? "—"}
                  </p>
                </div>
                <p className="text-pretty text-xs leading-relaxed text-[#6f6360]">
                  {selectedGift.description || "Описание не задано."}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {compatibleSlots.map((slot) => (
                    <span
                      key={slot}
                      className="rounded-lg bg-[#f7f1ee] px-2 py-1 text-[10px] font-bold tabular-nums text-[#8d6e63]"
                    >
                      {slot}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}
          </aside>
        </div>
        <AdminGiftPlacementManager apiUrl={apiUrl} />
      </div>
      {error ? (
        <ErrorToast message={error} onClose={() => setError(null)} />
      ) : null}
    </main>
  );
}
