"use client";

import { useEffect, useState } from "react";

export default function usePortraitLayout(maxWidth = 1024) {
  const [isPortraitLayout, setIsPortraitLayout] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const media = window.matchMedia(`(max-width: ${maxWidth}px) and (orientation: portrait)`);

    const update = () => {
      setIsPortraitLayout(
        media.matches || (window.innerWidth <= maxWidth && window.innerHeight > window.innerWidth)
      );
    };

    update();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", update);
    } else {
      media.addListener(update);
    }
    window.addEventListener("resize", update);

    return () => {
      if (typeof media.removeEventListener === "function") {
        media.removeEventListener("change", update);
      } else {
        media.removeListener(update);
      }
      window.removeEventListener("resize", update);
    };
  }, [maxWidth]);

  return isPortraitLayout;
}
