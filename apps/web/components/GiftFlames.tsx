"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

export type GiftFlameMode = "lite" | "off";

type FlameLayer = {
  group: THREE.Group;
  outer: THREE.Sprite;
  seed: number;
  lastFrameAt: number;
};

const FIRE_SLOT_PATTERN = /^fire_slot(?:_\d+)?$/i;
const LITE_FRAME_INTERVAL = 1 / 20;
let sharedFlameTexture: THREE.Texture | null = null;

function createFlameTexture() {
  if (typeof document === "undefined") {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);

  const gradient = context.createLinearGradient(0, 8, 0, canvas.height);
  gradient.addColorStop(0, "rgba(255,255,255,0)");
  gradient.addColorStop(0.16, "rgba(255,255,255,0.82)");
  gradient.addColorStop(0.48, "rgba(255,255,255,0.95)");
  gradient.addColorStop(0.86, "rgba(255,255,255,0.42)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");

  context.beginPath();
  context.moveTo(48, 8);
  context.bezierCurveTo(24, 34, 18, 70, 25, 112);
  context.bezierCurveTo(30, 144, 66, 148, 72, 112);
  context.bezierCurveTo(78, 72, 66, 42, 48, 8);
  context.closePath();
  context.fillStyle = gradient;
  context.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function getSharedFlameTexture() {
  if (!sharedFlameTexture) {
    sharedFlameTexture = createFlameTexture();
  }
  return sharedFlameTexture;
}

function createSprite(texture: THREE.Texture, color: string, opacity: number) {
  const material = new THREE.SpriteMaterial({
    map: texture,
    color,
    opacity,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const sprite = new THREE.Sprite(material);
  sprite.center.set(0.5, 0.12);
  return sprite;
}

export default function GiftFlames({
  root,
  mode = "lite"
}: {
  root: THREE.Object3D;
  mode?: GiftFlameMode;
}) {
  const texture = useMemo(
    () => (mode === "off" ? null : getSharedFlameTexture()),
    [mode]
  );
  const flamesRef = useRef<FlameLayer[]>([]);

  useEffect(() => {
    if (!texture || mode === "off") {
      return;
    }

    const slots: THREE.Object3D[] = [];
    root.traverse((node) => {
      if (FIRE_SLOT_PATTERN.test(node.name)) {
        slots.push(node);
      }
    });

    const flames = slots.map((slot, index) => {
      const group = new THREE.Group();
      group.name = `__animated_flame_${slot.name}`;
      group.position.set(0, 0.015, 0);

      const outer = createSprite(texture, "#ff8a24", 0.58);

      outer.scale.set(0.14, 0.3, 1);

      group.add(outer);
      slot.add(group);

      return {
        group,
        outer,
        seed: index * 1.37 + Math.random() * Math.PI * 2,
        lastFrameAt: 0
      };
    });

    flamesRef.current = flames;

    return () => {
      flames.forEach((flame) => {
        flame.group.parent?.remove(flame.group);
        if (flame.outer.material instanceof THREE.Material) {
          flame.outer.material.dispose();
        }
      });
      flamesRef.current = [];
    };
  }, [mode, root, texture]);

  useFrame(({ clock }) => {
    if (mode === "off") {
      return;
    }

    const t = clock.elapsedTime;
    flamesRef.current.forEach((flame) => {
      if (t - flame.lastFrameAt < LITE_FRAME_INTERVAL) {
        return;
      }
      flame.lastFrameAt = t;

      const flicker =
        Math.sin(t * 9.5 + flame.seed) * 0.08 +
        Math.sin(t * 17.3 + flame.seed * 0.7) * 0.05;
      const sway = Math.sin(t * 4.1 + flame.seed) * 0.018;
      const height = 1 + flicker;
      const width = 1 - flicker * 0.35;

      flame.group.position.x = sway * 0.55;
      flame.group.position.z = Math.cos(t * 3.2 + flame.seed) * 0.006;
      flame.outer.scale.set(0.14 * width, 0.3 * height, 1);
      flame.outer.material.opacity = THREE.MathUtils.clamp(
        0.5 + flicker * 0.4,
        0.38,
        0.62
      );
    });
  });

  return null;
}
