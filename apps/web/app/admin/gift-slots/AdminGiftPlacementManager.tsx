"use client";

import Link from "next/link";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import ErrorToast from "../../../components/ErrorToast";
import GiftFlames from "../../../components/GiftFlames";
import TunedSkyDome from "../../../components/TunedSkyDome";
import {
  getGiftAvailableTypes,
  getGiftSlotType,
  isGiftSlotName,
  resolveGiftIconUrl,
  resolveGiftModelUrl,
  resolveGiftScaleMultiplier,
  resolveGiftSizeMultiplier,
  resolveGiftTargetWidth,
  type GiftSize,
} from "../../../lib/gifts";
import { resolveEnvironmentModel } from "../../../lib/memorial-models";
import { resolveObjectTransformInParent } from "../../../lib/three-transforms";

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

type GiftPlacement = {
  id: string;
  slotName: string;
  size?: string | null;
  placedAt: string;
  expiresAt?: string | null;
  gift: GiftCatalogItem;
  owner: {
    id: string;
    email: string;
    login?: string | null;
  };
};

type ManagedPet = {
  id: string;
  name: string;
  owner: {
    id: string;
    email: string;
    login?: string | null;
  };
  memorial: {
    environmentId?: string | null;
  } | null;
  gifts: GiftPlacement[];
};

type PendingRemoval =
  | { kind: "one"; placement: GiftPlacement }
  | { kind: "all"; pet: ManagedPet }
  | null;

const FALLBACK_GIFT_ICON =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'><rect width='128' height='128' rx='22' fill='%23f7f1ee'/><path d='M64 27l10 21 23 3-17 16 4 23-20-11-20 11 4-23-17-16 23-3 10-21z' fill='%23d3a27f'/></svg>";

const normalizeGiftSize = (size?: string | null): GiftSize => {
  const normalized = size?.toLowerCase();
  return normalized === "s" || normalized === "l" ? normalized : "m";
};

const isGiftCompatibleWithSlot = (gift: GiftCatalogItem, slotName: string) => {
  const slotType = getGiftSlotType(slotName);
  const giftTypes = getGiftAvailableTypes(gift);
  return (
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
  if (size.x > 0) {
    target.scale.setScalar(width / size.x);
  }
};

function ManagedGiftAtSlot({
  terrain,
  placement,
}: {
  terrain: THREE.Object3D;
  placement: GiftPlacement;
}) {
  const slotType = getGiftSlotType(placement.slotName);
  const url =
    resolveGiftModelUrl({
      gift: placement.gift,
      slotType,
      fallbackUrl: placement.gift.modelUrl,
    }) ?? placement.gift.modelUrl;
  const { scene } = useGLTF(url);
  const model = useMemo(() => {
    const cloned = scene.clone(true);
    const targetWidth = resolveGiftTargetWidth(placement.gift);
    if (targetWidth) {
      applyGiftScale(cloned, targetWidth);
    }
    cloned.scale.multiplyScalar(
      resolveGiftSizeMultiplier({
        gift: placement.gift,
        size: normalizeGiftSize(placement.size),
      }),
    );
    cloned.scale.multiplyScalar(resolveGiftScaleMultiplier(placement.gift));
    return cloned;
  }, [placement.gift, placement.size, scene]);
  const baseQuaternion = useMemo(() => model.quaternion.clone(), [model]);

  useEffect(() => {
    const anchor = terrain.getObjectByName(placement.slotName);
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
  }, [baseQuaternion, model, placement.slotName, terrain]);

  return <GiftFlames root={model} />;
}

function ManagedTerrain({
  terrainUrl,
  placements,
  onSlotsDetected,
  onReady,
}: {
  terrainUrl: string;
  placements: GiftPlacement[];
  onSlotsDetected: (slots: string[]) => void;
  onReady: () => void;
}) {
  const { scene } = useGLTF(terrainUrl);
  const terrain = useMemo(() => scene.clone(true), [scene]);
  const slots = useMemo(() => {
    const found = new Set<string>();
    terrain.traverse((node) => {
      if (isGiftSlotName(node.name)) {
        found.add(node.name);
      }
    });
    return Array.from(found).sort((left, right) =>
      left.localeCompare(right, "ru", { numeric: true }),
    );
  }, [terrain]);

  useEffect(() => {
    onSlotsDetected(slots);
    onReady();
  }, [onReady, onSlotsDetected, slots]);

  return (
    <>
      <Primitive object={terrain} />
      {placements.map((placement) => (
        <ManagedGiftAtSlot
          key={`${placement.id}:${placement.slotName}`}
          terrain={terrain}
          placement={placement}
        />
      ))}
    </>
  );
}

const readApiError = async (response: Response) => {
  const text = await response.text();
  try {
    const data = JSON.parse(text) as { message?: string | string[] };
    if (Array.isArray(data.message)) {
      return data.message.join(". ");
    }
    return data.message || text;
  } catch {
    return text;
  }
};

export default function AdminGiftPlacementManager({
  apiUrl,
}: {
  apiUrl: string;
}) {
  const [pets, setPets] = useState<ManagedPet[]>([]);
  const [selectedPetId, setSelectedPetId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [sceneReady, setSceneReady] = useState(false);
  const [detectedSlots, setDetectedSlots] = useState<string[]>([]);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadPets = useCallback(
    async (search = "") => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (search.trim()) {
          params.set("q", search.trim());
        }
        const response = await fetch(
          `${apiUrl}/admin/gift-placements${
            params.size ? `?${params.toString()}` : ""
          }`,
          { credentials: "include" },
        );
        if (!response.ok) {
          throw new Error(
            (await readApiError(response)) || "Не удалось загрузить мемориалы",
          );
        }
        const data = (await response.json()) as { pets?: ManagedPet[] };
        const nextPets = Array.isArray(data.pets) ? data.pets : [];
        setPets(nextPets);
        setSelectedPetId((current) => {
          if (nextPets.some((pet) => pet.id === current)) {
            return current;
          }
          return (
            nextPets.find((pet) => pet.gifts.length > 0)?.id ??
            nextPets[0]?.id ??
            ""
          );
        });
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Не удалось загрузить мемориалы",
        );
      } finally {
        setLoading(false);
      }
    },
    [apiUrl],
  );

  useEffect(() => {
    void loadPets();
  }, [loadPets]);

  const selectedPet = pets.find((pet) => pet.id === selectedPetId) ?? null;
  const terrainUrl = selectedPet?.memorial?.environmentId
    ? resolveEnvironmentModel(selectedPet.memorial.environmentId, "auto")
    : null;
  const occupiedSlots = useMemo(
    () => new Set(selectedPet?.gifts.map((gift) => gift.slotName) ?? []),
    [selectedPet],
  );

  useEffect(() => {
    setDetectedSlots([]);
    setTargets({});
    setSceneReady(false);
  }, [selectedPetId, terrainUrl]);

  const getAvailableSlots = useCallback(
    (placement: GiftPlacement) =>
      detectedSlots.filter(
        (slot) =>
          slot !== placement.slotName &&
          !occupiedSlots.has(slot) &&
          isGiftCompatibleWithSlot(placement.gift, slot),
      ),
    [detectedSlots, occupiedSlots],
  );

  const runMutation = async (
    key: string,
    path: string,
    body?: Record<string, string>,
    successMessage = "Изменения сохранены",
  ) => {
    setActionKey(key);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`${apiUrl}${path}`, {
        method: "PATCH",
        credentials: "include",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        throw new Error(
          (await readApiError(response)) || "Не удалось сохранить изменения",
        );
      }
      setSuccess(successMessage);
      await loadPets(query);
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Не удалось сохранить изменения",
      );
    } finally {
      setActionKey(null);
    }
  };

  const confirmRemoval = async () => {
    const removal = pendingRemoval;
    if (!removal) {
      return;
    }
    setPendingRemoval(null);
    if (removal.kind === "one") {
      await runMutation(
        `deactivate:${removal.placement.id}`,
        `/admin/gift-placements/${removal.placement.id}/deactivate`,
        undefined,
        `Подарок «${removal.placement.gift.name}» деактивирован`,
      );
      return;
    }
    await runMutation(
      `deactivate-all:${removal.pet.id}`,
      "/admin/gift-placements/deactivate-all",
      { petId: removal.pet.id },
      `Все подарки мемориала «${removal.pet.name}» деактивированы`,
    );
  };

  return (
    <section
      id="gift-placement-manager"
      className="grid min-w-0 gap-4 border-t border-[#dfd3cd] pt-6"
    >
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#d3a27f]">
            Реальные размещения
          </p>
          <h2 className="text-balance text-2xl font-black">
            Управление подарками мемориалов
          </h2>
          <p className="mt-1 max-w-3xl text-pretty text-sm text-[#8d6e63]">
            Перемещайте подарки только в свободные совместимые слоты или
            деактивируйте размещения без удаления истории дарения.
          </p>
        </div>
        {selectedPet?.gifts.length ? (
          <button
            type="button"
            onClick={() => setPendingRemoval({ kind: "all", pet: selectedPet })}
            className="min-h-11 rounded-[16px] bg-[#fff4f2] px-4 text-xs font-black uppercase tracking-[0.1em] text-red-600 shadow-[0_0_0_1px_rgba(220,38,38,0.08),0_8px_18px_-14px_rgba(220,38,38,0.45)] transition-[transform,box-shadow] duration-150 active:scale-[0.96]"
          >
            Деактивировать все
          </button>
        ) : null}
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(420px,1.08fr)]">
        <div className="grid min-w-0 content-start gap-3">
          <form
            className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              void loadPets(query);
            }}
          >
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Имя питомца, логин или email владельца"
              className="min-h-11 min-w-0 rounded-[14px] bg-[#fffcf9] px-4 text-sm outline-none shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_6px_18px_-16px_rgba(93,64,55,0.5)] ring-[#3bceac]/45 transition-[box-shadow] focus-visible:ring-2"
            />
            <button
              type="submit"
              disabled={loading}
              className="min-h-11 rounded-[14px] bg-[#111827] px-5 text-xs font-black uppercase tracking-[0.1em] text-white transition-transform duration-150 active:scale-[0.96] disabled:opacity-55"
            >
              {loading ? "Ищем..." : "Найти"}
            </button>
          </form>

          <select
            value={selectedPetId}
            onChange={(event) => setSelectedPetId(event.target.value)}
            disabled={loading || pets.length === 0}
            className="min-h-12 w-full min-w-0 rounded-[14px] bg-[#fffcf9] px-4 text-sm font-semibold outline-none shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_6px_18px_-16px_rgba(93,64,55,0.5)] ring-[#3bceac]/45 transition-[box-shadow] focus-visible:ring-2"
          >
            {pets.length === 0 ? (
              <option value="">Мемориалы не найдены</option>
            ) : null}
            {pets.map((pet) => (
              <option key={pet.id} value={pet.id}>
                {pet.name} · {pet.owner.login || pet.owner.email} · подарков:{" "}
                {pet.gifts.length}
              </option>
            ))}
          </select>

          <div className="relative min-h-[360px] overflow-hidden rounded-[22px] bg-[#dcecff] shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_20px_50px_-38px_rgba(93,64,55,0.68)] sm:min-h-[460px]">
            {terrainUrl && selectedPet ? (
              <Canvas
                camera={{ position: [8, 7, 10], fov: 45 }}
                dpr={[1, 1.5]}
                gl={{ antialias: true, alpha: false }}
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
                  <ManagedTerrain
                    key={`${selectedPet.id}:${terrainUrl}`}
                    terrainUrl={terrainUrl}
                    placements={selectedPet.gifts}
                    onSlotsDetected={setDetectedSlots}
                    onReady={() => setSceneReady(true)}
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
              <div className="pointer-events-none absolute inset-0 grid place-items-center bg-[#dcecff]/85 px-4 text-center text-sm font-semibold text-[#8d6e63] backdrop-blur-sm">
                {selectedPet
                  ? "Загружаем поверхность и подарки..."
                  : "Выберите мемориал"}
              </div>
            ) : null}
            <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-2">
              <span className="rounded-xl bg-white/90 px-3 py-2 text-xs font-bold shadow-sm backdrop-blur">
                Слотов:{" "}
                <span className="tabular-nums">{detectedSlots.length}</span>
              </span>
              <span className="rounded-xl bg-white/90 px-3 py-2 text-xs font-bold shadow-sm backdrop-blur">
                Занято:{" "}
                <span className="tabular-nums">
                  {selectedPet?.gifts.length ?? 0}
                </span>
              </span>
            </div>
          </div>
        </div>

        <div className="grid min-h-0 min-w-0 content-start gap-3">
          {selectedPet ? (
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-lg font-black">
                  {selectedPet.name}
                </p>
                <p className="truncate text-xs font-semibold text-[#8d6e63]">
                  {selectedPet.owner.login || selectedPet.owner.email}
                </p>
              </div>
              <Link
                href={`/pets/${selectedPet.id}`}
                target="_blank"
                className="inline-flex min-h-10 items-center rounded-[14px] bg-[#fffcf9] px-4 text-xs font-black uppercase tracking-[0.08em] text-[#5d4037] shadow-sm transition-transform duration-150 active:scale-[0.96]"
              >
                Открыть мемориал
              </Link>
            </div>
          ) : null}

          <div className="grid max-h-[620px] min-w-0 gap-2 overflow-y-auto overscroll-contain pr-1">
            {selectedPet?.gifts.length ? (
              selectedPet.gifts.map((placement) => {
                const availableSlots = getAvailableSlots(placement);
                const selectedTarget = targets[placement.id] ?? "";
                const busy = actionKey?.endsWith(placement.id) ?? false;
                return (
                  <article
                    key={placement.id}
                    className="grid min-w-0 gap-3 rounded-[20px] bg-[#fffcf9] p-3 shadow-[0_0_0_1px_rgba(0,0,0,0.055),0_10px_28px_-22px_rgba(93,64,55,0.46)] sm:grid-cols-[72px_minmax(0,1fr)]"
                  >
                    <img
                      src={
                        resolveGiftIconUrl(placement.gift) ?? FALLBACK_GIFT_ICON
                      }
                      alt=""
                      className="aspect-square w-[72px] rounded-[12px] object-cover outline outline-1 -outline-offset-1 outline-black/10"
                      onError={(event) => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src = FALLBACK_GIFT_ICON;
                      }}
                    />
                    <div className="grid min-w-0 gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black">
                          {placement.gift.name}
                        </p>
                        <p className="truncate text-xs font-semibold text-[#8d6e63]">
                          {placement.slotName} · от{" "}
                          {placement.owner.login || placement.owner.email}
                        </p>
                      </div>
                      <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                        <select
                          value={selectedTarget}
                          onChange={(event) =>
                            setTargets((current) => ({
                              ...current,
                              [placement.id]: event.target.value,
                            }))
                          }
                          disabled={!sceneReady || availableSlots.length === 0}
                          className="min-h-10 min-w-0 rounded-[12px] bg-[#f7f1ee] px-3 text-xs font-semibold outline-none ring-[#3bceac]/45 transition-[box-shadow] focus-visible:ring-2 disabled:opacity-55"
                        >
                          <option value="">
                            {sceneReady
                              ? availableSlots.length
                                ? "Выберите свободный слот"
                                : "Нет свободных совместимых слотов"
                              : "Загрузка слотов..."}
                          </option>
                          {availableSlots.map((slot) => (
                            <option key={slot} value={slot}>
                              {slot}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!selectedTarget || busy}
                          onClick={() =>
                            void runMutation(
                              `move:${placement.id}`,
                              `/admin/gift-placements/${placement.id}/move`,
                              { slotName: selectedTarget },
                              `Подарок «${placement.gift.name}» перенесён`,
                            )
                          }
                          className="min-h-10 rounded-[12px] bg-[#e8fff8] px-3 text-[10px] font-black uppercase tracking-[0.08em] text-[#167a64] transition-transform duration-150 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          {busy ? "Сохраняем..." : "Перенести"}
                        </button>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          setPendingRemoval({ kind: "one", placement })
                        }
                        className="min-h-10 justify-self-start rounded-[12px] bg-[#fff4f2] px-3 text-[10px] font-black uppercase tracking-[0.08em] text-red-600 transition-transform duration-150 active:scale-[0.96] disabled:opacity-45"
                      >
                        Деактивировать
                      </button>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="rounded-[18px] bg-[#fffcf9] px-4 py-8 text-center text-sm font-semibold text-[#8d6e63] shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
                {loading
                  ? "Загружаем подарки..."
                  : "У этого мемориала нет активных подарков."}
              </div>
            )}
          </div>
        </div>
      </div>

      {pendingRemoval ? (
        <div className="fixed inset-0 z-[6000] grid place-items-center bg-black/35 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="gift-removal-title"
            className="w-full max-w-md rounded-[24px] bg-[#fffcf9] p-5 text-[#5d4037] shadow-[0_28px_80px_-34px_rgba(45,52,54,0.68)]"
          >
            <h3
              id="gift-removal-title"
              className="text-balance text-xl font-black"
            >
              {pendingRemoval.kind === "all"
                ? "Деактивировать все подарки?"
                : "Деактивировать подарок?"}
            </h3>
            <p className="mt-2 text-pretty text-sm text-[#8d6e63]">
              {pendingRemoval.kind === "all"
                ? `Все активные подарки мемориала «${pendingRemoval.pet.name}» исчезнут со сцены. История дарения сохранится.`
                : `«${pendingRemoval.placement.gift.name}» исчезнет со сцены. История дарения сохранится.`}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPendingRemoval(null)}
                className="min-h-11 rounded-[14px] bg-[#f7f1ee] px-4 text-xs font-black uppercase tracking-[0.08em] transition-transform duration-150 active:scale-[0.96]"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={() => void confirmRemoval()}
                className="min-h-11 rounded-[14px] bg-red-600 px-4 text-xs font-black uppercase tracking-[0.08em] text-white transition-transform duration-150 active:scale-[0.96]"
              >
                Подтвердить
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ErrorToast message={error} onClose={() => setError(null)} />
      <ErrorToast
        message={success}
        onClose={() => setSuccess(null)}
        variant="success"
        offset={88}
      />
    </section>
  );
}
