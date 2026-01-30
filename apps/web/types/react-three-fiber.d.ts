/// <reference types="@react-three/fiber" />

declare global {
  namespace JSX {
    interface IntrinsicElements {
      primitive: any;
      color: any;
      ambientLight: any;
      directionalLight: any;
    }
  }
}

export {};
