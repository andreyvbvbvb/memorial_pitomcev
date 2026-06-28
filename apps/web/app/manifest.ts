import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "МяуГав",
    short_name: "МяуГав",
    description: "3D-мемориалы для домашних питомцев",
    start_url: "/",
    display: "standalone",
    background_color: "#fcf8f5",
    theme_color: "#fcf8f5",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
