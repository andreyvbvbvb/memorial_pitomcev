import { group, sleep } from "k6";
import http from "k6/http";
import {
  API_BASE_URL,
  DEFAULT_THRESHOLDS,
  authParams,
  expectStatus,
  getNumberEnv,
  getStringEnv,
  loginWithEnvCredentials
} from "./common.js";

export const options = {
  scenarios: {
    admin_probe: {
      executor: "constant-arrival-rate",
      rate: getNumberEnv("RATE", 10),
      timeUnit: "1s",
      duration: getStringEnv("DURATION", "1m"),
      preAllocatedVUs: getNumberEnv("PRE_ALLOCATED_VUS", 20),
      maxVUs: getNumberEnv("MAX_VUS", 100)
    }
  },
  thresholds: DEFAULT_THRESHOLDS
};

export function setup() {
  return {
    session: loginWithEnvCredentials()
  };
}

export default function adminProbe(data) {
  group("admin db probe", () => {
    const response = http.get(
      `${API_BASE_URL}/admin/load-probe`,
      authParams(data.session, { tags: { name: "GET /admin/load-probe" } })
    );
    expectStatus(response, "admin load probe");
  });

  sleep(0.1);
}
