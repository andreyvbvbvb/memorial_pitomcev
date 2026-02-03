import type { ThreeElements } from "@react-three/fiber";

declare module "@react-three/fiber" {
  interface ThreeElements {
    primitive: any;
    group: any;
    color: any;
    ambientLight: any;
    directionalLight: any;
  }
}

export {};
