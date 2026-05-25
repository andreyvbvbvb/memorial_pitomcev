"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF, useTexture } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import * as THREE from "three";
import { ensureDracoLoader } from "../../lib/draco";

ensureDracoLoader();

const Primitive = "primitive" as unknown as ComponentType<any>;
const Mesh = "mesh" as unknown as ComponentType<any>;
const SphereGeometry = "sphereGeometry" as unknown as ComponentType<any>;
const ShaderMaterial = "shaderMaterial" as unknown as ComponentType<any>;
const AmbientLight = "ambientLight" as unknown as ComponentType<any>;
const DirectionalLight = "directionalLight" as unknown as ComponentType<any>;

type SkySettings = {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
};

const defaultSettings: SkySettings = {
  brightness: 1.08,
  contrast: 1.18,
  saturation: 1.12,
  hue: 0
};

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

function SkyDome({ settings }: { settings: SkySettings }) {
  const texture = useTexture("/nebo.png");

  useEffect(() => {
    if (!texture?.image) {
      return;
    }
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
  }, [texture]);

  const uniforms = useMemo(
    () => ({
      map: { value: texture },
      brightness: { value: settings.brightness },
      contrast: { value: settings.contrast },
      saturation: { value: settings.saturation },
      hue: { value: settings.hue }
    }),
    [settings.brightness, settings.contrast, settings.hue, settings.saturation, texture]
  );

  return (
    <Mesh raycast={() => null}>
      <SphereGeometry args={[80, 64, 64]} />
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

function TerrainSample() {
  const { scene } = useGLTF("/models/terrains/TERRAIN_3_summer.glb");
  const model = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const scale = 2.8 / Math.max(size.x, size.z, 0.001);
    clone.position.set(-center.x * scale, -box.min.y * scale - 0.42, -center.z * scale);
    clone.scale.setScalar(scale);
    return clone;
  }, [scene]);

  return <Primitive object={model} />;
}

const sliderRows: {
  key: keyof SkySettings;
  label: string;
  min: number;
  max: number;
  step: number;
  suffix?: string;
}[] = [
  { key: "brightness", label: "Яркость", min: 0.7, max: 1.5, step: 0.01 },
  { key: "contrast", label: "Контраст", min: 0.7, max: 1.8, step: 0.01 },
  { key: "saturation", label: "Насыщенность", min: 0.5, max: 1.8, step: 0.01 },
  { key: "hue", label: "Оттенок", min: -30, max: 30, step: 1, suffix: "°" }
];

export default function SkyTuningPreview() {
  const [settings, setSettings] = useState<SkySettings>(defaultSettings);

  const updateSetting = (key: keyof SkySettings, value: number) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const settingsText = `brightness=${settings.brightness.toFixed(2)}, contrast=${settings.contrast.toFixed(
    2
  )}, saturation=${settings.saturation.toFixed(2)}, hue=${settings.hue.toFixed(0)}deg`;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase text-slate-500">
            3D-превью неба
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Локальная настройка картинки `/nebo.png` для подбора яркости и контраста.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSettings(defaultSettings)}
          className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900"
        >
          Сбросить
        </button>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="h-[300px] overflow-hidden rounded-xl border border-slate-200 bg-[#d8ecf8]">
          <Canvas camera={{ position: [4, 2.5, 4], fov: 46 }}>
            <AmbientLight intensity={0.9} />
            <DirectionalLight position={[5, 6, 4]} intensity={1.15} />
            <Suspense fallback={null}>
              <SkyDome settings={settings} />
              <TerrainSample />
            </Suspense>
            <OrbitControls enablePan={false} minDistance={2.2} maxDistance={7} />
          </Canvas>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="grid gap-3">
            {sliderRows.map((row) => (
              <label key={row.key} className="grid gap-1.5 text-xs font-semibold text-slate-600">
                <span className="flex items-center justify-between gap-2">
                  <span>{row.label}</span>
                  <span className="text-slate-400">
                    {settings[row.key].toFixed(row.key === "hue" ? 0 : 2)}
                    {row.suffix ?? ""}
                  </span>
                </span>
                <input
                  type="range"
                  min={row.min}
                  max={row.max}
                  step={row.step}
                  value={settings[row.key]}
                  onChange={(event) => updateSetting(row.key, Number(event.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200"
                />
              </label>
            ))}
          </div>
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            {settingsText}
          </div>
        </div>
      </div>
    </div>
  );
}
