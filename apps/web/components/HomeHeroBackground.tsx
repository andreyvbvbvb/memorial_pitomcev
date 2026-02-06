"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";

const MODEL_URL = "/models/main_page.glb";

function RotatingModel() {
  const { scene } = useGLTF(MODEL_URL);
  const pivotRef = useRef<THREE.Group>(null);
  const normalized = useMemo(() => {
    const cloned = scene.clone(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    cloned.position.sub(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 7.5 / maxDim;
    cloned.scale.setScalar(scale);
    return cloned;
  }, [scene]);

  useFrame((_, delta) => {
    if (!pivotRef.current) {
      return;
    }
    pivotRef.current.rotation.y += delta * 0.12;
  });

  return (
    <group ref={pivotRef} rotation={[0.12, -0.4, 0]}>
      <primitive object={normalized} />
    </group>
  );
}

export default function HomeHeroBackground() {
  return (
    <Canvas
      className="h-full w-full"
      camera={{ position: [0, 2.6, 8.5], fov: 38 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true }}
    >
      <color attach="background" args={["#fbf7f5"]} />
      <ambientLight intensity={0.9} />
      <directionalLight intensity={1.1} position={[6, 8, 4]} />
      <Suspense fallback={null}>
        <RotatingModel />
      </Suspense>
    </Canvas>
  );
}

useGLTF.preload(MODEL_URL);
