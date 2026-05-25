"use client";

import { useGLTF } from "@react-three/drei";
import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import type { DirtSlotPlacement } from "../lib/dirt-models";

const MAX_DIRT_FLAT_SIZE = 0.25;

type Props = {
  terrain: THREE.Object3D;
  house: THREE.Object3D;
  placements: DirtSlotPlacement[];
};

function DirtSlotAttachment({
  terrain,
  house,
  placement
}: {
  terrain: THREE.Object3D;
  house: THREE.Object3D;
  placement: DirtSlotPlacement;
}) {
  const { scene } = useGLTF(placement.url);
  const dirt = useMemo(() => scene.clone(true), [scene]);
  const preferredRoot = placement.slotIndex <= 2 ? terrain : house;
  const fallbackRoot = placement.slotIndex <= 2 ? house : terrain;
  const explicitAnchor =
    preferredRoot.getObjectByName(placement.slot) ?? fallbackRoot.getObjectByName(placement.slot);
  const fallbackAnchor = useMemo(() => {
    const group = new THREE.Group();
    group.name = placement.slot;
    return group;
  }, [placement.slot]);

  useLayoutEffect(() => {
    const anchor = explicitAnchor ?? fallbackAnchor;
    const rootForFallback = placement.slotIndex <= 2 ? terrain : house;
    const usedFallback = !explicitAnchor;
    let firstFrameId: number | null = null;
    let secondFrameId: number | null = null;
    if (usedFallback) {
      const basePosition = new THREE.Vector3();
      if (placement.slotIndex <= 2) {
        house.getWorldPosition(basePosition);
        terrain.worldToLocal(basePosition);
        const offset =
          placement.slotIndex === 1
            ? new THREE.Vector3(0.55, 0.035, 0.42)
            : new THREE.Vector3(-0.5, 0.035, -0.36);
        fallbackAnchor.position.copy(basePosition.add(offset));
        fallbackAnchor.rotation.set(0, 0, 0);
      } else {
        const offset =
          placement.slotIndex === 3
            ? new THREE.Vector3(-0.18, 0.42, 0.2)
            : new THREE.Vector3(0.24, 0.32, -0.12);
        fallbackAnchor.position.copy(offset);
        fallbackAnchor.rotation.set(0, 0, 0);
      }
      rootForFallback.add(fallbackAnchor);
    }
    dirt.name = placement.modelId;
    dirt.position.set(0, 0, 0);
    dirt.rotation.set(0, 0, 0);
    dirt.scale.set(1, 1, 1);
    dirt.visible = false;
    anchor.add(dirt);
    const normalizeSize = () => {
      dirt.scale.set(1, 1, 1);
      terrain.updateMatrixWorld(true);
      house.updateMatrixWorld(true);
      anchor.updateMatrixWorld(true);
      dirt.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(dirt);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxFlatSize = Math.max(size.x, size.z);
      if (Number.isFinite(maxFlatSize) && maxFlatSize > MAX_DIRT_FLAT_SIZE) {
        dirt.scale.multiplyScalar(MAX_DIRT_FLAT_SIZE / maxFlatSize);
        dirt.updateMatrixWorld(true);
      }
      dirt.visible = true;
    };
    firstFrameId = window.requestAnimationFrame(() => {
      secondFrameId = window.requestAnimationFrame(normalizeSize);
    });
    return () => {
      if (firstFrameId !== null) {
        window.cancelAnimationFrame(firstFrameId);
      }
      if (secondFrameId !== null) {
        window.cancelAnimationFrame(secondFrameId);
      }
      anchor.remove(dirt);
      if (usedFallback) {
        rootForFallback.remove(fallbackAnchor);
      }
    };
  }, [dirt, explicitAnchor, fallbackAnchor, house, placement.modelId, placement.slotIndex, terrain]);

  return null;
}

export default function DirtSlotAttachments({ terrain, house, placements }: Props) {
  if (placements.length === 0) {
    return null;
  }
  return (
    <>
      {placements.map((placement) => (
        <DirtSlotAttachment
          key={`${placement.slot}-${placement.url}`}
          terrain={terrain}
          house={house}
          placement={placement}
        />
      ))}
    </>
  );
}
