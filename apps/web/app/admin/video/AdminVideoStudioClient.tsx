"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { API_BASE } from "../../../lib/config";
import { canAccessAdmin, type AccessLevel } from "../../../lib/access";
import { ensureDracoLoader } from "../../../lib/draco";
import {
  resolveBowlFoodModel,
  resolveBowlWaterModel,
  resolveEnvironmentModel,
  resolveFrameLeftModel,
  resolveFrameRightModel,
  resolveHouseModel,
  resolveMatModel,
  resolveRoofModel,
  resolveSignModel,
  resolveWallModel,
} from "../../../lib/memorial-models";
import { getHouseSlots } from "../../../lib/memorial-config";
import {
  applyHousePartAdjustment,
  applyHousePlacement,
  getHousePartFitBounds,
  getHousePartScaleMultiplier,
  getHouseScaleFitSizeOverride,
  getHouseTransform,
} from "../../../lib/house-layout";
import { splitHouseVariantId } from "../../../lib/house-variants";
import {
  buildDirtSlotPlacements,
  readActiveDirtSlots,
  type DirtSlotPlacement,
} from "../../../lib/dirt-models";
import {
  getGiftSlotType,
  resolveGiftModelUrl,
  resolveGiftScaleMultiplier,
  resolveGiftSizeMultiplier,
  resolveGiftTargetWidth,
} from "../../../lib/gifts";
import DirtSlotAttachments from "../../../components/DirtSlotAttachments";
import GiftFlames from "../../../components/GiftFlames";
import TunedSkyDome from "../../../components/TunedSkyDome";
import ErrorToast from "../../../components/ErrorToast";

ensureDracoLoader();

const Primitive = "primitive" as unknown as React.ComponentType<any>;
const Group = "group" as unknown as React.ComponentType<any>;
const Color = "color" as unknown as React.ComponentType<any>;
const AmbientLight = "ambientLight" as unknown as React.ComponentType<any>;
const DirectionalLight = "directionalLight" as unknown as React.ComponentType<any>;
const HemisphereLight = "hemisphereLight" as unknown as React.ComponentType<any>;

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

type MemorialDto = {
  environmentId: string | null;
  houseId: string | null;
  sceneJson: Record<string, unknown> | null;
  dustStage?: number | null;
  dustUpdatedAt?: string | null;
  createdAt?: string | null;
};

type GiftPlacementDto = {
  id: string;
  slotName: string;
  placedAt?: string | null;
  expiresAt: string | null;
  isActive?: boolean;
  size?: string | null;
  gift: {
    id: string;
    code?: string | null;
    name: string;
    price: number;
    modelUrl: string;
  };
};

type PetDto = {
  id: string;
  name: string;
  species?: string | null;
  birthDate?: string | null;
  deathDate?: string | null;
  memorial?: MemorialDto | null;
  gifts?: GiftPlacementDto[];
};

type StudioItem = {
  instanceId: string;
  petId: string;
  petName: string;
  memorial: MemorialDto;
  gifts: GiftPlacementDto[];
  x: number;
  y: number;
  z: number;
  rotationY: number;
  scale: number;
  speed: number;
};

type RecordingQuality = "compact" | "balanced" | "high";

type HeroVideoSetting = {
  url: string | null;
  fileName?: string | null;
  contentType?: string | null;
  sizeBytes?: number | null;
  updatedAt?: string | null;
};

type DirectionVector = {
  x: number;
  y: number;
  z: number;
};

const HOUSE_MAX_WIDTH = 2.5;
const HOUSE_MAX_HEIGHT = 4;
const KOTIK_MAX_HEIGHT = 2.5;
const FALLBACK_TERRAIN_URL = "/models/terrains/TERRAIN_3_summer.glb";
const FALLBACK_HOUSE_URL = "/models/houses/DOM_budka_1__base.glb";

const clampNumber = (value: number, fallback = 0) =>
  Number.isFinite(value) ? value : fallback;

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

const applyMaterialColors = (
  root: THREE.Object3D,
  colors?: Record<string, string>,
) => {
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
      const mat = material as THREE.Material & { color?: THREE.Color };
      const color = material?.name ? colors[material.name] : undefined;
      if (color && mat.color) {
        mat.color.set(color);
        mat.needsUpdate = true;
      }
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
  target.scale.setScalar(size / current);
};

const applyPartFitScale = (
  target: THREE.Object3D,
  maxWidth: number,
  maxLength: number,
) => {
  if (maxWidth <= 0 || maxLength <= 0) {
    return;
  }
  const box = new THREE.Box3().setFromObject(target);
  const sizeVec = new THREE.Vector3();
  box.getSize(sizeVec);
  if (sizeVec.x <= 0 || sizeVec.z <= 0) {
    return;
  }
  target.scale.setScalar(Math.min(maxWidth / sizeVec.x, maxLength / sizeVec.z));
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
  target.scale.setScalar(width / sizeVec.x);
};

const applyHouseScale = (
  target: THREE.Object3D,
  houseId?: string | null,
  terrainId?: string | null,
) => {
  const baseId = splitHouseVariantId(houseId ?? "").baseId || houseId || "";
  const maxHeight = baseId.startsWith("kotik") ? KOTIK_MAX_HEIGHT : HOUSE_MAX_HEIGHT;
  const maxWidth =
    baseId === "kotik_2" || baseId === "kotik_6" ? 2 : HOUSE_MAX_WIDTH;
  const { scale: scaleMultiplier } = getHouseTransform(houseId, terrainId);
  const sizeOverride = getHouseScaleFitSizeOverride(houseId);
  const sizeVec =
    sizeOverride ??
    (() => {
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

function PartAttachment({
  house,
  slot,
  url,
  colors,
  houseId,
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
    applyHousePartAdjustment(cloned, houseId, slot);
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
  }, [house, part, slot]);

  useEffect(() => {
    applyMaterialColors(part, colors);
  }, [colors, part]);

  return null;
}

function GiftInstance({
  terrain,
  slot,
  url,
  size,
  enableFlames = true,
}: {
  terrain: THREE.Object3D;
  slot: string;
  url: string;
  size?: string | null;
  enableFlames?: boolean;
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
    const configuredMultiplier = resolveGiftScaleMultiplier({ modelUrl: url });
    if (configuredMultiplier !== 1) {
      cloned.scale.multiplyScalar(configuredMultiplier);
    }
    return cloned;
  }, [scene, size, url]);

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
  }, [gift, slot, terrain]);

  return enableFlames ? <GiftFlames root={gift} /> : null;
}

function MemorialModel({ item }: { item: StudioItem }) {
  const sceneJson = (item.memorial.sceneJson ?? {}) as {
    parts?: SceneParts;
    colors?: Record<string, string>;
  };
  const terrainUrl = resolveEnvironmentModel(item.memorial.environmentId) ?? FALLBACK_TERRAIN_URL;
  const houseUrl = resolveHouseModel(item.memorial.houseId) ?? FALLBACK_HOUSE_URL;
  const houseSlots = getHouseSlots(item.memorial.houseId);
  const dirtSlots = useMemo<DirtSlotPlacement[]>(
    () =>
      buildDirtSlotPlacements({
        houseId: item.memorial.houseId,
        level: item.memorial.dustStage ?? 0,
        activeSlots: readActiveDirtSlots(
          item.memorial.sceneJson as Record<string, unknown> | null,
          item.memorial.dustStage ?? 0,
        ),
        seed: `${item.petId}:${item.memorial.dustUpdatedAt ?? item.memorial.createdAt ?? ""}`,
      }),
    [
      item.memorial.createdAt,
      item.memorial.dustStage,
      item.memorial.dustUpdatedAt,
      item.memorial.houseId,
      item.memorial.sceneJson,
      item.petId,
    ],
  );
  const gifts = useMemo(() => {
    const now = Date.now();
    return item.gifts
      .filter(
        (gift) =>
          gift.isActive !== false &&
          (!gift.expiresAt || new Date(gift.expiresAt).getTime() > now),
      )
      .map((gift) => {
        const slotType = getGiftSlotType(gift.slotName);
        const url =
          resolveGiftModelUrl({
            gift: gift.gift,
            slotType,
            fallbackUrl: gift.gift.modelUrl,
          }) ?? gift.gift.modelUrl;
        return {
          slot: gift.slotName,
          url,
          size: gift.size ?? null,
        };
      });
  }, [item.gifts]);
  const terrainGltf = useGLTF(terrainUrl) as unknown as { scene: THREE.Object3D };
  const houseGltf = useGLTF(houseUrl) as unknown as { scene: THREE.Object3D };
  const terrainScene = terrainGltf.scene;
  const houseScene = houseGltf.scene;
  const terrain = useMemo(() => {
    const cloned = terrainScene.clone(true);
    cloneMeshMaterials(cloned);
    return cloned;
  }, [terrainScene]);
  const house = useMemo(() => {
    const cloned = houseScene.clone(true);
    cloneMeshMaterials(cloned);
    applyHouseScale(cloned, item.memorial.houseId, item.memorial.environmentId);
    applyHousePlacement(cloned, item.memorial.houseId, item.memorial.environmentId);
    return cloned;
  }, [houseScene, item.memorial.environmentId, item.memorial.houseId]);
  const parts = useMemo(
    () =>
      [
        houseSlots.roof
          ? { slot: houseSlots.roof, url: resolveRoofModel(sceneJson.parts?.roof) }
          : null,
        houseSlots.wall
          ? { slot: houseSlots.wall, url: resolveWallModel(sceneJson.parts?.wall) }
          : null,
        houseSlots.sign
          ? { slot: houseSlots.sign, url: resolveSignModel(sceneJson.parts?.sign) }
          : null,
        houseSlots.frameLeft
          ? {
              slot: houseSlots.frameLeft,
              url: resolveFrameLeftModel(sceneJson.parts?.frameLeft),
            }
          : null,
        houseSlots.frameRight
          ? {
              slot: houseSlots.frameRight,
              url: resolveFrameRightModel(sceneJson.parts?.frameRight),
            }
          : null,
        houseSlots.mat
          ? { slot: houseSlots.mat, url: resolveMatModel(sceneJson.parts?.mat) }
          : null,
        houseSlots.bowlFood
          ? {
              slot: houseSlots.bowlFood,
              url: resolveBowlFoodModel(sceneJson.parts?.bowlFood),
            }
          : null,
        houseSlots.bowlWater
          ? {
              slot: houseSlots.bowlWater,
              url: resolveBowlWaterModel(sceneJson.parts?.bowlWater),
            }
          : null,
      ].filter((part): part is { slot: string; url: string } => Boolean(part?.url)),
    [houseSlots, sceneJson.parts],
  );

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
  }, [house, terrain]);

  useEffect(() => {
    applyMaterialColors(terrain, sceneJson.colors);
    applyMaterialColors(house, sceneJson.colors);
  }, [house, sceneJson.colors, terrain]);

  return (
    <>
      <Primitive object={terrain} />
      {parts.map((part) => (
        <PartAttachment
          key={`${part.slot}-${part.url}`}
          house={house}
          slot={part.slot}
          url={part.url}
          colors={sceneJson.colors}
          houseId={item.memorial.houseId}
        />
      ))}
      {gifts.map((gift) => (
        <GiftInstance
          key={`${gift.slot}-${gift.url}`}
          terrain={terrain}
          slot={gift.slot}
          url={gift.url}
          size={gift.size}
        />
      ))}
      <DirtSlotAttachments terrain={terrain} house={house} placements={dirtSlots} />
    </>
  );
}

function FloatingMemorial({
  item,
  elapsed,
  direction,
}: {
  item: StudioItem;
  elapsed: number;
  direction: DirectionVector;
}) {
  const position: [number, number, number] = [
    item.x + direction.x * item.speed * elapsed,
    item.y + direction.y * item.speed * elapsed,
    item.z + direction.z * item.speed * elapsed,
  ];
  return (
    <Group
      position={position}
      rotation={[0, THREE.MathUtils.degToRad(item.rotationY), 0]}
      scale={item.scale}
    >
      <MemorialModel item={item} />
    </Group>
  );
}

function VideoScene({
  items,
  elapsed,
  direction,
}: {
  items: StudioItem[];
  elapsed: number;
  direction: DirectionVector;
}) {
  return (
    <>
      <Color attach="background" args={["#dfeefe"]} />
      <TunedSkyDome radius={140} renderOrder={-20} />
      <AmbientLight intensity={0.95} />
      <HemisphereLight intensity={0.75} color="#ffffff" groundColor="#d5dbe5" />
      <DirectionalLight intensity={1.15} position={[8, 10, 5]} />
      <DirectionalLight intensity={0.45} position={[-7, 6, -5]} />
      <Suspense fallback={null}>
        {items.map((item) => (
          <FloatingMemorial
            key={item.instanceId}
            item={item}
            elapsed={elapsed}
            direction={direction}
          />
        ))}
      </Suspense>
      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        target={[0, 0.2, 0]}
        maxPolarAngle={Math.PI / 2.05}
      />
    </>
  );
}

const getSupportedMimeType = () => {
  const options = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return options.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
};

const createInstanceId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const SKY_PASS_DURATION = 90;
const SKY_PASS_MAX_ITEMS = 12;

const defaultPositionForIndex = (index: number) => ({
  x: (index % 3) * 4 - 4,
  y: Math.floor(index / 3) * 1.15,
  z: -Math.floor(index / 3) * 3,
  rotationY: 30,
  scale: 0.72,
});

const formatSeconds = (value: number) => `${value.toFixed(1)} c`;
const HERO_VIDEO_SAFE_UPLOAD_BYTES = 9.5 * 1024 * 1024;

const recordingQualityOptions: Array<{
  id: RecordingQuality;
  label: string;
  description: string;
  bitrate: number;
}> = [
  {
    id: "compact",
    label: "Лёгкое",
    description: "минимальный вес, подходит для загрузки на главную",
    bitrate: 650_000,
  },
  {
    id: "balanced",
    label: "Среднее",
    description: "баланс качества и веса",
    bitrate: 1_200_000,
  },
  {
    id: "high",
    label: "Высокое",
    description: "крупнее файл, лучше детализация, чаще только для скачивания",
    bitrate: 2_500_000,
  },
];

const formatFileSize = (bytes?: number | null) => {
  if (!bytes || bytes <= 0) {
    return "0 МБ";
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} КБ`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} МБ`;
};

export default function AdminVideoStudioClient() {
  const apiUrl = API_BASE;
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pets, setPets] = useState<PetDto[]>([]);
  const [items, setItems] = useState<StudioItem[]>([]);
  const [selectedPetId, setSelectedPetId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speed, setSpeed] = useState(0.55);
  const [duration, setDuration] = useState(8);
  const [directionYaw, setDirectionYaw] = useState(0);
  const [verticalSpeed, setVerticalSpeed] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingQuality, setRecordingQuality] = useState<RecordingQuality>("compact");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState("memorial-sky-video.webm");
  const [downloadBlob, setDownloadBlob] = useState<Blob | null>(null);
  const [heroVideo, setHeroVideo] = useState<HeroVideoSetting | null>(null);
  const [uploadingHeroVideo, setUploadingHeroVideo] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const elapsedRef = useRef(0);

  const direction = useMemo<DirectionVector>(() => {
    const yaw = THREE.MathUtils.degToRad(directionYaw);
    const horizontal = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw));
    const vector = new THREE.Vector3(horizontal.x, verticalSpeed, horizontal.z);
    if (vector.lengthSq() <= 0.0001) {
      return { x: 1, y: 0, z: 0 };
    }
    vector.normalize();
    return { x: vector.x, y: vector.y, z: vector.z };
  }, [directionYaw, verticalSpeed]);

  const filteredPets = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return pets
      .filter((pet) => pet.memorial)
      .filter((pet) => {
        if (!query) {
          return true;
        }
        return `${pet.name} ${pet.id}`.toLowerCase().includes(query);
      });
  }, [filter, pets]);

  const selectedItem = items.find((item) => item.instanceId === selectedItemId) ?? null;

  useEffect(() => {
    let isMounted = true;
    const checkAccess = async () => {
      try {
        const response = await fetch(`${apiUrl}/auth/me`, {
          credentials: "include",
        });
        if (!response.ok) {
          router.replace(`/auth?next=${encodeURIComponent("/admin/video")}`);
          return;
        }
        const data = (await response.json()) as { accessLevel?: AccessLevel };
        const nextAccessLevel = data.accessLevel ?? "USER";
        if (!canAccessAdmin(nextAccessLevel)) {
          router.replace("/");
          return;
        }
        if (!isMounted) {
          return;
        }
        setIsAdmin(true);
      } catch {
        if (isMounted) {
          setError("Не удалось проверить доступ");
        }
      } finally {
        if (isMounted) {
          setAuthChecked(true);
        }
      }
    };
    void checkAccess();
    return () => {
      isMounted = false;
    };
  }, [apiUrl, router]);

  useEffect(() => {
    if (!authChecked || !isAdmin) {
      return;
    }
    let isMounted = true;
    const loadPets = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${apiUrl}/pets`, {
          credentials: "include",
        });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || "Не удалось загрузить мемориалы");
        }
        const data = (await response.json()) as PetDto[];
        if (!isMounted) {
          return;
        }
        const withMemorials = data.filter((pet) => pet.memorial);
        setPets(withMemorials);
        setSelectedPetId(withMemorials[0]?.id ?? "");
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Ошибка загрузки мемориалов");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    void loadPets();
    return () => {
      isMounted = false;
    };
  }, [apiUrl, authChecked, isAdmin]);

  useEffect(() => {
    if (!playing && !recording) {
      return;
    }
    let frame = 0;
    const startedAt = performance.now() - elapsedRef.current * 1000;
    const tick = () => {
      const nextElapsed = Math.min((performance.now() - startedAt) / 1000, duration);
      elapsedRef.current = nextElapsed;
      setElapsed(nextElapsed);
      if (nextElapsed >= duration) {
        setPlaying(false);
        if (recording) {
          recorderRef.current?.stop();
        }
        return;
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [duration, playing, recording]);

  useEffect(() => {
    return () => {
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
    };
  }, [downloadUrl]);

  useEffect(() => {
    if (!authChecked || !isAdmin) {
      return;
    }
    let isMounted = true;
    const loadHeroVideo = async () => {
      try {
        const response = await fetch(`${apiUrl}/admin/hero-video`, {
          credentials: "include",
        });
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as { heroVideo?: HeroVideoSetting };
        if (isMounted) {
          setHeroVideo(data.heroVideo ?? null);
        }
      } catch {
        // The upload block stays usable even if the current value cannot be loaded.
      }
    };
    void loadHeroVideo();
    return () => {
      isMounted = false;
    };
  }, [apiUrl, authChecked, isAdmin]);

  const addSelectedPet = useCallback(() => {
    const pet = pets.find((item) => item.id === selectedPetId);
    if (!pet?.memorial) {
      setError("Выберите мемориал с 3D-сценой");
      return;
    }
    const position = defaultPositionForIndex(items.length);
    const instance: StudioItem = {
      instanceId: createInstanceId(),
      petId: pet.id,
      petName: pet.name,
      memorial: pet.memorial,
      gifts: pet.gifts ?? [],
      ...position,
      speed,
    };
    setItems((prev) => [...prev, instance]);
    setSelectedItemId(instance.instanceId);
  }, [items.length, pets, selectedPetId, speed]);

  const updateItem = useCallback(
    (instanceId: string, patch: Partial<Omit<StudioItem, "instanceId" | "petId" | "petName" | "memorial" | "gifts">>) => {
      setItems((prev) =>
        prev.map((item) =>
          item.instanceId === instanceId ? { ...item, ...patch } : item,
        ),
      );
    },
    [],
  );

  const removeItem = useCallback((instanceId: string) => {
    setItems((prev) => prev.filter((item) => item.instanceId !== instanceId));
    setSelectedItemId((prev) => (prev === instanceId ? null : prev));
  }, []);

  const buildSkyPassPreset = useCallback(() => {
    const sourcePets = pets.filter((pet) => pet.memorial);
    if (sourcePets.length === 0) {
      setError("Нет доступных мемориалов для автосцены");
      return;
    }

    const lanes = [
      { y: -0.15, z: -2.2, scale: 0.82, rotationY: 30 },
      { y: 0.55, z: -5.2, scale: 0.66, rotationY: 30 },
      { y: 1.05, z: -8.5, scale: 0.54, rotationY: 30 },
      { y: 1.55, z: -11.8, scale: 0.43, rotationY: 30 },
      { y: 0.1, z: -7.2, scale: 0.58, rotationY: 30 },
    ];
    const selectedPets = sourcePets.slice(0, SKY_PASS_MAX_ITEMS);
    const nextItems = selectedPets.map((pet, index) => {
      const lane = lanes[index % lanes.length]!;
      const wave = Math.floor(index / lanes.length);
      const progress =
        selectedPets.length <= 1 ? 0 : index / Math.max(1, selectedPets.length - 1);
      const z = lane.z - wave * 1.8;
      const distance = Math.abs(z);
      const leftExit = -15.5 - distance * 0.78;
      const rightExit = 17.5 + distance * 0.92;
      const entryAt = 4 + progress * 60;
      const visibleDuration = Math.max(17, Math.min(27, 24 - distance * 0.42));
      const exitAt = Math.min(SKY_PASS_DURATION - 3, entryAt + visibleDuration);
      const speed = (rightExit - leftExit) / Math.max(1, exitAt - entryAt);
      const x = leftExit - speed * entryAt;
      return {
        instanceId: `${createInstanceId()}-${index}`,
        petId: pet.id,
        petName: pet.name,
        memorial: pet.memorial!,
        gifts: pet.gifts ?? [],
        x: Number(x.toFixed(2)),
        y: Number((lane.y + wave * 0.22).toFixed(2)),
        z: Number(z.toFixed(2)),
        rotationY: lane.rotationY,
        scale: Number(Math.max(0.32, lane.scale - wave * 0.05).toFixed(2)),
        speed: Number(speed.toFixed(3)),
      };
    });

    setDuration(SKY_PASS_DURATION);
    setDirectionYaw(0);
    setVerticalSpeed(0);
    setItems(nextItems);
    setSelectedItemId(nextItems[0]?.instanceId ?? null);
    elapsedRef.current = 0;
    setElapsed(0);
    setPlaying(false);
    setRecording(false);
    setNotice(
      "Собран 90-секундный пролёт: начало и финал пустые, мемориалы идут слева направо.",
    );
  }, [pets]);

  const resetPlayback = useCallback(() => {
    elapsedRef.current = 0;
    setElapsed(0);
    setPlaying(false);
  }, []);

  const startPreview = useCallback(() => {
    if (items.length === 0) {
      setError("Добавьте хотя бы один мемориал на сцену");
      return;
    }
    setDownloadUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return null;
    });
    setDownloadBlob(null);
    elapsedRef.current = 0;
    setElapsed(0);
    setPlaying(true);
  }, [items.length]);

  const stopRecording = useCallback(() => {
    setPlaying(false);
    setRecording(false);
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }, []);

  const startRecording = useCallback(() => {
    if (!canvasRef.current) {
      setError("3D-сцена ещё не готова для записи");
      return;
    }
    if (items.length === 0) {
      setError("Добавьте хотя бы один мемориал на сцену");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setError("Этот браузер не поддерживает запись canvas через MediaRecorder");
      return;
    }
    setDownloadUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return null;
    });
    setDownloadBlob(null);
    chunksRef.current = [];
    const stream = canvasRef.current.captureStream(30);
    const mimeType = getSupportedMimeType();
    const selectedQuality =
      recordingQualityOptions.find((option) => option.id === recordingQuality) ??
      recordingQualityOptions[0]!;
    const recorder = new MediaRecorder(
      stream,
      mimeType
        ? { mimeType, videoBitsPerSecond: selectedQuality.bitrate }
        : { videoBitsPerSecond: selectedQuality.bitrate },
    );
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };
    recorder.onstop = () => {
      const type = recorder.mimeType || "video/webm";
      const blob = new Blob(chunksRef.current, { type });
      const url = URL.createObjectURL(blob);
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      setDownloadUrl(url);
      setDownloadName(`memorial-sky-video-${stamp}.webm`);
      setDownloadBlob(blob);
      setRecording(false);
      setPlaying(false);
      stream.getTracks().forEach((track) => track.stop());
    };
    elapsedRef.current = 0;
    setElapsed(0);
    setRecording(true);
    setPlaying(true);
    recorder.start(250);
  }, [items.length, recordingQuality]);

  const uploadHeroVideo = useCallback(async () => {
    if (!downloadBlob) {
      setError("Сначала запишите видео");
      return;
    }
    if (downloadBlob.size > HERO_VIDEO_SAFE_UPLOAD_BYTES) {
      setError(
        `Видео ${formatFileSize(downloadBlob.size)} слишком большое для загрузки через сайт. Запишите ролик в режиме «Лёгкое» заново: безопасный размер до ${formatFileSize(HERO_VIDEO_SAFE_UPLOAD_BYTES)}.`,
      );
      return;
    }
    setUploadingHeroVideo(true);
    setNotice(null);
    try {
      const formData = new FormData();
      formData.append("file", downloadBlob, downloadName);
      const response = await fetch(`${apiUrl}/admin/hero-video`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Не удалось загрузить видео на главную");
      }
      const data = (await response.json()) as { heroVideo?: HeroVideoSetting };
      setHeroVideo(data.heroVideo ?? null);
      setNotice("Видео загружено на главную страницу");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки видео");
    } finally {
      setUploadingHeroVideo(false);
    }
  }, [apiUrl, downloadBlob, downloadName]);

  if (!authChecked) {
    return (
      <main className="grid min-h-[calc(100vh-var(--app-header-height,56px))] place-items-center bg-[#fcf8f5] px-6 text-[#6f6360]">
        Загрузка...
      </main>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <main className="min-h-[calc(100vh-var(--app-header-height,56px))] bg-[#f5efe9] px-4 py-5 text-[#5d4037] sm:px-6">
      <div className="mx-auto grid w-full max-w-[1680px] gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white bg-[#fffcf9] px-5 py-4 shadow-[0_18px_46px_-34px_rgba(93,64,55,0.55)]">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#d3a27f]">
              Админ · Видео
            </p>
            <h1 className="text-2xl font-black tracking-tight">
              Студия фонового видео
            </h1>
            <p className="mt-1 text-sm text-[#8d6e63]">
              Расставьте мемориалы, задайте движение по небу и запишите WebM-файл.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/sql"
              className="rounded-[16px] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#5d4037] shadow-sm"
            >
              Админка
            </Link>
            <Link
              href="/admin/moderation"
              className="rounded-[16px] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#5d4037] shadow-sm"
            >
              Модерация
            </Link>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="aspect-video overflow-hidden rounded-[28px] border border-white bg-[#dcecff] shadow-[0_24px_60px_-40px_rgba(93,64,55,0.65)]">
            <Canvas
              camera={{ position: [0, 7.5, 16], fov: 42 }}
              dpr={recording ? 1 : [1, 1.8]}
              gl={{ antialias: true, alpha: false }}
              onCreated={({ gl }) => {
                canvasRef.current = gl.domElement;
              }}
              className="h-full w-full"
            >
              <VideoScene
                items={items}
                elapsed={elapsed}
                direction={direction}
              />
            </Canvas>
          </section>

          <aside className="grid gap-4">
            <section className="rounded-[24px] border border-white bg-[#fffcf9] p-4 shadow-[0_18px_42px_-34px_rgba(93,64,55,0.55)]">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-black uppercase tracking-[0.12em]">
                  Мемориалы
                </h2>
                <span className="text-xs text-[#8d6e63]">
                  {loading ? "Загрузка..." : `${filteredPets.length} доступно`}
                </span>
              </div>
              <input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Поиск по имени"
                className="mt-3 w-full rounded-[16px] border border-[#eadfd9] bg-white px-4 py-3 text-sm outline-none"
              />
              <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                <select
                  value={selectedPetId}
                  onChange={(event) => setSelectedPetId(event.target.value)}
                  className="min-w-0 rounded-[16px] border border-[#eadfd9] bg-white px-4 py-3 text-sm outline-none"
                >
                  {filteredPets.map((pet) => (
                    <option key={pet.id} value={pet.id}>
                      {pet.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addSelectedPet}
                  className="rounded-[16px] bg-[#111827] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-white shadow-[0_5px_0_#000]"
                >
                  Добавить
                </button>
              </div>
            </section>

            <section className="rounded-[24px] border border-white bg-[#fffcf9] p-4 shadow-[0_18px_42px_-34px_rgba(93,64,55,0.55)]">
              <h2 className="text-sm font-black uppercase tracking-[0.12em]">
                Движение
              </h2>
              <div className="mt-3 grid gap-3">
                <button
                  type="button"
                  onClick={buildSkyPassPreset}
                  disabled={recording || loading || pets.length === 0}
                  className="rounded-[16px] bg-[#f0fffb] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#16866f] shadow-sm transition hover:bg-[#e0faf3] disabled:cursor-not-allowed disabled:opacity-55"
                  title="Автоматически собрать 90-секундное видео: чистое небо в начале и конце, мемориалы летят слева направо на разной глубине."
                >
                  Пресет 90 сек · слева направо
                </button>
                <label className="grid gap-1 text-xs font-bold text-[#8d6e63]">
                  Длительность, сек
                  <input
                    type="number"
                    min={1}
                    max={120}
                    step={1}
                    value={duration}
                    onChange={(event) => setDuration(Math.max(1, Number(event.target.value)))}
                    className="rounded-[14px] border border-[#eadfd9] bg-white px-3 py-2 text-sm text-[#5d4037] outline-none"
                  />
                </label>
                <label className="grid gap-1 text-xs font-bold text-[#8d6e63]">
                  Скорость для новых мемориалов
                  <input
                    type="number"
                    min={0}
                    max={5}
                    step={0.05}
                    value={speed}
                    onChange={(event) => setSpeed(Math.max(0, Number(event.target.value)))}
                    className="rounded-[14px] border border-[#eadfd9] bg-white px-3 py-2 text-sm text-[#5d4037] outline-none"
                  />
                </label>
                <label className="grid gap-1 text-xs font-bold text-[#8d6e63]">
                  Направление по горизонтали, °
                  <input
                    type="number"
                    step={5}
                    value={directionYaw}
                    onChange={(event) => setDirectionYaw(Number(event.target.value))}
                    className="rounded-[14px] border border-[#eadfd9] bg-white px-3 py-2 text-sm text-[#5d4037] outline-none"
                  />
                </label>
                <label className="grid gap-1 text-xs font-bold text-[#8d6e63]">
                  Вертикальная составляющая
                  <input
                    type="number"
                    step={0.05}
                    value={verticalSpeed}
                    onChange={(event) => setVerticalSpeed(Number(event.target.value))}
                    className="rounded-[14px] border border-[#eadfd9] bg-white px-3 py-2 text-sm text-[#5d4037] outline-none"
                  />
                </label>
                <div className="grid gap-2 rounded-[18px] bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black uppercase tracking-[0.12em] text-[#8d6e63]">
                      Сжатие
                    </span>
                    <span className="text-[11px] font-bold text-[#a8948b]">
                      WebM, 16:9
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {recordingQualityOptions.map((option) => {
                      const active = recordingQuality === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setRecordingQuality(option.id)}
                          disabled={recording}
                          className={`rounded-[14px] px-2 py-2 text-[10px] font-black uppercase tracking-[0.08em] transition disabled:opacity-60 ${
                            active
                              ? "bg-[#111827] text-white shadow-[0_4px_0_#000]"
                              : "bg-[#f7f1ee] text-[#5d4037]"
                          }`}
                          title={option.description}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] font-semibold leading-snug text-[#8d6e63]">
                    Для главной используйте «Лёгкое»: запись идёт с низким битрейтом и
                    DPR 1, безопасный размер загрузки до {formatFileSize(HERO_VIDEO_SAFE_UPLOAD_BYTES)}.
                  </p>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#eadfd9]">
                  <div
                    className="h-full rounded-full bg-[#3bceac]"
                    style={{ width: `${Math.min(100, (elapsed / duration) * 100)}%` }}
                  />
                </div>
                <div className="text-xs text-[#8d6e63]">
                  {formatSeconds(elapsed)} / {formatSeconds(duration)}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={startPreview}
                    disabled={recording}
                    className="rounded-[16px] bg-white px-3 py-3 text-xs font-black uppercase tracking-[0.1em] shadow-sm disabled:opacity-50"
                  >
                    Превью
                  </button>
                  <button
                    type="button"
                    onClick={resetPlayback}
                    disabled={recording}
                    className="rounded-[16px] bg-white px-3 py-3 text-xs font-black uppercase tracking-[0.1em] shadow-sm disabled:opacity-50"
                  >
                    Сброс
                  </button>
                  <button
                    type="button"
                    onClick={recording ? stopRecording : startRecording}
                    className="rounded-[16px] bg-[#111827] px-3 py-3 text-xs font-black uppercase tracking-[0.1em] text-white shadow-[0_5px_0_#000]"
                  >
                    {recording ? "Стоп" : "Запись"}
                  </button>
                </div>
                {downloadUrl ? (
                  <div className="grid gap-2 rounded-[18px] bg-[#eafaf6] p-3">
                    <div className="text-xs font-black uppercase tracking-[0.1em] text-[#16866f]">
                      Видео готово · {formatFileSize(downloadBlob?.size)}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={downloadUrl}
                        download={downloadName}
                        className="rounded-[16px] bg-white px-4 py-3 text-center text-xs font-black uppercase tracking-[0.1em] text-[#16866f]"
                      >
                        Скачать
                      </a>
                      <button
                        type="button"
                        onClick={uploadHeroVideo}
                        disabled={uploadingHeroVideo}
                        className="rounded-[16px] bg-[#111827] px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-white shadow-[0_4px_0_#000] disabled:cursor-wait disabled:opacity-70"
                      >
                        {uploadingHeroVideo ? "Загрузка..." : "На главную"}
                      </button>
                    </div>
                  </div>
                ) : null}
                {heroVideo?.url ? (
                  <div className="rounded-[18px] bg-white px-4 py-3 text-xs font-semibold leading-relaxed text-[#8d6e63]">
                    Сейчас на главной:
                    <a
                      href={heroVideo.url}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-1 font-black text-[#5d4037] underline"
                    >
                      {heroVideo.fileName || "hero-video"}
                    </a>
                    {heroVideo.sizeBytes ? (
                      <span className="ml-1">({formatFileSize(heroVideo.sizeBytes)})</span>
                    ) : null}
                  </div>
                ) : null}
                {notice ? (
                  <div className="rounded-[16px] bg-[#f0fffb] px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-[#16866f]">
                    {notice}
                  </div>
                ) : null}
              </div>
            </section>

            <section className="rounded-[24px] border border-white bg-[#fffcf9] p-4 shadow-[0_18px_42px_-34px_rgba(93,64,55,0.55)]">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-[0.12em]">
                  Позиции
                </h2>
                <span className="text-xs text-[#8d6e63]">{items.length} на сцене</span>
              </div>
              <div className="mt-3 max-h-[38vh] space-y-3 overflow-auto pr-1">
                {items.length === 0 ? (
                  <div className="rounded-[18px] bg-white px-4 py-5 text-sm text-[#8d6e63]">
                    Добавьте мемориалы из списка выше.
                  </div>
                ) : null}
                {items.map((item) => {
                  const active = item.instanceId === selectedItem?.instanceId;
                  return (
                    <div
                      key={item.instanceId}
                      className={`rounded-[20px] border p-3 ${
                        active
                          ? "border-[#3bceac] bg-[#f0fffb]"
                          : "border-[#eadfd9] bg-white"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedItemId(item.instanceId)}
                        className="w-full text-left text-sm font-black"
                      >
                        {item.petName}
                      </button>
                      <div className="mt-3 grid grid-cols-6 gap-2">
                        {(["x", "y", "z", "rotationY", "scale", "speed"] as const).map((key) => (
                          <label
                            key={key}
                            className="grid gap-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#8d6e63]"
                          >
                            {key === "rotationY" ? "Y°" : key === "speed" ? "скор." : key}
                            <input
                              type="number"
                              step={key === "scale" || key === "speed" ? 0.05 : 0.1}
                              value={item[key]}
                              onChange={(event) =>
                                updateItem(item.instanceId, {
                                  [key]: clampNumber(Number(event.target.value), item[key]),
                                } as Partial<
                                  Omit<
                                    StudioItem,
                                    "instanceId" | "petId" | "petName" | "memorial" | "gifts"
                                  >
                                >)
                              }
                              className="min-w-0 rounded-[12px] border border-[#eadfd9] bg-[#fffcf9] px-2 py-2 text-xs text-[#5d4037] outline-none"
                            />
                          </label>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.instanceId)}
                        className="mt-3 rounded-[14px] bg-[#fff2f2] px-3 py-2 text-[11px] font-black uppercase tracking-[0.1em] text-[#d9534f]"
                      >
                        Убрать
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          </aside>
        </div>
      </div>
      {error ? <ErrorToast message={error} onClose={() => setError(null)} /> : null}
    </main>
  );
}
