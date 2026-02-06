"use client";

import Link from "next/link";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
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
import { getHouseSlots } from "../lib/memorial-config";

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

const DEFAULT_CAMERA = new THREE.Vector3(0, 9, 18);
const DEFAULT_TARGET = new THREE.Vector3(0, 0, 0);

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
      const cloned = materials.map((material) => (material as THREE.Material).clone());
      mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
      mesh.userData.__clonedMaterial = true;
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
  const part = useMemo(() => scene.clone(true), [scene]);

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
  onSelect
}: {
  item: SceneItem;
  isActive: boolean;
  onSelect: () => void;
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

  const { scene: terrainScene } = useGLTF(environmentUrl);
  const { scene: houseScene } = useGLTF(houseUrl);
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
    applyMaterialColors(terrain, sceneJson.colors);
    applyMaterialColors(house, sceneJson.colors);
  }, [terrain, house, sceneJson.colors]);

  return (
    <Group
      position={item.position}
      rotation={item.rotation}
      scale={isActive ? 1.05 : 1}
      onPointerDown={(event: any) => {
        event.stopPropagation();
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
  const spacing = 9;
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

export default function MyPets3DView({
  pets,
  loading
}: {
  pets: MyPets3DViewPet[];
  loading?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const controlsRef = useRef<any>(null);

  const items = useMemo<SceneItem[]>(() => {
    const positions = buildGridPositions(pets.length);
    return pets.map((pet, index) => ({
      pet,
      position: positions[index] ?? [0, 0, 0],
      rotation: [0, (index % 6) * 0.35, 0]
    }));
  }, [pets]);

  const selectedItem = items.find((item) => item.pet.id === selectedId) ?? null;
  const focusPosition = selectedItem ? selectedItem.position : null;

  return (
    <div className="relative h-[calc(100vh-220px)] min-h-[520px] w-full overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50 shadow-sm">
      {loading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 text-sm text-slate-500">
          Загрузка...
        </div>
      ) : null}
      {pets.length === 0 && !loading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-slate-500">
          Пока нет мемориалов.
        </div>
      ) : null}

      <Canvas
        className="h-full w-full"
        camera={{ position: [DEFAULT_CAMERA.x, DEFAULT_CAMERA.y, DEFAULT_CAMERA.z], fov: 45 }}
      >
        <Color attach="background" args={["#f3f0ee"]} />
        <AmbientLight intensity={0.8} />
        <DirectionalLight intensity={1.15} position={[7, 10, 6]} />
        <Suspense fallback={null}>
          {items.map((item) => (
            <MemorialInstance
              key={item.pet.id}
              item={item}
              isActive={selectedId === item.pet.id}
              onSelect={() => setSelectedId(item.pet.id)}
            />
          ))}
        </Suspense>
        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          minPolarAngle={0}
          maxPolarAngle={Math.PI / 2}
          minDistance={6}
          maxDistance={40}
        />
        <SceneCameraRig focus={focusPosition} controlsRef={controlsRef} />
      </Canvas>

      {selectedItem ? (
        <aside className="absolute right-6 top-1/2 z-20 w-[320px] -translate-y-1/2 rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-xl backdrop-blur">
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="absolute right-3 top-3 h-8 w-8 rounded-full border border-slate-200 bg-white text-lg text-slate-500 transition hover:text-slate-800"
            aria-label="Закрыть"
          >
            ×
          </button>
          <div className="flex items-center gap-3">
            {selectedItem.pet.previewUrl ? (
              <img
                src={selectedItem.pet.previewUrl}
                alt={`Фото ${selectedItem.pet.name}`}
                className="h-14 w-14 rounded-2xl object-cover"
                loading="lazy"
              />
            ) : (
              <div className="h-14 w-14 rounded-2xl bg-slate-200" />
            )}
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Мемориал</p>
              <h3 className="text-lg font-semibold text-slate-900">{selectedItem.pet.name}</h3>
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            {selectedItem.pet.epitaph ?? "Без эпитафии"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
            {selectedItem.pet.birthDate ? (
              <span className="rounded-full bg-slate-100 px-3 py-1">
                Рождение: {new Date(selectedItem.pet.birthDate).toLocaleDateString()}
              </span>
            ) : null}
            {selectedItem.pet.deathDate ? (
              <span className="rounded-full bg-slate-100 px-3 py-1">
                Уход: {new Date(selectedItem.pet.deathDate).toLocaleDateString()}
              </span>
            ) : null}
            <span className="rounded-full bg-slate-100 px-3 py-1">
              {selectedItem.pet.isPublic ? "Публичный" : "Приватный"}
            </span>
          </div>
          <div className="mt-5">
            <Link href={`/pets/${selectedItem.pet.id}`} className="btn btn-primary w-full">
              Открыть мемориал
            </Link>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
