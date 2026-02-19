"use client";

import {
  GoogleMap,
  InfoWindow,
  Marker,
  MarkerClusterer,
  useJsApiLoader
} from "@react-google-maps/api";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "../../lib/config";
import ErrorToast from "../../components/ErrorToast";
import { markerAnchor, markerBaseId, markerIconUrl, markerSize, markerStyles } from "../../lib/markers";
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

type MemorialSceneData = {
  terrainUrl: string;
  houseUrl: string;
  parts: { slot: string; url: string }[];
  colors?: Record<string, string>;
};

const Group = "group" as unknown as React.ComponentType<any>;
const Primitive = "primitive" as unknown as React.ComponentType<any>;
const AmbientLight = "ambientLight" as unknown as React.ComponentType<any>;
const DirectionalLight = "directionalLight" as unknown as React.ComponentType<any>;
const Color = "color" as unknown as React.ComponentType<any>;

const defaultCenter = { lat: 55.751244, lng: 37.618423 };
const containerStyle = { width: "100%", height: "100%" };
const petTypeOptions = [{ id: "all", name: "Все виды" }, ...markerStyles];

const applyMaterialColors = (root: THREE.Object3D, colors?: Record<string, string>) => {
  if (!colors) {
    return;
  }
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) {
      return;
    }
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => {
      if (!material) {
        return;
      }
      const key = material.name;
      const color = colors[key];
      const mat = material as THREE.Material & { color?: THREE.Color };
      if (color && mat.color) {
        mat.color.set(color);
        mat.needsUpdate = true;
      }
    });
  });
};

const applyMaterialTone = (root: THREE.Object3D, tone = 1) => {
  if (tone >= 0.99) {
    // restore base colors
    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) {
        return;
      }
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => {
        const mat = material as THREE.Material & { color?: THREE.Color; userData?: Record<string, unknown> };
        if (!mat.color) {
          return;
        }
        const base = mat.userData?.baseColor;
        if (base && base instanceof THREE.Color) {
          mat.color.copy(base);
          mat.needsUpdate = true;
        }
      });
    });
    return;
  }

  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) {
      return;
    }
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => {
      const mat = material as THREE.Material & { color?: THREE.Color; userData?: Record<string, unknown> };
      if (!mat.color) {
        return;
      }
      if (!mat.userData) {
        mat.userData = {};
      }
      const base =
        (mat.userData.baseColor as THREE.Color | undefined) ?? mat.color.clone();
      if (!mat.userData.baseColor) {
        mat.userData.baseColor = base.clone();
      }
      const color = base.clone();
      const l = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
      const gray = new THREE.Color(l, l, l);
      color.lerp(gray, 1 - tone);
      color.multiplyScalar(0.6 + 0.4 * tone);
      mat.color.copy(color);
      mat.needsUpdate = true;
    });
  });
};

const HIGHLIGHT_COLOR = new THREE.Color("#7dd3fc");

const applyMaterialHighlight = (root: THREE.Object3D, intensity = 0) => {
  const last = root.userData.lastHighlight as number | undefined;
  if (last !== undefined && Math.abs(last - intensity) < 0.01) {
    return;
  }
  root.userData.lastHighlight = intensity;
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) {
      return;
    }
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => {
      const mat = material as THREE.Material & {
        emissive?: THREE.Color;
        emissiveIntensity?: number;
        userData?: Record<string, unknown>;
      };
      if (!mat.emissive) {
        return;
      }
      if (!mat.userData) {
        mat.userData = {};
      }
      if (!mat.userData.baseEmissive) {
        mat.userData.baseEmissive = mat.emissive.clone();
        mat.userData.baseEmissiveIntensity = mat.emissiveIntensity ?? 0;
      }
      if (intensity > 0) {
        mat.emissive.copy(HIGHLIGHT_COLOR);
        mat.emissiveIntensity = intensity;
      } else {
        const base = mat.userData.baseEmissive as THREE.Color | undefined;
        const baseIntensity = mat.userData.baseEmissiveIntensity as number | undefined;
        if (base) {
          mat.emissive.copy(base);
        }
        if (typeof baseIntensity === "number") {
          mat.emissiveIntensity = baseIntensity;
        }
      }
      mat.needsUpdate = true;
    });
  });
};

const applyPartScale = (target: THREE.Object3D, size: number, axis: "x" | "z") => {
  if (!size || size <= 0) {
    return;
  }
  const box = new THREE.Box3().setFromObject(target);
  const sizeVec = new THREE.Vector3();
  box.getSize(sizeVec);
  const current = axis === "z" ? sizeVec.z : sizeVec.x;
  if (current <= 0) {
    return;
  }
  const scale = size / current;
  target.scale.setScalar(scale);
};

const applyPartFitScale = (target: THREE.Object3D, maxWidth: number, maxLength: number) => {
  if (!maxWidth || !maxLength || maxWidth <= 0 || maxLength <= 0) {
    return;
  }
  const box = new THREE.Box3().setFromObject(target);
  const sizeVec = new THREE.Vector3();
  box.getSize(sizeVec);
  if (sizeVec.x <= 0 || sizeVec.z <= 0) {
    return;
  }
  const scale = Math.min(maxWidth / sizeVec.x, maxLength / sizeVec.z);
  target.scale.setScalar(scale);
};

function PartInstance({
  house,
  slot,
  url,
  colors
}: {
  house: THREE.Object3D;
  slot: string;
  url: string;
  colors?: Record<string, string>;
}) {
  const { scene } = useGLTF(url);
  const part = useMemo(() => {
    const cloned = scene.clone(true);
    if (slot === "mat_slot") {
      applyPartFitScale(cloned, 1, 1.5);
    }
    if (slot === "bowl_food_slot" || slot === "bowl_water_slot") {
      applyPartScale(cloned, 0.5, "x");
    }
    return cloned;
  }, [scene, slot]);

  useEffect(() => {
    const anchor = house.getObjectByName(slot);
    if (!anchor) {
      return;
    }
    anchor.add(part);
    return () => {
      anchor.remove(part);
    };
  }, [house, slot, part]);

  useEffect(() => {
    applyMaterialColors(part, colors);
  }, [part, colors]);

  return null;
}

function TerrainWithHouseScene({ data, tone }: { data: MemorialSceneData; tone?: number }) {
  const { scene: terrainScene } = useGLTF(data.terrainUrl);
  const { scene: houseScene } = useGLTF(data.houseUrl);
  const terrain = useMemo(() => terrainScene.clone(true), [terrainScene]);
  const house = useMemo(() => houseScene.clone(true), [houseScene]);

  useEffect(() => {
    const domSlot = terrain.getObjectByName("dom_slot");
    if (!domSlot) {
      terrain.add(house);
      return;
    }
    domSlot.add(house);
    return () => {
      domSlot.remove(house);
    };
  }, [terrain, house]);

  useEffect(() => {
    applyMaterialColors(terrain, data.colors);
    applyMaterialColors(house, data.colors);
  }, [terrain, house, data.colors]);

  useEffect(() => {
    if (typeof tone !== "number") {
      return;
    }
    applyMaterialTone(terrain, tone);
    applyMaterialTone(house, tone);
  }, [terrain, house, tone]);

  return (
    <Group>
      <Primitive object={terrain} />
      {data.parts.map((part) => (
        <PartInstance key={`${part.slot}-${part.url}`} house={house} slot={part.slot} url={part.url} colors={data.colors} />
      ))}
    </Group>
  );
}

function MemorialInstance({
  data,
  tone,
  innerRef,
  onSelect,
  onHover,
  onLeave
}: {
  data: MemorialSceneData | null;
  tone: number;
  innerRef: (node: THREE.Group | null) => void;
  onSelect?: () => void;
  onHover?: () => void;
  onLeave?: () => void;
}) {
  if (!data) {
    return null;
  }
  return (
    <Group
      ref={innerRef}
      onPointerDown={(event: any) => {
        if (!onSelect) {
          return;
        }
        event.stopPropagation();
        onSelect();
      }}
      onPointerOver={(event: any) => {
        if (!onHover) {
          return;
        }
        event.stopPropagation();
        onHover();
      }}
      onPointerOut={(event: any) => {
        if (!onLeave) {
          return;
        }
        event.stopPropagation();
        onLeave();
      }}
    >
      <Group>
        <TerrainWithHouseScene data={data} tone={tone} />
      </Group>
    </Group>
  );
}

function RowCarouselStage({
  items,
  activeIndex,
  targetIndex,
  onArrive,
  onAnimationEnd,
  onSelectIndex
}: {
  items: { data: MemorialSceneData | null; id: string }[];
  activeIndex: number;
  targetIndex: number | null;
  onArrive: (index: number) => void;
  onAnimationEnd: () => void;
  onSelectIndex: (index: number) => void;
}) {
  const { camera } = useThree();
  const instanceRefs = useRef<(THREE.Group | null)[]>([]);
  const hoveredRef = useRef<number | null>(null);
  const animRef = useRef<{
    from: number;
    to: number;
    t: number;
    duration: number;
  } | null>(null);
  const activeIndexRef = useRef(activeIndex);
  const onArriveRef = useRef(onArrive);
  const onAnimationEndRef = useRef(onAnimationEnd);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    instanceRefs.current = new Array(items.length).fill(null);
  }, [items.length]);

  useEffect(() => {
    onArriveRef.current = onArrive;
  }, [onArrive]);

  useEffect(() => {
    onAnimationEndRef.current = onAnimationEnd;
  }, [onAnimationEnd]);

  useEffect(() => {
    if (targetIndex === null || animRef.current) {
      return;
    }
    animRef.current = {
      from: activeIndexRef.current,
      to: targetIndex,
      t: 0,
      duration: 1
    };
  }, [targetIndex]);

  useFrame((_, delta) => {
    const count = items.length;
    if (count === 0) {
      return;
    }
    const desiredSpacing = 10;
    const minRadius = 14;
    const radius = Math.max(minRadius, (desiredSpacing * count) / (Math.PI * 2));
    const cameraRadius = radius + 8;
    const cameraHeight = 5;
    const popDistance = 2;
    const angleStep = (Math.PI * 2) / count;

    let fromIndex = activeIndexRef.current;
    let toIndex = activeIndexRef.current;
    let blend = 0;

    if (animRef.current) {
      animRef.current.t += delta;
      blend = Math.min(animRef.current.t / animRef.current.duration, 1);
      const eased = blend * blend * (3 - 2 * blend);
      fromIndex = animRef.current.from;
      toIndex = animRef.current.to;
      const fromAngle = -fromIndex * angleStep;
      const toAngle = -toIndex * angleStep;
      const angle = THREE.MathUtils.lerp(fromAngle, toAngle, eased);
      camera.position.x = Math.cos(angle) * cameraRadius;
      camera.position.z = Math.sin(angle) * cameraRadius;
      camera.position.y = cameraHeight;
      camera.lookAt(0, 0, 0);
      if (blend >= 1) {
        onArriveRef.current(toIndex);
        activeIndexRef.current = toIndex;
        animRef.current = null;
        onAnimationEndRef.current();
      }
    } else {
      const angle = -activeIndexRef.current * angleStep;
      camera.position.x = Math.cos(angle) * cameraRadius;
      camera.position.z = Math.sin(angle) * cameraRadius;
      camera.position.y = cameraHeight;
      camera.lookAt(0, 0, 0);
    }

    const distanceBetween = (a: number, b: number) => {
      const diff = Math.abs(a - b);
      return Math.min(diff, count - diff);
    };

    instanceRefs.current.forEach((node, idx) => {
      if (!node) {
        return;
      }
      const angle = idx * angleStep;
      let pop = 0;
      if (animRef.current) {
        if (idx === fromIndex) {
          pop = popDistance * (1 - blend);
        } else if (idx === toIndex) {
          pop = popDistance * blend;
        }
      } else if (idx === activeIndexRef.current) {
        pop = popDistance;
      }
      const radial = radius + pop;
      node.position.x = Math.cos(angle) * radial;
      node.position.z = Math.sin(angle) * radial;
      node.position.y = 0;
      node.lookAt(0, 0, 0);

      const distFromFrom = distanceBetween(idx, fromIndex);
      const distFromTo = distanceBetween(idx, toIndex);
      const toneForDistance = (dist: number) =>
        dist === 0 ? 1 : dist === 1 ? 0.7 : dist === 2 ? 0.45 : 0.3;
      const toneFrom = toneForDistance(distFromFrom);
      const toneTo = toneForDistance(distFromTo);
      const tone = animRef.current ? THREE.MathUtils.lerp(toneFrom, toneTo, blend) : toneFrom;
      applyMaterialTone(node, tone);

      const hovered = hoveredRef.current === idx;
      const highlight =
        hovered || idx === activeIndexRef.current ? 0.55 : 0;
      applyMaterialHighlight(node, highlight);
    });
  });

  return (
    <>
      <Color attach="background" args={["#f8fafc"]} />
      <AmbientLight intensity={0.85} />
      <DirectionalLight intensity={1.1} position={[6, 8, 4]} />
      <DirectionalLight intensity={0.6} position={[-6, 6, -4]} />
      {items.map((item, idx) => {
        const count = items.length;
        const distanceBetween = (a: number, b: number) => {
          const diff = Math.abs(a - b);
          return Math.min(diff, count - diff);
        };
        const dist = distanceBetween(idx, activeIndex);
        const clickable = dist === 1 && targetIndex === null;
        return (
          <MemorialInstance
            key={item.id}
            data={item.data}
            tone={1}
            innerRef={(node) => {
              instanceRefs.current[idx] = node;
            }}
            onHover={() => {
              hoveredRef.current = idx;
            }}
            onLeave={() => {
              if (hoveredRef.current === idx) {
                hoveredRef.current = null;
              }
            }}
            onSelect={clickable ? () => onSelectIndex(idx) : undefined}
          />
        );
      })}
    </>
  );
}

function CarouselScene({
  items,
  activeIndex,
  targetIndex,
  onArrive,
  onAnimationEnd,
  onSelectIndex
}: {
  items: { data: MemorialSceneData | null; id: string }[];
  activeIndex: number;
  targetIndex: number | null;
  onArrive: (index: number) => void;
  onAnimationEnd: () => void;
  onSelectIndex: (index: number) => void;
}) {
  return (
    <Canvas camera={{ position: [0, 5, 16], fov: 45 }}>
      <RowCarouselStage
        items={items}
        activeIndex={activeIndex}
        targetIndex={targetIndex}
        onArrive={onArrive}
        onAnimationEnd={onAnimationEnd}
        onSelectIndex={onSelectIndex}
      />
    </Canvas>
  );
}

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
  const [carouselTargetIndex, setCarouselTargetIndex] = useState<number | null>(null);
  const [petCache, setPetCache] = useState<Record<string, PetDetail>>({});
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

  useEffect(() => {
    if (filteredMarkers.length === 0) {
      setCarouselOrder([]);
      setCarouselIndex(0);
      setCarouselTargetIndex(null);
      return;
    }
    const shuffled = [...filteredMarkers].sort(() => Math.random() - 0.5);
    setCarouselOrder(shuffled);
    setCarouselIndex(0);
    setCarouselTargetIndex(null);
  }, [filteredMarkers]);

  const activeCarouselMarker = carouselOrder[carouselIndex] ?? null;

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
    if (carouselOrder.length === 0) {
      return;
    }
    const range = 3;
    const ids = new Set<string>();
    for (let offset = -range; offset <= range; offset += 1) {
      const idx = (carouselIndex + offset + carouselOrder.length) % carouselOrder.length;
      const marker = carouselOrder[idx];
      if (marker?.petId) {
        ids.add(marker.petId);
      }
    }
    ids.forEach((id) => {
      void loadPetDetail(id);
    });
  }, [mapMode, carouselIndex, carouselOrder]);

  const buildMemorialSceneData = useCallback((marker: MarkerDto | null): MemorialSceneData | null => {
    if (!marker) {
      return null;
    }
    const pet = petCache[marker.petId];
    const memorial = pet?.memorial;
    const environmentUrl = resolveEnvironmentModel(memorial?.environmentId);
    const houseUrl = resolveHouseModel(memorial?.houseId);
    if (!environmentUrl || !houseUrl) {
      return null;
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

    return {
      terrainUrl: environmentUrl,
      houseUrl,
      parts,
      colors: sceneJson.colors ?? undefined
    };
  }, [petCache]);

  const carouselItems = useMemo(
    () =>
      carouselOrder.map((marker) => ({
        id: marker.id,
        data: buildMemorialSceneData(marker)
      })),
    [carouselOrder, buildMemorialSceneData]
  );

  const handleCarouselArrive = (index: number) => {
    setCarouselIndex(index);
  };

  const handleCarouselAnimationEnd = () => {
    setCarouselTargetIndex(null);
  };

  const handleCarouselPrev = () => {
    if (carouselOrder.length < 2 || carouselTargetIndex !== null) {
      return;
    }
    const nextIndex =
      (carouselIndex - 1 + carouselOrder.length) % carouselOrder.length;
    setCarouselTargetIndex(nextIndex);
  };

  const handleCarouselNext = () => {
    if (carouselOrder.length < 2 || carouselTargetIndex !== null) {
      return;
    }
    const nextIndex = (carouselIndex + 1) % carouselOrder.length;
    setCarouselTargetIndex(nextIndex);
  };

  const activeCarouselPet = activeCarouselMarker ? petCache[activeCarouselMarker.petId] : null;
  const activePreviewUrl = activeCarouselMarker?.previewPhotoUrl;
  const activePreviewSrc = activePreviewUrl
    ? activePreviewUrl.startsWith("http")
      ? activePreviewUrl
      : `${apiUrl}${activePreviewUrl}`
    : null;
  const canRotate = carouselOrder.length > 1 && carouselTargetIndex === null;

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
                <div className="pointer-events-auto relative h-[60vh] w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur">
                  <CarouselScene
                    items={carouselItems}
                    activeIndex={carouselIndex}
                    targetIndex={carouselTargetIndex}
                    onArrive={handleCarouselArrive}
                    onAnimationEnd={handleCarouselAnimationEnd}
                    onSelectIndex={(index) => {
                      if (carouselTargetIndex !== null) {
                        return;
                      }
                      setCarouselTargetIndex(index);
                    }}
                  />
                </div>
                <div className="pointer-events-auto mt-4 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={handleCarouselPrev}
                    disabled={!canRotate}
                    className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm text-slate-700 shadow-sm transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={handleCarouselNext}
                    disabled={!canRotate}
                    className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm text-slate-700 shadow-sm transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
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
