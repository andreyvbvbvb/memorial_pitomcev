import { check, group } from "k6";
import http from "k6/http";
import { SharedArray } from "k6/data";
import { Trend } from "k6/metrics";
import {
  WEB_BASE_URL,
  getNumberEnv
} from "./common.js";

const MODEL_EXPORTS = [
  "environmentSeasonModelsByIdGenerated",
  "houseModelByIdGenerated",
  "roofModelByIdGenerated",
  "wallModelByIdGenerated",
  "signModelByIdGenerated",
  "frameLeftModelByIdGenerated",
  "frameRightModelByIdGenerated",
  "matModelByIdGenerated",
  "bowlFoodModelByIdGenerated",
  "bowlWaterModelByIdGenerated"
];

const OPTION_IMAGE_EXPORTS = [
  ["environmentOptionsGenerated", "environment"],
  ["houseOptionsGenerated", "house-texture"],
  ["signOptionsGenerated", "sign"],
  ["matOptionsGenerated", "mat"],
  ["bowlFoodOptionsGenerated", "bowl-food"],
  ["bowlWaterOptionsGenerated", "bowl-water"]
];

const MARKER_CATEGORIES = ["dog", "cat", "bird", "rat", "gryzun", "fish", "other"];
const BATCH_SIZE = getNumberEnv("ASSET_BATCH_SIZE", 2);
const VIRTUAL_USERS = getNumberEnv("VUS", 10);
const modelDuration = new Trend("editor_model_download_duration", true);
const imageDuration = new Trend("editor_image_download_duration", true);

const extractExportBlock = (source, exportName) => {
  const pattern = new RegExp(
    `export const ${exportName} = ([\\s\\S]*?) as const;`
  );
  return source.match(pattern)?.[1] || "";
};

const extractPaths = (source, exportName, pathPattern) => {
  const block = extractExportBlock(source, exportName);
  return [...block.matchAll(pathPattern)].map((match) => match[1]);
};

const modelAssets = new SharedArray("editor model assets", () => {
  const source = open("../../apps/web/lib/memorial-models.generated.ts");
  return MODEL_EXPORTS.flatMap((exportName) =>
    extractPaths(source, exportName, /"(\/models\/[^"]+\.glb)"/g).map((path) => ({
      exportName,
      path
    }))
  );
});

const optionImageAssets = new SharedArray("editor option images", () => {
  const source = open("../../apps/web/lib/memorial-options.generated.ts");
  const paths = OPTION_IMAGE_EXPORTS.flatMap(([exportName, directory]) =>
    extractPaths(source, exportName, /"id": "([^"]+)"/g)
      .filter(
        (id) =>
          directory !== "house-texture" ||
          /^(?:budka|kotik|mat)_\d+/.test(id)
      )
      .map((id) => `/memorial/options/${directory}/${id}.png`)
  );

  const houseIds = extractPaths(
    source,
    "houseOptionsGenerated",
    /"id": "([^"]+)"/g
  );
  houseIds.forEach((id) => {
    const baseMatch = id.match(/^((?:budka|kotik|mat)_\d+)/);
    if (baseMatch?.[1]) {
      paths.push(`/memorial/options/house/${baseMatch[1]}.png`);
    }
  });

  return [...new Set(paths)];
});

const markerImageAssets = new SharedArray("editor marker images", () => {
  const source = open("../../apps/web/lib/markers.generated.ts");
  return [
    ...new Set(
      [...source.matchAll(/"iconUrl": "(\/markers_icons\/[^"]+\.png)"/g)].map(
        (match) => match[1]
      )
    )
  ];
});

const selectSceneModels = (vu) =>
  MODEL_EXPORTS.map((exportName, index) => {
    const options = modelAssets.filter((asset) => asset.exportName === exportName);
    return options[(vu + index) % options.length]?.path;
  }).filter(Boolean);

const selectMarkerImages = (vu) => {
  const category = MARKER_CATEGORIES[(vu - 1) % MARKER_CATEGORIES.length];
  return markerImageAssets.filter((path) => {
    const fileName = path.split("/").pop() || "";
    const isCategoryButton = MARKER_CATEGORIES.some(
      (item) => fileName === `${item}_icon.png`
    );
    return isCategoryButton || fileName.startsWith(`${category}_`);
  });
};

const downloadInBatches = (paths, assetType, metric) => {
  for (let offset = 0; offset < paths.length; offset += BATCH_SIZE) {
    const batch = paths.slice(offset, offset + BATCH_SIZE).map((path) => [
      "GET",
      `${WEB_BASE_URL}${path}`,
      null,
      {
        tags: {
          name: `GET editor ${assetType}`,
          asset_type: assetType
        },
        timeout: "60s"
      }
    ]);
    const responses = http.batch(batch);
    responses.forEach((response) => {
      metric.add(response.timings.duration);
      check(response, {
        [`editor ${assetType}: status 200`]: (item) => item.status === 200
      });
    });
  }
};

export const options = {
  discardResponseBodies: true,
  scenarios: {
    editor_first_load: {
      executor: "per-vu-iterations",
      vus: VIRTUAL_USERS,
      iterations: 1,
      maxDuration: "8m"
    }
  },
  thresholds: {
    http_req_failed: ["rate<0.02"],
    "http_req_duration{asset_type:model}": [
      `p(95)<${getNumberEnv("MODEL_P95_MS", 30000)}`
    ],
    "http_req_duration{asset_type:image}": [
      `p(95)<${getNumberEnv("IMAGE_P95_MS", 15000)}`
    ]
  }
};

export default function editorAssets() {
  group("editor page", () => {
    const response = http.get(`${WEB_BASE_URL}/create`, {
      tags: { name: "GET /create", asset_type: "page" },
      timeout: "60s"
    });
    check(response, {
      "editor page: status 200": (item) => item.status === 200
    });
  });

  group("selected 3D scene", () => {
    downloadInBatches(
      selectSceneModels(__VU),
      "model",
      modelDuration
    );
  });

  group("editor option images", () => {
    downloadInBatches(
      optionImageAssets,
      "image",
      imageDuration
    );
  });

  group("marker picker images", () => {
    downloadInBatches(
      selectMarkerImages(__VU),
      "marker",
      imageDuration
    );
  });
}
