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
  useGLTF.setDRACOLoader(dracoLoader);
  return dracoLoader;
};
