"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type ActiveBanner = {
  text: string;
  version: string;
};

const DISMISSED_BANNER_VERSION_KEY = "memorial-dismissed-site-banner-version";

export default function SiteBanner({ variant = "flow" }: Props) {
  const apiUrl = useMemo(() => API_BASE, []);
  const [banner, setBanner] = useState<ActiveBanner | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        const nextVersion =
          data.banner?.updatedAt?.trim() ||
          (nextText ? `text:${nextText}` : null);
        if (active) {
          let isDismissed = false;
          if (nextVersion) {
            try {
              isDismissed =
                window.localStorage.getItem(DISMISSED_BANNER_VERSION_KEY) ===
                nextVersion;
            } catch {
              isDismissed = false;
            }
          }
          setIsClosing(false);
          setBanner(
            nextText && nextVersion && !isDismissed
              ? { text: nextText, version: nextVersion }
              : null,
          );
        }
      } catch {
        if (active) {
          setBanner(null);
        }
      }
    };
    void loadBanner();
    return () => {
      active = false;
    };
  }, [apiUrl]);

  useEffect(
    () => () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    },
    [],
  );

  if (!banner) {
    return null;
  }

  const dismissBanner = () => {
    try {
      window.localStorage.setItem(DISMISSED_BANNER_VERSION_KEY, banner.version);
    } catch {
      // The current page still hides the banner when storage is unavailable.
    }
    setIsClosing(true);
    dismissTimerRef.current = setTimeout(() => {
      setBanner(null);
      dismissTimerRef.current = null;
    }, 150);
  };

  const content = (
    <div className="mx-auto grid min-h-10 w-full max-w-6xl grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center px-1 sm:px-2">
      <span aria-hidden="true" />
      <p className="px-2 py-1.5 text-center text-[11px] font-bold leading-snug text-[#5d4037] sm:text-xs">
        {banner.text}
      </p>
      <button
        type="button"
        onClick={dismissBanner}
        disabled={isClosing}
        aria-label="Скрыть уведомление"
        title="Скрыть уведомление"
        className="pointer-events-auto inline-flex size-10 items-center justify-center justify-self-end rounded-full text-[#8d6e63] transition-[transform,background-color,color] duration-150 ease-out hover:bg-white/75 hover:text-[#5d4037] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[#5d4037] active:scale-[0.96] disabled:pointer-events-none"
      >
        <span aria-hidden="true" className="text-xl font-medium leading-none">
          ×
        </span>
      </button>
    </div>
  );

  const visibilityClass = isClosing
    ? "-translate-y-1 opacity-0"
    : "translate-y-0 opacity-100";

  if (variant === "overlay") {
    return (
      <div
        className={`pointer-events-none absolute left-0 right-0 top-[var(--app-header-height,56px)] z-40 border-y border-white/80 bg-[#fff7f2]/95 shadow-[0_10px_26px_-24px_rgba(93,64,55,0.45)] backdrop-blur transition-[transform,opacity] duration-150 ease-in ${visibilityClass}`}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      className={`relative z-20 border-y border-white/80 bg-[#fff7f2] shadow-[0_10px_26px_-24px_rgba(93,64,55,0.45)] transition-[transform,opacity] duration-150 ease-in ${visibilityClass}`}
    >
      {content}
    </div>
  );
}
