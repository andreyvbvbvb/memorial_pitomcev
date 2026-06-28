import { check } from "k6";
import http from "k6/http";

const trimTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");

export const API_BASE_URL = trimTrailingSlash(
  __ENV.API_BASE_URL || "http://localhost:4000"
);
export const WEB_BASE_URL = trimTrailingSlash(
  __ENV.WEB_BASE_URL || "http://localhost:3000"
);

export const JSON_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json"
};

export const DEFAULT_THRESHOLDS = {
  http_req_failed: ["rate<0.02"],
  http_req_duration: [`p(95)<${Number(__ENV.P95_MS || 1200)}`]
};

export const getNumberEnv = (name, fallback) => {
  const value = Number(__ENV[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const getStringEnv = (name, fallback) => {
  const value = __ENV[name];
  return value === undefined || value === "" ? fallback : String(value);
};

export const buildRampingScenario = () => {
  const targetVus = getNumberEnv("VUS", 20);
  return {
    executor: "ramping-vus",
    startVUs: 0,
    stages: [
      {
        duration: getStringEnv("RAMP_UP", "30s"),
        target: targetVus
      },
      {
        duration: getStringEnv("DURATION", "2m"),
        target: targetVus
      },
      {
        duration: getStringEnv("RAMP_DOWN", "15s"),
        target: 0
      }
    ],
    gracefulRampDown: "30s"
  };
};

export const randomItem = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }
  return items[Math.floor(Math.random() * items.length)] || null;
};

export const safeJson = (response, fallback = null) => {
  try {
    return response.json();
  } catch (_) {
    return fallback;
  }
};

export const expectStatus = (response, name, min = 200, max = 299) =>
  check(response, {
    [`${name}: status ${min}-${max}`]: (item) =>
      item.status >= min && item.status <= max
  });

export const authParams = (session, extra = {}) => ({
  ...extra,
  headers: {
    ...(extra.headers || {}),
    ...(session?.cookieHeader ? { Cookie: session.cookieHeader } : {})
  }
});

export const loginWithEnvCredentials = () => {
  const email = __ENV.K6_EMAIL || __ENV.K6_LOGIN || __ENV.K6_USER;
  const password = __ENV.K6_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Set K6_EMAIL and K6_PASSWORD for authenticated k6 scenarios."
    );
  }

  const response = http.post(
    `${API_BASE_URL}/auth/login`,
    JSON.stringify({ email, password }),
    {
      headers: JSON_HEADERS,
      tags: { name: "POST /auth/login" }
    }
  );

  expectStatus(response, "login");

  const token = response.cookies?.access_token?.[0]?.value;
  if (!token) {
    throw new Error("Login succeeded without access_token cookie.");
  }

  return {
    cookieHeader: `access_token=${token}`,
    user: safeJson(response, {})
  };
};

export const loadPublicMarkers = () => {
  const response = http.get(`${API_BASE_URL}/map/markers`, {
    tags: { name: "GET /map/markers" }
  });
  expectStatus(response, "public markers");
  const markers = safeJson(response, []);
  return Array.isArray(markers) ? markers : [];
};
