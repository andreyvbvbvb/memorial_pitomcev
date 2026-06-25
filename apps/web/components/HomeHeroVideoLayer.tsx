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

const HERO_VIDEO_CACHE_KEY = "meowgav.homeHeroVideo";

const warmVideoOrigin = (url: string) => {
  if (typeof document === "undefined") {
    return;
  }
  try {
    const { origin } = new URL(url, window.location.href);
    const selector = `link[data-hero-video-origin="${origin}"]`;
    if (document.head.querySelector(selector)) {
      return;
    }
    const preconnect = document.createElement("link");
    preconnect.rel = "preconnect";
    preconnect.href = origin;
    preconnect.crossOrigin = "anonymous";
    preconnect.dataset.heroVideoOrigin = origin;
    document.head.appendChild(preconnect);
  } catch {
    // Relative or malformed URLs can still be used by the video element.
  }
};

export default function HomeHeroVideoLayer() {
  const [video, setVideo] = useState<HeroVideoState | null>(null);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    let isMounted = true;
    try {
      const cached = window.localStorage.getItem(HERO_VIDEO_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as HeroVideoState;
        if (parsed?.url && parsed?.version) {
          warmVideoOrigin(parsed.url);
          setVideo(parsed);
        }
      }
    } catch {
      // Local storage can be unavailable in private modes; fetch below is enough.
    }

    const loadVideo = async () => {
      try {
        const response = await fetch(`${API_BASE}/content/hero-video`, {
          cache: "default",
          credentials: "omit",
        });
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as HeroVideoResponse;
        const nextUrl = data.heroVideo?.url?.trim() || null;
        if (isMounted && nextUrl) {
          const nextVideo = {
            url: nextUrl,
            version: data.heroVideo?.updatedAt || String(Date.now()),
          };
          warmVideoOrigin(nextVideo.url);
          setVideo(nextVideo);
          try {
            window.localStorage.setItem(HERO_VIDEO_CACHE_KEY, JSON.stringify(nextVideo));
          } catch {
            // Ignore storage quota/security failures.
          }
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

  useEffect(() => {
    setVideoReady(false);
  }, [sourceUrl]);

  return (
    <>
      <div className="absolute inset-0 bg-[#fcf8f5]" />
      <div
        className="absolute inset-0 scale-[1.03] bg-cover bg-top opacity-[0.92]"
        style={{ backgroundImage: "url('/nebo_5.png')" }}
      />
      {sourceUrl ? (
        <video
          key={sourceUrl}
          className={`absolute inset-0 h-full w-full scale-[1.03] object-cover object-top transition-opacity duration-700 ease-out ${
            videoReady ? "opacity-[0.92]" : "opacity-0"
          }`}
          src={sourceUrl}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster="/nebo_5.png"
          onLoadedData={() => setVideoReady(true)}
          onPlaying={() => setVideoReady(true)}
          onError={() => setVideoReady(false)}
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
