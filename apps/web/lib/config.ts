const configuredApiBase = process.env.NEXT_PUBLIC_API_URL?.trim();

export const API_BASE =
  configuredApiBase && configuredApiBase.length > 0
    ? configuredApiBase.replace(/\/+$/, "")
    : process.env.NODE_ENV === "production"
      ? "/api"
      : "http://localhost:3001";
