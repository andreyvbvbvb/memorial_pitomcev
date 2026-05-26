"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { Suspense, useMemo, useState } from "react";
import type { ComponentType } from "react";
import * as THREE from "three";
import { ensureDracoLoader } from "../../lib/draco";
import TunedSkyDome, {
  SKY_TUNING_SETTINGS,
  type SkyTuningSettings
} from "../TunedSkyDome";

ensureDracoLoader();

const Primitive = "primitive" as unknown as ComponentType<any>;
const AmbientLight = "ambientLight" as unknown as ComponentType<any>;
const DirectionalLight = "directionalLight" as unknown as ComponentType<any>;

const defaultSettings: SkyTuningSettings = { ...SKY_TUNING_SETTINGS };
const skyOptions = [
  { id: "nebo", name: "Nebo", path: "/nebo.png", meta: "1536 x 1024" },
  { id: "nebo_2", name: "Nebo 2", path: "/nebo_2.png", meta: "1774 x 887" },
  { id: "nebo_3", name: "Nebo 3", path: "/nebo_3.png", meta: "1672 x 941" },
  { id: "nebo_4", name: "Nebo 4", path: "/nebo_4.png", meta: "1536 x 1024" }
] as const;

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
  key: keyof SkyTuningSettings;
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
  const [settings, setSettings] = useState<SkyTuningSettings>(defaultSettings);
  const [skyPath, setSkyPath] = useState<(typeof skyOptions)[number]["path"]>(
    "/nebo.png"
  );

  const updateSetting = (key: keyof SkyTuningSettings, value: number) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const settingsText = `brightness=${settings.brightness.toFixed(2)}, contrast=${settings.contrast.toFixed(
    2
  )}, saturation=${settings.saturation.toFixed(2)}, hue=${settings.hue.toFixed(0)}deg, sky=${skyPath}`;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase text-slate-500">
            3D-превью неба
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Экспериментальный просмотр неба. На сайте пока остается `/nebo.png`.
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
              <TunedSkyDome
                settings={settings}
                radius={80}
                renderOrder={-20}
                texturePath={skyPath}
              />
              <TerrainSample />
            </Suspense>
            <OrbitControls enablePan={false} minDistance={2.2} maxDistance={7} />
          </Canvas>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-3 grid gap-2">
            <div className="text-xs font-semibold uppercase text-slate-500">
              Вариант неба
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {skyOptions.map((option) => {
                const isActive = skyPath === option.path;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSkyPath(option.path)}
                    className={`rounded-xl border px-3 py-2 text-left transition ${
                      isActive
                        ? "border-[#3bceac] bg-[#f0fffb] text-[#5d4037]"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:border-[#d3a27f]"
                    }`}
                  >
                    <span className="block text-xs font-black uppercase tracking-[0.12em]">
                      {option.name}
                    </span>
                    <span className="mt-0.5 block text-[10px] font-semibold text-slate-400">
                      {option.meta}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
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
