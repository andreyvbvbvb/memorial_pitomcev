"use client";

import Link from "next/link";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, useTexture } from "@react-three/drei";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { ensureDracoLoader } from "../lib/draco";
import usePortraitLayout from "./usePortraitLayout";
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
} from "../lib/memorial-models";

ensureDracoLoader();
import { getHouseSlots } from "../lib/memorial-config";
import { splitHouseVariantId } from "../lib/house-variants";
import { applyHousePlacement, getHouseTransform } from "../lib/house-layout";

type SceneParts = {
  roof?: string;
  wall?: string;
  sign?: string;
  frameLeft?: string;
  frameRight?: string;
  mat?: string;
  bowlFood?: string;
  bowlWater?: string;
};

type MemorialScene = {
  environmentId: string | null;
  houseId: string | null;
  sceneJson: Record<string, unknown> | null;
};

export type MyPets3DViewPet = {
  id: string;
  name: string;
  birthDate: string | null;
  deathDate: string | null;
  epitaph: string | null;
  isPublic: boolean;
  previewUrl: string | null;
  memorial?: MemorialScene | null;
};

type SceneItem = {
  pet: MyPets3DViewPet;
  position: [number, number, number];
  rotation: [number, number, number];
};

const Primitive = "primitive" as unknown as React.ComponentType<any>;
const Group = "group" as unknown as React.ComponentType<any>;
const Color = "color" as unknown as React.ComponentType<any>;
const AmbientLight = "ambientLight" as unknown as React.ComponentType<any>;
const DirectionalLight = "directionalLight" as unknown as React.ComponentType<any>;
const Mesh = "mesh" as unknown as React.ComponentType<any>;
const SphereGeometry = "sphereGeometry" as unknown as React.ComponentType<any>;
const MeshBasicMaterial = "meshBasicMaterial" as unknown as React.ComponentType<any>;

const DEFAULT_CAMERA = new THREE.Vector3(0, 9, 18);
const DEFAULT_TARGET = new THREE.Vector3(0, 0, 0);
const CLICK_DRAG_THRESHOLD = 6;
const HOUSE_MAX_WIDTH = 2.5;
const HOUSE_MAX_HEIGHT = 4;
const KOTIK_MAX_HEIGHT = 2.5;

function formatYear(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.getFullYear();
}

function formatYearRange(birthDate: string | null, deathDate: string | null) {
  const birthYear = formatYear(birthDate);
  const deathYear = formatYear(deathDate);
  if (birthYear && deathYear) {
    return `${birthYear} — ${deathYear}`;
  }
  return birthYear ?? deathYear ?? "Годы не указаны";
}

function applyHouseScale(
  target: THREE.Object3D,
  houseId?: string | null,
  terrainId?: string | null
) {
  const baseId = splitHouseVariantId(houseId ?? "").baseId || houseId || "";
  const maxHeight = baseId.startsWith("kotik") ? KOTIK_MAX_HEIGHT : HOUSE_MAX_HEIGHT;
  const maxWidth = baseId === "kotik_2" || baseId === "kotik_6" ? 2 : HOUSE_MAX_WIDTH;
  const { scale: scaleMultiplier } = getHouseTransform(houseId, terrainId);
  const box = new THREE.Box3().setFromObject(target);
  const sizeVec = new THREE.Vector3();
  box.getSize(sizeVec);
  if (sizeVec.x <= 0 || sizeVec.y <= 0) {
    return;
  }
  const scale = Math.min(maxWidth / sizeVec.x, maxHeight / sizeVec.y) * scaleMultiplier;
  if (Number.isFinite(scale) && scale > 0) {
    target.scale.setScalar(scale);
  }
}

function SkyBackground() {
  const texture = useTexture("/nebo.png");
  const sphereRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    if (!texture?.image) {
      return;
    }
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
  }, [texture]);

  useFrame(({ camera }) => {
    if (!sphereRef.current) {
      return;
    }
    sphereRef.current.position.copy(camera.position);
  });

  if (!texture?.image) {
    return <Color attach="background" args={["#f3f0ee"]} />;
  }

  return (
    <>
      <Color attach="background" args={["#f3f0ee"]} />
      <Mesh ref={sphereRef} renderOrder={-20} raycast={() => null}>
        <SphereGeometry args={[120, 64, 64]} />
        <MeshBasicMaterial map={texture} side={THREE.BackSide} depthWrite={false} />
      </Mesh>
    </>
  );
}

function applyMaterialColors(root: THREE.Object3D, colors?: Record<string, string>) {
  if (!colors) {
    return;
  }
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) {
      return;
    }
    if (!mesh.userData.__clonedMaterial) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const cloned = materials
        .map((material) => (material as THREE.Material | undefined)?.clone?.())
        .filter((material): material is THREE.Material => Boolean(material));
      if (cloned.length > 0) {
        mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0] ?? mesh.material;
        mesh.userData.__clonedMaterial = true;
      }
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
}

function applyPartScale(target: THREE.Object3D, size: number, axis: "x" | "z") {
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
}

function applyPartFitScale(target: THREE.Object3D, maxWidth: number, maxLength: number) {
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
}

function PartAttachment({
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
      applyPartFitScale(cloned, 1.25, 1.875);
    }
    if (slot === "bowl_food_slot" || slot === "bowl_water_slot") {
      applyPartScale(cloned, 0.575, "x");
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

function MemorialInstance({
  item,
  isActive,
  onSelect,
  orbitMovedRef
}: {
  item: SceneItem;
  isActive: boolean;
  onSelect: () => void;
  orbitMovedRef?: React.MutableRefObject<boolean>;
}) {
  const memorial = item.pet.memorial;
  const environmentUrl = resolveEnvironmentModel(memorial?.environmentId);
  const houseUrl = resolveHouseModel(memorial?.houseId);
  const houseSlots = getHouseSlots(memorial?.houseId);
  const sceneJson = (memorial?.sceneJson ?? {}) as {
    parts?: SceneParts;
    colors?: Record<string, string>;
  };
  const parts = useMemo(
    () =>
      [
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
      ].filter((part): part is { slot: string; url: string } => Boolean(part?.url)),
    [houseSlots, sceneJson.parts]
  );

  if (!environmentUrl || !houseUrl) {
    return null;
  }
  const terrainGltf = useGLTF(environmentUrl) as unknown as { scene: THREE.Object3D };
  const houseGltf = useGLTF(houseUrl) as unknown as { scene: THREE.Object3D };
  const terrainScene = terrainGltf.scene;
  const houseScene = houseGltf.scene;
  const terrain = useMemo(() => terrainScene.clone(true), [terrainScene]);
  const house = useMemo(() => {
    const cloned = houseScene.clone(true);
    applyHouseScale(cloned, memorial?.houseId ?? null, memorial?.environmentId ?? null);
    applyHousePlacement(cloned, memorial?.houseId ?? null, memorial?.environmentId ?? null);
    return cloned;
  }, [houseScene, memorial?.houseId, memorial?.environmentId]);

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
    applyMaterialColors(terrain, sceneJson.colors);
    applyMaterialColors(house, sceneJson.colors);
  }, [terrain, house, sceneJson.colors]);

  const pointerStateRef = useRef<{
    x: number;
    y: number;
    moved: boolean;
    pointerId: number | null;
  } | null>(null);

  return (
    <Group
      position={item.position}
      rotation={item.rotation}
      scale={isActive ? 1.05 : 1}
      onPointerDown={(event: any) => {
        event.stopPropagation();
        if (orbitMovedRef) {
          orbitMovedRef.current = false;
        }
        pointerStateRef.current = {
          x: event.clientX,
          y: event.clientY,
          moved: false,
          pointerId: typeof event.pointerId === "number" ? event.pointerId : null
        };
      }}
      onPointerMove={(event: any) => {
        const state = pointerStateRef.current;
        if (!state) {
          return;
        }
        if (state.pointerId !== null && event.pointerId !== state.pointerId) {
          return;
        }
        const dx = event.clientX - state.x;
        const dy = event.clientY - state.y;
        if (Math.hypot(dx, dy) >= CLICK_DRAG_THRESHOLD) {
          state.moved = true;
        }
      }}
      onPointerUp={(event: any) => {
        event.stopPropagation();
        const state = pointerStateRef.current;
        pointerStateRef.current = null;
        if (orbitMovedRef?.current) {
          return;
        }
        if (state?.moved) {
          return;
        }
        onSelect();
      }}
      onPointerOver={() => {
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "";
      }}
    >
      <Primitive object={terrain} />
      {parts.map((part) => (
        <PartAttachment key={`${part.slot}-${part.url}`} house={house} slot={part.slot} url={part.url} colors={sceneJson.colors} />
      ))}
    </Group>
  );
}

function SceneCameraRig({
  focus,
  controlsRef
}: {
  focus: [number, number, number] | null;
  controlsRef: React.MutableRefObject<any>;
}) {
  const { camera } = useThree();
  const animationRef = useRef<{
    elapsed: number;
    duration: number;
    startPos: THREE.Vector3;
    startTarget: THREE.Vector3;
    endPos: THREE.Vector3;
    endTarget: THREE.Vector3;
  } | null>(null);

  useEffect(() => {
    const controls = controlsRef.current;
    const currentTarget = controls ? controls.target.clone() : DEFAULT_TARGET.clone();
    const startPos = camera.position.clone();
    const startTarget = currentTarget;
    const endTarget = focus
      ? new THREE.Vector3(focus[0], focus[1] + 0.8, focus[2])
      : DEFAULT_TARGET.clone();
    const endPos = focus
      ? endTarget.clone().add(new THREE.Vector3(5.2, 3.4, 6.4))
      : DEFAULT_CAMERA.clone();
    animationRef.current = {
      elapsed: 0,
      duration: 1.1,
      startPos,
      startTarget,
      endPos,
      endTarget
    };
  }, [focus, camera, controlsRef]);

  useFrame((_, delta) => {
    const anim = animationRef.current;
    if (!anim) {
      return;
    }
    anim.elapsed += delta;
    const t = Math.min(anim.elapsed / anim.duration, 1);
    const eased = t * (2 - t);
    camera.position.lerpVectors(anim.startPos, anim.endPos, eased);
    const target = new THREE.Vector3().lerpVectors(anim.startTarget, anim.endTarget, eased);
    const controls = controlsRef.current;
    if (controls) {
      controls.target.copy(target);
      controls.update();
    } else {
      camera.lookAt(target);
    }
    if (t >= 1) {
      animationRef.current = null;
    }
  });

  return null;
}

function buildGridPositions(count: number) {
  const columns = Math.max(1, Math.ceil(Math.sqrt(count)));
  const rows = Math.ceil(count / columns);
  const spacing = 12;
  const positions: [number, number, number][] = [];
  for (let index = 0; index < count; index += 1) {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const x = (col - (columns - 1) / 2) * spacing;
    const z = (row - (rows - 1) / 2) * spacing;
    positions.push([x, 0, z]);
  }
  return positions;
}

function SceneLoadingOverlay({ label }: { label: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-[#fcf8f5]/86 backdrop-blur-sm">
      <div className="flex w-[min(18rem,78vw)] flex-col items-center gap-3 text-center text-sm font-semibold text-[#6f6360]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#d8cfc9] border-t-[#5d4037]" />
        <span>{label}</span>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[#eadfd9]">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-[#8d6e63]" />
        </div>
      </div>
    </div>
  );
}

function SceneReady({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    onReady();
  }, [onReady]);
  return null;
}

export default function MyPets3DView({
  pets,
  loading,
  fullScreen
}: {
  pets: MyPets3DViewPet[];
  loading?: boolean;
  fullScreen?: boolean;
}) {
  const isPortraitLayout = usePortraitLayout();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hasArrowNavigation, setHasArrowNavigation] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const controlsRef = useRef<any>(null);
  const orbitMovedRef = useRef(false);
  const orbitingRef = useRef(false);
  const orbitEndTimeoutRef = useRef<number | null>(null);
  const autoSelectedSignatureRef = useRef<string | null>(null);

  const items = useMemo<SceneItem[]>(() => {
    const positions = buildGridPositions(pets.length);
    return pets.map((pet, index) => ({
      pet,
      position: positions[index] ?? [0, 0, 0],
      rotation: [0, (index % 6) * 0.35, 0]
    }));
  }, [pets]);

  const selectedItem = items.find((item) => item.pet.id === selectedId) ?? null;
  const selectedIndex = selectedItem
    ? items.findIndex((item) => item.pet.id === selectedItem.pet.id)
    : -1;
  const focusPosition = selectedItem ? selectedItem.position : null;
  const petsSignature = useMemo(() => pets.map((pet) => pet.id).join("|"), [pets]);
  const handleSceneReady = useCallback(() => setSceneReady(true), []);

  const containerClassName = fullScreen
    ? "fixed inset-0 z-0 h-screen w-screen overflow-hidden bg-slate-50"
    : "relative h-[calc(100vh-220px)] min-h-[520px] w-full overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50 shadow-sm";
  const canvasFrameClass = fullScreen && isPortraitLayout
    ? "absolute left-0 right-0 top-0 h-[60dvh] overflow-hidden"
    : "absolute inset-0";
  const infoAsideClass = isPortraitLayout
    ? "absolute bottom-[calc(4.25rem+env(safe-area-inset-bottom))] left-2 right-2 z-20 max-h-[min(38dvh,21rem)] overflow-y-auto rounded-[20px] border-2 border-white bg-[#f7f1ee]/95 p-2 shadow-[0_18px_44px_-24px_rgba(0,0,0,0.3)] backdrop-blur"
    : "absolute right-6 top-1/2 z-20 w-[340px] -translate-y-1/2 rounded-[32px] border-[4px] border-white bg-[#f7f1ee]/95 p-4 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.28)] backdrop-blur";
  const infoCardClass = isPortraitLayout
    ? "rounded-[20px] border border-white/80 bg-white/85 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_24px_rgba(126,102,93,0.08)]"
    : "rounded-[26px] border border-white/80 bg-white/85 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_24px_rgba(126,102,93,0.08)]";
  const infoImageClass = isPortraitLayout
    ? "h-[clamp(7.5rem,18dvh,9.5rem)] w-[clamp(7.5rem,18dvh,9.5rem)] rounded-[24px] object-cover"
    : "h-36 w-36 rounded-[28px] object-cover";
  const infoImageFallbackClass = isPortraitLayout
    ? "h-[clamp(7.5rem,18dvh,9.5rem)] w-[clamp(7.5rem,18dvh,9.5rem)] rounded-[24px] bg-slate-200"
    : "h-36 w-36 rounded-[28px] bg-slate-200";
  const sideNavButtonClass = (side: "left" | "right") =>
    `group absolute z-10 flex items-center ${
      side === "left" ? "left-0 justify-start" : "right-0 justify-end"
    } ${fullScreen && isPortraitLayout ? "top-0 h-[60dvh] w-14 px-1" : "bottom-0 top-0 w-28 px-4"}`;
  const sideNavIconClass = `flex items-center justify-center rounded-full border-[3px] border-white bg-white/90 text-[#5d4037] shadow-[0_14px_32px_-18px_rgba(0,0,0,0.45)] backdrop-blur transition-all duration-200 group-hover:opacity-100 ${
    fullScreen && isPortraitLayout ? "h-10 w-10" : "h-14 w-14"
  }`;

  useEffect(() => {
    return () => {
      if (orbitEndTimeoutRef.current !== null) {
        window.clearTimeout(orbitEndTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (pets.length === 0) {
      setSelectedId(null);
      autoSelectedSignatureRef.current = petsSignature;
      return;
    }
    const selectedExists = selectedId
      ? pets.some((pet) => pet.id === selectedId)
      : false;
    if (selectedExists) {
      return;
    }
    if (autoSelectedSignatureRef.current !== petsSignature || selectedId) {
      autoSelectedSignatureRef.current = petsSignature;
      setSelectedId(pets[0]?.id ?? null);
    }
  }, [pets, petsSignature, selectedId]);

  useEffect(() => {
    setSceneReady(false);
  }, [loading, petsSignature]);

  const navigateMemorial = (direction: -1 | 1) => {
    if (items.length === 0) {
      return;
    }
    const currentIndex = selectedIndex >= 0 ? selectedIndex : 0;
    const nextIndex = (currentIndex + direction + items.length) % items.length;
    setSelectedId(items[nextIndex]?.pet.id ?? null);
    setHasArrowNavigation(true);
  };

  return (
    <div className={containerClassName}>
      {loading ? (
        <SceneLoadingOverlay label="Загружаем ваши мемориалы..." />
      ) : null}
      {!loading && items.length > 0 && !sceneReady ? (
        <SceneLoadingOverlay label="Загружаем 3D-превью..." />
      ) : null}
      {pets.length === 0 && !loading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-slate-500">
          Пока нет мемориалов.
        </div>
      ) : null}

      <div className={canvasFrameClass}>
        <Canvas
          className="h-full w-full"
          dpr={1}
          camera={{ position: [DEFAULT_CAMERA.x, DEFAULT_CAMERA.y, DEFAULT_CAMERA.z], fov: 45 }}
        >
          <SkyBackground />
          <AmbientLight intensity={0.8} />
          <DirectionalLight intensity={1.15} position={[7, 10, 6]} />
          <Suspense fallback={null}>
            {items.map((item) => (
              <MemorialInstance
                key={item.pet.id}
                item={item}
                isActive={selectedId === item.pet.id}
                onSelect={() => setSelectedId(item.pet.id)}
                orbitMovedRef={orbitMovedRef}
              />
            ))}
            {items.length > 0 ? <SceneReady onReady={handleSceneReady} /> : null}
          </Suspense>
          <OrbitControls
            ref={controlsRef}
            enablePan={false}
            minPolarAngle={0}
            maxPolarAngle={Math.PI / 2}
            minDistance={6}
            maxDistance={40}
            onStart={() => {
              if (orbitEndTimeoutRef.current !== null) {
                window.clearTimeout(orbitEndTimeoutRef.current);
              }
              orbitingRef.current = true;
              orbitMovedRef.current = false;
            }}
            onChange={() => {
              if (orbitingRef.current) {
                orbitMovedRef.current = true;
              }
            }}
            onEnd={() => {
              if (orbitEndTimeoutRef.current !== null) {
                window.clearTimeout(orbitEndTimeoutRef.current);
              }
              orbitEndTimeoutRef.current = window.setTimeout(() => {
                orbitingRef.current = false;
                orbitMovedRef.current = false;
              }, 200);
            }}
          />
          <SceneCameraRig focus={focusPosition} controlsRef={controlsRef} />
        </Canvas>
      </div>

      {selectedItem ? (
        <aside className={infoAsideClass}>
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="absolute right-4 top-4 h-8 w-8 rounded-full border border-[#eadfd9] bg-white text-lg text-[#8d6e63] transition hover:text-[#5d4037]"
            aria-label="Закрыть"
          >
            ×
          </button>
          <div className={infoCardClass}>
            <div className="flex items-start gap-4">
              <div className="relative">
                {selectedItem.pet.previewUrl ? (
                  <img
                    src={selectedItem.pet.previewUrl}
                    alt={`Фото ${selectedItem.pet.name}`}
                    className={infoImageClass}
                    loading="lazy"
                  />
                ) : (
                  <div className={infoImageFallbackClass} />
                )}
                <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full border border-white bg-white/90 px-2.5 py-1 shadow-sm backdrop-blur">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      selectedItem.pet.isPublic ? "bg-[#3bceac]" : "bg-[#adb5bd]"
                    }`}
                  />
                  <span className="text-[9px] font-black uppercase text-[#5d4037]">
                    {selectedItem.pet.isPublic ? "Публичный" : "Приватный"}
                  </span>
                </div>
              </div>
              <div className="min-w-0 flex-1 pt-1">
                <h3 className="text-xl font-black uppercase tracking-tight text-[#5d4037]">
                  {selectedItem.pet.name}
                </h3>
                <p className="mt-1 text-sm font-semibold text-[#8d6e63]">
                  {formatYearRange(selectedItem.pet.birthDate, selectedItem.pet.deathDate)}
                </p>
              </div>
            </div>
            <p className="mt-4 text-[15px] italic leading-relaxed text-[#6f6360]">
              &ldquo;{selectedItem.pet.epitaph ?? "Без эпитафии"}&rdquo;
            </p>
            <div className="mt-5">
              <Link
                href={`/pets/${selectedItem.pet.id}`}
                className="group inline-flex w-full items-center justify-center rounded-xl bg-[#c8d8cf] px-7 py-3 text-[1rem] font-black text-[#355148] shadow-[0_4px_0_0_#8ca79c] transition-all hover:brightness-105 active:translate-y-[4px] active:shadow-none"
              >
                <span className="transition-transform duration-300 group-hover:-translate-x-1">
                  Открыть мемориал
                </span>
                <svg
                  viewBox="0 0 24 24"
                  className="ml-2 h-5 w-5 text-current transition-transform duration-300 group-hover:translate-x-1"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14" />
                  <path d="m13 5 7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </aside>
      ) : null}

      {items.length > 1 ? (
        <>
          <button
            type="button"
            onClick={() => navigateMemorial(-1)}
            aria-label="Предыдущий мемориал"
            className={sideNavButtonClass("left")}
          >
            <span
              className={`${sideNavIconClass} group-hover:translate-x-1 ${
                hasArrowNavigation ? "opacity-0" : "opacity-100"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-7 w-7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M15 18 9 12l6-6" />
              </svg>
            </span>
          </button>
          <button
            type="button"
            onClick={() => navigateMemorial(1)}
            aria-label="Следующий мемориал"
            className={sideNavButtonClass("right")}
          >
            <span
              className={`${sideNavIconClass} group-hover:-translate-x-1 ${
                hasArrowNavigation ? "opacity-0" : "opacity-100"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-7 w-7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </span>
          </button>
        </>
      ) : null}
    </div>
  );
}
