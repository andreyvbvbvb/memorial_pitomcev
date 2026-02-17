"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls, useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  environmentModelByIdGenerated,
  houseModelByIdGenerated,
  roofModelByIdGenerated,
  wallModelByIdGenerated,
  signModelByIdGenerated,
  frameLeftModelByIdGenerated,
  frameRightModelByIdGenerated,
  matModelByIdGenerated,
  bowlFoodModelByIdGenerated,
  bowlWaterModelByIdGenerated
} from "../../lib/memorial-models.generated";
import { isGiftSlotName, parseGiftSlot, resolveGiftTargetWidth } from "../../lib/gifts";

type Props = {
  terrainUrl?: string | null;
  houseUrl?: string | null;
  parts?: { slot: string; url: string }[];
  gifts?: { slot: string; url: string; name?: string; owner?: string; expiresAt?: string | null }[];
  giftSlots?: string[];
  selectedSlot?: string | null;
  onSelectSlot?: (slot: string) => void;
  onGiftSlotsDetected?: (slots: string[]) => void;
  focusSlot?: string | null;
  colors?: Record<string, string>;
  backgroundColor?: string;
  className?: string;
  style?: React.CSSProperties;
};

type GiftHover = {
  slot: string;
  position: [number, number, number];
  name?: string;
  owner?: string;
  expiresAt?: string | null;
};

const Primitive = "primitive" as unknown as React.ComponentType<any>;
const Color = "color" as unknown as React.ComponentType<any>;
const AmbientLight = "ambientLight" as unknown as React.ComponentType<any>;
const DirectionalLight = "directionalLight" as unknown as React.ComponentType<any>;
const Group = "group" as unknown as React.ComponentType<any>;
const Mesh = "mesh" as unknown as React.ComponentType<any>;
const SphereGeometry = "sphereGeometry" as unknown as React.ComponentType<any>;
const MeshBasicMaterial = "meshBasicMaterial" as unknown as React.ComponentType<any>;
const HemisphereLight = "hemisphereLight" as unknown as React.ComponentType<any>;
const DEFAULT_TARGET = new THREE.Vector3(0, 0.6, 0);
const DEFAULT_CAMERA = new THREE.Vector3(4, 3, 4);
const DEFAULT_FOCUS_OFFSET = new THREE.Vector3(2.6, 1.8, 2.6);

const collectGiftSlots = (target: THREE.Object3D) => {
  const found = new Set<string>();
  target.traverse((node) => {
    if (!isGiftSlotName(node.name)) {
      return;
    }
    found.add(node.name);
  });
  return Array.from(found).sort((a, b) => {
    const aInfo = parseGiftSlot(a);
    const bInfo = parseGiftSlot(b);
    const aType = aInfo?.type ?? "";
    const bType = bInfo?.type ?? "";
    if (aType !== bType) {
      return aType.localeCompare(bType);
    }
    const aIndex = aInfo?.index ?? null;
    const bIndex = bInfo?.index ?? null;
    if (aIndex !== null && bIndex !== null && aIndex !== bIndex) {
      return aIndex - bIndex;
    }
    return a.localeCompare(b);
  });
};

function SceneBackground({ backgroundColor }: { backgroundColor: string }) {
  const texture = useTexture("/nebo.png");
  const hasTexture = Boolean(texture?.image);
  const sphereRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    if (!hasTexture) {
      return;
    }
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
  }, [texture, hasTexture]);

  useFrame(({ camera }) => {
    if (!sphereRef.current) {
      return;
    }
    sphereRef.current.position.copy(camera.position);
  });

  if (!hasTexture) {
    return <Color attach="background" args={[backgroundColor]} />;
  }

  return (
    <>
      <Color attach="background" args={[backgroundColor]} />
      <Mesh ref={sphereRef} renderOrder={-10}>
        <SphereGeometry args={[80, 64, 64]} />
        <MeshBasicMaterial
          map={texture}
          side={THREE.BackSide}
          depthWrite={false}
          transparent
        />
      </Mesh>
    </>
  );
}

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

function applyGiftScale(target: THREE.Object3D, width: number) {
  if (!width || width <= 0) {
    return;
  }
  const box = new THREE.Box3().setFromObject(target);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (size.x <= 0) {
    return;
  }
  const scale = width / size.x;
  target.scale.setScalar(scale);
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

function SceneCameraRig({
  focus,
  direction,
  focusSlot,
  controlsRef
}: {
  focus: [number, number, number] | null;
  direction: [number, number, number] | null;
  focusSlot?: string | null;
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
      ? new THREE.Vector3(focus[0], focus[1] + 0.6, focus[2])
      : DEFAULT_TARGET.clone();
    let offset = DEFAULT_FOCUS_OFFSET.clone();
    const isSideFrame =
      focusSlot === "frame_right_slot" || focusSlot === "frame_left_slot";
    if (focus && isSideFrame) {
      const sideSign = focus[0] >= 0 ? 1 : -1;
      offset = new THREE.Vector3(2.8 * sideSign, 1.4, 0.4);
    } else if (focus && direction) {
      const dir = new THREE.Vector3(direction[0], direction[1], direction[2]);
      if (dir.lengthSq() > 0.0001) {
        offset = dir.normalize().multiplyScalar(2.6);
        offset.y += 1.4;
      }
    }
    const endPos = focus ? endTarget.clone().add(offset) : DEFAULT_CAMERA.clone();
    animationRef.current = {
      elapsed: 0,
      duration: 0.9,
      startPos,
      startTarget,
      endPos,
      endTarget
    };
  }, [focus, direction, focusSlot, camera, controlsRef]);

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

function GiftSlotsOverlay({
  target,
  visible,
  slots
}: {
  target: THREE.Object3D;
  visible: boolean;
  slots?: string[];
}) {
  const { scene } = useGLTF("/models/gifts/slot_placeholder.glb");
  const placeholder = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const allowed = slots && slots.length > 0 ? new Set(slots) : null;
    const anchors: THREE.Object3D[] = [];
    target.traverse((node) => {
      if (!isGiftSlotName(node.name)) {
        return;
      }
      if (allowed && !allowed.has(node.name)) {
        return;
      }
      anchors.push(node);
    });

    if (anchors.length === 0) {
      console.warn("[MemorialPreview] Не найдено ни одной метки gift_*");
      return;
    }

    const markers = anchors.map((anchor) => {
      const model = placeholder.clone(true);
      model.name = "__gift_placeholder";
      anchor.add(model);
      return { anchor, model };
    });

    return () => {
      markers.forEach(({ anchor, model }) => {
        anchor.remove(model);
      });
    };
  }, [target, visible, slots, placeholder]);

  return null;
}

function GiftSlotButtons({
  terrain,
  slots,
  visible,
  selectedSlot,
  onSelectSlot,
  onSlotsDetected
}: {
  terrain: THREE.Object3D;
  slots: string[];
  visible: boolean;
  selectedSlot?: string | null;
  onSelectSlot?: (slot: string) => void;
  onSlotsDetected?: (slots: string[]) => void;
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
    onSlotsDetected?.(points.map((item) => item.slot));
  }, [terrain, slots, visible, onSlotsDetected]);

  if (!visible || !onSelectSlot) {
    return null;
  }

  return (
    <>
      {anchors.map((anchor) => {
        const isActive = selectedSlot === anchor.slot;
        return (
          <Html key={anchor.slot} position={anchor.position} center distanceFactor={8}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSelectSlot(anchor.slot);
              }}
              className={`h-4 w-4 rounded-full border shadow-sm transition ${
                isActive
                  ? "border-rose-400/80 bg-rose-500/70"
                  : "border-white/60 bg-white/30"
              }`}
            >
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
  url,
  info,
  onHover,
  onLeave
}: {
  terrain: THREE.Object3D;
  slot: string;
  url: string;
  info?: { name?: string; owner?: string; expiresAt?: string | null };
  onHover?: (gift: GiftHover) => void;
  onLeave?: () => void;
}) {
  const { scene } = useGLTF(url);
  const gift = useMemo(() => {
    const cloned = scene.clone(true);
    const targetWidth = resolveGiftTargetWidth({ modelUrl: url });
    if (targetWidth) {
      applyGiftScale(cloned, targetWidth);
    }
    return cloned;
  }, [scene, url]);
  const [position, setPosition] = useState<[number, number, number] | null>(null);

  useEffect(() => {
    const anchor = terrain.getObjectByName(slot);
    if (!anchor) {
      console.warn(`[MemorialPreview] gift slot '${slot}' не найден`);
      return;
    }
    const pos = new THREE.Vector3();
    anchor.getWorldPosition(pos);
    setPosition([pos.x, pos.y, pos.z]);
  }, [terrain, slot]);

  if (!position) {
    return null;
  }

  return (
    <Group
      position={position}
      onPointerOver={(event: any) => {
        event.stopPropagation();
        onHover?.({
          slot,
          position,
          name: info?.name,
          owner: info?.owner,
          expiresAt: info?.expiresAt
        });
      }}
      onPointerOut={(event: any) => {
        event.stopPropagation();
        onLeave?.();
      }}
    >
      <Primitive object={gift} />
    </Group>
  );
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
    if (slot === "mat_slot") {
      applyPartFitScale(part, 1, 1.5);
    }
    if (slot === "bowl_food_slot" || slot === "bowl_water_slot") {
      applyPartScale(part, 0.5, "x");
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
  onSelectSlot,
  onSlotsDetected,
  onGiftHover,
  onGiftLeave,
  focusSlot,
  onFocusPosition,
  onFocusDirection
}: {
  terrainUrl: string;
  houseUrl: string;
  parts?: { slot: string; url: string }[];
  gifts?: { slot: string; url: string; name?: string; owner?: string; expiresAt?: string | null }[];
  colors?: Record<string, string>;
  showGiftSlots: boolean;
  giftSlots?: string[];
  selectedSlot?: string | null;
  onSelectSlot?: (slot: string) => void;
  onSlotsDetected?: (slots: string[]) => void;
  onGiftHover?: (gift: GiftHover) => void;
  onGiftLeave?: () => void;
  focusSlot?: string | null;
  onFocusPosition?: (position: [number, number, number] | null) => void;
  onFocusDirection?: (direction: [number, number, number] | null) => void;
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

  useEffect(() => {
    if (!onFocusPosition && !onFocusDirection) {
      return;
    }
    if (!focusSlot) {
      onFocusPosition?.(null);
      onFocusDirection?.(null);
      return;
    }
    const anchor = house.getObjectByName(focusSlot) ?? terrain.getObjectByName(focusSlot);
    if (!anchor) {
      console.warn(`[MemorialPreview] focus slot '${focusSlot}' не найден`);
      onFocusPosition?.(null);
      onFocusDirection?.(null);
      return;
    }
    terrain.updateMatrixWorld(true);
    const pos = new THREE.Vector3();
    anchor.getWorldPosition(pos);
    onFocusPosition?.([pos.x, pos.y, pos.z]);
    if (onFocusDirection) {
      const dir = new THREE.Vector3();
      anchor.getWorldDirection(dir);
      if (dir.lengthSq() <= 0.0001) {
        onFocusDirection(null);
      } else {
        onFocusDirection([dir.x, dir.y, dir.z]);
      }
    }
  }, [focusSlot, house, terrain, onFocusPosition, onFocusDirection]);

  useEffect(() => {
    if (!onSlotsDetected) {
      return;
    }
    const detected = collectGiftSlots(terrain);
    onSlotsDetected(detected);
  }, [terrain, onSlotsDetected]);

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
          onSlotsDetected={onSlotsDetected}
        />
      ) : null}
      {gifts?.map((gift) => (
        <GiftPlacementAttachment
          key={`${gift.slot}-${gift.url}`}
          terrain={terrain}
          slot={gift.slot}
          url={gift.url}
          info={{ name: gift.name, owner: gift.owner, expiresAt: gift.expiresAt }}
          onHover={onGiftHover}
          onLeave={onGiftLeave}
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
  onGiftSlotsDetected,
  focusSlot,
  colors,
  backgroundColor = "#eef6ff",
  className,
  style
}: Props) {
  const controlsRef = useRef<any>(null);
  const baseDistance = Math.sqrt(4 * 4 + 3 * 3 + 4 * 4);
  const [showGiftSlots, setShowGiftSlots] = useState(Boolean(onSelectSlot));
  const [hoveredGift, setHoveredGift] = useState<GiftHover | null>(null);
  const [focusPosition, setFocusPosition] = useState<[number, number, number] | null>(null);
  const [focusDirection, setFocusDirection] = useState<[number, number, number] | null>(null);

  useEffect(() => {
    controlsRef.current?.saveState?.();
  }, []);

  useEffect(() => {
    if (onSelectSlot) {
      setShowGiftSlots(true);
    }
  }, [onSelectSlot]);

  const containerStyle: React.CSSProperties = {
    ...style
  };
  if (!style?.height && !className) {
    containerStyle.height = "320px";
  }

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 ${
        className ?? ""
      }`}
      style={containerStyle}
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
        <SceneBackground backgroundColor={backgroundColor} />
        <AmbientLight intensity={0.9} />
        <HemisphereLight intensity={0.6} color={"#ffffff"} groundColor={"#d5dbe5"} />
        <DirectionalLight intensity={1} position={[6, 8, 4]} />
        <DirectionalLight intensity={0.65} position={[-6, 5, -4]} />
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
              onSlotsDetected={onGiftSlotsDetected}
              onGiftHover={setHoveredGift}
              onGiftLeave={() => setHoveredGift(null)}
              focusSlot={focusSlot}
              onFocusPosition={setFocusPosition}
              onFocusDirection={setFocusDirection}
            />
          ) : null}
          {!terrainUrl && houseUrl ? (
            <Model url={houseUrl} position={[0, 0, 0]} />
          ) : null}
          {hoveredGift ? (
            <Html position={hoveredGift.position} center distanceFactor={8} className="pointer-events-none">
              <div className="inline-block min-w-[180px] max-w-[280px] break-words rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 text-[6px] leading-snug text-slate-700 shadow-lg">
                <p className="font-semibold text-slate-900">{hoveredGift.name ?? "Подарок"}</p>
                <p className="text-slate-500">
                  От: {hoveredGift.owner ? hoveredGift.owner : "владельца"}
                </p>
                {hoveredGift.expiresAt ? (
                  <p className="text-slate-500">
                    До {new Date(hoveredGift.expiresAt).toLocaleDateString()}
                  </p>
                ) : null}
              </div>
            </Html>
          ) : null}
        </Suspense>
        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          minPolarAngle={0}
          maxPolarAngle={Math.PI / 2}
          minDistance={baseDistance / 2}
          maxDistance={baseDistance * 2.6}
        />
        <SceneCameraRig
          focus={focusPosition}
          direction={focusDirection}
          focusSlot={focusSlot}
          controlsRef={controlsRef}
        />
      </Canvas>
    </div>
  );
}

const preloadUrls = [
  ...Object.values(environmentModelByIdGenerated),
  ...Object.values(houseModelByIdGenerated),
  ...Object.values(roofModelByIdGenerated),
  ...Object.values(wallModelByIdGenerated),
  ...Object.values(signModelByIdGenerated),
  ...Object.values(frameLeftModelByIdGenerated),
  ...Object.values(frameRightModelByIdGenerated),
  ...Object.values(matModelByIdGenerated),
  ...Object.values(bowlFoodModelByIdGenerated),
  ...Object.values(bowlWaterModelByIdGenerated)
];

preloadUrls.forEach((url) => {
  useGLTF.preload(url);
});
useGLTF.preload("/models/gifts/candle.glb");
useGLTF.preload("/models/gifts/slot_placeholder.glb");
