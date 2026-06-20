import { group, sleep } from "k6";
import http from "k6/http";
import {
  API_BASE_URL,
  DEFAULT_THRESHOLDS,
  WEB_BASE_URL,
  expectStatus,
  getNumberEnv,
  getStringEnv,
  loadPublicMarkers,
  randomItem
} from "./common.js";

export const options = {
  scenarios: {
    public_browse: {
      executor: "constant-vus",
      vus: getNumberEnv("VUS", 20),
      duration: getStringEnv("DURATION", "2m")
    }
  },
  thresholds: DEFAULT_THRESHOLDS
};

export default function publicBrowse() {
  let markers = [];

  group("public pages", () => {
    const responses = http.batch([
      ["GET", `${WEB_BASE_URL}/`, null, { tags: { name: "GET /" } }],
      ["GET", `${WEB_BASE_URL}/map`, null, { tags: { name: "GET /map" } }],
      [
        "GET",
        `${WEB_BASE_URL}/news`,
        null,
        { tags: { name: "GET /news" } }
      ],
      [
        "GET",
        `${WEB_BASE_URL}/about`,
        null,
        { tags: { name: "GET /about" } }
      ],
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
      ]
    ]);

    expectStatus(responses[0], "home page");
    expectStatus(responses[1], "map page");
    expectStatus(responses[2], "news page");
    expectStatus(responses[3], "about page");
    expectStatus(responses[4], "health");
    expectStatus(responses[5], "gift catalog");
  });

  group("map markers", () => {
    markers = loadPublicMarkers();
  });

  const marker = randomItem(markers);
  if (marker?.petId) {
    group("public memorial", () => {
      const responses = http.batch([
        [
          "GET",
          `${WEB_BASE_URL}/pets/${marker.petId}`,
          null,
          { tags: { name: "GET /pets/[id] page" } }
        ],
        [
          "GET",
          `${API_BASE_URL}/pets/${marker.petId}`,
          null,
          { tags: { name: "GET /pets/[id] api" } }
        ]
      ]);
      expectStatus(responses[0], "memorial page");
      expectStatus(responses[1], "memorial api");
    });
  }

  sleep(1 + Math.random() * 2);
}
