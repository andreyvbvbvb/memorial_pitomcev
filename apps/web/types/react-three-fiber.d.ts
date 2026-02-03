/// <reference types="@react-three/fiber" />

declare global {
  namespace JSX {
    interface IntrinsicElements {
      primitive: any;
      group: any;
      color: any;
      ambientLight: any;
      directionalLight: any;
    }
  }
}

export {};
