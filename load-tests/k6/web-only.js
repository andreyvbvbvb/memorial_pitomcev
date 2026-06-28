import { group, sleep } from "k6";
import http from "k6/http";
import {
  DEFAULT_THRESHOLDS,
  WEB_BASE_URL,
  buildRampingScenario,
  expectStatus,
  loadPublicMarkers,
  randomItem
} from "./common.js";

export const options = {
  scenarios: {
    web_only: buildRampingScenario()
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

export default function webOnly(data) {
  const petId = randomItem(data?.petIds || []);
  const requests = [
    ["GET", `${WEB_BASE_URL}/`, null, { tags: { name: "GET /" } }],
    ["GET", `${WEB_BASE_URL}/map`, null, { tags: { name: "GET /map" } }],
    ["GET", `${WEB_BASE_URL}/news`, null, { tags: { name: "GET /news" } }],
    ["GET", `${WEB_BASE_URL}/about`, null, { tags: { name: "GET /about" } }]
  ];

  if (petId) {
    requests.push([
      "GET",
      `${WEB_BASE_URL}/pets/${petId}`,
      null,
      { tags: { name: "GET /pets/[id] page" } }
    ]);
  }

  group("web pages", () => {
    const responses = http.batch(requests);
    expectStatus(responses[0], "home page");
    expectStatus(responses[1], "map page");
    expectStatus(responses[2], "news page");
    expectStatus(responses[3], "about page");
    if (petId) {
      expectStatus(responses[4], "memorial page");
    }
  });

  sleep(1 + Math.random() * 2);
}
