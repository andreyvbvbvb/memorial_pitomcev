"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import * as THREE from "three";
import ErrorToast from "../../../components/ErrorToast";
import TunedSkyDome from "../../../components/TunedSkyDome";
import { canAccessAdmin, type AccessLevel } from "../../../lib/access";
import { API_BASE } from "../../../lib/config";
import { ensureDracoLoader } from "../../../lib/draco";
import {
  environmentOptions,
  houseOptions,
  partOptionsByCategory,
  type OptionItem,
} from "../../../lib/memorial-options";
import {
  resolveEnvironmentModel,
  resolveHouseModel,
  resolvePartModel,
} from "../../../lib/memorial-models";

ensureDracoLoader();

const Primitive = "primitive" as unknown as ComponentType<any>;
const Group = "group" as unknown as ComponentType<any>;
const Color = "color" as unknown as ComponentType<any>;
const Mesh = "mesh" as unknown as ComponentType<any>;
const CircleGeometry = "circleGeometry" as unknown as ComponentType<any>;
const SphereGeometry = "sphereGeometry" as unknown as ComponentType<any>;
const MeshBasicMaterial = "meshBasicMaterial" as unknown as ComponentType<any>;
const MeshStandardMaterial =
  "meshStandardMaterial" as unknown as ComponentType<any>;
const AmbientLight = "ambientLight" as unknown as ComponentType<any>;
const DirectionalLight =
  "directionalLight" as unknown as ComponentType<any>;
const HemisphereLight =
  "hemisphereLight" as unknown as ComponentType<any>;
const PointLight = "pointLight" as unknown as ComponentType<any>;

type ShowcaseCategory = {
  id: string;
  label: string;
  options: OptionItem[];
  resolveModelUrl: (id?: string | null) => string | null | undefined;
  targetSize: number;
};

type ShowcaseItem = {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  categoryLabel: string;
  modelUrl: string;
  targetSize: number;
};

type EffectKey = "floating" | "rimLight" | "particles" | "pedestal";

const CATEGORY_LABELS: Record<string, string> = {
  environment: "Поверхности",
  house: "Домики",
  roof: "Крыши",
  wall: "Стены",
  sign: "Украшения",
  frame_left: "Левые рамки",
  frame_right: "Правые рамки",
  mat: "Коврики",
  bowl_food: "Миски еды",
  bowl_water: "Миски воды",
  candle: "Свечи",
  flower: "Цветы",
};

const EFFECT_LABELS: Record<EffectKey, string> = {
  floating: "Плавание",
  rimLight: "Контровой свет",
  particles: "Искры",
  pedestal: "Плашка снизу",
};

const EFFECT_KEYS: EffectKey[] = [
  "floating",
  "rimLight",
  "particles",
  "pedestal",
];

const ADMIN_LINKS = [
  { href: "/admin/sql", label: "Админка" },
  { href: "/admin/gift-slots", label: "Слоты подарков" },
  { href: "/admin/video", label: "Видео" },
  { href: "/admin/moderation", label: "Модерация" },
] as const;

const buildCategories = (): ShowcaseCategory[] => {
  const partCategories = Object.entries(partOptionsByCategory)
    .map(([categoryId, options]) => ({
      id: categoryId,
      label: CATEGORY_LABELS[categoryId] ?? categoryId,
      options: options.filter((option) => option.id !== "none"),
      resolveModelUrl: (id?: string | null) => resolvePartModel(categoryId, id),
      targetSize:
        categoryId === "mat"
          ? 2.1
          : categoryId.startsWith("bowl")
            ? 1.35
            : 1.75,
    }))
    .filter((category) => category.options.length > 0);

  return [
    {
      id: "environment",
      label: CATEGORY_LABELS.environment ?? "Поверхности",
      options: environmentOptions,
      resolveModelUrl: (id?: string | null) =>
        resolveEnvironmentModel(id, "summer"),
      targetSize: 3.5,
    },
    {
      id: "house",
      label: CATEGORY_LABELS.house ?? "Домики",
      options: houseOptions,
      resolveModelUrl: resolveHouseModel,
      targetSize: 2.6,
    },
    ...partCategories,
  ];
};

const toggleSetValue = <T,>(set: Set<T>, value: T) => {
  const next = new Set(set);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
};

function ShowcaseModel({
  url,
  autoRotate,
  floating,
  targetSize,
  viewScale,
}: {
  url: string;
  autoRotate: boolean;
  floating: boolean;
  targetSize: number;
  viewScale: number;
}) {
  const { scene } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh) {
        return;
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const material = mesh.material;
      if (Array.isArray(material)) {
        material.forEach((item) => {
          item.side = THREE.FrontSide;
        });
      } else if (material) {
        material.side = THREE.FrontSide;
      }
    });

    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxSize = Math.max(size.x, size.y, size.z, 0.001);
    const scale = targetSize / maxSize;
    clone.scale.setScalar(scale);
    clone.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
    return clone;
  }, [scene, targetSize]);

  useEffect(() => {
    if (!groupRef.current) {
      return;
    }
    groupRef.current.rotation.set(0, 0, 0);
    groupRef.current.position.set(0, 0, 0);
  }, [url]);

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) {
      return;
    }
    if (autoRotate) {
      groupRef.current.rotation.y += delta * 0.45;
    }
    groupRef.current.position.y = floating
      ? Math.sin(clock.elapsedTime * 1.35) * 0.11
      : 0;
  });

  return (
    <Group ref={groupRef} scale={[viewScale, viewScale, viewScale]}>
      <Primitive object={model} />
    </Group>
  );
}

function ParticleHalo({ enabled }: { enabled: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const particles = useMemo(
    () =>
      Array.from({ length: 30 }, (_, index) => {
        const angle = (index / 30) * Math.PI * 2;
        const radius = 1.45 + (index % 5) * 0.13;
        return {
          id: index,
          position: [
            Math.cos(angle) * radius,
            -0.95 + (index % 6) * 0.36,
            Math.sin(angle) * radius,
          ] as [number, number, number],
          scale: 0.018 + (index % 4) * 0.007,
          opacity: 0.24 + (index % 3) * 0.12,
        };
      }),
    [],
  );

  useFrame(({ clock }) => {
    if (!groupRef.current) {
      return;
    }
    groupRef.current.rotation.y = clock.elapsedTime * 0.08;
  });

  if (!enabled) {
    return null;
  }

  return (
    <Group ref={groupRef}>
      {particles.map((particle) => (
        <Mesh
          key={particle.id}
          position={particle.position}
          scale={[particle.scale, particle.scale, particle.scale]}
        >
          <SphereGeometry args={[1, 10, 10]} />
          <MeshBasicMaterial
            color="#fff4b8"
            transparent
            opacity={particle.opacity}
            toneMapped={false}
          />
        </Mesh>
      ))}
    </Group>
  );
}

function ShowcaseScene({
  item,
  autoRotate,
  effects,
  viewScale,
}: {
  item: ShowcaseItem | null;
  autoRotate: boolean;
  effects: Set<EffectKey>;
  viewScale: number;
}) {
  const hasRimLight = effects.has("rimLight");
  return (
    <>
      <Color attach="background" args={["#dcecff"]} />
      <TunedSkyDome radius={120} renderOrder={-20} />
      <AmbientLight intensity={0.82} />
      <HemisphereLight
        intensity={0.78}
        color="#ffffff"
        groundColor="#d8c8be"
      />
      <DirectionalLight position={[5, 6, 4]} intensity={1.25} castShadow />
      <DirectionalLight position={[-5, 3, -5]} intensity={0.42} />
      {hasRimLight ? (
        <>
          <PointLight position={[-2.8, 1.6, -2.2]} intensity={3.1} color="#d7f4ff" />
          <PointLight position={[2.2, 1.2, 2.5]} intensity={1.6} color="#fff0c4" />
        </>
      ) : null}
      <Suspense fallback={null}>
        {item ? (
          <ShowcaseModel
            key={item.modelUrl}
            url={item.modelUrl}
            autoRotate={autoRotate}
            floating={effects.has("floating")}
            targetSize={item.targetSize}
            viewScale={viewScale}
          />
        ) : null}
      </Suspense>
      {effects.has("pedestal") ? (
        <Mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -1.25, 0]}
          receiveShadow
        >
          <CircleGeometry args={[1.45, 72]} />
          <MeshStandardMaterial
            color="#fff8ef"
            transparent
            opacity={0.74}
            roughness={0.92}
            metalness={0}
          />
        </Mesh>
      ) : null}
      <ParticleHalo enabled={effects.has("particles")} />
      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        target={[0, 0, 0]}
        minDistance={2.1}
        maxDistance={8}
      />
    </>
  );
}

export default function AdminDetailShowcaseClient() {
  const router = useRouter();
  const categories = useMemo(buildCategories, []);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    categories[0]?.id ?? "",
  );
  const [selectedItemId, setSelectedItemId] = useState(
    categories[0]?.options[0]?.id ?? "",
  );
  const [search, setSearch] = useState("");
  const [autoRotate, setAutoRotate] = useState(true);
  const [effects, setEffects] = useState<Set<EffectKey>>(
    () => new Set(["floating", "rimLight", "particles", "pedestal"]),
  );
  const [viewScale, setViewScale] = useState(1);

  useEffect(() => {
    let mounted = true;
    const checkAccess = async () => {
      try {
        const response = await fetch(`${API_BASE}/auth/me`, {
          credentials: "include",
        });
        if (!response.ok) {
          router.replace(
            `/auth?next=${encodeURIComponent("/admin/detail-showcase")}`,
          );
          return;
        }
        const data = (await response.json()) as { accessLevel?: AccessLevel };
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
  }, [router]);

  const selectedCategory =
    categories.find((category) => category.id === selectedCategoryId) ??
    categories[0] ??
    null;
  const items = useMemo<ShowcaseItem[]>(() => {
    if (!selectedCategory) {
      return [];
    }
    return selectedCategory.options
      .map((option) => {
        const modelUrl = selectedCategory.resolveModelUrl(option.id);
        if (!modelUrl) {
          return null;
        }
        return {
          id: option.id,
          name: option.name,
          description: option.description,
          categoryId: selectedCategory.id,
          categoryLabel: selectedCategory.label,
          modelUrl,
          targetSize: selectedCategory.targetSize,
        };
      })
      .filter((item): item is ShowcaseItem => Boolean(item));
  }, [selectedCategory]);
  const visibleItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) {
      return items;
    }
    return items.filter((item) =>
      `${item.name} ${item.description} ${item.id}`
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [items, search]);
  const selectedItem =
    items.find((item) => item.id === selectedItemId) ?? items[0] ?? null;

  useEffect(() => {
    if (!selectedCategory) {
      return;
    }
    setSelectedItemId(selectedCategory.options[0]?.id ?? "");
  }, [selectedCategory]);

  useEffect(() => {
    if (!selectedItem?.modelUrl) {
      return;
    }
    useGLTF.preload(selectedItem.modelUrl);
  }, [selectedItem?.modelUrl]);

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
    <main className="min-h-[calc(100vh-var(--app-header-height,56px))] bg-[#f5efe9] px-3 py-4 text-[#5d4037] sm:px-6 sm:py-5">
      <div className="mx-auto grid w-full max-w-[1720px] gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] bg-[#fffcf9] px-4 py-4 shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_18px_46px_-34px_rgba(93,64,55,0.55)] sm:px-5">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#d3a27f]">
              Админ · 3D
            </p>
            <h1 className="text-balance text-2xl font-black sm:text-3xl">
              Витрина деталей
            </h1>
          </div>
          <nav className="flex flex-wrap gap-2" aria-label="Разделы админки">
            {ADMIN_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex min-h-10 items-center rounded-[16px] bg-white px-3 text-[10px] font-black uppercase tracking-[0.1em] shadow-sm transition-transform duration-150 active:scale-[0.96] sm:px-4 sm:text-xs"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </header>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="relative h-[62vh] min-h-[520px] overflow-hidden rounded-[30px] bg-[#dcecff] shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_24px_60px_-40px_rgba(93,64,55,0.65)]">
            <Canvas
              camera={{ position: [3.2, 2.05, 3.8], fov: 38 }}
              dpr={[1, 1.75]}
              gl={{ antialias: true, alpha: false }}
              shadows
              className="h-full w-full"
            >
              <ShowcaseScene
                item={selectedItem}
                autoRotate={autoRotate}
                effects={effects}
                viewScale={viewScale}
              />
            </Canvas>
            <div className="pointer-events-none absolute left-3 top-3 max-w-[calc(100%-1.5rem)] rounded-[18px] bg-white/84 px-4 py-3 shadow-[0_18px_34px_-28px_rgba(93,64,55,0.55)] backdrop-blur">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#d3a27f]">
                {selectedItem?.categoryLabel ?? "Модель"}
              </p>
              <h2 className="mt-1 line-clamp-2 text-lg font-black leading-tight">
                {selectedItem?.name ?? "Деталь не выбрана"}
              </h2>
              {selectedItem?.description ? (
                <p className="mt-1 line-clamp-2 max-w-md text-xs font-semibold text-[#8d6e63]">
                  {selectedItem.description}
                </p>
              ) : null}
            </div>
          </section>

          <aside className="grid content-start gap-4 rounded-[26px] bg-[#fffcf9] p-4 shadow-[0_0_0_1px_rgba(0,0,0,0.05),0_18px_46px_-34px_rgba(93,64,55,0.55)]">
            <section className="grid gap-3 border-b border-[#eadfd9] pb-4">
              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8d6e63]">
                    Категория
                  </span>
                  <select
                    value={selectedCategoryId}
                    onChange={(event) =>
                      setSelectedCategoryId(event.target.value)
                    }
                    className="min-h-11 rounded-[16px] bg-[#f7f1ee] px-3 text-sm font-black outline-none ring-[#3bceac]/40 focus-visible:ring-2"
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8d6e63]">
                    Поиск
                  </span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Название"
                    className="min-h-11 rounded-[16px] bg-[#f7f1ee] px-3 text-sm font-black outline-none ring-[#3bceac]/40 placeholder:text-[#b0a29c] focus-visible:ring-2"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ToggleButton active={autoRotate} onClick={() => setAutoRotate((value) => !value)}>
                  Вращение
                </ToggleButton>
                <label className="grid gap-1.5 rounded-[18px] bg-[#f7f1ee] px-3 py-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#8d6e63]">
                    Масштаб
                  </span>
                  <input
                    type="range"
                    min="0.65"
                    max="1.45"
                    step="0.05"
                    value={viewScale}
                    onChange={(event) =>
                      setViewScale(Number(event.target.value))
                    }
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {EFFECT_KEYS.map((key) => (
                  <ToggleButton
                    key={key}
                    active={effects.has(key)}
                    onClick={() =>
                      setEffects((current) => toggleSetValue(current, key))
                    }
                  >
                    {EFFECT_LABELS[key]}
                  </ToggleButton>
                ))}
              </div>
            </section>

            <section className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-black">Модели</h2>
                <span className="text-xs font-black tabular-nums text-[#8d6e63]">
                  {visibleItems.length}
                </span>
              </div>
              <div className="grid max-h-[44vh] gap-2 overflow-auto pr-1">
                {visibleItems.map((item) => {
                  const active = selectedItem?.id === item.id;
                  return (
                    <button
                      key={`${item.categoryId}:${item.id}`}
                      type="button"
                      onClick={() => setSelectedItemId(item.id)}
                      className={`min-h-16 rounded-[18px] px-3 py-3 text-left transition-[background-color,box-shadow,transform] duration-150 active:scale-[0.96] ${
                        active
                          ? "bg-[#111827] text-white shadow-[0_8px_0_rgba(17,24,39,0.18)]"
                          : "bg-[#f7f1ee] text-[#5d4037] shadow-[inset_0_0_0_1px_rgba(93,64,55,0.06)]"
                      }`}
                    >
                      <span className="block truncate text-sm font-black">
                        {item.name}
                      </span>
                      <span
                        className={`mt-1 block truncate text-[11px] font-bold ${
                          active ? "text-white/68" : "text-[#8d6e63]"
                        }`}
                      >
                        {item.id}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          </aside>
        </div>
      </div>
      {error ? (
        <ErrorToast message={error} onClose={() => setError(null)} />
      ) : null}
    </main>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-11 rounded-[16px] px-3 text-xs font-black uppercase tracking-[0.1em] transition-[background-color,color,transform] duration-150 active:scale-[0.96] ${
        active ? "bg-[#111827] text-white" : "bg-[#f7f1ee] text-[#8d6e63]"
      }`}
    >
      {children}
    </button>
  );
}
