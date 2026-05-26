"use client";

import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import type { ComponentType } from "react";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

export type SkyTuningSettings = {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
};

export const SKY_TUNING_SETTINGS: SkyTuningSettings = {
  brightness: 1.13,
  contrast: 0.8,
  saturation: 1.06,
  hue: -18,
};

const Mesh = "mesh" as unknown as ComponentType<any>;
const SphereGeometry = "sphereGeometry" as unknown as ComponentType<any>;
const ShaderMaterial = "shaderMaterial" as unknown as ComponentType<any>;

const vertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D map;
  uniform float brightness;
  uniform float contrast;
  uniform float saturation;
  uniform float hue;
  varying vec2 vUv;

  vec3 hueRotate(vec3 color, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    mat3 weights = mat3(
      vec3(0.299, 0.587, 0.114),
      vec3(0.299, 0.587, 0.114),
      vec3(0.299, 0.587, 0.114)
    );
    mat3 rotation = mat3(
      vec3(0.701, -0.587, -0.114),
      vec3(-0.299, 0.413, -0.114),
      vec3(-0.300, -0.588, 0.886)
    ) * c + mat3(
      vec3(0.168, 0.330, -0.497),
      vec3(-0.328, 0.035, 0.292),
      vec3(1.250, -1.050, -0.203)
    ) * s;
    return clamp(color * (weights + rotation), 0.0, 1.0);
  }

  void main() {
    vec4 sampled = texture2D(map, vUv);
    vec3 color = sampled.rgb;
    color = (color - 0.5) * contrast + 0.5;
    color *= brightness;
    float gray = dot(color, vec3(0.299, 0.587, 0.114));
    color = mix(vec3(gray), color, saturation);
    color = hueRotate(color, radians(hue));
    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`;

type TunedSkyDomeProps = {
  radius?: number;
  settings?: SkyTuningSettings;
  renderOrder?: number;
  followCamera?: boolean;
  texturePath?: string;
};

export default function TunedSkyDome({
  radius = 80,
  settings = SKY_TUNING_SETTINGS,
  renderOrder = -10,
  followCamera = true,
  texturePath = "/nebo_4.png",
}: TunedSkyDomeProps) {
  const texture = useTexture(texturePath);
  const sphereRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    if (!texture?.image) {
      return;
    }
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
  }, [texture]);

  useFrame(({ camera }) => {
    if (!followCamera || !sphereRef.current) {
      return;
    }
    sphereRef.current.position.copy(camera.position);
  });

  const uniforms = useMemo(
    () => ({
      map: { value: texture },
      brightness: { value: settings.brightness },
      contrast: { value: settings.contrast },
      saturation: { value: settings.saturation },
      hue: { value: settings.hue },
    }),
    [
      settings.brightness,
      settings.contrast,
      settings.hue,
      settings.saturation,
      texture,
    ],
  );

  if (!texture?.image) {
    return null;
  }

  return (
    <Mesh ref={sphereRef} renderOrder={renderOrder} raycast={() => null}>
      <SphereGeometry args={[radius, 64, 64]} />
      <ShaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        side={THREE.BackSide}
        depthWrite={false}
        toneMapped={false}
      />
    </Mesh>
  );
}
