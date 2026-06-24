"use client";

import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../lib/config";

type HeroVideoResponse = {
  heroVideo?: {
    url?: string | null;
    updatedAt?: string | null;
  } | null;
};

type HeroVideoState = {
  url: string;
  version: string;
};

export default function HomeHeroVideoLayer() {
  const [video, setVideo] = useState<HeroVideoState | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadVideo = async () => {
      try {
        const response = await fetch(`${API_BASE}/content/hero-video?t=${Date.now()}`, {
          cache: "no-store",
          credentials: "include",
        });
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as HeroVideoResponse;
        const nextUrl = data.heroVideo?.url?.trim() || null;
        if (isMounted && nextUrl) {
          setVideo({
            url: nextUrl,
            version: data.heroVideo?.updatedAt || String(Date.now()),
          });
        }
      } catch {
        // The static fallback background is enough when the content API is unreachable.
      }
    };
    void loadVideo();
    return () => {
      isMounted = false;
    };
  }, []);

  const sourceUrl = useMemo(() => {
    if (!video?.url) {
      return null;
    }
    return `${video.url}${video.url.includes("?") ? "&" : "?"}v=${encodeURIComponent(video.version)}`;
  }, [video]);

  return (
    <>
      <div className="absolute inset-0 bg-[#fcf8f5]" />
      {sourceUrl ? (
        <video
          key={sourceUrl}
          className="absolute inset-x-0 top-[calc(-1*var(--app-header-height,64px))] h-[calc(100%+var(--app-header-height,64px))] w-full scale-[1.03] object-cover object-top opacity-[0.92]"
          src={sourceUrl}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
        />
      ) : null}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 42%, rgba(255,255,255,0.34) 0%, rgba(252,248,245,0.24) 46%, rgba(252,248,245,0.72) 100%)",
        }}
      />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#fcf8f5]" />
    </>
  );
}
