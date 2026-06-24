export const HERO_VIDEO_SETTING_KEY = "homeHeroVideo";

export type HeroVideoSetting = {
  url: string | null;
  fileName?: string | null;
  contentType?: string | null;
  sizeBytes?: number | null;
  updatedAt?: string | null;
};

export const normalizeHeroVideoSetting = (value: unknown): HeroVideoSetting => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { url: null };
  }
  const record = value as Record<string, unknown>;
  const url = typeof record.url === "string" ? record.url.trim() : "";
  return {
    url: url || null,
    fileName: typeof record.fileName === "string" ? record.fileName : null,
    contentType: typeof record.contentType === "string" ? record.contentType : null,
    sizeBytes:
      typeof record.sizeBytes === "number" && Number.isFinite(record.sizeBytes)
        ? record.sizeBytes
        : null,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : null,
  };
};
