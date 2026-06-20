import { group, sleep } from "k6";
import http from "k6/http";
import {
  API_BASE_URL,
  DEFAULT_THRESHOLDS,
  WEB_BASE_URL,
  authParams,
  expectStatus,
  getNumberEnv,
  getStringEnv,
  loginWithEnvCredentials,
  randomItem,
  safeJson
} from "./common.js";

export const options = {
  scenarios: {
    authenticated_user: {
      executor: "constant-vus",
      vus: getNumberEnv("VUS", 10),
      duration: getStringEnv("DURATION", "2m")
    }
  },
  thresholds: DEFAULT_THRESHOLDS
};

export function setup() {
  const session = loginWithEnvCredentials();
  const response = http.get(
    `${API_BASE_URL}/auth/me`,
    authParams(session, { tags: { name: "GET /auth/me" } })
  );
  expectStatus(response, "auth me");
  return {
    session,
    user: safeJson(response, session.user)
  };
}

export default function authenticatedUser(data) {
  const session = data.session;
  const userId = data.user?.id || data.session?.user?.id;

  group("authenticated dashboard", () => {
    const responses = http.batch([
      [
        "GET",
        `${WEB_BASE_URL}/my-pets`,
        null,
        authParams(session, { tags: { name: "GET /my-pets page" } })
      ],
      [
        "GET",
        `${WEB_BASE_URL}/profile`,
        null,
        authParams(session, { tags: { name: "GET /profile page" } })
      ],
      [
        "GET",
        `${API_BASE_URL}/auth/me`,
        null,
        authParams(session, { tags: { name: "GET /auth/me" } })
      ],
      [
        "GET",
        `${API_BASE_URL}/users/me/gifts`,
        null,
        authParams(session, { tags: { name: "GET /users/me/gifts" } })
      ],
      [
        "GET",
        `${API_BASE_URL}/users/me/received-gifts`,
        null,
        authParams(session, {
          tags: { name: "GET /users/me/received-gifts" }
        })
      ],
      [
        "GET",
        `${API_BASE_URL}/wallet/me/transactions`,
        null,
        authParams(session, { tags: { name: "GET /wallet/me/transactions" } })
      ]
    ]);

    responses.forEach((response, index) =>
      expectStatus(response, `authenticated response ${index + 1}`)
    );
  });

  if (userId) {
    group("owner pets", () => {
      const petsResponse = http.get(
        `${API_BASE_URL}/pets?ownerId=${encodeURIComponent(userId)}`,
        authParams(session, { tags: { name: "GET /pets?ownerId" } })
      );
      expectStatus(petsResponse, "owner pets");
      const pets = safeJson(petsResponse, []);
      const pet = randomItem(Array.isArray(pets) ? pets : []);
      if (pet?.id) {
        const response = http.get(
          `${API_BASE_URL}/pets/${pet.id}`,
          authParams(session, { tags: { name: "GET /pets/[id] owned" } })
        );
        expectStatus(response, "owned memorial");
      }
    });

    group("wallet", () => {
      const response = http.get(
        `${API_BASE_URL}/wallet/${encodeURIComponent(userId)}`,
        authParams(session, { tags: { name: "GET /wallet/[ownerId]" } })
      );
      expectStatus(response, "wallet balance");
    });
  }

  sleep(1 + Math.random() * 3);
}
