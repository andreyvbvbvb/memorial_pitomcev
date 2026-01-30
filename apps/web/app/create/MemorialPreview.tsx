"use client";

import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

type Props = {
  terrainUrl?: string | null;
  houseUrl?: string | null;
  parts?: { slot: string; url: string }[];
  gifts?: { slot: string; url: string }[];
  giftSlots?: string[];
  selectedSlot?: string | null;
  onSelectSlot?: (slot: string) => void;
  colors?: Record<string, string>;
  className?: string;
};

const Primitive = "primitive" as unknown as React.ComponentType<any>;

function Model({ url, position }: { url: string; position?: [number, number, number] }) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  return <Primitive object={cloned} position={position} />;
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

function GiftSlotsOverlay({
  target,
  visible,
  slots
}: {
  target: THREE.Object3D;
  visible: boolean;
  slots?: string[];
}) {
  useEffect(() => {
    if (!visible) {
      return;
    }

    const allowed = slots && slots.length > 0 ? new Set(slots) : null;
    const anchors: THREE.Object3D[] = [];
    target.traverse((node) => {
      if (!node.name || !node.name.toLowerCase().startsWith("gift_slot_")) {
        return;
      }
      if (allowed && !allowed.has(node.name)) {
        return;
      }
      if (node.name && node.name.toLowerCase().startsWith("gift_slot_")) {
        anchors.push(node);
      }
    });

    if (anchors.length === 0) {
      console.warn("[MemorialPreview] Не найдено ни одной метки gift_slot_*");
      return;
    }

    const markers = anchors.map((anchor) => {
      const geometry = new THREE.SphereGeometry(0.08, 16, 16);
      const material = new THREE.MeshBasicMaterial({
        color: "#ff7a7a",
        transparent: true,
        opacity: 0.8
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = "__gift_marker";
      anchor.add(mesh);
      return { anchor, mesh, geometry, material };
    });

    return () => {
      markers.forEach(({ anchor, mesh, geometry, material }) => {
        anchor.remove(mesh);
        geometry.dispose();
        material.dispose();
      });
    };
  }, [target, visible, slots]);

  return null;
}

function GiftSlotButtons({
  terrain,
  slots,
  visible,
  selectedSlot,
  onSelectSlot
}: {
  terrain: THREE.Object3D;
  slots: string[];
  visible: boolean;
  selectedSlot?: string | null;
  onSelectSlot?: (slot: string) => void;
}) {
  const [anchors, setAnchors] = useState<{ slot: string; position: [number, number, number] }[]>([]);

  useEffect(() => {
    if (!visible || slots.length === 0) {
      setAnchors([]);
      return;
    }
    terrain.updateMatrixWorld(true);
    const points = slots
      .map((slot) => {
        const anchor = terrain.getObjectByName(slot);
        if (!anchor) {
          return null;
        }
        const pos = new THREE.Vector3();
        anchor.getWorldPosition(pos);
        return { slot, position: [pos.x, pos.y, pos.z] as [number, number, number] };
      })
      .filter((item): item is { slot: string; position: [number, number, number] } => Boolean(item));
    setAnchors(points);
  }, [terrain, slots, visible]);

  if (!visible || !onSelectSlot) {
    return null;
  }

  return (
    <>
      {anchors.map((anchor) => {
        const isActive = selectedSlot === anchor.slot;
        const label = anchor.slot.replace("gift_slot_", "");
        return (
          <Html key={anchor.slot} position={anchor.position} center distanceFactor={8}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSelectSlot(anchor.slot);
              }}
              className={`rounded-full border px-2 py-1 text-[10px] font-semibold shadow-sm transition ${
                isActive
                  ? "border-rose-400/80 bg-rose-500/80 text-white"
                  : "border-slate-200/80 bg-white/70 text-slate-700"
              }`}
            >
              {label}
            </button>
          </Html>
        );
      })}
    </>
  );
}

function GiftPlacementAttachment({
  terrain,
  slot,
  url
}: {
  terrain: THREE.Object3D;
  slot: string;
  url: string;
}) {
  const { scene } = useGLTF(url);
  const gift = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    const anchor = terrain.getObjectByName(slot);
    if (!anchor) {
      console.warn(`[MemorialPreview] gift slot '${slot}' не найден`);
      return;
    }
    anchor.add(gift);
    return () => {
      anchor.remove(gift);
    };
  }, [terrain, slot, gift]);

  return null;
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
      console.warn(`[MemorialPreview] slot '${slot}' не найден`);
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

function TerrainWithHouse({
  terrainUrl,
  houseUrl,
  parts,
  gifts,
  colors,
  showGiftSlots,
  giftSlots,
  selectedSlot,
  onSelectSlot
}: {
  terrainUrl: string;
  houseUrl: string;
  parts?: { slot: string; url: string }[];
  gifts?: { slot: string; url: string }[];
  colors?: Record<string, string>;
  showGiftSlots: boolean;
  giftSlots?: string[];
  selectedSlot?: string | null;
  onSelectSlot?: (slot: string) => void;
}) {
  const { scene: terrainScene } = useGLTF(terrainUrl);
  const { scene: houseScene } = useGLTF(houseUrl);
  const terrain = useMemo(() => terrainScene.clone(true), [terrainScene]);
  const house = useMemo(() => houseScene.clone(true), [houseScene]);

  useEffect(() => {
    const domSlot = terrain.getObjectByName("dom_slot");
    if (!domSlot) {
      console.warn("[MemorialPreview] slot 'dom_slot' не найден на поверхности");
      terrain.add(house);
      return;
    }
    domSlot.add(house);
    return () => {
      domSlot.remove(house);
    };
  }, [terrain, house]);

  useEffect(() => {
    applyMaterialColors(terrain, colors);
    applyMaterialColors(house, colors);
  }, [terrain, house, colors]);

  return (
    <>
      <Primitive object={terrain} />
      <GiftSlotsOverlay target={terrain} visible={showGiftSlots} slots={giftSlots} />
      {giftSlots && giftSlots.length > 0 ? (
        <GiftSlotButtons
          terrain={terrain}
          slots={giftSlots}
          visible={showGiftSlots}
          selectedSlot={selectedSlot}
          onSelectSlot={onSelectSlot}
        />
      ) : null}
      {gifts?.map((gift) => (
        <GiftPlacementAttachment
          key={`${gift.slot}-${gift.url}`}
          terrain={terrain}
          slot={gift.slot}
          url={gift.url}
        />
      ))}
      {parts?.map((part) => (
        <PartAttachment key={`${part.slot}-${part.url}`} house={house} slot={part.slot} url={part.url} colors={colors} />
      ))}
    </>
  );
}

export default function MemorialPreview({
  terrainUrl,
  houseUrl,
  parts,
  gifts,
  giftSlots,
  selectedSlot,
  onSelectSlot,
  colors,
  className
}: Props) {
  const controlsRef = useRef<any>(null);
  const baseDistance = Math.sqrt(4 * 4 + 3 * 3 + 4 * 4);
  const [showGiftSlots, setShowGiftSlots] = useState(Boolean(onSelectSlot));

  useEffect(() => {
    controlsRef.current?.saveState?.();
  }, []);

  useEffect(() => {
    if (onSelectSlot) {
      setShowGiftSlots(true);
    }
  }, [onSelectSlot]);

  return (
    <div
      className={`relative h-[320px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 ${
        className ?? ""
      }`}
    >
      <button
        type="button"
        onClick={() => controlsRef.current?.reset?.()}
        className="absolute right-3 top-3 z-10 rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs text-slate-700 shadow-sm"
      >
        Сбросить вид
      </button>
      <button
        type="button"
        onClick={() => setShowGiftSlots((prev) => !prev)}
        className="absolute left-3 top-3 z-10 rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs text-slate-700 shadow-sm"
      >
        {showGiftSlots ? "Скрыть метки подарков" : "Показать метки подарков"}
      </button>
      <Canvas camera={{ position: [4, 3, 4], fov: 45 }}>
        <color attach="background" args={["#f8fafc"]} />
        <ambientLight intensity={0.7} />
        <directionalLight intensity={1} position={[6, 8, 4]} />
        <Suspense fallback={null}>
          {terrainUrl && houseUrl ? (
            <TerrainWithHouse
              terrainUrl={terrainUrl}
              houseUrl={houseUrl}
              parts={parts}
              gifts={gifts}
              colors={colors}
              showGiftSlots={showGiftSlots}
              giftSlots={giftSlots}
              selectedSlot={selectedSlot}
              onSelectSlot={onSelectSlot}
            />
          ) : null}
          {!terrainUrl && houseUrl ? (
            <Model url={houseUrl} position={[0, 0, 0]} />
          ) : null}
        </Suspense>
        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          minPolarAngle={0}
          maxPolarAngle={Math.PI / 2}
          minDistance={baseDistance / 2}
          maxDistance={baseDistance * 2}
        />
      </Canvas>
    </div>
  );
}

useGLTF.preload("/models/terrains/TERRAIN_summer.glb");
useGLTF.preload("/models/terrains/TERRAIN_winter.glb");
useGLTF.preload("/models/houses/DOM_budka_1.glb");
useGLTF.preload("/models/houses/DOM_budka_2.glb");
useGLTF.preload("/models/parts/roof/roof_1.glb");
useGLTF.preload("/models/parts/roof/roof_2.glb");
useGLTF.preload("/models/parts/wall/wall_1.glb");
useGLTF.preload("/models/parts/wall/wall_2.glb");
useGLTF.preload("/models/parts/sign/sign_1.glb");
useGLTF.preload("/models/parts/sign/sign_2.glb");
useGLTF.preload("/models/parts/frame_left/frame_left_1.glb");
useGLTF.preload("/models/parts/frame_left/frame_left_2.glb");
useGLTF.preload("/models/parts/frame_right/frame_right_1.glb");
useGLTF.preload("/models/parts/frame_right/frame_right_2.glb");
useGLTF.preload("/models/parts/mat/mat_1.glb");
useGLTF.preload("/models/parts/mat/mat_2.glb");
useGLTF.preload("/models/parts/bowl_food/bowl_food_1.glb");
useGLTF.preload("/models/parts/bowl_food/bowl_food_2.glb");
useGLTF.preload("/models/parts/bowl_water/bowl_water_1.glb");
useGLTF.preload("/models/parts/bowl_water/bowl_water_2.glb");
useGLTF.preload("/models/gifts/candle.glb");
