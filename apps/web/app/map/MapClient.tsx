"use client";

import {
  GoogleMap,
  InfoWindow,
  Marker,
  MarkerClusterer,
  useJsApiLoader
} from "@react-google-maps/api";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ensureDracoLoader } from "../../lib/draco";
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

ensureDracoLoader();
import {
  getGiftSlotType,
  resolveGiftModelUrl,
  resolveGiftSizeMultiplier,
  resolveGiftTargetWidth
} from "../../lib/gifts";
import { getHouseSlots } from "../../lib/memorial-config";
import { splitHouseVariantId } from "../../lib/house-variants";
import { applyHousePlacement, getHouseTransform } from "../../lib/house-layout";

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
};

const Group = "group" as unknown as React.ComponentType<any>;
const Primitive = "primitive" as unknown as React.ComponentType<any>;
const Mesh = "mesh" as unknown as React.ComponentType<any>;
const SphereGeometry = "sphereGeometry" as unknown as React.ComponentType<any>;
const PlaneGeometry = "planeGeometry" as unknown as React.ComponentType<any>;
const MeshBasicMaterial = "meshBasicMaterial" as unknown as React.ComponentType<any>;
const AmbientLight = "ambientLight" as unknown as React.ComponentType<any>;
const DirectionalLight = "directionalLight" as unknown as React.ComponentType<any>;
const PointLight = "pointLight" as unknown as React.ComponentType<any>;
const Color = "color" as unknown as React.ComponentType<any>;
const MAP_PREVIEW_ROTATION_Y = THREE.MathUtils.degToRad(15);
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
    cloneMeshMaterials(cloned);
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

function TerrainWithHouseScene({ data, tone }: { data: MemorialSceneData; tone?: number }) {
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
    <Group rotation={[0, MAP_PREVIEW_ROTATION_Y, 0]}>
      <Primitive object={terrain} />
      {data.parts.map((part) => (
        <PartInstance key={`${part.slot}-${part.url}`} house={house} slot={part.slot} url={part.url} colors={data.colors} />
      ))}
      {data.gifts?.map((gift) => (
        <GiftInstance key={`${gift.slot}-${gift.url}`} terrain={terrain} slot={gift.slot} url={gift.url} size={gift.size} />
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
        className={`w-full bg-slate-100 ${className ?? "rounded-2xl"}`}
        style={{ aspectRatio: CARD_PREVIEW_ASPECT }}
      />
    );
  }
  return (
    <div
      className={`w-full overflow-hidden bg-slate-100 ${className ?? "rounded-2xl"}`}
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
    return () => {
      hoveredRef.current = null;
    };
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
      return <Color attach="background" args={["#f8fafc"]} />;
    }

    return (
      <>
        <Color attach="background" args={["#f8fafc"]} />
        <Mesh ref={sphereRef} renderOrder={-20} raycast={() => null}>
          <SphereGeometry args={[120, 64, 64]} />
          <MeshBasicMaterial map={texture} side={THREE.BackSide} depthWrite={false} />
        </Mesh>
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
      node.rotateY(Math.PI);
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
      node.rotateY(Math.PI);

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
  return (
    <Canvas
      dpr={1}
      camera={{ position: initialCameraPosition, fov: 45 }}
      onCreated={({ camera }) => {
        applyCarouselCamera(camera, items.length, activeIndex, cameraSettings);
      }}
    >
      <RowCarouselStage
        items={items}
        activeIndex={activeIndex}
        targetIndex={targetIndex}
        onArrive={onArrive}
        onAnimationEnd={onAnimationEnd}
        cameraSettings={cameraSettings}
        enableHoverHighlight={enableHoverHighlight}
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
  const simsPanelClass =
    "rounded-[32px] border-[4px] border-white bg-white/90 p-4 shadow-[0_18px_40px_-24px_rgba(93,64,55,0.4)] backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_46px_-22px_rgba(93,64,55,0.44)]";
  const simsSidebarClass =
    "rounded-[32px] border-[4px] border-[#f8f9fa] bg-white/92 shadow-[0_18px_40px_-24px_rgba(93,64,55,0.38)] backdrop-blur-md";
  const simsFieldClass =
    "w-full rounded-full border-0 bg-[#efedeb] px-4 py-2.5 text-sm font-extrabold text-[#5d4037] outline-none transition focus:ring-2 focus:ring-[#d3a27f]/35";
  const simsResetButtonClass =
    "self-start rounded-full border-2 border-[#fdf2e9] bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#d3a27f] transition hover:bg-[#fdf2e9] disabled:cursor-not-allowed disabled:opacity-60";
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
      gifts: gifts.length > 0 ? gifts : undefined
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

  const activeCarouselPet = activeCarouselMarker ? petCache[activeCarouselMarker.petId] : null;
  const activePreviewSrc = resolvePreviewSrc(activeCarouselMarker?.previewPhotoUrl);

  const memorialListContent = (
    <div className="grid grid-cols-1 gap-4">
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
      {listMarkers.map((marker) => {
        const previewSrc = resolvePreviewSrc(
          marker.previewImageUrl ?? marker.previewPhotoUrl
        );
        const hoverPreviewSrc = resolvePreviewSrc(
          marker.previewPhotoUrl ?? marker.previewImageUrl
        );
        return (
          <a
            key={marker.id}
            href={`/pets/${marker.petId}`}
            onMouseEnter={() => setHoveredMarkerId(marker.id)}
            onMouseLeave={() => setHoveredMarkerId(null)}
            onFocus={() => setHoveredMarkerId(marker.id)}
            onBlur={() => setHoveredMarkerId(null)}
            className="group relative flex flex-col overflow-visible rounded-2xl border border-slate-200 bg-white/90 transition hover:border-slate-300"
          >
            <div className="overflow-hidden rounded-2xl bg-white/90">
              <MemorialCardPreview previewSrc={previewSrc} className="rounded-t-2xl" />
              <div className="border-t border-slate-200 bg-white/90 p-3">
                <h3 className="text-sm font-semibold text-slate-900">{marker.name}</h3>
                <p className="mt-1 text-xs text-slate-600">
                  {formatYearRange(marker.birthDate, marker.deathDate)}
                </p>
              </div>
            </div>
            {hoverPreviewSrc ? (
              <div className="pointer-events-none absolute left-full top-1/2 hidden -translate-y-1/2 rounded-xl border border-slate-200 bg-white/95 p-2 shadow-lg backdrop-blur-sm group-hover:block ml-3">
                <img
                  src={hoverPreviewSrc}
                  alt="Обложка мемориала"
                  className="h-40 w-56 rounded-lg object-contain"
                  loading="lazy"
                />
              </div>
            ) : null}
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
        className="relative flex w-screen overflow-hidden bg-[#cfe9ff]"
        style={mapViewportStyle}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.6),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(59,206,172,0.14),_transparent_30%)]" />
        <div
          className="relative z-10 flex h-full flex-col gap-4 px-4 pb-4"
          style={{ paddingTop: "calc(var(--app-header-height, 56px) + 16px)" }}
        >
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setFilterSheetOpen(true)}
              className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm text-slate-700 shadow-sm"
            >
              Фильтры
            </button>
            {modeToggleMobile}
          </div>
          {mapMode === "map" ? (
            <>
              <div className={`relative h-[42vh] w-full overflow-hidden ${simsPanelClass}`}>
                {!apiKey ? (
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
                                hoveredMarkerId === marker.id &&
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
                    {active ? (
                      <InfoWindow
                        position={{ lat: active.lat, lng: active.lng }}
                        onCloseClick={() => setActive(null)}
                        options={{ maxWidth: 260 }}
                      >
                        <div className="max-w-[240px] text-sm">
                          {resolvePreviewSrc(active.previewPhotoUrl) ? (
                            <img
                              src={resolvePreviewSrc(active.previewPhotoUrl)!}
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
                )}
              </div>
              <div className="flex items-center justify-between px-1">
                <h2 className="text-base font-black uppercase tracking-tight text-[#5d4037]">Мемориалы</h2>
                <span className="rounded-full bg-[#d3a27f]/10 px-3 py-1 text-[10px] font-black text-[#d3a27f]">
                  {listMarkers.length}
                </span>
              </div>
              <div className={`flex-1 overflow-y-auto p-4 ${simsSidebarClass}`}>
                {memorialListContent}
              </div>
            </>
          ) : (
            <>
              <div className={`relative h-[42vh] w-full overflow-hidden ${simsPanelClass}`}>
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
                      className={`pointer-events-none absolute left-4 top-1/2 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-white bg-white/90 text-[#5d4037] shadow-[0_14px_32px_-18px_rgba(0,0,0,0.45)] backdrop-blur transition-all duration-200 group-hover:translate-x-1 group-hover:opacity-100 ${
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
                      className={`pointer-events-none absolute right-4 top-1/2 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-white bg-white/90 text-[#5d4037] shadow-[0_14px_32px_-18px_rgba(0,0,0,0.45)] backdrop-blur transition-all duration-200 group-hover:-translate-x-1 group-hover:opacity-100 ${
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
              <div className={`flex-1 overflow-y-auto p-4 ${simsSidebarClass}`}>
                {activeCarouselMarker ? (
                  <div className="flex h-full flex-col gap-3">
                    {activePreviewSrc ? (
                      <img
                        src={activePreviewSrc}
                        alt="Фото питомца"
                        className="h-40 w-full flex-shrink-0 rounded-2xl object-contain"
                        loading="lazy"
                      />
                    ) : null}
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">
                        {activeCarouselMarker.name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {activeCarouselMarker.epitaph ?? "Без эпитафии"}
                      </p>
                    </div>
                    {activeCarouselPet?.story ? (
                      <p className="flex-1 overflow-y-auto text-xs text-slate-500">
                        {activeCarouselPet.story}
                      </p>
                    ) : null}
                    <a
                      className="mt-auto inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white"
                      href={`/pets/${activeCarouselMarker.petId}`}
                    >
                      Открыть мемориал
                    </a>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Нет мемориалов</p>
                )}
              </div>
            </>
          )}
        </div>
        {filterSheetOpen ? (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/30 px-4 py-6 backdrop-blur-sm">
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
      className="relative w-screen overflow-hidden bg-[#cfe9ff]"
      style={mapViewportStyle}
    >
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
                    {resolvePreviewSrc(active.previewPhotoUrl) ? (
                      <img
                        src={resolvePreviewSrc(active.previewPhotoUrl)!}
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
          <div className="relative h-full w-full">
            {desktopFilterPanel}
            <div
              className={`pointer-events-auto absolute right-6 z-20 flex max-h-[78vh] w-[320px] max-w-[360px] flex-col p-5 ${simsSidebarClass}`}
              style={{ top: overlayTop }}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-tight text-[#5d4037]">Мемориалы</h2>
                <span className="rounded-full bg-[#d3a27f]/10 px-3 py-1 text-[10px] font-black text-[#d3a27f]">
                  {listMarkers.length}
                </span>
              </div>
              <div className="mt-4 flex-1 overflow-y-auto pr-1">{memorialListContent}</div>
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
                    className={`pointer-events-none absolute left-6 top-1/2 flex h-16 w-16 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-white bg-white/90 text-[#5d4037] shadow-[0_16px_36px_-18px_rgba(0,0,0,0.48)] backdrop-blur transition-all duration-200 group-hover:translate-x-1 group-hover:opacity-100 ${
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
                    className={`pointer-events-none absolute right-6 top-1/2 flex h-16 w-16 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-white bg-white/90 text-[#5d4037] shadow-[0_16px_36px_-18px_rgba(0,0,0,0.48)] backdrop-blur transition-all duration-200 group-hover:-translate-x-1 group-hover:opacity-100 ${
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
            <div className={`pointer-events-auto absolute right-6 top-1/2 z-20 h-[60%] w-[24%] max-w-[360px] min-w-[260px] -translate-y-1/2 p-5 ${simsSidebarClass}`}>
              {activeCarouselMarker ? (
                <div className="flex h-full flex-col gap-3">
                  {activePreviewSrc ? (
                    <img
                      src={activePreviewSrc}
                      alt="Фото питомца"
                      className="h-40 w-full flex-shrink-0 rounded-2xl object-contain"
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
                    <p className="flex-1 overflow-y-auto text-xs text-slate-500">
                      {activeCarouselPet.story}
                    </p>
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
        )}
        <div className="pointer-events-auto absolute bottom-6 right-6">
          <ErrorToast message={error} onClose={() => setError(null)} />
        </div>
      </div>
    </main>
  );
}
