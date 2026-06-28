import { group, sleep } from "k6";
import http from "k6/http";
import {
  API_BASE_URL,
  DEFAULT_THRESHOLDS,
  buildRampingScenario,
  expectStatus,
  loadPublicMarkers,
  randomItem
} from "./common.js";

export const options = {
  scenarios: {
    api_only: buildRampingScenario()
  },
  thresholds: DEFAULT_THRESHOLDS
};

export function setup() {
  return {
    petIds: loadPublicMarkers()
      .map((marker) => marker?.petId)
      .filter(Boolean)
  };
}

export default function apiOnly(data) {
  const petId = randomItem(data?.petIds || []);
  const requests = [
    [
      "GET",
      `${API_BASE_URL}/health`,
      null,
      { tags: { name: "GET /health" } }
    ],
    [
      "GET",
      `${API_BASE_URL}/gifts`,
      null,
      { tags: { name: "GET /gifts" } }
    ],
    [
      "GET",
      `${API_BASE_URL}/map/markers`,
      null,
      { tags: { name: "GET /map/markers" } }
    ]
  ];

  if (petId) {
    requests.push([
      "GET",
      `${API_BASE_URL}/pets/${petId}`,
      null,
      { tags: { name: "GET /pets/[id]" } }
    ]);
  }

  group("api reads", () => {
    const responses = http.batch(requests);
    expectStatus(responses[0], "health");
    expectStatus(responses[1], "gift catalog");
    expectStatus(responses[2], "public markers");
    if (petId) {
      expectStatus(responses[3], "memorial api");
    }
  });

  sleep(1 + Math.random() * 2);
}
