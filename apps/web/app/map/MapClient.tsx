"use client";

import {
  GoogleMap,
  Marker,
  MarkerClusterer,
  useJsApiLoader
} from "@react-google-maps/api";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ensureDracoLoader } from "../../lib/draco";
import { API_BASE } from "../../lib/config";
import ErrorToast from "../../components/ErrorToast";
import usePortraitLayout from "../../components/usePortraitLayout";
import VisibilityIndicator from "../../components/VisibilityIndicator";
import {
  hudCardSurfaceClass,
  hudEmptyStateTextClass,
  hudFloatingPanelClass,
  hudInfoPanelChromeClass,
  hudSidebarChromeClass
} from "../../components/hudTheme";
import {
  PetSoul,
  readSoulSettings,
  resolveSoulAnchorPosition,
  resolveSoulObstacleCenterPosition,
  resolveSoulOrbitCenterPosition,
  resolveSoulOrbitRadius,
  resolveSoulSurfaceFloorY,
  type PetSoulPath
} from "../../components/PetSoul";
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
import {
  buildDirtSlotPlacements,
  readActiveDirtSlots,
  type DirtSlotPlacement
} from "../../lib/dirt-models";
import DirtSlotAttachments from "../../components/DirtSlotAttachments";
import TunedSkyDome from "../../components/TunedSkyDome";

ensureDracoLoader();
import {
  getGiftSlotType,
  resolveGiftModelUrl,
  resolveGiftSizeMultiplier,
  resolveGiftTargetWidth
} from "../../lib/gifts";
import { getHouseSlots } from "../../lib/memorial-config";
import { splitHouseVariantId } from "../../lib/house-variants";
import {
  applyHousePlacement,
  getHousePartFitBounds,
  getHousePartScaleMultiplier,
  getHouseScaleFitSizeOverride,
  getHouseTransform
} from "../../lib/house-layout";

type MarkerDto = {
  id: string;
  petId: string;
  name: string;
  epitaph: string | null;
  birthDate?: string | null;
  deathDate?: string | null;
  lat: number;
  lng: number;
  markerStyle?: string | null;
  previewPhotoUrl?: string | null;
  previewImageUrl?: string | null;
  isPublic?: boolean | null;
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
    dustStage?: number | null;
    dustUpdatedAt?: string | null;
    createdAt?: string | null;
  } | null;
  gifts?: {
    id: string;
    slotName: string;
    placedAt: string;
    expiresAt: string | null;
    isActive?: boolean;
    size?: string | null;
    gift: { id: string; code?: string | null; name: string; price: number; modelUrl: string };
  }[];
};

type MemorialSceneData = {
  terrainUrl: string;
  terrainId?: string | null;
  houseUrl: string;
  houseId?: string | null;
  parts: { slot: string; url: string }[];
  colors?: Record<string, string>;
  gifts?: { slot: string; url: string; size?: string | null }[];
  dirtSlots?: DirtSlotPlacement[];
  soul?: {
    enabled: boolean;
    color: string;
    glowColor: string;
    path: PetSoulPath | null;
  };
};

const Group = "group" as unknown as React.ComponentType<any>;
const Primitive = "primitive" as unknown as React.ComponentType<any>;
const Mesh = "mesh" as unknown as React.ComponentType<any>;
const PlaneGeometry = "planeGeometry" as unknown as React.ComponentType<any>;
const MeshBasicMaterial = "meshBasicMaterial" as unknown as React.ComponentType<any>;
const AmbientLight = "ambientLight" as unknown as React.ComponentType<any>;
const DirectionalLight = "directionalLight" as unknown as React.ComponentType<any>;
const PointLight = "pointLight" as unknown as React.ComponentType<any>;
const Color = "color" as unknown as React.ComponentType<any>;
const MAP_PREVIEW_ROTATION_Y = THREE.MathUtils.degToRad(-35);
const CARD_PREVIEW_ASPECT = "15 / 9";

const defaultCenter = { lat: 55.751244, lng: 37.618423 };
const containerStyle = { width: "100%", height: "100%" };
const petTypeOptions = [{ id: "all", name: "Все виды" }, ...markerStyles];
const selectArrowStyle = {
  backgroundImage:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M6 8l4 4 4-4'/></svg>\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 0.75rem center",
  backgroundSize: "12px 12px"
} as const;

const formatDate = (value?: string | null) => {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

const formatYearRange = (birthDate?: string | null, deathDate?: string | null) => {
  const birthYear = birthDate ? new Date(birthDate).getFullYear() : null;
  const deathYear = deathDate ? new Date(deathDate).getFullYear() : null;
  if (birthYear && deathYear) {
    return `${birthYear} — ${deathYear}`;
  }
  if (birthYear) {
    return `Рождён: ${birthYear}`;
  }
  if (deathYear) {
    return `Ушёл: ${deathYear}`;
  }
  return "Без дат";
};

const getMarkerCoverSrc = (marker: MarkerDto | null | undefined) =>
  marker?.previewPhotoUrl ?? marker?.previewImageUrl ?? null;

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

const cloneMeshMaterials = (root: THREE.Object3D) => {
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) {
      return;
    }
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((material) => material?.clone?.() ?? material);
    } else if (mesh.material.clone) {
      mesh.material = mesh.material.clone();
    }
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

const applyMaterialDimming = (root: THREE.Object3D, dim = 0) => {
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) {
      return;
    }
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => {
      const mat = material as THREE.Material & {
        userData?: Record<string, unknown>;
        color?: THREE.Color;
        emissive?: THREE.Color;
        emissiveIntensity?: number;
      };
      if (!mat.userData) {
        mat.userData = {};
      }
      if (!mat.userData.baseColor && mat.color) {
        mat.userData.baseColor = mat.color.clone();
      }
      if (!mat.userData.baseEmissive && mat.emissive) {
        mat.userData.baseEmissive = mat.emissive.clone();
        mat.userData.baseEmissiveIntensity = mat.emissiveIntensity ?? 0;
      }
      if (mat.color && mat.userData.baseColor) {
        const base = mat.userData.baseColor as THREE.Color;
        const color = base.clone();
        if (dim > 0) {
          color.multiplyScalar(1 - dim);
        }
        mat.color.copy(color);
      }
      if (mat.emissive && mat.userData.baseEmissive) {
        const baseEmissive = mat.userData.baseEmissive as THREE.Color;
        mat.emissive.copy(baseEmissive);
        mat.emissiveIntensity = mat.userData.baseEmissiveIntensity as number;
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

const HOUSE_MAX_WIDTH = 2.5;
const HOUSE_MAX_HEIGHT = 4;
const KOTIK_MAX_HEIGHT = 2.5;

const applyHouseScale = (
  target: THREE.Object3D,
  houseId?: string | null,
  terrainId?: string | null
) => {
  const baseId = splitHouseVariantId(houseId ?? "").baseId || houseId || "";
  const maxHeight = baseId.startsWith("kotik") ? KOTIK_MAX_HEIGHT : HOUSE_MAX_HEIGHT;
  const maxWidth = baseId === "kotik_2" || baseId === "kotik_6" ? 2 : HOUSE_MAX_WIDTH;
  const { scale: scaleMultiplier } = getHouseTransform(houseId, terrainId);
  const sizeOverride = getHouseScaleFitSizeOverride(houseId);
  const sizeVec = sizeOverride ?? (() => {
    const box = new THREE.Box3().setFromObject(target);
    const size = new THREE.Vector3();
    box.getSize(size);
    return size;
  })();
  if (sizeVec.x <= 0 || sizeVec.y <= 0) {
    return;
  }
  const scale = Math.min(maxWidth / sizeVec.x, maxHeight / sizeVec.y) * scaleMultiplier;
  if (Number.isFinite(scale) && scale > 0) {
    target.scale.setScalar(scale);
  }
};

const applyGiftScale = (target: THREE.Object3D, width: number) => {
  if (!width || width <= 0) {
    return;
  }
  const box = new THREE.Box3().setFromObject(target);
  const sizeVec = new THREE.Vector3();
  box.getSize(sizeVec);
  if (sizeVec.x <= 0) {
    return;
  }
  const scale = width / sizeVec.x;
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
  colors,
  houseId
}: {
  house: THREE.Object3D;
  slot: string;
  url: string;
  colors?: Record<string, string>;
  houseId?: string | null;
}) {
  const { scene } = useGLTF(url);
  const part = useMemo(() => {
    const cloned = scene.clone(true);
    cloneMeshMaterials(cloned);
    const fitBounds = getHousePartFitBounds(houseId, slot);
    if (slot === "mat_slot") {
      if (fitBounds) {
        applyPartFitScale(cloned, fitBounds.maxWidth, fitBounds.maxLength);
      } else {
        const scale = getHousePartScaleMultiplier(houseId, slot);
        applyPartFitScale(cloned, 1.25 * scale, 1.875 * scale);
      }
    }
    if (slot === "bowl_food_slot" || slot === "bowl_water_slot") {
      if (fitBounds) {
        applyPartFitScale(cloned, fitBounds.maxWidth, fitBounds.maxLength);
      } else {
        applyPartScale(cloned, 0.575 * getHousePartScaleMultiplier(houseId, slot), "x");
      }
    }
    return cloned;
  }, [houseId, scene, slot]);

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

function GiftInstance({
  terrain,
  slot,
  url,
  size
}: {
  terrain: THREE.Object3D;
  slot: string;
  url: string;
  size?: string | null;
}) {
  const { scene } = useGLTF(url);
  const gift = useMemo(() => {
    const cloned = scene.clone(true);
    cloneMeshMaterials(cloned);
    const targetWidth = resolveGiftTargetWidth({ modelUrl: url });
    if (targetWidth) {
      applyGiftScale(cloned, targetWidth);
    }
    const sizeMultiplier = resolveGiftSizeMultiplier({ gift: { modelUrl: url }, size });
    if (sizeMultiplier && sizeMultiplier !== 1) {
      cloned.scale.multiplyScalar(sizeMultiplier);
    }
    return cloned;
  }, [scene, url, size]);

  useEffect(() => {
    const anchor = terrain.getObjectByName(slot);
    if (!anchor) {
      return;
    }
    const position = new THREE.Vector3();
    anchor.getWorldPosition(position);
    terrain.worldToLocal(position);
    gift.position.copy(position);
    terrain.add(gift);
    return () => {
      terrain.remove(gift);
    };
  }, [terrain, slot, gift]);

  return null;
}

function SoulAnchor({
  root,
  terrain,
  house,
  color,
  glowColor,
  path,
  enabled,
  active
}: {
  root: THREE.Object3D | null;
  terrain: THREE.Object3D;
  house: THREE.Object3D;
  color?: string | null;
  glowColor?: string | null;
  path?: PetSoulPath | null;
  enabled: boolean;
  active: boolean;
}) {
  const [anchor, setAnchor] = useState<{
    position: [number, number, number];
    avoidCenter: [number, number, number];
    orbitCenter: [number, number, number];
    orbitRadius: number;
    floorY: number;
  } | null>(null);

  useEffect(() => {
    if (!enabled || !root) {
      setAnchor(null);
      return;
    }
    root.updateMatrixWorld(true);
    terrain.updateMatrixWorld(true);

    const toRootLocal = (value: [number, number, number]): [number, number, number] => {
      const point = new THREE.Vector3(value[0], value[1], value[2]);
      terrain.localToWorld(point);
      root.worldToLocal(point);
      return [point.x, point.y, point.z];
    };

    const terrainFloorY = resolveSoulSurfaceFloorY(terrain, house);
    const floorPoint = new THREE.Vector3(0, terrainFloorY, 0);
    terrain.localToWorld(floorPoint);
    root.worldToLocal(floorPoint);
    const orbitCenter = resolveSoulOrbitCenterPosition(terrain, house);
    const orbitRadius = resolveSoulOrbitRadius(terrain);
    const orbitCenterPoint = new THREE.Vector3(orbitCenter[0], orbitCenter[1], orbitCenter[2]);
    const orbitEdgePoint = orbitCenterPoint.clone().add(new THREE.Vector3(orbitRadius, 0, 0));
    terrain.localToWorld(orbitCenterPoint);
    terrain.localToWorld(orbitEdgePoint);
    root.worldToLocal(orbitCenterPoint);
    root.worldToLocal(orbitEdgePoint);

    setAnchor({
      position: toRootLocal(resolveSoulAnchorPosition(terrain, house)),
      avoidCenter: toRootLocal(resolveSoulObstacleCenterPosition(terrain, house)),
      orbitCenter: [orbitCenterPoint.x, orbitCenterPoint.y, orbitCenterPoint.z],
      orbitRadius: orbitCenterPoint.distanceTo(orbitEdgePoint),
      floorY: floorPoint.y
    });
  }, [enabled, root, terrain, house]);

  if (!enabled || !anchor) {
    return null;
  }

  return (
    <PetSoul
      color={color}
      glowColor={glowColor}
      position={anchor.position}
      avoidCenter={anchor.avoidCenter}
      orbitCenter={anchor.orbitCenter}
      orbitRadius={anchor.orbitRadius}
      avoidRadius={0.96}
      floorY={anchor.floorY}
      mode="idle"
      quality={active ? "full" : "light"}
      path={path}
      scale={active ? 0.86 : 0.58}
    />
  );
}

function TerrainWithHouseScene({
  data,
  tone,
  active
}: {
  data: MemorialSceneData;
  tone?: number;
  active?: boolean;
}) {
  const [sceneRoot, setSceneRoot] = useState<THREE.Group | null>(null);
  const handleSceneRoot = useCallback((node: THREE.Group | null) => {
    setSceneRoot(node);
  }, []);
  const { scene: terrainScene } = useGLTF(data.terrainUrl);
  const { scene: houseScene } = useGLTF(data.houseUrl);
  const terrain = useMemo(() => {
    const cloned = terrainScene.clone(true);
    cloneMeshMaterials(cloned);
    return cloned;
  }, [terrainScene]);
  const house = useMemo(() => {
    const cloned = houseScene.clone(true);
    cloneMeshMaterials(cloned);
    applyHouseScale(cloned, data.houseId, data.terrainId);
    applyHousePlacement(cloned, data.houseId, data.terrainId);
    return cloned;
  }, [houseScene, data.houseId, data.terrainId]);

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
    <Group ref={handleSceneRoot} rotation={[0, MAP_PREVIEW_ROTATION_Y, 0]}>
      <Primitive object={terrain} />
      {data.parts.map((part) => (
        <PartInstance
          key={`${part.slot}-${part.url}`}
          house={house}
          slot={part.slot}
          url={part.url}
          colors={data.colors}
          houseId={data.houseId}
        />
      ))}
      {data.gifts?.map((gift) => (
        <GiftInstance key={`${gift.slot}-${gift.url}`} terrain={terrain} slot={gift.slot} url={gift.url} size={gift.size} />
      ))}
      <DirtSlotAttachments terrain={terrain} house={house} placements={data.dirtSlots ?? []} />
      {data.soul?.enabled !== false ? (
        <SoulAnchor
          root={sceneRoot}
          terrain={terrain}
          house={house}
          color={data.soul?.color}
          glowColor={data.soul?.glowColor}
          path={data.soul?.path}
          enabled
          active={active === true}
        />
      ) : null}
    </Group>
  );
}

function MemorialInstance({
  data,
  tone,
  innerRef,
  onSelect,
  onPressStart,
  onDragMove,
  onPressEnd,
  onHover,
  onLeave
}: {
  data: MemorialSceneData | null;
  tone: number;
  innerRef: (node: THREE.Group | null) => void;
  onSelect?: () => void;
  onPressStart?: (event: any) => void;
  onDragMove?: (event: any) => void;
  onPressEnd?: (event: any) => void;
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
        if (onPressStart) {
          event.stopPropagation();
          onPressStart(event);
        }
        if (!onSelect) {
          return;
        }
        event.stopPropagation();
        onSelect();
      }}
      onPointerMove={(event: any) => {
        if (!onDragMove) {
          return;
        }
        event.stopPropagation();
        onDragMove(event);
      }}
      onPointerUp={(event: any) => {
        if (!onPressEnd) {
          return;
        }
        event.stopPropagation();
        onPressEnd(event);
      }}
      onPointerCancel={(event: any) => {
        if (!onPressEnd) {
          return;
        }
        event.stopPropagation();
        onPressEnd(event);
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
        <TerrainWithHouseScene data={data} tone={tone} active={tone >= 0.98} />
      </Group>
    </Group>
  );
}

function MemorialCardPreview({
  previewSrc,
  className
}: {
  previewSrc?: string | null;
  className?: string;
}) {
  if (!previewSrc) {
    return (
      <div
        className={`w-full bg-[#f1e7e0] ${className ?? "rounded-2xl"}`}
        style={{ aspectRatio: CARD_PREVIEW_ASPECT }}
      />
    );
  }
  return (
    <div
      className={`w-full overflow-hidden bg-[#f1e7e0] ${className ?? "rounded-2xl"}`}
      style={{ aspectRatio: CARD_PREVIEW_ASPECT }}
    >
      <img
        src={previewSrc}
        alt="Фото питомца"
        className="h-full w-full object-cover"
        loading="lazy"
      />
    </div>
  );
}

function SceneLoadingOverlay() {
  const tips = [
    "Можно вращать сцену и приближать мемориалы после загрузки.",
    "Нажмите на мемориал, чтобы открыть его карточку.",
    "3D-режим загружает модели постепенно, поэтому первая загрузка может занять чуть дольше."
  ];
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTipIndex((index) => (index + 1) % tips.length);
    }, 3600);
    return () => window.clearInterval(timer);
  }, [tips.length]);

  return (
    <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-[#fcf8f5]/86 backdrop-blur-sm">
      <div className="flex w-[min(18rem,78vw)] flex-col items-center gap-3 text-center text-sm font-semibold leading-tight text-[#6f6360]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#d8cfc9] border-t-[#5d4037]" />
        <span className="block w-full text-center text-xs font-bold text-[#8d6e63]">
          {tips[tipIndex]}
        </span>
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

type CarouselCameraSettings = { distanceOffset: number; height: number; tiltDeg: number };

const CAROUSEL_DESIRED_SPACING = 20;
const CAROUSEL_MIN_RADIUS = 30;
const CAROUSEL_POP_DISTANCE = 3.6;
const CAROUSEL_SCALE_BOOST = 0.1;

const getCarouselRadius = (count: number) =>
  Math.max(CAROUSEL_MIN_RADIUS, (CAROUSEL_DESIRED_SPACING * Math.max(1, count)) / (Math.PI * 2));

const wrapCarouselIndex = (value: number, count: number) => {
  if (count <= 0) {
    return 0;
  }
  let wrapped = value % count;
  if (wrapped < 0) {
    wrapped += count;
  }
  return wrapped;
};

const carouselDistanceBetween = (index: number, center: number, count: number) => {
  const diff = Math.abs(index - center);
  return Math.min(diff, count - diff);
};

const carouselDimForDistance = (dist: number) => {
  if (dist <= 0) {
    return 0;
  }
  if (dist < 1) {
    return THREE.MathUtils.lerp(0, 0.2, dist);
  }
  if (dist < 2) {
    return THREE.MathUtils.lerp(0.2, 0.35, dist - 1);
  }
  if (dist < 3) {
    return THREE.MathUtils.lerp(0.35, 0.5, dist - 2);
  }
  return 0.5;
};

const applyCarouselCamera = (
  camera: THREE.Camera,
  count: number,
  activeIndex: number,
  cameraSettings: CarouselCameraSettings
) => {
  const radius = getCarouselRadius(count);
  const safeIndex = wrapCarouselIndex(activeIndex, Math.max(1, count));
  const centerAngle = safeIndex * ((Math.PI * 2) / Math.max(1, count));
  camera.position.set(
    Math.cos(centerAngle) * (radius + cameraSettings.distanceOffset),
    cameraSettings.height,
    Math.sin(centerAngle) * (radius + cameraSettings.distanceOffset)
  );
  camera.lookAt(0, 0, 0);
  camera.rotateX(-THREE.MathUtils.degToRad(cameraSettings.tiltDeg));
  if ("updateProjectionMatrix" in camera) {
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
  }
};

function RowCarouselStage({
  items,
  activeIndex,
  targetIndex,
  onArrive,
  onAnimationEnd,
  cameraSettings,
  enableHoverHighlight = true
}: {
  items: { data: MemorialSceneData | null; id: string }[];
  activeIndex: number;
  targetIndex: number | null;
  onArrive: (index: number) => void;
  onAnimationEnd: () => void;
  cameraSettings: CarouselCameraSettings;
  enableHoverHighlight?: boolean;
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
  const radiusRef = useRef(20);
  const activeLightRef = useRef<THREE.PointLight>(null);
  const hoverLightRef = useRef<THREE.PointLight>(null);
  const activeIndexRef = useRef(activeIndex);
  const onArriveRef = useRef(onArrive);
  const onAnimationEndRef = useRef(onAnimationEnd);
  const activeRotationYRef = useRef(0);
  const activeDragRef = useRef<{
    dragging: boolean;
    pointerId: number | null;
    startX: number;
    startRotation: number;
  }>({
    dragging: false,
    pointerId: null,
    startX: 0,
    startRotation: 0
  });

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    onArriveRef.current = onArrive;
  }, [onArrive]);

  useEffect(() => {
    onAnimationEndRef.current = onAnimationEnd;
  }, [onAnimationEnd]);

  useEffect(() => {
    return () => {
      hoveredRef.current = null;
      document.body.style.cursor = "";
    };
  }, []);

  useEffect(() => {
    activeRotationYRef.current = 0;
    activeDragRef.current = {
      dragging: false,
      pointerId: null,
      startX: 0,
      startRotation: 0
    };
    document.body.style.cursor = "";
  }, [activeIndex, targetIndex]);

  const handleRotationStart = useCallback((event: any, idx: number) => {
    if (animRef.current || idx !== activeIndexRef.current) {
      return;
    }
    activeDragRef.current = {
      dragging: true,
      pointerId: typeof event.pointerId === "number" ? event.pointerId : null,
      startX: typeof event.clientX === "number" ? event.clientX : 0,
      startRotation: activeRotationYRef.current
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    document.body.style.cursor = "grabbing";
  }, []);

  const handleRotationMove = useCallback((event: any, idx: number) => {
    const drag = activeDragRef.current;
    if (!drag.dragging || animRef.current || idx !== activeIndexRef.current) {
      return;
    }
    if (drag.pointerId !== null && event.pointerId !== drag.pointerId) {
      return;
    }
    const clientX = typeof event.clientX === "number" ? event.clientX : drag.startX;
    activeRotationYRef.current = drag.startRotation + (clientX - drag.startX) * 0.01;
  }, []);

  const handleRotationEnd = useCallback((event: any) => {
    const drag = activeDragRef.current;
    if (!drag.dragging) {
      return;
    }
    if (drag.pointerId !== null && typeof event.pointerId === "number" && event.pointerId !== drag.pointerId) {
      return;
    }
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    activeDragRef.current = {
      dragging: false,
      pointerId: null,
      startX: 0,
      startRotation: activeRotationYRef.current
    };
    document.body.style.cursor = "";
  }, []);

  const OcclusionPlane = ({ size }: { size: number }) => {
    const { camera } = useThree();
    const planeRef = useRef<THREE.Mesh>(null);
    useFrame(() => {
      if (!planeRef.current) {
        return;
      }
      planeRef.current.position.set(0, 0, 0);
      planeRef.current.lookAt(camera.position);
    });
    return (
      <Mesh ref={planeRef} renderOrder={-10} raycast={() => null}>
        <PlaneGeometry args={[size, size]} />
        <MeshBasicMaterial colorWrite={false} depthWrite depthTest />
      </Mesh>
    );
  };

  const SkyBackground = () => {
    return (
      <>
        <Color attach="background" args={["#f8fafc"]} />
        <TunedSkyDome radius={120} renderOrder={-20} />
      </>
    );
  };

  useEffect(() => {
    if (targetIndex === null || animRef.current) {
      return;
    }
    animRef.current = {
      from: activeIndexRef.current,
      to: targetIndex,
      t: 0,
      duration: 0.22
    };
  }, [targetIndex]);

  const placeInstance = useCallback(
    (node: THREE.Group | null, idx: number, centerIndexFloat = activeIndexRef.current) => {
      const count = items.length;
      if (!node || count === 0) {
        return;
      }
      const radius = getCarouselRadius(count);
      radiusRef.current = radius;
      const angleStep = (Math.PI * 2) / count;
      const angle = idx * angleStep;
      const distToCenter = carouselDistanceBetween(idx, centerIndexFloat, count);
      const centerWeight = Math.max(0, 1 - distToCenter);
      const radial = radius + CAROUSEL_POP_DISTANCE * centerWeight;
      node.position.set(Math.cos(angle) * radial, 0, Math.sin(angle) * radial);
      node.scale.setScalar(1 + CAROUSEL_SCALE_BOOST * centerWeight);
      node.lookAt(0, 0, 0);
      node.rotateY(
        Math.PI + (idx === activeIndexRef.current ? activeRotationYRef.current : 0)
      );
      applyMaterialDimming(node, carouselDimForDistance(distToCenter));
      applyMaterialHighlight(node, 0);
    },
    [items.length]
  );

  useLayoutEffect(() => {
    const count = items.length;
    if (count === 0 || animRef.current) {
      return;
    }
    applyCarouselCamera(camera, count, activeIndex, cameraSettings);
    instanceRefs.current.forEach((node, idx) => placeInstance(node, idx, activeIndex));
  }, [activeIndex, camera, cameraSettings, items.length, placeInstance]);

  useFrame((_, delta) => {
    const count = items.length;
    if (count === 0) {
      if (activeLightRef.current) {
        activeLightRef.current.visible = false;
      }
      if (hoverLightRef.current) {
        hoverLightRef.current.visible = false;
      }
      return;
    }
    radiusRef.current = getCarouselRadius(count);
    const cameraRadius = radiusRef.current + cameraSettings.distanceOffset;
    const cameraHeight = cameraSettings.height;
    const cameraTilt = THREE.MathUtils.degToRad(cameraSettings.tiltDeg);
    const angleStep = (Math.PI * 2) / count;

    let fromIndex = activeIndexRef.current;
    let toIndex = activeIndexRef.current;
    let blend = 0;
    let eased = 0;
    let centerIndexFloat = activeIndexRef.current;
    let centerAngle = centerIndexFloat * angleStep;

    if (animRef.current) {
      animRef.current.t += delta;
      blend = Math.min(animRef.current.t / animRef.current.duration, 1);
      eased = blend * blend * (3 - 2 * blend);
      fromIndex = animRef.current.from;
      toIndex = animRef.current.to;
      let deltaIndex = toIndex - fromIndex;
      if (deltaIndex > count / 2) {
        deltaIndex -= count;
      } else if (deltaIndex < -count / 2) {
        deltaIndex += count;
      }
      centerIndexFloat = wrapCarouselIndex(fromIndex + deltaIndex * eased, count);
      centerAngle = centerIndexFloat * angleStep;
      camera.position.x = Math.cos(centerAngle) * cameraRadius;
      camera.position.z = Math.sin(centerAngle) * cameraRadius;
      camera.position.y = cameraHeight;
      camera.lookAt(0, 0, 0);
      camera.rotateX(-cameraTilt);
      if (blend >= 1) {
        onArriveRef.current(toIndex);
        activeIndexRef.current = toIndex;
        animRef.current = null;
        onAnimationEndRef.current();
      }
    } else {
      camera.position.x = Math.cos(centerAngle) * cameraRadius;
      camera.position.z = Math.sin(centerAngle) * cameraRadius;
      camera.position.y = cameraHeight;
      camera.lookAt(0, 0, 0);
      camera.rotateX(-cameraTilt);
    }

    instanceRefs.current.forEach((node, idx) => {
      if (!node) {
        return;
      }
      const angle = idx * angleStep;
      const distToCenter = carouselDistanceBetween(idx, centerIndexFloat, count);
      const centerWeight = Math.max(0, 1 - distToCenter);
      const pop = CAROUSEL_POP_DISTANCE * centerWeight;
      const radial = radiusRef.current + pop;
      node.position.x = Math.cos(angle) * radial;
      node.position.z = Math.sin(angle) * radial;
      node.position.y = 0;
      const scale = 1 + CAROUSEL_SCALE_BOOST * centerWeight;
      node.scale.setScalar(scale);
      node.lookAt(0, 0, 0);
      node.rotateY(
        Math.PI +
          (!animRef.current && idx === activeIndexRef.current
            ? activeRotationYRef.current
            : 0)
      );

      const dim = carouselDimForDistance(distToCenter);
      applyMaterialDimming(node, dim);
      applyMaterialHighlight(node, 0);
    });

    if (activeLightRef.current) {
      const lightRadius = radiusRef.current + CAROUSEL_POP_DISTANCE;
      activeLightRef.current.position.set(
        Math.cos(centerAngle) * lightRadius,
        6,
        Math.sin(centerAngle) * lightRadius
      );
      activeLightRef.current.intensity = 1.6;
      activeLightRef.current.visible = true;
    }

    if (enableHoverHighlight) {
      const hoveredIndex = hoveredRef.current;
      if (hoverLightRef.current && hoveredIndex !== null) {
        const hoveredNode = instanceRefs.current[hoveredIndex];
        if (hoveredNode) {
          const pos = new THREE.Vector3();
          hoveredNode.getWorldPosition(pos);
          hoverLightRef.current.position.set(pos.x, pos.y + 7, pos.z);
          hoverLightRef.current.intensity = 2.5;
          hoverLightRef.current.visible = true;
        } else {
          hoverLightRef.current.visible = false;
        }
      } else if (hoverLightRef.current) {
        hoverLightRef.current.visible = false;
      }
    } else if (hoverLightRef.current) {
      hoverLightRef.current.visible = false;
    }
  });

  return (
    <>
      <SkyBackground />
      <AmbientLight intensity={0.85} />
      <DirectionalLight intensity={1.1} position={[6, 8, 4]} />
      <DirectionalLight intensity={0.6} position={[-6, 6, -4]} />
      <PointLight ref={activeLightRef} color="#93c5fd" distance={34} decay={1.5} />
      {enableHoverHighlight ? (
        <PointLight ref={hoverLightRef} color="#bae6fd" distance={40} decay={1.5} />
      ) : null}
      <OcclusionPlane size={Math.max(220, radiusRef.current * 16)} />
      {items.map((item, idx) => {
        return (
          <MemorialInstance
            key={item.id}
            data={item.data}
            tone={1}
            innerRef={(node) => {
              instanceRefs.current[idx] = node;
              placeInstance(node, idx);
            }}
            onPressStart={(event) => handleRotationStart(event, idx)}
            onDragMove={(event) => handleRotationMove(event, idx)}
            onPressEnd={handleRotationEnd}
            onHover={
              enableHoverHighlight
                ? () => {
                    hoveredRef.current = idx;
                  }
                : undefined
            }
            onLeave={
              enableHoverHighlight
                ? () => {
                    if (hoveredRef.current === idx) {
                      hoveredRef.current = null;
                    }
                  }
                : undefined
            }
            onSelect={undefined}
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
  cameraSettings,
  enableHoverHighlight = true
}: {
  items: { data: MemorialSceneData | null; id: string }[];
  activeIndex: number;
  targetIndex: number | null;
  onArrive: (index: number) => void;
  onAnimationEnd: () => void;
  cameraSettings: CarouselCameraSettings;
  enableHoverHighlight?: boolean;
}) {
  const [sceneReady, setSceneReady] = useState(false);
  const itemsSignature = useMemo(
    () => items.map((item) => `${item.id}:${item.data ? "ready" : "empty"}`).join("|"),
    [items]
  );
  const handleSceneReady = useCallback(() => setSceneReady(true), []);
  const initialCameraPosition = useMemo(() => {
    const count = Math.max(1, items.length);
    const radius = getCarouselRadius(count);
    const cameraRadius = radius + cameraSettings.distanceOffset;
    const safeIndex = wrapCarouselIndex(activeIndex, count);
    const centerAngle = safeIndex * ((Math.PI * 2) / count);
    return [
      Math.cos(centerAngle) * cameraRadius,
      cameraSettings.height,
      Math.sin(centerAngle) * cameraRadius
    ] as [number, number, number];
  }, [activeIndex, items.length, cameraSettings]);

  useEffect(() => {
    setSceneReady(false);
  }, [itemsSignature]);

  return (
    <div className="relative h-full w-full">
      <Canvas
        className="h-full w-full"
        dpr={1}
        camera={{ position: initialCameraPosition, fov: 45 }}
        onCreated={({ camera }) => {
          applyCarouselCamera(camera, items.length, activeIndex, cameraSettings);
        }}
      >
        <Suspense fallback={null}>
          <RowCarouselStage
            items={items}
            activeIndex={activeIndex}
            targetIndex={targetIndex}
            onArrive={onArrive}
            onAnimationEnd={onAnimationEnd}
            cameraSettings={cameraSettings}
            enableHoverHighlight={enableHoverHighlight}
          />
          {items.length > 0 ? <SceneReady onReady={handleSceneReady} /> : null}
        </Suspense>
      </Canvas>
      {items.length > 0 && !sceneReady ? (
        <SceneLoadingOverlay />
      ) : null}
    </div>
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
  const isPortraitLayout = usePortraitLayout();
  const [markers, setMarkers] = useState<MarkerDto[]>([]);
  const [visibleMarkers, setVisibleMarkers] = useState<MarkerDto[]>([]);
  const [boundsReady, setBoundsReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<MarkerDto | null>(null);
  const [map, setMap] = useState<any>(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [nameFilter, setNameFilter] = useState("");
  const [pendingTypeFilter, setPendingTypeFilter] = useState("all");
  const [pendingNameFilter, setPendingNameFilter] = useState("");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [hoveredMarkerId, setHoveredMarkerId] = useState<string | null>(null);
  const [mapMode, setMapMode] = useState<"map" | "carousel">("map");
  const [carouselOrder, setCarouselOrder] = useState<MarkerDto[]>([]);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [carouselTargetIndex, setCarouselTargetIndex] = useState<number | null>(null);
  const [carouselQueue, setCarouselQueue] = useState(0);
  const [hasCarouselArrowNavigation, setHasCarouselArrowNavigation] = useState(false);
  const carouselQueueRef = useRef(0);
  const overlayTop = "calc(var(--app-header-height, 56px) + 16px)";
  const mapViewportStyle = {
    height: "100dvh",
    marginTop: "calc(-1 * var(--app-header-height, 56px))"
  } as const;
  const mobileMapViewportStyle = {
    height: "100dvh",
    minHeight: "100dvh",
    maxHeight: "100dvh"
  } as const;
  const cameraSettings = useMemo<CarouselCameraSettings>(() => ({
    distanceOffset: 16,
    height: 4.0,
    tiltDeg: 14.5
  }), []);
  const [petCache, setPetCache] = useState<Record<string, PetDetail>>({});
  const hasAutoFitRef = useRef(false);

  const apiUrl = useMemo(() => API_BASE, []);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  const resolvePreviewSrc = useCallback(
    (url?: string | null) => {
      if (!url) {
        return null;
      }
      return url.startsWith("http") ? url : `${apiUrl}${url}`;
    },
    [apiUrl]
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const media = window.matchMedia("(max-width: 1024px)");
    const handleChange = () => setIsMobile(media.matches);
    handleChange();
    if (media.addEventListener) {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (!filterSheetOpen) {
      return;
    }
    setPendingTypeFilter(typeFilter);
    setPendingNameFilter(nameFilter);
  }, [filterSheetOpen, typeFilter, nameFilter]);

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
      setCarouselQueue(0);
      return;
    }
    const shuffled = [...filteredMarkers].sort(() => Math.random() - 0.5);
    setCarouselOrder(shuffled);
    setCarouselIndex(0);
    setCarouselTargetIndex(null);
    setCarouselQueue(0);
  }, [filteredMarkers]);

  useEffect(() => {
    carouselQueueRef.current = carouselQueue;
  }, [carouselQueue]);

  const activeCarouselMarker = carouselOrder[carouselIndex] ?? null;

  useEffect(() => {
    if (carouselOrder.length === 0) {
      return;
    }
    if (carouselIndex >= carouselOrder.length) {
      setCarouselIndex(0);
      setCarouselTargetIndex(null);
      setCarouselQueue(0);
    }
  }, [carouselIndex, carouselOrder.length]);

  const listMarkers = useMemo(() => {
    const source = boundsReady ? visibleMarkers : markers;
    return source.filter((marker) => matchesFilters(marker, typeFilter, nameFilter));
  }, [boundsReady, visibleMarkers, markers, typeFilter, nameFilter]);

  const hasFilters = typeFilter !== "all" || nameFilter.trim().length > 0;
  const activeTypeFilter = isMobile ? pendingTypeFilter : typeFilter;
  const activeNameFilter = isMobile ? pendingNameFilter : nameFilter;
  const desktopSidebarClass =
    "pointer-events-auto absolute bottom-6 right-6 z-20 flex w-[360px] max-w-[400px] flex-col overflow-hidden p-5 [@media(max-height:640px)]:bottom-4 [@media(max-height:640px)]:right-4 [@media(max-height:640px)]:w-[310px] [@media(max-height:640px)]:p-3 [@media(max-width:1120px)]:w-[320px]";
  const desktopCarouselInfoClass =
    `pointer-events-auto absolute right-6 top-1/2 z-20 flex h-[70dvh] w-[30%] max-w-[440px] min-w-[340px] -translate-y-1/2 flex-col overflow-visible ${hudInfoPanelChromeClass(false)} [@media(max-height:640px)]:right-4 [@media(max-height:640px)]:h-[calc(100dvh-var(--app-header-height,56px)-1rem)] [@media(max-height:640px)]:min-w-0 [@media(max-height:640px)]:w-[310px] [@media(max-height:640px)]:rounded-[24px] [@media(max-height:640px)]:p-2 [@media(max-width:1120px)]:min-w-0 [@media(max-width:1120px)]:w-[320px]`;
  const simsPanelClass =
    `${hudFloatingPanelClass(false)} transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_46px_-22px_rgba(93,64,55,0.44)]`;
  const simsSidebarClass =
    hudSidebarChromeClass(false);
  const simsFieldClass =
    "w-full rounded-full border-0 bg-[#efedeb] px-4 py-2.5 text-sm font-extrabold text-[#5d4037] outline-none transition focus:ring-2 focus:ring-[#d3a27f]/35";
  const simsResetButtonClass =
    "self-start rounded-full border-2 border-[#fdf2e9] bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#d3a27f] transition hover:bg-[#fdf2e9] disabled:cursor-not-allowed disabled:opacity-60";
  const mobileContentClass = isPortraitLayout
    ? "relative z-10 flex h-full min-h-0 w-full flex-col gap-2.5 overflow-hidden px-2.5 pb-3"
    : "relative z-10 flex h-full min-h-0 flex-col gap-3 overflow-hidden px-4 pb-4";
  const mobileTopBarClass = isPortraitLayout
    ? "flex items-center justify-between gap-2"
    : "flex items-center justify-between gap-3";
  const mobilePanelClass = isPortraitLayout
    ? `${hudFloatingPanelClass(true)} transition-all duration-300`
    : simsPanelClass;
  const mobileSidebarClass = isPortraitLayout
    ? `min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain ${hudSidebarChromeClass(true)}`
    : `min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4 overscroll-contain ${simsSidebarClass}`;
  const mobileMapSceneHeightClass = isPortraitLayout
    ? "h-[clamp(13rem,34dvh,20rem)] shrink-0"
    : "h-[38dvh] shrink-0";
  const mobileCarouselSceneHeightClass = isPortraitLayout
    ? "h-[clamp(12rem,36dvh,20rem)] shrink-0"
    : "h-[48dvh] shrink-0";
  const modeToggleShellClass =
    "flex rounded-[20px] border-[3px] border-white bg-[#fffcf9] p-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#8d6e63] shadow-sm";
  const modeToggleButtonClass = (active: boolean) =>
    `rounded-[14px] px-3 py-1.5 transition ${
      active
        ? "bg-[#111827] text-white shadow-[0_3px_0_0_#000]"
        : "hover:bg-[#fdf2e9]"
    }`;
  const resetFilters = () => {
    if (isMobile) {
      setPendingTypeFilter("all");
      setPendingNameFilter("");
      return;
    }
    setTypeFilter("all");
    setNameFilter("");
  };
  const applyFilters = () => {
    setTypeFilter(pendingTypeFilter);
    setNameFilter(pendingNameFilter);
    setFilterSheetOpen(false);
  };
  const handleTypeFilterChange = (value: string) => {
    if (isMobile) {
      setPendingTypeFilter(value);
      return;
    }
    setTypeFilter(value);
  };
  const handleNameFilterChange = (value: string) => {
    if (isMobile) {
      setPendingNameFilter(value);
      return;
    }
    setNameFilter(value);
  };

  const modeToggle = !isMobile ? (
    <div className={modeToggleShellClass}>
      <button
        type="button"
        onClick={() => setMapMode("map")}
        className={modeToggleButtonClass(mapMode === "map")}
      >
        Карта
      </button>
      <button
        type="button"
        onClick={() => setMapMode("carousel")}
        className={modeToggleButtonClass(mapMode === "carousel")}
      >
        3D
      </button>
    </div>
  ) : null;
  const modeToggleMobile = isMobile ? (
    <div className={modeToggleShellClass}>
      <button
        type="button"
        onClick={() => setMapMode("map")}
        className={modeToggleButtonClass(mapMode === "map")}
      >
        Карта
      </button>
      <button
        type="button"
        onClick={() => setMapMode("carousel")}
        className={modeToggleButtonClass(mapMode === "carousel")}
      >
        3D
      </button>
    </div>
  ) : null;

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
    if (mapMode !== "carousel" && !isMobile) {
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
  }, [mapMode, isMobile, carouselIndex, carouselOrder]);

  useEffect(() => {
    if (mapMode !== "map" && !isMobile) {
      return;
    }
    const ids = new Set<string>();
    listMarkers.forEach((marker) => {
      if (marker.petId) {
        ids.add(marker.petId);
      }
    });
    ids.forEach((id) => {
      void loadPetDetail(id);
    });
  }, [mapMode, isMobile, listMarkers]);

  useEffect(() => {
    if (!active?.petId) {
      return;
    }
    void loadPetDetail(active.petId);
  }, [active?.petId]);

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
    const soulSettings = readSoulSettings(memorial?.sceneJson as Record<string, unknown> | null);
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

    const now = new Date();
    const activeGifts =
      pet?.gifts?.filter(
        (gift) =>
          gift.isActive !== false &&
          (!gift.expiresAt || new Date(gift.expiresAt) > now)
      ) ?? [];
    const gifts = activeGifts.map((gift) => {
      const slotType = getGiftSlotType(gift.slotName);
      const resolvedUrl =
        resolveGiftModelUrl({ gift: gift.gift, slotType, fallbackUrl: gift.gift.modelUrl }) ??
        gift.gift.modelUrl;
      return {
        slot: gift.slotName,
        url: resolvedUrl,
        size: gift.size ?? null
      };
    });

    return {
      terrainUrl: environmentUrl,
      terrainId: memorial?.environmentId ?? null,
      houseUrl,
      houseId: memorial?.houseId ?? null,
      parts,
      colors: sceneJson.colors ?? undefined,
      gifts: gifts.length > 0 ? gifts : undefined,
      dirtSlots: buildDirtSlotPlacements({
        houseId: memorial?.houseId,
        level: memorial?.dustStage ?? 0,
        activeSlots: readActiveDirtSlots(
          memorial?.sceneJson as Record<string, unknown> | null,
          memorial?.dustStage ?? 0
        ),
        seed: `${marker.petId}:${memorial?.dustUpdatedAt ?? memorial?.createdAt ?? ""}`
      }),
      soul: soulSettings
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

  const queueCarouselStep = useCallback(
    (step: number) => {
      if (carouselOrder.length < 2) {
        return;
      }
      setHasCarouselArrowNavigation(true);
      if (step > 0 && carouselQueueRef.current >= 4) {
        return;
      }
      if (step < 0 && carouselQueueRef.current <= -4) {
        return;
      }
      setCarouselQueue((prev) => {
        const next = prev + step;
        if (next > 4) {
          return 4;
        }
        if (next < -4) {
          return -4;
        }
        return next;
      });
    },
    [carouselOrder.length]
  );

  const handleCarouselAnimationEnd = () => {
    setCarouselTargetIndex(null);
  };

  const handleCarouselPrev = () => {
    queueCarouselStep(-1);
  };

  const handleCarouselNext = () => {
    queueCarouselStep(1);
  };

  useEffect(() => {
    if (mapMode !== "carousel") {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        handleCarouselNext();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        handleCarouselPrev();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mapMode, handleCarouselNext, handleCarouselPrev]);

  useEffect(() => {
    if (carouselTargetIndex !== null || carouselQueue === 0 || carouselOrder.length < 2) {
      return;
    }
    const step = carouselQueue > 0 ? 1 : -1;
    const nextIndex =
      (carouselIndex + step + carouselOrder.length) % carouselOrder.length;
    setCarouselTargetIndex(nextIndex);
    setCarouselQueue((prev) => prev - step);
  }, [carouselTargetIndex, carouselQueue, carouselIndex, carouselOrder.length]);

  const renderMemorialInfoContent = (
    marker: MarkerDto,
    options?: { onClose?: () => void; compact?: boolean; stacked?: boolean }
  ) => {
    const pet = petCache[marker.petId];
    const previewSrc = resolvePreviewSrc(getMarkerCoverSrc(marker));
    const compact = options?.compact ?? isPortraitLayout;
    const stacked = options?.stacked ?? false;
    return (
      <div className={compact ? `relative flex min-h-full flex-col overflow-x-hidden p-2.5 ${hudCardSurfaceClass(true)}` : `relative flex h-full min-h-0 flex-col overflow-x-hidden p-4 ${hudCardSurfaceClass(false)} [@media(max-height:640px)]:rounded-[20px] [@media(max-height:640px)]:p-3`}>
        {options?.onClose ? (
          <button
            type="button"
            onClick={options.onClose}
            className={compact ? "absolute right-2 top-2 z-20 h-8 w-8 rounded-full border-2 border-[#fdf2e9] bg-white text-lg font-black text-[#8d6e63] shadow-sm transition hover:text-[#5d4037]" : "absolute right-3 top-3 z-20 h-9 w-9 rounded-full border-2 border-[#fdf2e9] bg-white text-xl font-black text-[#8d6e63] shadow-sm transition hover:text-[#5d4037]"}
            aria-label="Вернуться к списку"
          >
            ×
          </button>
        ) : null}
        {stacked ? (
          <div className={compact ? "shrink-0 pr-8" : "shrink-0 pr-9"}>
            <div className="relative shrink-0">
              {previewSrc ? (
                <img
                  src={previewSrc}
                  alt={`Фото ${marker.name}`}
                  className={compact ? "mx-auto h-[clamp(7.5rem,18dvh,10rem)] w-[clamp(7.5rem,18dvh,10rem)] rounded-[22px] object-cover" : "mx-auto h-[clamp(7rem,24dvh,12rem)] w-[clamp(7rem,24dvh,12rem)] rounded-[28px] object-cover [@media(max-height:640px)]:h-[clamp(5.75rem,22dvh,8rem)] [@media(max-height:640px)]:w-[clamp(5.75rem,22dvh,8rem)] [@media(max-height:640px)]:rounded-[22px]"}
                  loading="lazy"
                />
              ) : (
                <div className={compact ? "mx-auto h-[clamp(7.5rem,18dvh,10rem)] w-[clamp(7.5rem,18dvh,10rem)] rounded-[22px] bg-[#eadfd9]" : "mx-auto h-[clamp(7rem,24dvh,12rem)] w-[clamp(7rem,24dvh,12rem)] rounded-[28px] bg-[#eadfd9] [@media(max-height:640px)]:h-[clamp(5.75rem,22dvh,8rem)] [@media(max-height:640px)]:w-[clamp(5.75rem,22dvh,8rem)] [@media(max-height:640px)]:rounded-[22px]"} />
              )}
            </div>
            <div className="mt-3 min-w-0 text-center">
              <div className="relative min-w-0 px-7">
                <h3 className={compact ? "truncate text-center text-base font-black uppercase tracking-tight text-[#5d4037]" : "truncate text-center text-xl font-black uppercase tracking-tight text-[#5d4037]"}>
                  {marker.name}
                </h3>
                <span className="absolute right-0 top-1/2 -translate-y-1/2">
                  <VisibilityIndicator
                    isPublic={marker.isPublic ?? true}
                    tooltipAlign="right"
                  />
                </span>
              </div>
              <p className={compact ? "mt-0.5 whitespace-nowrap text-center text-xs font-semibold text-[#8d6e63]" : "mt-1 whitespace-nowrap text-center text-sm font-semibold text-[#8d6e63]"}>
                {formatYearRange(marker.birthDate, marker.deathDate)}
              </p>
            </div>
          </div>
        ) : (
          <div className={compact ? "flex shrink-0 items-start gap-3 pr-8" : "flex shrink-0 items-start gap-4 pr-9"}>
            <div className="relative shrink-0">
              {previewSrc ? (
                <img
                  src={previewSrc}
                  alt={`Фото ${marker.name}`}
                  className={compact ? "h-[clamp(7rem,17dvh,9rem)] w-[clamp(7rem,17dvh,9rem)] rounded-[22px] object-cover" : "h-36 w-36 rounded-[28px] object-cover"}
                  loading="lazy"
                />
              ) : (
                <div className={compact ? "h-[clamp(7rem,17dvh,9rem)] w-[clamp(7rem,17dvh,9rem)] rounded-[22px] bg-[#eadfd9]" : "h-36 w-36 rounded-[28px] bg-[#eadfd9]"} />
              )}
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex min-w-0 items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className={compact ? "truncate text-base font-black uppercase tracking-tight text-[#5d4037]" : "truncate text-xl font-black uppercase tracking-tight text-[#5d4037]"}>
                    {marker.name}
                  </h3>
                  <p className={compact ? "mt-0.5 whitespace-nowrap text-xs font-semibold text-[#8d6e63]" : "mt-1 whitespace-nowrap text-sm font-semibold text-[#8d6e63]"}>
                    {formatYearRange(marker.birthDate, marker.deathDate)}
                  </p>
                </div>
                <VisibilityIndicator
                  isPublic={marker.isPublic ?? true}
                  className="mt-1 shrink-0"
                  tooltipAlign="right"
                />
              </div>
            </div>
          </div>
        )}
        <div className={compact ? "mt-3 h-16 shrink-0 overflow-y-auto rounded-[16px] bg-[#f7f1ee] px-3 py-2" : "mt-3 h-[clamp(4rem,15dvh,7rem)] shrink-0 overflow-y-auto rounded-[20px] bg-[#f7f1ee] px-4 py-3 [@media(max-height:640px)]:mt-2 [@media(max-height:640px)]:rounded-[16px] [@media(max-height:640px)]:px-3 [@media(max-height:640px)]:py-2"}>
          <p className={compact ? "text-sm italic leading-snug text-[#6f6360]" : "text-[15px] italic leading-relaxed text-[#6f6360]"}>
            &ldquo;{marker.epitaph ?? "Без эпитафии"}&rdquo;
          </p>
        </div>
        <div className={stacked && compact ? "mt-2 min-h-[9rem] max-h-[18rem] shrink-0 overflow-y-auto rounded-[16px] bg-[#f7f1ee] px-3 py-2" : compact ? "mt-2 min-h-0 flex-1 overflow-y-auto rounded-[16px] bg-[#f7f1ee] px-3 py-2" : "mt-3 min-h-[3.5rem] flex-1 overflow-y-auto rounded-[20px] bg-[#f7f1ee] px-4 py-3 [@media(max-height:640px)]:mt-2 [@media(max-height:640px)]:min-h-[2.75rem] [@media(max-height:640px)]:rounded-[16px] [@media(max-height:640px)]:px-3 [@media(max-height:640px)]:py-2"}>
          <p className={compact ? "text-xs leading-snug text-[#7b6b65]" : "text-sm leading-relaxed text-[#7b6b65]"}>
            {pet?.story || "История пока не добавлена."}
          </p>
        </div>
        <a
          className={compact ? "group mt-3 inline-flex w-full shrink-0 items-center justify-center rounded-xl bg-[#c8d8cf] px-5 py-2.5 text-sm font-black text-[#355148] shadow-[0_3px_0_0_#8ca79c] transition-all hover:brightness-105 active:translate-y-[3px] active:shadow-none" : "group mt-5 inline-flex w-full shrink-0 items-center justify-center rounded-xl bg-[#c8d8cf] px-7 py-3 text-base font-black text-[#355148] shadow-[0_4px_0_0_#8ca79c] transition-all hover:brightness-105 active:translate-y-[4px] active:shadow-none"}
          href={`/pets/${marker.petId}`}
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
        </a>
      </div>
    );
  };

  const activeCarouselInfoContent = activeCarouselMarker ? (
    renderMemorialInfoContent(activeCarouselMarker, { stacked: true })
  ) : (
    <p className={hudEmptyStateTextClass}>Нет мемориалов</p>
  );
  const activeMarkerInfoContent = active
    ? renderMemorialInfoContent(active, {
        onClose: () => setActive(null),
        compact: isPortraitLayout,
        stacked: true
      })
    : null;

  const memorialListContent = (
    <div className={`grid min-w-0 overflow-x-hidden pb-1 ${isPortraitLayout ? "grid-cols-2 gap-2" : "grid-cols-1 gap-4"}`}>
      {loading ? <p className={hudEmptyStateTextClass}>Загрузка...</p> : null}
      {!loading && !error && listMarkers.length === 0 ? (
        <p className={hudEmptyStateTextClass}>
          {hasFilters
            ? "По заданным фильтрам ничего не найдено."
            : boundsReady
              ? "В выбранной области нет мемориалов."
              : "Пока нет публичных мемориалов."}
        </p>
      ) : null}
      {listMarkers.map((marker) => {
        const previewSrc = resolvePreviewSrc(
          marker.previewImageUrl ?? marker.previewPhotoUrl
        );
        return (
          <a
            key={marker.id}
            href={`/pets/${marker.petId}`}
            onMouseEnter={() => setHoveredMarkerId(marker.id)}
            onMouseLeave={() => setHoveredMarkerId(null)}
            onFocus={() => setHoveredMarkerId(marker.id)}
            onBlur={() => setHoveredMarkerId(null)}
            className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#eadfd9] bg-[#fffcf9] transition hover:border-[#d3a27f]"
          >
            <div className="overflow-hidden rounded-2xl bg-[#fffcf9]">
              <MemorialCardPreview previewSrc={previewSrc} className="rounded-t-2xl" />
              <div className={`${isPortraitLayout ? "p-2" : "p-3"} border-t border-[#eadfd9] bg-[#fffcf9]`}>
                <h3 className={`${isPortraitLayout ? "text-xs" : "text-sm"} truncate font-semibold text-[#5d4037]`}>{marker.name}</h3>
                <p className={`${isPortraitLayout ? "text-[10px]" : "text-xs"} mt-1 whitespace-nowrap text-[#8d6e63]`}>
                  {formatYearRange(marker.birthDate, marker.deathDate)}
                </p>
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
  const desktopFilterPanel = (
    <div
      className={`pointer-events-auto absolute left-6 z-20 flex w-full max-w-[320px] flex-col gap-3 transition-[transform,opacity,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${simsPanelClass}`}
      style={{
        top: overlayTop,
        transform: mapMode === "carousel" ? "translateY(2px)" : "translateY(0px)"
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="ml-auto">{modeToggle}</div>
      </div>
      <label className="grid gap-1 text-sm text-[#8d6e63]">
        Вид питомца
        <select
          className={`${simsFieldClass} appearance-none pr-10`}
          style={selectArrowStyle}
          value={activeTypeFilter}
          onChange={(event) => handleTypeFilterChange(event.target.value)}
        >
          {petTypeOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm text-[#8d6e63]">
        Имя питомца
        <input
          className={simsFieldClass}
          value={activeNameFilter}
          onChange={(event) => handleNameFilterChange(event.target.value)}
          placeholder="Барсик"
        />
      </label>
      <button
        type="button"
        onClick={resetFilters}
        disabled={!hasFilters}
        className={simsResetButtonClass}
      >
        Сбросить
      </button>
    </div>
  );
  if (isMobile) {
    return (
      <main
        data-mobile-immersive="true"
        className="relative flex h-[100dvh] max-h-[100dvh] w-screen overflow-hidden bg-[#fcf8f5] overscroll-none"
        style={mobileMapViewportStyle}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.6),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(59,206,172,0.14),_transparent_30%)]" />
        <div
          className={mobileContentClass}
          style={{ paddingTop: isPortraitLayout ? "10px" : "16px" }}
        >
          <div className={mobileTopBarClass}>
            <button
              type="button"
              onClick={() => setFilterSheetOpen(true)}
              className="rounded-full border border-[#eadfd9] bg-[#fffcf9] px-4 py-2 text-sm font-semibold text-[#6f6360] shadow-sm transition hover:border-[#d3a27f] hover:bg-[#fff7f2]"
            >
              Фильтры
            </button>
            {modeToggleMobile}
          </div>
          {mapMode === "map" ? (
            <>
              <div className={`relative ${mobileMapSceneHeightClass} w-full overflow-hidden ${mobilePanelClass}`}>
                {!apiKey ? (
                  <div className="flex h-full items-center justify-center bg-[#fcf8f5] text-sm font-semibold text-[#8d6e63]">
                    Укажи NEXT_PUBLIC_GOOGLE_MAPS_API_KEY в .env.local
                  </div>
                ) : loadError ? (
                  <div className="flex h-full items-center justify-center bg-[#fcf8f5] text-sm text-red-600">
                    Ошибка загрузки Google Maps
                  </div>
                ) : !isLoaded ? (
                  <div className="flex h-full items-center justify-center bg-[#fcf8f5] text-sm font-semibold text-[#8d6e63]">
                    Загрузка карты...
                  </div>
                ) : (
                  <GoogleMap
                    mapContainerStyle={containerStyle}
                    onClick={() => setActive(null)}
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
                                (hoveredMarkerId === marker.id || active?.id === marker.id) &&
                                typeof window !== "undefined" &&
                                window.google
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
                  </GoogleMap>
                )}
              </div>
              <div className="flex items-center justify-between px-1">
                <h2 className="text-base font-black uppercase tracking-tight text-[#5d4037]">
                  {active ? "Мемориал" : "Мемориалы"}
                </h2>
                {!active ? (
                  <span className="rounded-full bg-[#d3a27f]/10 px-3 py-1 text-[10px] font-black text-[#d3a27f]">
                    {listMarkers.length}
                  </span>
                ) : null}
              </div>
              <div className={mobileSidebarClass}>
                {activeMarkerInfoContent ?? memorialListContent}
              </div>
            </>
          ) : (
            <>
              <div className={`relative ${mobileCarouselSceneHeightClass} w-full overflow-hidden ${mobilePanelClass}`}>
                <CarouselScene
                  items={carouselItems}
                  activeIndex={carouselIndex}
                  targetIndex={carouselTargetIndex}
                  onArrive={handleCarouselArrive}
                  onAnimationEnd={handleCarouselAnimationEnd}
                  cameraSettings={cameraSettings}
                  enableHoverHighlight={false}
                />
                <div className="pointer-events-none absolute inset-0">
                  <button
                    type="button"
                    aria-label="Предыдущий мемориал"
                    onClick={handleCarouselNext}
                    className="pointer-events-auto group absolute left-0 top-0 h-full w-[20%] bg-transparent"
                  >
                    <span
                      className={`pointer-events-none absolute left-4 top-1/2 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-white bg-[#fffcf9] text-[#5d4037] shadow-[0_14px_32px_-18px_rgba(93,64,55,0.42)] backdrop-blur transition-all duration-200 group-hover:translate-x-1 group-hover:opacity-100 ${
                        hasCarouselArrowNavigation ? "opacity-0" : "opacity-100"
                      }`}
                    >
                      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M15 18 9 12l6-6" />
                      </svg>
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label="Следующий мемориал"
                    onClick={handleCarouselPrev}
                    className="pointer-events-auto group absolute right-0 top-0 h-full w-[20%] bg-transparent"
                  >
                    <span
                      className={`pointer-events-none absolute right-4 top-1/2 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-white bg-[#fffcf9] text-[#5d4037] shadow-[0_14px_32px_-18px_rgba(93,64,55,0.42)] backdrop-blur transition-all duration-200 group-hover:-translate-x-1 group-hover:opacity-100 ${
                        hasCarouselArrowNavigation ? "opacity-0" : "opacity-100"
                      }`}
                    >
                      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </span>
                  </button>
                </div>
              </div>
              <div className={isPortraitLayout ? `min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain ${hudInfoPanelChromeClass(true)}` : `min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain ${hudInfoPanelChromeClass(false)}`}>
                {activeCarouselInfoContent}
              </div>
            </>
          )}
        </div>
        {filterSheetOpen ? (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#111827]/30 px-4 py-6 backdrop-blur-sm">
            <div className={`w-full max-w-sm p-5 ${simsPanelClass}`}>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-black uppercase tracking-tight text-[#5d4037]">Фильтры</h2>
                <button
                  type="button"
                  onClick={() => setFilterSheetOpen(false)}
                  className="rounded-full border-2 border-[#fdf2e9] px-2 py-1 text-xs font-black text-[#8d6e63]"
                  aria-label="Закрыть"
                >
                  ✕
                </button>
              </div>
              <label className="mt-4 grid gap-1 text-sm text-[#8d6e63]">
                Вид питомца
                <select
                  className={`${simsFieldClass} appearance-none pr-10`}
                  style={selectArrowStyle}
                  value={pendingTypeFilter}
                  onChange={(event) => handleTypeFilterChange(event.target.value)}
                >
                  {petTypeOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-3 grid gap-1 text-sm text-[#8d6e63]">
                Имя питомца
                <input
                  className={simsFieldClass}
                  value={pendingNameFilter}
                  onChange={(event) => handleNameFilterChange(event.target.value)}
                  placeholder="Барсик"
                />
              </label>
              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetFilters}
                  className={simsResetButtonClass}
                >
                  Сбросить
                </button>
                <button
                  type="button"
                  onClick={applyFilters}
                  className="flex-1 rounded-2xl bg-[#111827] px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-white shadow-[0_4px_0_0_#000] transition hover:-translate-y-[1px] hover:shadow-[0_5px_0_0_#000] active:translate-y-[3px] active:shadow-none"
                >
                  Применить
                </button>
              </div>
            </div>
          </div>
        ) : null}
        <div className="pointer-events-auto absolute bottom-4 right-4">
          <ErrorToast message={error} onClose={() => setError(null)} />
        </div>
      </main>
    );
  }

  return (
    <main
      className="relative w-screen overflow-hidden bg-[#fcf8f5]"
      style={mapViewportStyle}
    >
      <div className="absolute inset-0">
        {mapMode === "map" ? (
          !apiKey ? (
            <div className="flex h-full items-center justify-center bg-[#fcf8f5] text-sm font-semibold text-[#8d6e63]">
              Укажи NEXT_PUBLIC_GOOGLE_MAPS_API_KEY в .env.local
            </div>
          ) : loadError ? (
            <div className="flex h-full items-center justify-center bg-[#fcf8f5] text-sm text-red-600">
              Ошибка загрузки Google Maps
            </div>
          ) : !isLoaded ? (
            <div className="flex h-full items-center justify-center bg-[#fcf8f5] text-sm font-semibold text-[#8d6e63]">
              Загрузка карты...
            </div>
          ) : (
            <GoogleMap
              mapContainerStyle={containerStyle}
              onClick={() => setActive(null)}
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
                          (hoveredMarkerId === marker.id || active?.id === marker.id) && typeof window !== "undefined" && window.google
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
            </GoogleMap>
          )
        ) : (
          <div className="h-full w-full bg-gradient-to-b from-[#fcf8f5] via-white to-[#f1e7e0]" />
        )}
      </div>

      <div className="relative z-10 h-full w-full pointer-events-none">
        {mapMode === "map" ? (
          <div className="relative h-full w-full">
            {desktopFilterPanel}
            <div
              className={`${desktopSidebarClass} ${simsSidebarClass}`}
              style={{ top: overlayTop }}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-tight text-[#5d4037]">
                  {active ? "Мемориал" : "Мемориалы"}
                </h2>
                {!active ? (
                  <span className="rounded-full bg-[#d3a27f]/10 px-3 py-1 text-[10px] font-black text-[#d3a27f]">
                    {listMarkers.length}
                  </span>
                ) : null}
              </div>
              <div className="mt-4 min-h-0 flex-1 overflow-x-hidden overflow-y-auto pr-1 [@media(max-height:640px)]:mt-3">
                {activeMarkerInfoContent ?? memorialListContent}
              </div>
            </div>
          </div>
        ) : (
          <div className="relative h-full w-full overflow-hidden">
            <div className="absolute inset-0">
              <CarouselScene
                items={carouselItems}
                activeIndex={carouselIndex}
                targetIndex={carouselTargetIndex}
                onArrive={handleCarouselArrive}
                onAnimationEnd={handleCarouselAnimationEnd}
                cameraSettings={cameraSettings}
              />
              <div className="pointer-events-none absolute inset-0">
                <button
                  type="button"
                  aria-label="Предыдущий мемориал"
                  onClick={handleCarouselNext}
                  className="pointer-events-auto group absolute left-0 top-0 h-full w-[20%] bg-transparent"
                >
                  <span
                    className={`pointer-events-none absolute left-6 top-1/2 flex h-16 w-16 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-white bg-[#fffcf9] text-[#5d4037] shadow-[0_16px_36px_-18px_rgba(93,64,55,0.45)] backdrop-blur transition-all duration-200 group-hover:translate-x-1 group-hover:opacity-100 ${
                      hasCarouselArrowNavigation ? "opacity-0" : "opacity-100"
                    }`}
                  >
                    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M15 18 9 12l6-6" />
                    </svg>
                  </span>
                </button>
                <button
                  type="button"
                  aria-label="Следующий мемориал"
                  onClick={handleCarouselPrev}
                  className="pointer-events-auto group absolute right-0 top-0 h-full w-[20%] bg-transparent"
                >
                  <span
                    className={`pointer-events-none absolute right-6 top-1/2 flex h-16 w-16 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-white bg-[#fffcf9] text-[#5d4037] shadow-[0_16px_36px_-18px_rgba(93,64,55,0.45)] backdrop-blur transition-all duration-200 group-hover:-translate-x-1 group-hover:opacity-100 ${
                      hasCarouselArrowNavigation ? "opacity-0" : "opacity-100"
                    }`}
                  >
                    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </span>
                </button>
              </div>
            </div>
            {desktopFilterPanel}
            <div className={desktopCarouselInfoClass}>
              {activeCarouselInfoContent}
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
