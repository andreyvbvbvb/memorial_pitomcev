"use client";

import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../lib/config";

type SiteBannerResponse = {
  banner?: {
    text?: string;
    updatedAt?: string;
  } | null;
};

type Props = {
  variant?: "flow" | "overlay";
};

export default function SiteBanner({ variant = "flow" }: Props) {
  const apiUrl = useMemo(() => API_BASE, []);
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadBanner = async () => {
      try {
        const response = await fetch(`${apiUrl}/content/site-banner`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as SiteBannerResponse;
        const nextText = data.banner?.text?.trim() || null;
        if (active) {
          setText(nextText);
        }
      } catch {
        if (active) {
          setText(null);
        }
      }
    };
    void loadBanner();
    return () => {
      active = false;
    };
  }, [apiUrl]);

  if (!text) {
    return null;
  }

  const content = (
    <div className="mx-auto flex min-h-8 w-full max-w-6xl items-center justify-center px-4 py-1.5 text-center text-[11px] font-bold leading-snug text-[#5d4037] sm:min-h-9 sm:text-xs">
      {text}
    </div>
  );

  if (variant === "overlay") {
    return (
      <div className="pointer-events-none absolute left-0 right-0 top-[var(--app-header-height,56px)] z-40 border-y border-white/80 bg-[#fff7f2]/95 shadow-[0_10px_26px_-24px_rgba(93,64,55,0.45)] backdrop-blur">
        {content}
      </div>
    );
  }

  return (
    <div className="relative z-20 border-y border-white/80 bg-[#fff7f2] shadow-[0_10px_26px_-24px_rgba(93,64,55,0.45)]">
      {content}
    </div>
  );
}
