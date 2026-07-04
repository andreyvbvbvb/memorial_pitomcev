"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ensureDracoLoader } from "../../lib/draco";
import type { DirtSlotPlacement } from "../../lib/dirt-models";
import DirtSlotAttachments from "../../components/DirtSlotAttachments";
import GiftFlames, { type GiftFlameMode } from "../../components/GiftFlames";
import {
  getGiftCodeFromUrl,
  isGiftSlotName,
  parseGiftSlot,
  resolveGiftScaleMultiplier,
  resolveGiftSizeMultiplier,
  resolveGiftTargetWidth
} from "../../lib/gifts";
import {
  getHouseSlotCategory,
  isHouseDetailSlotName,
  type HouseSlots
} from "../../lib/memorial-config";
import { splitHouseVariantId } from "../../lib/house-variants";
import {
  applyHousePartAdjustment,
  applyHousePlacement,
  getHousePartFitBounds,
  getHousePartScaleMultiplier,
  getHouseScaleFitSizeOverride,
  getHouseTransform
} from "../../lib/house-layout";
import { resolveObjectTransformInParent } from "../../lib/three-transforms";
import {
  PetSoul,
  normalizeSoulColor,
  resolveSoulAnchorPosition,
  resolveSoulObstacleCenterPosition,
  resolveSoulOrbitCenterPosition,
  resolveSoulOrbitRadius,
  resolveSoulSurfaceFloorY,
  type PetSoulMode,
  type PetSoulPath,
  type PetSoulQuality
} from "../../components/PetSoul";
import TunedSkyDome from "../../components/TunedSkyDome";

ensureDracoLoader();

export type { GiftFlameMode };

export type DetailPartOverride = {
  scale: number;
  rotationY?: number;
  position: {
    x: number;
    y: number;
    z: number;
  };
};

export type DetailPartOverrides = Record<string, DetailPartOverride>;

type Props = {
  terrainUrl?: string | null;
  terrainId?: string | null;
  houseUrl?: string | null;
  houseId?: string | null;
  parts?: { slot: string; url: string }[];
  detailPartOverrides?: DetailPartOverrides;
  dirtUrl?: string | null;
  dirtUrls?: string[] | null;
  dirtSlots?: DirtSlotPlacement[] | null;
  dirtLevel?: number;
  gifts?: {
    slot: string;
    url: string;
    name?: string;
    owner?: string;
    expiresAt?: string | null;
    size?: string | null;
    scaleMultiplier?: number;
  }[];
  giftSlots?: string[];
  dimmedGiftSlots?: string[];
  giftFlameMode?: GiftFlameMode;
  selectedSlot?: string | null;
  onSelectSlot?: (slot: string) => void;
  onGiftSlotsDetected?: (slots: string[]) => void;
  focusSlot?: string | null;
  focusRequestId?: number;
  onDetailClick?: (detail: DetailClick) => void;
  lockHorizontalOrbit?: boolean;
  cameraOffsetAdjustments?: Record<string, { x: number; y: number; z: number }>;
  cameraAdjustmentKey?: string | null;
  onOrbitEndCapture?: (payload: { key: string; adjustment: { x: number; y: number; z: number } }) => void;
  colors?: Record<string, string>;
  backgroundColor?: string;
  softEdges?: boolean;
  showGiftSlots?: boolean;
  enableHoverHighlight?: boolean;
  showControls?: boolean;
  controlsEnabled?: boolean;
  preloadGiftUrl?: string | null;
  onGiftPreloaded?: (url: string) => void;
  onHouseSlotsDetected?: (slots: HouseSlots) => void;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
  onControlsReady?: (controls: any) => void;
  onRenderContextReady?: (context: {
    gl: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.Camera;
  }) => void;
  onMemorialObjectReady?: (object: THREE.Object3D | null) => void;
  onSceneReadyChange?: (ready: boolean) => void;
  preserveDrawingBuffer?: boolean;
  cameraPosition?: [number, number, number];
  defaultCameraPosition?: [number, number, number];
  defaultTarget?: [number, number, number];
  houseOffsetX?: number;
  houseOffsetZ?: number;
  houseRotationY?: number;
  houseScaleMultiplier?: number;
  soulColor?: string | null;
  soulGlowColor?: string | null;
  soulEnabled?: boolean;
  soulMode?: PetSoulMode;
  soulPath?: PetSoulPath | null;
  showSoulPathMarkers?: boolean;
  showMeterGrid?: boolean;
  soulQuality?: PetSoulQuality;
  soulAnchorMode?: "scene" | "screen-left";
  suppressLoadingOverlay?: boolean;
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

type DetailClick = {
  slot?: string;
  area?: "environment" | "house";
};

type SceneAssets = {
  terrainUrl?: string | null;
  houseUrl?: string | null;
  houseId?: string | null;
  parts?: { slot: string; url: string }[];
  dirtUrl?: string | null;
  dirtUrls?: string[] | null;
  dirtSlots?: DirtSlotPlacement[] | null;
  dirtLevel?: number;
  gifts?: {
    slot: string;
    url: string;
    name?: string;
    owner?: string;
    expiresAt?: string | null;
    size?: string | null;
    scaleMultiplier?: number;
  }[];
  colors?: Record<string, string>;
};

type HousePresentation = {
  terrainId?: string | null;
  houseOffsetX?: number;
  houseOffsetZ?: number;
  houseRotationY?: number;
  houseScaleMultiplier?: number;
};

const buildSceneSignature = (assets: SceneAssets) => {
  const parts = assets.parts ?? [];
  const gifts = assets.gifts ?? [];
  const colors = assets.colors ?? {};
  const partsKey = parts.map((part) => `${part.slot}:${part.url}`).join("|");
  const giftsKey = gifts.map((gift) => `${gift.slot}:${gift.url}:${gift.size ?? ""}`).join("|");
  const colorsKey = Object.entries(colors)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${value}`)
    .join("|");
  return [
    assets.terrainUrl ?? "",
    assets.houseUrl ?? "",
    assets.houseId ?? "",
    partsKey,
    giftsKey,
    colorsKey
  ].join("::");
};

const Primitive = "primitive" as unknown as React.ComponentType<any>;
const Color = "color" as unknown as React.ComponentType<any>;
const AmbientLight = "ambientLight" as unknown as React.ComponentType<any>;
const DirectionalLight = "directionalLight" as unknown as React.ComponentType<any>;
const Group = "group" as unknown as React.ComponentType<any>;
const Mesh = "mesh" as unknown as React.ComponentType<any>;
const SphereGeometry = "sphereGeometry" as unknown as React.ComponentType<any>;
const TubeGeometry = "tubeGeometry" as unknown as React.ComponentType<any>;
const LineSegments = "lineSegments" as unknown as React.ComponentType<any>;
const MeshBasicMaterial = "meshBasicMaterial" as unknown as React.ComponentType<any>;
const LineBasicMaterial = "lineBasicMaterial" as unknown as React.ComponentType<any>;
const HemisphereLight = "hemisphereLight" as unknown as React.ComponentType<any>;
const PointLight = "pointLight" as unknown as React.ComponentType<any>;
const DEFAULT_TARGET = new THREE.Vector3(0, 0.6, 0);
const DEFAULT_CAMERA = new THREE.Vector3(4, 3, 4);
const DEFAULT_FOCUS_OFFSET = new THREE.Vector3(2.6, 1.8, 2.6);
const HOUSE_FOCUS_OFFSET = new THREE.Vector3(4.2, 1.6, 3.0);
const LOCKED_POLAR_ANGLE = 1.1;
const CLICK_DRAG_THRESHOLD = 5;
const HOVER_EMISSIVE_INTENSITY = 0.03;
const HOVER_COLOR_LERP = 0.012;
const DEFAULT_LOADING_TIPS = [
  "Модели и текстуры загружаются постепенно.",
  "После загрузки сцену можно вращать и приближать.",
  "Если превью появилось не сразу, дождитесь окончания загрузки 3D-сцены."
];
const METER_GRID_CUBE_SIZE = 8;
const METER_GRID_CELL_SIZE = 1;

const createVolumetricGridGeometry = (size: number, cellSize: number) => {
  const divisions = Math.max(1, Math.round(size / cellSize));
  const normalizedSize = divisions * cellSize;
  const half = normalizedSize / 2;
  const coordinates = Array.from(
    { length: divisions + 1 },
    (_, index) => -half + index * cellSize
  );
  const points: number[] = [];
  const pushLine = (from: [number, number, number], to: [number, number, number]) => {
    points.push(...from, ...to);
  };

  coordinates.forEach((a) => {
    coordinates.forEach((b) => {
      pushLine([-half, a, b], [half, a, b]);
      pushLine([a, -half, b], [a, half, b]);
      pushLine([a, b, -half], [a, b, half]);
    });
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  return geometry;
};

const buildFocusTarget = (
  focus: [number, number, number] | null,
  defaultTarget = DEFAULT_TARGET
) => (focus ? new THREE.Vector3(focus[0], focus[1] + 0.6, focus[2]) : defaultTarget.clone());

const getBaseFocusOffset = ({
  focus,
  direction,
  focusSlot
}: {
  focus: [number, number, number] | null;
  direction: [number, number, number] | null;
  focusSlot?: string | null;
}) => {
  let offset = DEFAULT_FOCUS_OFFSET.clone();
  const isDomFocus = focusSlot === "dom_slot";
  if (focus && isDomFocus) {
    offset = HOUSE_FOCUS_OFFSET.clone();
  }
  const isSideFrame = focusSlot === "frame_right_slot" || focusSlot === "frame_left_slot";
  if (focus && isSideFrame) {
    const sideSign = focus[0] >= 0 ? 1 : -1;
    offset = new THREE.Vector3(2.8 * sideSign, 1.4, 0.4);
  } else if (focus && direction && !isDomFocus) {
    const dir = new THREE.Vector3(direction[0], direction[1], direction[2]);
    if (dir.lengthSq() > 0.0001) {
      offset = dir.normalize().multiplyScalar(2.6);
      offset.y += 1.4;
    }
  }
  return offset;
};
const isSelectableSlotName = (name: string) =>
  (/^dirt_slot_[1-4]$/i.test(name) || isHouseDetailSlotName(name)) &&
  name !== "dom_slot" &&
  !isGiftSlotName(name);

const findDetailSlot = (object: THREE.Object3D | null) => {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (isSelectableSlotName(current.name)) {
      return current.name;
    }
    current = current.parent;
  }
  return null;
};

const isDescendantOf = (object: THREE.Object3D | null, ancestor: THREE.Object3D) => {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (current === ancestor) {
      return true;
    }
    current = current.parent;
  }
  return false;
};

const resolveHouseBaseId = (houseId?: string | null) => {
  const parsed = splitHouseVariantId(houseId ?? "");
  return parsed.baseId || houseId || "";
};

const sameHousePresentation = (
  left: HousePresentation | null | undefined,
  right: HousePresentation | null | undefined
) =>
  (left?.terrainId ?? null) === (right?.terrainId ?? null) &&
  (left?.houseOffsetX ?? null) === (right?.houseOffsetX ?? null) &&
  (left?.houseOffsetZ ?? null) === (right?.houseOffsetZ ?? null) &&
  (left?.houseRotationY ?? null) === (right?.houseRotationY ?? null) &&
  (left?.houseScaleMultiplier ?? null) === (right?.houseScaleMultiplier ?? null);

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
  return (
    <>
      <Color attach="background" args={[backgroundColor]} />
      <TunedSkyDome radius={80} renderOrder={-10} />
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

const HOUSE_MAX_WIDTH = 2.5;
const HOUSE_MAX_HEIGHT = 4;
const KOTIK_MAX_HEIGHT = 2.5;

function applyHouseScale(
  target: THREE.Object3D,
  houseId?: string | null,
  baseSize?: THREE.Vector3,
  scaleMultiplier = 1
) {
  const baseId = splitHouseVariantId(houseId ?? "").baseId || houseId || "";
  const maxHeight = baseId.startsWith("kotik") ? KOTIK_MAX_HEIGHT : HOUSE_MAX_HEIGHT;
  const maxWidth = baseId === "kotik_2" || baseId === "kotik_6" ? 2 : HOUSE_MAX_WIDTH;
  const sizeOverride = getHouseScaleFitSizeOverride(houseId);
  const sizeVec = sizeOverride ?? (baseSize ? baseSize.clone() : (() => {
    const box = new THREE.Box3().setFromObject(target);
    const size = new THREE.Vector3();
    box.getSize(size);
    return size;
  })());
  if (sizeVec.x <= 0 || sizeVec.y <= 0) {
    return;
  }
  const fitScale = Math.min(maxWidth / sizeVec.x, maxHeight / sizeVec.y);
  const scale = fitScale * scaleMultiplier;
  if (Number.isFinite(scale) && scale > 0) {
    target.scale.setScalar(scale);
  }
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

function applyPartFitWidthHeight(target: THREE.Object3D, maxWidth: number, maxHeight: number) {
  if (!maxWidth || !maxHeight || maxWidth <= 0 || maxHeight <= 0) {
    return;
  }
  const box = new THREE.Box3().setFromObject(target);
  const sizeVec = new THREE.Vector3();
  box.getSize(sizeVec);
  if (sizeVec.x <= 0 || sizeVec.y <= 0) {
    return;
  }
  const scale = Math.min(maxWidth / sizeVec.x, maxHeight / sizeVec.y);
  target.scale.setScalar(scale);
}

function SceneCameraRig({
  focus,
  direction,
  focusSlot,
  offsetAdjustment,
  defaultCameraPosition,
  defaultTarget,
  controlsRef
}: {
  focus: [number, number, number] | null;
  direction: [number, number, number] | null;
  focusSlot?: string | null;
  offsetAdjustment?: [number, number, number] | null;
  defaultCameraPosition: THREE.Vector3;
  defaultTarget: THREE.Vector3;
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
    const currentTarget = controls ? controls.target.clone() : defaultTarget.clone();
    const startPos = camera.position.clone();
    const startTarget = currentTarget;
    const endTarget = buildFocusTarget(focus, defaultTarget);
    let offset = getBaseFocusOffset({ focus, direction, focusSlot });
    if (offsetAdjustment) {
      offset.add(new THREE.Vector3(offsetAdjustment[0], offsetAdjustment[1], offsetAdjustment[2]));
    }
    const endPos = focus ? endTarget.clone().add(offset) : defaultCameraPosition.clone();
    animationRef.current = {
      elapsed: 0,
      duration: 0.9,
      startPos,
      startTarget,
      endPos,
      endTarget
    };
  }, [focus, direction, focusSlot, offsetAdjustment, defaultCameraPosition, defaultTarget, camera, controlsRef]);

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
  slots,
  dimmedSlots
}: {
  target: THREE.Object3D;
  visible: boolean;
  slots?: string[];
  dimmedSlots?: string[];
}) {
  const { scene } = useGLTF("/models/gifts/slot_placeholder.glb");
  const placeholder = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const allowed = slots && slots.length > 0 ? new Set(slots) : null;
    const dimmed = dimmedSlots && dimmedSlots.length > 0 ? new Set(dimmedSlots) : null;
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
      if (dimmed?.has(anchor.name)) {
        applyGiftSlotPlaceholderTone(model, true);
      }
      anchor.add(model);
      return { anchor, model };
    });

    return () => {
      markers.forEach(({ anchor, model }) => {
        anchor.remove(model);
      });
    };
  }, [target, visible, slots, dimmedSlots, placeholder]);

  return null;
}

function applyGiftSlotPlaceholderTone(root: THREE.Object3D, dimmed: boolean) {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }
    const tuneMaterial = (material: THREE.Material) => {
      const next = material.clone() as THREE.Material & {
        color?: THREE.Color;
        opacity?: number;
        transparent?: boolean;
      };
      if (dimmed) {
        next.color?.set("#9ca3af");
        next.transparent = true;
        next.opacity = 0.24;
      }
      next.needsUpdate = true;
      return next;
    };
    child.material = Array.isArray(child.material)
      ? child.material.map(tuneMaterial)
      : tuneMaterial(child.material);
  });
}

function GiftSlotButtons({
  terrain,
  slots,
  dimmedSlots,
  visible,
  selectedSlot,
  onSelectSlot
}: {
  terrain: THREE.Object3D;
  slots: string[];
  dimmedSlots?: string[];
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
        const pos = resolveObjectPositionInRenderParent(anchor, terrain);
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
        const isDimmed = Boolean(dimmedSlots?.includes(anchor.slot));
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
                  : isDimmed
                    ? "border-slate-300/45 bg-slate-400/20 opacity-55"
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
  size,
  scaleMultiplier = 1,
  flameMode,
  onHover,
  onLeave
}: {
  terrain: THREE.Object3D;
  slot: string;
  url: string;
  info?: { name?: string; owner?: string; expiresAt?: string | null };
  size?: string | null;
  scaleMultiplier?: number;
  flameMode?: GiftFlameMode;
  onHover?: (gift: GiftHover) => void;
  onLeave?: () => void;
}) {
  const { scene } = useGLTF(url);
  const isStarGift = useMemo(() => {
    const code = getGiftCodeFromUrl(url);
    return Boolean(code?.startsWith("star"));
  }, [url]);
  const gift = useMemo(() => {
    const cloned = scene.clone(true);
    const targetWidth = resolveGiftTargetWidth({ modelUrl: url });
    if (targetWidth) {
      applyGiftScale(cloned, targetWidth);
    }
    const sizeMultiplier = resolveGiftSizeMultiplier({ gift: { modelUrl: url }, size });
    if (sizeMultiplier && sizeMultiplier !== 1) {
      cloned.scale.multiplyScalar(sizeMultiplier);
    }
    const configuredMultiplier = resolveGiftScaleMultiplier({ modelUrl: url });
    if (configuredMultiplier !== 1) {
      cloned.scale.multiplyScalar(configuredMultiplier);
    }
    if (
      Number.isFinite(scaleMultiplier) &&
      scaleMultiplier > 0 &&
      scaleMultiplier !== 1
    ) {
      cloned.scale.multiplyScalar(scaleMultiplier);
    }
    return cloned;
  }, [scene, url, size, scaleMultiplier]);
  const [transform, setTransform] = useState<{
    position: [number, number, number];
    quaternion: [number, number, number, number];
  } | null>(null);
  const giftGroupRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    const anchor = terrain.getObjectByName(slot);
    if (!anchor) {
      console.warn(`[MemorialPreview] gift slot '${slot}' не найден`);
      return;
    }
    const renderParent = terrain.parent;
    if (!renderParent) {
      return;
    }
    const { position, quaternion } = resolveObjectTransformInParent(anchor, renderParent);
    setTransform({
      position: [position.x, position.y, position.z],
      quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w]
    });
  }, [terrain, slot]);

  if (!transform) {
    return null;
  }

  return (
    <Group
      ref={giftGroupRef}
      name={`__gift_placement_${slot}`}
      position={transform.position}
      quaternion={transform.quaternion}
      onPointerOver={(event: any) => {
        event.stopPropagation();
        const hoverPosition = new THREE.Vector3();
        giftGroupRef.current?.getWorldPosition(hoverPosition);
        onHover?.({
          slot,
          position: [hoverPosition.x, hoverPosition.y, hoverPosition.z],
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
      <GiftFlames root={gift} mode={flameMode} />
      {isStarGift ? (
        <PointLight
          intensity={0.6}
          distance={4}
          decay={2}
          color={"#ffe8a3"}
          position={[0, 0.45, 0]}
        />
      ) : null}
    </Group>
  );
}

function resolveObjectPositionInRenderParent(object: THREE.Object3D, terrain: THREE.Object3D) {
  terrain.updateMatrixWorld(true);
  object.updateMatrixWorld(true);
  const parent = terrain.parent;
  parent?.updateMatrixWorld(true);
  const position = new THREE.Vector3();
  object.getWorldPosition(position);
  if (parent) {
    parent.worldToLocal(position);
  }
  return position;
}

function PartAttachment({
  house,
  slot,
  url,
  colors,
  houseBaseId,
  houseId,
  override
}: {
  house: THREE.Object3D;
  slot: string;
  url: string;
  colors?: Record<string, string>;
  houseBaseId?: string;
  houseId?: string | null;
  override?: DetailPartOverride;
}) {
  const { scene } = useGLTF(url);
  const part = useMemo(() => {
    const cloned = scene.clone(true);
    const fitBounds = getHousePartFitBounds(houseBaseId, slot);
    if (slot === "mat_slot") {
      if (fitBounds) {
        applyPartFitScale(cloned, fitBounds.maxWidth, fitBounds.maxLength);
      } else {
        const scale = getHousePartScaleMultiplier(houseBaseId, slot);
        applyPartFitScale(cloned, 1.25 * scale, 1.875 * scale);
      }
    }
    if (slot === "bowl_food_slot" || slot === "bowl_water_slot") {
      if (fitBounds) {
        applyPartFitScale(cloned, fitBounds.maxWidth, fitBounds.maxLength);
      } else {
        applyPartScale(cloned, 0.575 * getHousePartScaleMultiplier(houseBaseId, slot), "x");
      }
    }
    if (slot === "sign_slot") {
      const scale = houseBaseId === "budka_1" ? 0.85 : 1;
      applyPartFitWidthHeight(cloned, 1 * scale, 0.4 * scale);
    }
    if (override) {
      const scale = Number.isFinite(override.scale) && override.scale > 0 ? override.scale : 1;
      cloned.scale.multiplyScalar(scale);
      cloned.position.set(
        Number.isFinite(override.position.x) ? override.position.x : 0,
        Number.isFinite(override.position.y) ? override.position.y : 0,
        Number.isFinite(override.position.z) ? override.position.z : 0
      );
      if (Number.isFinite(override.rotationY)) {
        cloned.rotation.y += THREE.MathUtils.degToRad(override.rotationY ?? 0);
      }
    } else {
      applyHousePartAdjustment(cloned, houseId ?? houseBaseId, slot);
    }
    return cloned;
  }, [
    houseBaseId,
    houseId,
    override?.position.x,
    override?.position.y,
    override?.position.z,
    override?.rotationY,
    override?.scale,
    scene,
    slot
  ]);

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

  return getHouseSlotCategory(slot) === "candle" ? <GiftFlames root={part} /> : null;
}

function DirtAttachment({
  house,
  url,
  level
}: {
  house: THREE.Object3D;
  url: string;
  level: number;
}) {
  const { scene } = useGLTF(url);
  const dirt = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    const maxLevel = Math.max(0, Math.min(4, level));
    dirt.traverse((child) => {
      if (!(child instanceof THREE.Object3D)) {
        return;
      }
      const name = child.name?.toLowerCase?.() ?? "";
      if (name.startsWith("dirt_")) {
        const index = Number(name.replace(/\D+/g, ""));
        child.visible = Number.isFinite(index) && index > 0 && index <= maxLevel;
      }
    });
  }, [dirt, level]);

  useEffect(() => {
    house.add(dirt);
    return () => {
      house.remove(dirt);
    };
  }, [house, dirt]);

  return null;
}

function DirtChunkAttachment({
  house,
  url,
  visible
}: {
  house: THREE.Object3D;
  url: string;
  visible: boolean;
}) {
  const { scene } = useGLTF(url);
  const chunk = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    house.add(chunk);
    return () => {
      house.remove(chunk);
    };
  }, [house, chunk]);

  useEffect(() => {
    chunk.visible = visible;
  }, [chunk, visible]);

  return null;
}

function DirtStackAttachment({
  house,
  urls,
  level
}: {
  house: THREE.Object3D;
  urls: string[];
  level: number;
}) {
  if (!urls || urls.length === 0) {
    return null;
  }
  return (
    <>
      {urls.map((url, index) => (
        <DirtChunkAttachment key={url} house={house} url={url} visible={level >= index + 1} />
      ))}
    </>
  );
}

function SoulPathCurve({
  points,
  smooth,
  color
}: {
  points: [number, number, number][];
  smooth: boolean;
  color: string;
}) {
  const curve = useMemo(() => {
    if (points.length < 2) {
      return null;
    }
    const vectors = points.map((point) => new THREE.Vector3(point[0], point[1], point[2]));
    if (smooth && vectors.length >= 3) {
      return new THREE.CatmullRomCurve3(vectors, true, "centripetal", 0.5);
    }
    return new THREE.CatmullRomCurve3(vectors, vectors.length > 2, "catmullrom", 0.5);
  }, [points, smooth]);

  if (!curve) {
    return null;
  }

  return (
    <Mesh renderOrder={72} raycast={() => null}>
      <TubeGeometry args={[curve, Math.max(48, points.length * 24), 0.016, 8, smooth && points.length >= 3]} />
      <MeshBasicMaterial
        color={color}
        transparent
        opacity={0.62}
        depthWrite={false}
        depthTest={false}
      />
    </Mesh>
  );
}

function SoulPathMarkers({
  position,
  path,
  color
}: {
  position: [number, number, number];
  path?: PetSoulPath | null;
  color: string;
}) {
  const markers = useMemo(() => {
    if (!path?.points.length) {
      return [];
    }
    const base = new THREE.Vector3(position[0], position[1], position[2]);
    return [
      { id: "start", label: "Старт", duration: null, position: [base.x, base.y, base.z] as [number, number, number] },
      ...path.points.map((point, index) => {
        const next = base.clone().add(new THREE.Vector3(point.x, point.y, point.z));
        return {
          id: `point-${index + 1}`,
          label: `${index + 1}`,
          duration: point.duration,
          position: [next.x, next.y, next.z] as [number, number, number]
        };
      })
    ];
  }, [path, position]);

  if (markers.length <= 1) {
    return null;
  }

  const segmentColor = normalizeSoulColor(color);
  const pathLineColor = "#111827";
  const pathPoints = markers.map((marker) => marker.position);

  return (
    <Group renderOrder={70}>
      <SoulPathCurve
        points={pathPoints}
        smooth={path?.curve !== "linear"}
        color={pathLineColor}
      />
      {markers.map((marker, index) => {
        const isStart = index === 0;
        return (
          <Group key={marker.id} position={marker.position} renderOrder={76}>
            <Mesh renderOrder={76} raycast={() => null}>
              <SphereGeometry args={[isStart ? 0.095 : 0.085, 18, 18]} />
              <MeshBasicMaterial
                color={isStart ? "#ffffff" : segmentColor}
                transparent
                opacity={isStart ? 0.95 : 0.9}
                depthWrite={false}
                depthTest={false}
              />
            </Mesh>
            <Html center distanceFactor={7.5} className="pointer-events-none select-none">
              <div className="rounded-full border border-white/90 bg-white/94 px-2.5 py-1.5 text-[12px] font-black uppercase leading-none tracking-[0.08em] text-[#5d4037] shadow-[0_10px_24px_-16px_rgba(93,64,55,0.55)]">
                {marker.label}
                {marker.duration !== null ? (
                  <span className="ml-1 text-[#8d6e63]">{marker.duration.toFixed(1)}с</span>
                ) : null}
              </div>
            </Html>
          </Group>
        );
      })}
    </Group>
  );
}

function SoulAnchor({
  terrain,
  house,
  color,
  glowColor,
  mode,
  quality,
  path,
  showPathMarkers,
  enabled
}: {
  terrain: THREE.Object3D;
  house: THREE.Object3D;
  color?: string | null;
  glowColor?: string | null;
  mode: PetSoulMode;
  quality: PetSoulQuality;
  path?: PetSoulPath | null;
  showPathMarkers?: boolean;
  enabled: boolean;
}) {
  const [anchor, setAnchor] = useState<{
    position: [number, number, number];
    avoidCenter: [number, number, number];
    orbitCenter: [number, number, number];
    orbitRadius: number;
    floorY: number;
  } | null>(null);

  useEffect(() => {
    if (!enabled) {
      setAnchor(null);
      return;
    }
    setAnchor({
      position: resolveSoulAnchorPosition(terrain, house),
      avoidCenter: resolveSoulObstacleCenterPosition(terrain, house),
      orbitCenter: resolveSoulOrbitCenterPosition(terrain, house),
      orbitRadius: resolveSoulOrbitRadius(terrain),
      floorY: resolveSoulSurfaceFloorY(terrain, house)
    });
  }, [enabled, terrain, house]);

  if (!enabled || !anchor) {
    return null;
  }

  const normalizedColor = normalizeSoulColor(color);
  const normalizedGlowColor = normalizeSoulColor(glowColor, normalizedColor);

  return (
    <>
      <PetSoul
        color={normalizedColor}
        glowColor={normalizedGlowColor}
        position={anchor.position}
        avoidCenter={anchor.avoidCenter}
        orbitCenter={anchor.orbitCenter}
        orbitRadius={anchor.orbitRadius}
        avoidRadius={0.96}
        floorY={anchor.floorY}
        mode={mode}
        quality={quality}
        path={path}
        scale={quality === "light" ? 0.78 : 1}
      />
      {showPathMarkers ? (
        <SoulPathMarkers position={anchor.position} path={path} color={normalizedColor} />
      ) : null}
    </>
  );
}

function ScreenAnchoredSoul({
  color,
  glowColor,
  quality,
  enabled
}: {
  color?: string | null;
  glowColor?: string | null;
  quality: PetSoulQuality;
  enabled: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera, size } = useThree();
  const normalizedColor = normalizeSoulColor(color);
  const normalizedGlowColor = normalizeSoulColor(glowColor, normalizedColor);
  const ndc = useMemo(() => new THREE.Vector3(), []);
  const world = useMemo(() => new THREE.Vector3(), []);
  const direction = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    if (!groupRef.current || !enabled) {
      return;
    }
    const isNarrow = size.width < 720;
    ndc.set(isNarrow ? -0.42 : -0.5, isNarrow ? 0.02 : 0.0, 0.52);
    world.copy(ndc).unproject(camera);
    direction.copy(world).sub(camera.position).normalize();
    groupRef.current.position.copy(camera.position).add(direction.multiplyScalar(isNarrow ? 5.4 : 6.2));
    groupRef.current.quaternion.copy(camera.quaternion);
  });

  if (!enabled) {
    return null;
  }

  return (
    <Group ref={groupRef} renderOrder={80}>
      <PetSoul
        color={normalizedColor}
        glowColor={normalizedGlowColor}
        position={[0, 0, 0]}
        mode="idle"
        quality={quality}
        scale={quality === "light" ? 0.55 : 0.7}
      />
    </Group>
  );
}

function TerrainWithHouse({
  terrainUrl,
  houseUrl,
  parts,
  detailPartOverrides,
  dirtUrl,
  dirtUrls,
  dirtSlots,
  dirtLevel = 0,
  gifts,
  giftFlameMode,
  colors,
  showGiftSlots,
  giftSlots,
  dimmedGiftSlots,
  selectedSlot,
  onSelectSlot,
  onSlotsDetected,
  onGiftHover,
  onGiftLeave,
  focusSlot,
  focusRequestId,
  onFocusPosition,
  onFocusDirection,
  onHouseSlotsDetected,
  onDetailClick,
  orbitMovedRef,
  orbitLastChangeRef,
  enableHoverHighlight,
  allowFocus,
  terrainId,
  houseBaseId,
  houseId,
  houseOffsetX,
  houseOffsetZ,
  houseRotationY,
  houseScaleMultiplier,
  soulColor,
  soulGlowColor,
  soulEnabled,
  soulMode,
  soulPath,
  showSoulPathMarkers,
  showMeterGrid,
  soulQuality,
  soulAnchorMode,
  onReady,
  onMemorialObjectReady,
  visible = true
}: {
  terrainUrl: string;
  houseUrl: string;
  parts?: { slot: string; url: string }[];
  detailPartOverrides?: DetailPartOverrides;
  dirtUrl?: string | null;
  dirtUrls?: string[] | null;
  dirtSlots?: DirtSlotPlacement[] | null;
  dirtLevel?: number;
  gifts?: {
    slot: string;
    url: string;
    name?: string;
    owner?: string;
    expiresAt?: string | null;
    size?: string | null;
    scaleMultiplier?: number;
  }[];
  giftFlameMode?: GiftFlameMode;
  colors?: Record<string, string>;
  showGiftSlots: boolean;
  giftSlots?: string[];
  dimmedGiftSlots?: string[];
  selectedSlot?: string | null;
  onSelectSlot?: (slot: string) => void;
  onSlotsDetected?: (slots: string[]) => void;
  onGiftHover?: (gift: GiftHover) => void;
  onGiftLeave?: () => void;
  focusSlot?: string | null;
  focusRequestId?: number;
  onFocusPosition?: (position: [number, number, number] | null) => void;
  onFocusDirection?: (direction: [number, number, number] | null) => void;
  onHouseSlotsDetected?: (slots: HouseSlots) => void;
  onDetailClick?: (detail: DetailClick) => void;
  orbitMovedRef?: React.MutableRefObject<boolean>;
  orbitLastChangeRef?: React.MutableRefObject<number | null>;
  enableHoverHighlight?: boolean;
  allowFocus?: boolean;
  terrainId?: string | null;
  houseBaseId?: string;
  houseId?: string | null;
  houseOffsetX?: number;
  houseOffsetZ?: number;
  houseRotationY?: number;
  houseScaleMultiplier?: number;
  soulColor?: string | null;
  soulGlowColor?: string | null;
  soulEnabled?: boolean;
  soulMode?: PetSoulMode;
  soulPath?: PetSoulPath | null;
  showSoulPathMarkers?: boolean;
  showMeterGrid?: boolean;
  soulQuality?: PetSoulQuality;
  soulAnchorMode?: "scene" | "screen-left";
  onReady?: () => void;
  onMemorialObjectReady?: (object: THREE.Object3D | null) => void;
  visible?: boolean;
}) {
  const { scene: terrainScene } = useGLTF(terrainUrl);
  const { scene: houseScene } = useGLTF(houseUrl);
  const terrain = useMemo(() => terrainScene.clone(true), [terrainScene]);
  const baseHouseSize = useMemo(() => {
    const box = new THREE.Box3().setFromObject(houseScene);
    const size = new THREE.Vector3();
    box.getSize(size);
    return size;
  }, [houseScene]);
  const defaultHouseTransform = useMemo(
    () => getHouseTransform(houseBaseId, terrainId),
    [houseBaseId, terrainId]
  );
  const house = useMemo(() => {
    const cloned = houseScene.clone(true);
    applyHouseScale(
      cloned,
      houseBaseId,
      baseHouseSize,
      houseScaleMultiplier ?? defaultHouseTransform.scale
    );
    return cloned;
  }, [houseScene, houseBaseId, terrainId, baseHouseSize, houseScaleMultiplier, defaultHouseTransform.scale]);
  const offsetX = houseOffsetX ?? defaultHouseTransform.offsetX;
  const offsetZ = houseOffsetZ ?? defaultHouseTransform.offsetZ;
  const rotationY = houseRotationY ?? defaultHouseTransform.rotationY;

  useLayoutEffect(() => {
    applyHousePlacement(house, houseBaseId, terrainId, {
      offsetX,
      offsetZ,
      rotationY
    });
  }, [house, houseBaseId, terrainId, offsetX, offsetZ, rotationY]);
  const pointerStateRef = useRef<{ x: number; y: number; moved: boolean; pointerId: number | null } | null>(null);
  const hoveredMeshRef = useRef<THREE.Mesh | null>(null);
  const hoveredMaterialRef = useRef<THREE.Material | THREE.Material[] | null>(null);
  const hoveredOutlineRef = useRef<THREE.LineSegments | null>(null);
  const floatGroupRef = useRef<THREE.Group | null>(null);
  const floatPhaseRef = useRef(Math.random() * Math.PI * 2);

  useFrame(({ clock }) => {
    const group = floatGroupRef.current;
    if (!group) {
      return;
    }
    if (!visible) {
      group.position.set(0, 0, 0);
      return;
    }
    const t = clock.elapsedTime;
    const phase = floatPhaseRef.current;
    group.position.set(
      Math.cos(t * 0.47 + phase) * 0.065,
      Math.sin(t * 0.58 + phase * 0.7) * 0.033,
      Math.sin(t * 0.41 + phase * 1.2) * 0.065
    );
  });

  const clearHoverOutline = () => {
    const outline = hoveredOutlineRef.current;
    if (outline) {
      outline.parent?.remove(outline);
      outline.geometry.dispose();
      if (Array.isArray(outline.material)) {
        outline.material.forEach((material) => material.dispose());
      } else {
        outline.material.dispose();
      }
    }
    hoveredOutlineRef.current = null;
  };

  const clearHoverHighlight = () => {
    const mesh = hoveredMeshRef.current;
    const material = hoveredMaterialRef.current;
    if (mesh && material) {
      mesh.material = material;
    }
    hoveredMeshRef.current = null;
    hoveredMaterialRef.current = null;
    clearHoverOutline();
  };

  const applyHoverHighlight = (object: THREE.Object3D | null) => {
    if (!object || !(object as THREE.Mesh).isMesh) {
      clearHoverHighlight();
      return;
    }
    const mesh = object as THREE.Mesh;
    if (mesh === hoveredMeshRef.current) {
      return;
    }
    clearHoverHighlight();
    const original = mesh.material;
    hoveredMeshRef.current = mesh;
    hoveredMaterialRef.current = original;
    const highlightColor = new THREE.Color("#7dd3fc");
    const applyHighlight = (material: THREE.Material) => {
      const cloned = material.clone() as THREE.Material & {
        emissive?: THREE.Color;
        emissiveIntensity?: number;
        color?: THREE.Color;
      };
      if (cloned.emissive) {
        cloned.emissive = highlightColor.clone();
        cloned.emissiveIntensity = HOVER_EMISSIVE_INTENSITY;
      }
      if (cloned.color) {
        cloned.color = cloned.color.clone().lerp(highlightColor, HOVER_COLOR_LERP);
      }
      return cloned;
    };
    if (Array.isArray(original)) {
      mesh.material = original.map((mat) => applyHighlight(mat));
    } else {
      mesh.material = applyHighlight(original);
    }

    clearHoverOutline();
    if (mesh.geometry) {
      const outline = new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry, 25),
        new THREE.LineBasicMaterial({
          color: highlightColor,
          transparent: true,
          opacity: 0.55
        })
      );
      outline.renderOrder = 3;
      outline.raycast = () => null;
      outline.scale.setScalar(1.01);
      mesh.add(outline);
      hoveredOutlineRef.current = outline;
    }
  };

  useLayoutEffect(() => {
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
    onReady?.();
  }, [onReady, terrain, house]);

  useEffect(() => {
    onMemorialObjectReady?.(floatGroupRef.current);
    return () => {
      onMemorialObjectReady?.(null);
    };
  }, [onMemorialObjectReady, terrain, house]);

  useEffect(() => {
    applyMaterialColors(terrain, colors);
    applyMaterialColors(house, colors);
  }, [terrain, house, colors]);

  useEffect(() => {
    clearHoverHighlight();
  }, [terrain, house]);

  useEffect(() => {
    return () => {
      clearHoverHighlight();
    };
  }, []);

  useEffect(() => {
    if (!enableHoverHighlight) {
      clearHoverHighlight();
    }
  }, [enableHoverHighlight]);

  useEffect(() => {
    if (!focusSlot) {
      onFocusPosition?.(null);
      onFocusDirection?.(null);
      return;
    }
    if (!onFocusPosition && !onFocusDirection) {
      return;
    }
    if (typeof focusRequestId === "number" && allowFocus === false) {
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
  }, [focusSlot, focusRequestId, onFocusPosition, onFocusDirection]);

  useEffect(() => {
    if (!onSlotsDetected) {
      return;
    }
    const detected = collectGiftSlots(terrain);
    onSlotsDetected(detected);
  }, [terrain, onSlotsDetected]);

  useEffect(() => {
    if (!onHouseSlotsDetected) {
      return;
    }
    const detected: HouseSlots = {};
    if (house.getObjectByName("roof_slot")) {
      detected.roof = "roof_slot";
    }
    if (house.getObjectByName("wall_slot")) {
      detected.wall = "wall_slot";
    }
    if (house.getObjectByName("sign_slot")) {
      detected.sign = "sign_slot";
    }
    if (house.getObjectByName("frame_left_slot")) {
      detected.frameLeft = "frame_left_slot";
    }
    if (house.getObjectByName("frame_right_slot")) {
      detected.frameRight = "frame_right_slot";
    }
    if (house.getObjectByName("mat_slot")) {
      detected.mat = "mat_slot";
    }
    if (house.getObjectByName("bowl_food_slot")) {
      detected.bowlFood = "bowl_food_slot";
    }
    if (house.getObjectByName("bowl_water_slot")) {
      detected.bowlWater = "bowl_water_slot";
    }
    house.traverse((object) => {
      const slotName = object.name;
      if (!isHouseDetailSlotName(slotName)) {
        return;
      }
      if (Object.values(detected).includes(slotName)) {
        return;
      }
      detected[slotName] = slotName;
    });
    onHouseSlotsDetected(detected);
  }, [house, onHouseSlotsDetected]);

  const resolveClickTarget = (event: any) => {
    const intersections = event?.intersections as Array<{ object: THREE.Object3D }> | undefined;
    if (intersections && intersections.length > 0) {
      const slotHit = intersections.find((hit) => findDetailSlot(hit.object));
      if (slotHit) {
        return slotHit.object;
      }
      const houseHit = intersections.find((hit) => isDescendantOf(hit.object, house));
      if (houseHit) {
        return houseHit.object;
      }
      return intersections[0]?.object ?? null;
    }
    return (event?.object as THREE.Object3D | undefined) ?? null;
  };

  const handleDetailClick = (event: any) => {
    if (!onDetailClick) {
      return;
    }
    const target = resolveClickTarget(event);
    if (!target) {
      return;
    }
    const isInHouse = isDescendantOf(target, house);
    const isInTerrain = isDescendantOf(target, terrain);
    const slot = findDetailSlot(target);
    if (slot) {
      onDetailClick({
        slot,
        area: isInHouse ? "house" : isInTerrain ? "environment" : undefined
      });
      return;
    }
    if (isInHouse) {
      onDetailClick({ area: "house" });
      return;
    }
    if (isInTerrain) {
      onDetailClick({ area: "environment" });
    }
  };

  const handlePointerDown = (event: any) => {
    if (orbitMovedRef) {
      orbitMovedRef.current = false;
    }
    pointerStateRef.current = {
      x: event.clientX,
      y: event.clientY,
      moved: false,
      pointerId: typeof event.pointerId === "number" ? event.pointerId : null
    };
  };

  const handlePointerMove = (event: any) => {
    if (orbitMovedRef?.current) {
      clearHoverHighlight();
      return;
    }
    const state = pointerStateRef.current;
    if (state && state.pointerId !== null && event.pointerId !== state.pointerId) {
      return;
    }
    if (state) {
      const dx = event.clientX - state.x;
      const dy = event.clientY - state.y;
      if (Math.hypot(dx, dy) >= CLICK_DRAG_THRESHOLD) {
        state.moved = true;
      }
    }
    const hoverTarget = event?.intersections?.[0]?.object ?? null;
    const hoverSlot = findDetailSlot(hoverTarget);
    const shouldHighlightDirt = Boolean(hoverSlot?.startsWith("dirt_slot"));
    if (!enableHoverHighlight && !shouldHighlightDirt) {
      clearHoverHighlight();
      return;
    }
    applyHoverHighlight(hoverTarget);
  };

  const handlePointerUp = (event: any) => {
    const now = Date.now();
    if (orbitLastChangeRef?.current && now - orbitLastChangeRef.current < 250) {
      pointerStateRef.current = null;
      return;
    }
    if (orbitMovedRef?.current) {
      orbitMovedRef.current = false;
      pointerStateRef.current = null;
      return;
    }
    const state = pointerStateRef.current;
    pointerStateRef.current = null;
    if (!state) {
      return;
    }
    if (state?.moved) {
      return;
    }
    handleDetailClick(event);
  };

  const handlePointerOut = () => {
    clearHoverHighlight();
  };

  return (
    <Group
      ref={floatGroupRef}
      visible={visible}
      onPointerDown={onDetailClick ? handlePointerDown : undefined}
      onPointerMove={onDetailClick ? handlePointerMove : undefined}
      onPointerUp={onDetailClick ? handlePointerUp : undefined}
      onPointerOut={onDetailClick ? handlePointerOut : undefined}
    >
      <Primitive object={terrain} />
      {showMeterGrid ? <MeterGridOverlay /> : null}
      <GiftSlotsOverlay
        target={terrain}
        visible={showGiftSlots}
        slots={giftSlots}
        dimmedSlots={dimmedGiftSlots}
      />
      {giftSlots && giftSlots.length > 0 && onSelectSlot ? (
        <GiftSlotButtons
          terrain={terrain}
          slots={giftSlots}
          dimmedSlots={dimmedGiftSlots}
          visible={showGiftSlots}
          selectedSlot={selectedSlot}
          onSelectSlot={onSelectSlot}
        />
      ) : null}
      <Suspense fallback={null}>
        {gifts?.map((gift) => (
          <GiftPlacementAttachment
            key={`${gift.slot}-${gift.url}`}
            terrain={terrain}
            slot={gift.slot}
            url={gift.url}
            info={{ name: gift.name, owner: gift.owner, expiresAt: gift.expiresAt }}
            size={gift.size ?? undefined}
            scaleMultiplier={gift.scaleMultiplier}
            flameMode={giftFlameMode}
            onHover={onGiftHover}
            onLeave={onGiftLeave}
          />
        ))}
      </Suspense>
      {parts?.map((part) => (
        <PartAttachment
          key={`${part.slot}-${part.url}`}
          house={house}
          slot={part.slot}
          url={part.url}
          colors={colors}
          houseBaseId={houseBaseId}
          houseId={houseId}
          override={detailPartOverrides?.[part.slot]}
        />
      ))}
      {dirtSlots && dirtSlots.length > 0 ? (
        <DirtSlotAttachments terrain={terrain} house={house} placements={dirtSlots} />
      ) : dirtUrls && dirtUrls.length > 0 ? (
        <DirtStackAttachment house={house} urls={dirtUrls} level={dirtLevel} />
      ) : dirtUrl && dirtLevel > 0 ? (
        <DirtAttachment house={house} url={dirtUrl} level={dirtLevel} />
      ) : null}
      {soulEnabled !== false && soulAnchorMode !== "screen-left" ? (
        <SoulAnchor
          terrain={terrain}
          house={house}
          color={soulColor}
          glowColor={soulGlowColor}
          mode={soulMode ?? "idle"}
          path={soulPath}
          showPathMarkers={showSoulPathMarkers}
          quality={soulQuality ?? "full"}
          enabled
        />
      ) : null}
    </Group>
  );
}

function MeterGridOverlay() {
  const boxGeometry = useMemo(
    () => new THREE.BoxGeometry(METER_GRID_CUBE_SIZE, METER_GRID_CUBE_SIZE, METER_GRID_CUBE_SIZE),
    []
  );
  const edgeGeometry = useMemo(() => new THREE.EdgesGeometry(boxGeometry), [boxGeometry]);
  const gridGeometry = useMemo(
    () => createVolumetricGridGeometry(METER_GRID_CUBE_SIZE, METER_GRID_CELL_SIZE),
    []
  );

  useEffect(() => {
    return () => {
      gridGeometry.dispose();
      edgeGeometry.dispose();
      boxGeometry.dispose();
    };
  }, [boxGeometry, edgeGeometry, gridGeometry]);

  return (
    <Group position={[0, METER_GRID_CUBE_SIZE / 2, 0]} raycast={() => null}>
      <Mesh geometry={boxGeometry} renderOrder={-1} raycast={() => null}>
        <MeshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.035}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </Mesh>
      <LineSegments geometry={gridGeometry} renderOrder={0} raycast={() => null}>
        <LineBasicMaterial
          color="#5d4037"
          transparent
          opacity={0.32}
          depthWrite={false}
        />
      </LineSegments>
      <LineSegments geometry={edgeGeometry} renderOrder={1} raycast={() => null}>
        <LineBasicMaterial
          color="#5d4037"
          transparent
          opacity={0.52}
          depthWrite={false}
        />
      </LineSegments>
    </Group>
  );
}

function GiftModelPreloader({
  url,
  onReady
}: {
  url: string;
  onReady?: (url: string) => void;
}) {
  useGLTF(url);

  useEffect(() => {
    onReady?.(url);
  }, [onReady, url]);

  return null;
}

function SceneReady({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    onReady();
  }, [onReady]);
  return null;
}

function RenderContextReporter({
  onReady
}: {
  onReady?: (context: {
    gl: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.Camera;
  }) => void;
}) {
  const { gl, scene, camera } = useThree();
  const reportedRef = useRef(false);

  useEffect(() => {
    if (!onReady || reportedRef.current) {
      return;
    }
    reportedRef.current = true;
    onReady({ gl, scene, camera });
  }, [camera, gl, onReady, scene]);

  return null;
}

export default function MemorialPreview({
  terrainUrl,
  terrainId,
  houseUrl,
  houseId,
  parts,
  detailPartOverrides,
  dirtUrl,
  dirtUrls,
  dirtSlots,
  dirtLevel = 0,
  gifts,
  giftSlots,
  dimmedGiftSlots,
  giftFlameMode = "lite",
  selectedSlot,
  onSelectSlot,
  onGiftSlotsDetected,
  focusSlot,
  focusRequestId,
  onDetailClick,
  lockHorizontalOrbit = false,
  cameraOffsetAdjustments,
  cameraAdjustmentKey,
  onOrbitEndCapture,
  colors,
  backgroundColor = "#eef6ff",
  softEdges = false,
  showGiftSlots,
  enableHoverHighlight = false,
  showControls = true,
  controlsEnabled = true,
  preloadGiftUrl,
  onGiftPreloaded,
  onHouseSlotsDetected,
  onCanvasReady,
  onControlsReady,
  onRenderContextReady,
  onMemorialObjectReady,
  onSceneReadyChange,
  preserveDrawingBuffer = false,
  cameraPosition = [4, 3, 4],
  defaultCameraPosition,
  defaultTarget,
  houseOffsetX,
  houseOffsetZ,
  houseRotationY,
  houseScaleMultiplier,
  soulColor,
  soulGlowColor,
  soulEnabled = true,
  soulMode = "idle",
  soulPath,
  showSoulPathMarkers = false,
  showMeterGrid = false,
  soulQuality = "full",
  soulAnchorMode = "scene",
  suppressLoadingOverlay = false,
  className,
  style
}: Props) {
  const controlsRef = useRef<any>(null);
  const baseDistance = Math.sqrt(
    cameraPosition[0] * cameraPosition[0] +
      cameraPosition[1] * cameraPosition[1] +
      cameraPosition[2] * cameraPosition[2]
  );
  const [giftSlotsVisible, setGiftSlotsVisible] = useState(
    typeof showGiftSlots === "boolean"
      ? showGiftSlots
      : showControls && Boolean(onSelectSlot)
  );
  const [hoveredGift, setHoveredGift] = useState<GiftHover | null>(null);
  const [focusPosition, setFocusPosition] = useState<[number, number, number] | null>(null);
  const [focusDirection, setFocusDirection] = useState<[number, number, number] | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [loadingTipIndex, setLoadingTipIndex] = useState(0);
  const [canvasKey, setCanvasKey] = useState(0);
  const canvasCleanupRef = useRef<(() => void) | null>(null);
  const currentAssets = useMemo<SceneAssets>(
    () => ({
      terrainUrl,
      houseUrl,
      houseId,
      parts,
      dirtUrl,
      dirtUrls,
      dirtSlots,
      dirtLevel,
      gifts,
      colors
    }),
    [colors, dirtLevel, dirtSlots, dirtUrl, dirtUrls, gifts, houseId, houseUrl, parts, terrainUrl]
  );
  const currentSignature = useMemo(
    () => buildSceneSignature(currentAssets),
    [currentAssets]
  );
  const currentHousePresentation = useMemo<HousePresentation>(
    () => ({
      terrainId,
      houseOffsetX,
      houseOffsetZ,
      houseRotationY,
      houseScaleMultiplier
    }),
    [terrainId, houseOffsetX, houseOffsetZ, houseRotationY, houseScaleMultiplier]
  );
  const [activeAssets, setActiveAssets] = useState<SceneAssets>(currentAssets);
  const [activeSignature, setActiveSignature] = useState(currentSignature);
  const [activeHousePresentation, setActiveHousePresentation] =
    useState<HousePresentation>(currentHousePresentation);
  const [pendingAssets, setPendingAssets] = useState<SceneAssets | null>(null);
  const [pendingHousePresentation, setPendingHousePresentation] =
    useState<HousePresentation | null>(null);
  const pendingRef = useRef<{ signature: string; assets: SceneAssets } | null>(null);
  const pendingHousePresentationRef = useRef<HousePresentation | null>(null);
  const pendingSignature = useMemo(
    () => (pendingAssets ? buildSceneSignature(pendingAssets) : null),
    [pendingAssets]
  );
  const lastFocusRequestRef = useRef<number | null>(null);
  const orbitingRef = useRef(false);
  const orbitMovedRef = useRef(false);
  const orbitLastChangeRef = useRef<number | null>(null);
  const orbitEndTimeoutRef = useRef<number | null>(null);
  const defaultCameraVector = useMemo(
    () =>
      defaultCameraPosition
        ? new THREE.Vector3(defaultCameraPosition[0], defaultCameraPosition[1], defaultCameraPosition[2])
        : DEFAULT_CAMERA.clone(),
    [defaultCameraPosition?.[0], defaultCameraPosition?.[1], defaultCameraPosition?.[2]]
  );
  const defaultTargetVector = useMemo(
    () =>
      defaultTarget
        ? new THREE.Vector3(defaultTarget[0], defaultTarget[1], defaultTarget[2])
        : DEFAULT_TARGET.clone(),
    [defaultTarget?.[0], defaultTarget?.[1], defaultTarget?.[2]]
  );

  useEffect(() => {
    if (currentSignature === activeSignature) {
      setActiveAssets(currentAssets);
      if (pendingRef.current) {
        pendingRef.current = null;
        pendingHousePresentationRef.current = null;
        setPendingAssets(null);
        setPendingHousePresentation(null);
      }
      setActiveHousePresentation((prev) =>
        sameHousePresentation(prev, currentHousePresentation) ? prev : currentHousePresentation
      );
      return;
    }
    if (
      pendingRef.current?.signature === currentSignature &&
      sameHousePresentation(pendingHousePresentationRef.current, currentHousePresentation)
    ) {
      return;
    }
    pendingRef.current = { signature: currentSignature, assets: currentAssets };
    pendingHousePresentationRef.current = currentHousePresentation;
    setPendingAssets(currentAssets);
    setPendingHousePresentation(currentHousePresentation);
  }, [activeSignature, currentAssets, currentHousePresentation, currentSignature]);

  const handlePendingReady = useCallback(
    (signature: string) => {
      if (pendingRef.current?.signature !== signature) {
        return;
      }
      const nextAssets = pendingRef.current.assets;
      const nextHousePresentation =
        pendingHousePresentationRef.current ?? currentHousePresentation;
      pendingRef.current = null;
      pendingHousePresentationRef.current = null;
      setPendingAssets(null);
      setPendingHousePresentation(null);
      setActiveAssets(nextAssets);
      setActiveSignature(signature);
      setActiveHousePresentation(nextHousePresentation);
      setSceneReady(true);
    },
    [currentHousePresentation]
  );

  const offsetAdjustment = useMemo(() => {
    const key = cameraAdjustmentKey ?? focusSlot;
    if (!key || !cameraOffsetAdjustments) {
      return null;
    }
    const entry = cameraOffsetAdjustments[key];
    if (!entry) {
      return null;
    }
    return [entry.x, entry.y, entry.z] as [number, number, number];
  }, [cameraAdjustmentKey, cameraOffsetAdjustments, focusSlot]);

  const computeCameraAdjustment = useCallback(
    () => {
      const key = cameraAdjustmentKey ?? focusSlot;
      if (!key || !focusPosition) {
        return null;
      }
      const controls = controlsRef.current;
      const camera = controls?.object as THREE.Camera | undefined;
      if (!camera) {
        return null;
      }
      const baseOffset = getBaseFocusOffset({
        focus: focusPosition,
        direction: focusDirection,
        focusSlot
      });
      const target = buildFocusTarget(focusPosition);
      const currentOffset = camera.position.clone().sub(target);
      const adjustment = currentOffset.sub(baseOffset);
      return {
        key,
        adjustment: { x: adjustment.x, y: adjustment.y, z: adjustment.z }
      };
    },
    [cameraAdjustmentKey, focusDirection, focusPosition, focusSlot]
  );

  const activeHouseBaseId = useMemo(
    () => resolveHouseBaseId(activeAssets.houseId ?? houseId ?? ""),
    [activeAssets.houseId, houseId]
  );
  const pendingHouseBaseId = useMemo(
    () => resolveHouseBaseId(pendingAssets?.houseId ?? ""),
    [pendingAssets?.houseId]
  );

  const allowFocus = useMemo(() => {
    if (typeof focusRequestId !== "number") {
      return true;
    }
    if (focusPosition === null) {
      return true;
    }
    return focusRequestId !== lastFocusRequestRef.current;
  }, [focusPosition, focusRequestId]);

  useEffect(() => {
    if (typeof focusRequestId !== "number") {
      return;
    }
    if (focusRequestId !== lastFocusRequestRef.current) {
      lastFocusRequestRef.current = focusRequestId;
    }
  }, [focusRequestId]);

  useEffect(() => {
    return () => {
      if (orbitEndTimeoutRef.current !== null) {
        window.clearTimeout(orbitEndTimeoutRef.current);
      }
      if (canvasCleanupRef.current) {
        canvasCleanupRef.current();
        canvasCleanupRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!onControlsReady || typeof window === "undefined") {
      return;
    }
    const interval = window.setInterval(() => {
      if (controlsRef.current) {
        onControlsReady(controlsRef.current);
        window.clearInterval(interval);
      }
    }, 60);
    return () => {
      window.clearInterval(interval);
    };
  }, [onControlsReady]);

  useEffect(() => {
    controlsRef.current?.saveState?.();
  }, []);

  useEffect(() => {
    if (suppressLoadingOverlay) {
      return;
    }
    setSceneReady(false);
  }, [activeSignature, suppressLoadingOverlay]);

  useEffect(() => {
    onSceneReadyChange?.(sceneReady || suppressLoadingOverlay);
  }, [onSceneReadyChange, sceneReady, suppressLoadingOverlay]);

  useEffect(() => {
    if (sceneReady || suppressLoadingOverlay) {
      return;
    }
    const timer = window.setInterval(() => {
      setLoadingTipIndex((index) => (index + 1) % DEFAULT_LOADING_TIPS.length);
    }, 3600);
    return () => {
      window.clearInterval(timer);
    };
  }, [sceneReady, suppressLoadingOverlay]);

  useEffect(() => {
    if (typeof showGiftSlots === "boolean") {
      setGiftSlotsVisible(showGiftSlots);
      return;
    }
    if (showControls && onSelectSlot) {
      setGiftSlotsVisible(true);
    }
  }, [onSelectSlot, showControls, showGiftSlots]);

  const containerStyle: React.CSSProperties = {
    ...style
  };
  if (softEdges) {
    containerStyle.WebkitMaskImage =
      "radial-gradient(140% 140% at 50% 50%, #000 45%, transparent 100%)";
    containerStyle.maskImage =
      "radial-gradient(140% 140% at 50% 50%, #000 45%, transparent 100%)";
    containerStyle.WebkitMaskRepeat = "no-repeat";
    containerStyle.maskRepeat = "no-repeat";
    containerStyle.WebkitMaskSize = "100% 100%";
    containerStyle.maskSize = "100% 100%";
  }
  if (!style?.height && !className) {
    containerStyle.height = "320px";
  }

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl ${
        softEdges ? "bg-transparent" : "border border-slate-200 bg-slate-50"
      } ${className ?? ""}`}
      style={containerStyle}
    >
      {softEdges ? (
        <div
          className="pointer-events-none absolute inset-0 z-20"
          style={{
            background:
              "radial-gradient(140% 140% at 50% 50%, rgba(251,247,245,0) 55%, rgba(251,247,245,0.98) 100%)"
          }}
        />
      ) : null}
      {showControls ? (
        <>
          <button
            type="button"
            onClick={() => controlsRef.current?.reset?.()}
            className="absolute right-3 top-3 z-10 rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs text-slate-700 shadow-sm"
          >
            Сбросить вид
          </button>
          {typeof showGiftSlots !== "boolean" ? (
            <button
              type="button"
              onClick={() => setGiftSlotsVisible((prev) => !prev)}
              className="absolute left-3 top-3 z-10 rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs text-slate-700 shadow-sm"
            >
              {giftSlotsVisible ? "Скрыть метки подарков" : "Показать метки подарков"}
            </button>
          ) : null}
        </>
      ) : null}
      {!sceneReady && !suppressLoadingOverlay ? (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center rounded-2xl bg-[#fcf8f5]/86 backdrop-blur-sm">
          <div className="flex w-[min(18rem,78vw)] flex-col items-center gap-3 text-center text-sm font-semibold text-[#6f6360]">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#d8cfc9] border-t-[#5d4037]" />
            <span className="block w-full text-center text-xs font-bold leading-snug text-[#8d6e63]">
              {DEFAULT_LOADING_TIPS[loadingTipIndex]}
            </span>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#eadfd9]">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-[#8d6e63]" />
            </div>
          </div>
        </div>
      ) : null}
      <Canvas
        key={canvasKey}
        dpr={[1, 2]}
        camera={{ position: cameraPosition, fov: 45 }}
        gl={preserveDrawingBuffer ? { preserveDrawingBuffer: true } : undefined}
        onCreated={({ gl }) => {
          const canvas = gl.domElement;
          if (canvasCleanupRef.current) {
            canvasCleanupRef.current();
            canvasCleanupRef.current = null;
          }
          const handleLost = (event: Event) => {
            event.preventDefault();
            setCanvasKey((prev) => prev + 1);
          };
          const handleRestored = () => {
            setCanvasKey((prev) => prev + 1);
          };
          canvas.addEventListener("webglcontextlost", handleLost, false);
          canvas.addEventListener("webglcontextrestored", handleRestored, false);
          canvasCleanupRef.current = () => {
            canvas.removeEventListener("webglcontextlost", handleLost);
            canvas.removeEventListener("webglcontextrestored", handleRestored);
          };
          onCanvasReady?.(canvas);
        }}
        style={
          softEdges
            ? {
                WebkitMaskImage:
                  "radial-gradient(140% 140% at 50% 50%, #000 45%, transparent 100%)",
                maskImage:
                  "radial-gradient(140% 140% at 50% 50%, #000 45%, transparent 100%)",
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                WebkitMaskSize: "100% 100%",
                maskSize: "100% 100%"
              }
            : undefined
        }
      >
        <SceneBackground backgroundColor={backgroundColor} />
        <AmbientLight intensity={0.9} />
        <HemisphereLight intensity={0.6} color={"#ffffff"} groundColor={"#d5dbe5"} />
        <DirectionalLight intensity={1} position={[6, 8, 4]} />
        <DirectionalLight intensity={0.65} position={[-6, 5, -4]} />
        <RenderContextReporter onReady={onRenderContextReady} />
        <Suspense fallback={null}>
          {activeAssets.terrainUrl && activeAssets.houseUrl ? (
            <TerrainWithHouse
              terrainUrl={activeAssets.terrainUrl}
              houseUrl={activeAssets.houseUrl}
              parts={activeAssets.parts}
              detailPartOverrides={detailPartOverrides}
              dirtUrl={activeAssets.dirtUrl}
              dirtUrls={activeAssets.dirtUrls}
              dirtSlots={activeAssets.dirtSlots}
              dirtLevel={activeAssets.dirtLevel ?? 0}
              gifts={activeAssets.gifts}
              giftFlameMode={giftFlameMode}
              colors={activeAssets.colors}
              showGiftSlots={giftSlotsVisible}
              giftSlots={giftSlots}
              dimmedGiftSlots={dimmedGiftSlots}
              selectedSlot={selectedSlot}
              onSelectSlot={onSelectSlot}
              onSlotsDetected={onGiftSlotsDetected}
              onGiftHover={setHoveredGift}
              onGiftLeave={() => setHoveredGift(null)}
              focusSlot={focusSlot}
              focusRequestId={focusRequestId}
              onFocusPosition={setFocusPosition}
              onFocusDirection={setFocusDirection}
              onHouseSlotsDetected={onHouseSlotsDetected}
              onDetailClick={onDetailClick}
              orbitMovedRef={orbitMovedRef}
              orbitLastChangeRef={orbitLastChangeRef}
              enableHoverHighlight={enableHoverHighlight}
              allowFocus={allowFocus}
              terrainId={activeHousePresentation.terrainId}
              houseBaseId={activeHouseBaseId}
              houseId={activeAssets.houseId}
              houseOffsetX={activeHousePresentation.houseOffsetX}
              houseOffsetZ={activeHousePresentation.houseOffsetZ}
              houseRotationY={activeHousePresentation.houseRotationY}
              houseScaleMultiplier={activeHousePresentation.houseScaleMultiplier}
              soulColor={soulColor}
              soulGlowColor={soulGlowColor}
              soulEnabled={soulEnabled}
              soulMode={soulMode}
              soulPath={soulPath}
              showSoulPathMarkers={showSoulPathMarkers}
              showMeterGrid={showMeterGrid}
              soulQuality={soulQuality}
              soulAnchorMode={soulAnchorMode}
              onMemorialObjectReady={onMemorialObjectReady}
              onReady={() => setSceneReady(true)}
            />
          ) : null}
          {!activeAssets.terrainUrl && activeAssets.houseUrl ? (
            <>
              <Model url={activeAssets.houseUrl} position={[0, 0, 0]} />
              <SceneReady onReady={() => setSceneReady(true)} />
            </>
          ) : null}
          {hoveredGift ? (
            <Html position={hoveredGift.position} center distanceFactor={8} className="pointer-events-none">
              <div className="inline-block min-w-[220px] max-w-[360px] break-words rounded-2xl border border-[#eadfd9] bg-white/95 px-4 py-3 text-[12px] leading-snug text-[#6f6360] shadow-lg">
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
        {soulEnabled !== false && soulAnchorMode === "screen-left" ? (
          <ScreenAnchoredSoul
            color={soulColor}
            glowColor={soulGlowColor}
            quality={soulQuality}
            enabled
          />
        ) : null}
        {pendingAssets && pendingSignature ? (
          <Suspense fallback={null}>
            <Group visible={false}>
              {pendingAssets.terrainUrl && pendingAssets.houseUrl ? (
                <TerrainWithHouse
                  terrainUrl={pendingAssets.terrainUrl}
                  houseUrl={pendingAssets.houseUrl}
                  parts={pendingAssets.parts}
                  dirtUrl={pendingAssets.dirtUrl}
                  dirtUrls={pendingAssets.dirtUrls}
                  dirtSlots={pendingAssets.dirtSlots}
                  dirtLevel={pendingAssets.dirtLevel ?? 0}
                  gifts={pendingAssets.gifts}
                  giftFlameMode="off"
                  colors={pendingAssets.colors}
                  showGiftSlots={false}
                  giftSlots={undefined}
                  dimmedGiftSlots={undefined}
                  selectedSlot={undefined}
                  onSelectSlot={undefined}
                  onSlotsDetected={undefined}
                  onGiftHover={undefined}
                  onGiftLeave={undefined}
                  focusSlot={null}
                  focusRequestId={undefined}
                  onFocusPosition={undefined}
                  onFocusDirection={undefined}
                  onHouseSlotsDetected={undefined}
                  onDetailClick={undefined}
                  orbitMovedRef={orbitMovedRef}
                  orbitLastChangeRef={orbitLastChangeRef}
                  enableHoverHighlight={false}
                  allowFocus={false}
                  terrainId={pendingHousePresentation?.terrainId}
                  houseBaseId={pendingHouseBaseId}
                  houseId={pendingAssets.houseId}
                  houseOffsetX={pendingHousePresentation?.houseOffsetX}
                  houseOffsetZ={pendingHousePresentation?.houseOffsetZ}
                  houseRotationY={pendingHousePresentation?.houseRotationY}
                  houseScaleMultiplier={pendingHousePresentation?.houseScaleMultiplier}
                  soulEnabled={false}
                  showMeterGrid={false}
                  onReady={() => handlePendingReady(pendingSignature)}
                />
              ) : pendingAssets.houseUrl ? (
                <>
                  <Model url={pendingAssets.houseUrl} position={[0, 0, 0]} />
                  <SceneReady onReady={() => handlePendingReady(pendingSignature)} />
                </>
              ) : null}
            </Group>
          </Suspense>
        ) : null}
        <Suspense fallback={null}>
          {preloadGiftUrl ? (
            <GiftModelPreloader url={preloadGiftUrl} onReady={onGiftPreloaded} />
          ) : null}
        </Suspense>
        <OrbitControls
          ref={controlsRef}
          enabled={controlsEnabled}
          enableRotate={controlsEnabled}
          enableZoom={controlsEnabled}
          enablePan={false}
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
              orbitLastChangeRef.current = Date.now();
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
            if (onOrbitEndCapture) {
              const capture = computeCameraAdjustment();
              if (capture) {
                onOrbitEndCapture(capture);
              }
            }
          }}
          minPolarAngle={lockHorizontalOrbit ? LOCKED_POLAR_ANGLE : 0}
          maxPolarAngle={lockHorizontalOrbit ? LOCKED_POLAR_ANGLE : Math.PI / 2}
          minDistance={Math.max(1.2, baseDistance / 6)}
          maxDistance={baseDistance * 2.6}
        />
        <SceneCameraRig
          focus={focusPosition}
          direction={focusDirection}
          focusSlot={focusSlot}
          offsetAdjustment={offsetAdjustment}
          defaultCameraPosition={defaultCameraVector}
          defaultTarget={defaultTargetVector}
          controlsRef={controlsRef}
        />
      </Canvas>
    </div>
  );
}

useGLTF.preload("/models/gifts/slot_placeholder.glb");
