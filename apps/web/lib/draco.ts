import { useGLTF } from "@react-three/drei";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

let dracoLoader: DRACOLoader | null = null;

export const ensureDracoLoader = () => {
  if (typeof window === "undefined") {
    return null;
  }
  if (!dracoLoader) {
    dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("/draco/");
  }
  const gltf = useGLTF as unknown as {
    setDRACOLoader?: (loader: DRACOLoader) => void;
  };
  gltf.setDRACOLoader?.(dracoLoader);
  return dracoLoader;
};
