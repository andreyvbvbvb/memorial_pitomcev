"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { Suspense, useMemo, useState } from "react";
import type { ComponentType } from "react";
import * as THREE from "three";
import { dirtModelOptions, type DirtModelOption } from "../../lib/dirt-models";
import { ensureDracoLoader } from "../../lib/draco";

ensureDracoLoader();

const Primitive = "primitive" as unknown as ComponentType<any>;
const Color = "color" as unknown as ComponentType<any>;
const Mesh = "mesh" as unknown as ComponentType<any>;
const PlaneGeometry = "planeGeometry" as unknown as ComponentType<any>;
const MeshStandardMaterial = "meshStandardMaterial" as unknown as ComponentType<any>;
const AmbientLight = "ambientLight" as unknown as ComponentType<any>;
const DirectionalLight = "directionalLight" as unknown as ComponentType<any>;
const HemisphereLight = "hemisphereLight" as unknown as ComponentType<any>;
const GridHelper = "gridHelper" as unknown as ComponentType<any>;

function DirtModelObject({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxSize = Math.max(size.x, size.y, size.z, 0.001);
    const scale = 1.55 / maxSize;
    clone.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
    clone.scale.setScalar(scale);
    clone.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) {
        return;
      }
      child.castShadow = true;
      child.receiveShadow = true;
    });
    return clone;
  }, [scene]);

  return <Primitive object={model} />;
}

const slotLabel = (model: DirtModelOption) =>
  model.slot === null ? "любой слот" : `только слот ${model.slot}`;

export default function DirtModelPreview() {
  const models = dirtModelOptions;
  const [selectedUrl, setSelectedUrl] = useState(models[0]?.url ?? "");
  const selectedModel = models.find((model) => model.url === selectedUrl) ?? models[0] ?? null;

  if (models.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="text-xs font-semibold uppercase text-slate-500">
          Модели грязи
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Slot-модели грязи пока не найдены.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase text-slate-500">
            3D-превью грязи
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Проверка моделей для слотов `dirt_slot_1...4`.
          </p>
        </div>
        <div className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">
          {models.length} моделей
        </div>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_240px]">
        <div className="h-[280px] overflow-hidden rounded-xl border border-slate-200 bg-[#eef6ff]">
          <Canvas camera={{ position: [1.8, 1.25, 1.8], fov: 42 }} shadows>
            <Color attach="background" args={["#eef6ff"]} />
            <AmbientLight intensity={0.75} />
            <HemisphereLight intensity={0.5} color={"#ffffff"} groundColor={"#cbb29f"} />
            <DirectionalLight position={[3, 4, 2]} intensity={1.15} castShadow />
            <Suspense fallback={null}>
              {selectedModel ? <DirtModelObject url={selectedModel.url} /> : null}
            </Suspense>
            <Mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} receiveShadow>
              <PlaneGeometry args={[2.8, 2.8]} />
              <MeshStandardMaterial color={"#f5eee9"} roughness={0.9} />
            </Mesh>
            <GridHelper args={[2.8, 8, "#8d6e63", "#dacac1"]} position={[0, 0.002, 0]} />
            <OrbitControls enablePan={false} minDistance={1.1} maxDistance={4} />
          </Canvas>
        </div>

        <div className="max-h-[280px] space-y-2 overflow-auto pr-1">
          {models.map((model) => {
            const active = selectedModel?.url === model.url;
            return (
              <button
                key={model.url}
                type="button"
                onClick={() => setSelectedUrl(model.url)}
                className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                  active
                    ? "border-slate-900 bg-white text-slate-900"
                    : "border-slate-200 bg-white/80 text-slate-600 hover:border-slate-300 hover:bg-white"
                }`}
              >
                <div className="truncate text-xs font-semibold">{model.name}</div>
                <div className="mt-1 text-[10px] text-slate-500">
                  {slotLabel(model)}
                  {model.houseId ? ` · ${model.houseId}` : " · global"}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedModel ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600">
          <span className="font-semibold text-slate-800">{selectedModel.modelId}</span>
          <span className="mx-1">·</span>
          <span>{selectedModel.url}</span>
        </div>
      ) : null}
    </div>
  );
}
