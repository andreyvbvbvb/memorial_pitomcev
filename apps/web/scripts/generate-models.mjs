import fs from "fs";
import path from "path";

const ROOT = path.resolve(process.cwd(), "public", "models");

const envNameMap = {
  summer: "Лето",
  winter: "Зима",
  spring: "Весна",
  autumn: "Осень"
};

const envSeasons = ["spring", "summer", "autumn", "winter"];

const categories = [
  {
    key: "environment",
    dir: "terrains",
    filePrefix: "TERRAIN_",
    urlPrefix: "/models/terrains/",
    label: "Поверхность",
    naming: "environment"
  },
  {
    key: "house",
    dir: "houses",
    filePrefix: "DOM_",
    urlPrefix: "/models/houses/",
    label: "Будка",
    naming: "numbered"
  },
  {
    key: "roof",
    dir: "parts/roof",
    filePrefix: "",
    urlPrefix: "/models/parts/roof/",
    label: "Крыша",
    naming: "numbered"
  },
  {
    key: "wall",
    dir: "parts/wall",
    filePrefix: "",
    urlPrefix: "/models/parts/wall/",
    label: "Стены",
    naming: "numbered"
  },
  {
    key: "sign",
    dir: "parts/sign",
    filePrefix: "",
    urlPrefix: "/models/parts/sign/",
    label: "Украшение",
    naming: "numbered"
  },
  {
    key: "frameLeft",
    dir: "parts/frame_left",
    filePrefix: "",
    urlPrefix: "/models/parts/frame_left/",
    label: "Рамка слева",
    naming: "numbered"
  },
  {
    key: "frameRight",
    dir: "parts/frame_right",
    filePrefix: "",
    urlPrefix: "/models/parts/frame_right/",
    label: "Рамка справа",
    naming: "numbered"
  },
  {
    key: "mat",
    dir: "parts/mat",
    filePrefix: "",
    urlPrefix: "/models/parts/mat/",
    label: "Коврик",
    naming: "numbered"
  },
  {
    key: "bowlFood",
    dir: "parts/bowl_food",
    filePrefix: "",
    urlPrefix: "/models/parts/bowl_food/",
    label: "Миска еды",
    naming: "numbered"
  },
  {
    key: "bowlWater",
    dir: "parts/bowl_water",
    filePrefix: "",
    urlPrefix: "/models/parts/bowl_water/",
    label: "Миска воды",
    naming: "numbered"
  }
];

const toId = (fileName, prefix) => {
  const base = path.basename(fileName, ".glb");
  if (prefix && base.startsWith(prefix)) {
    return base.slice(prefix.length);
  }
  return base;
};

const extractNumber = (id) => {
  const match = id.match(/_(\d+)$/);
  return match ? Number(match[1]) : null;
};

const humanize = (value) =>
  value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());

const makeName = (category, id) => {
  if (category.naming === "environment") {
    const baseName = envNameMap[id] ?? humanize(id);
    return baseName;
  }
  const number = extractNumber(id);
  return number ? `${category.label} ${number}` : category.label;
};

const makeDescription = (category, id) => {
  if (category.naming === "environment") {
    return "Автодобавлено";
  }
  const number = extractNumber(id);
  return number ? `Вариант ${number}` : "Автодобавлено";
};

const houseSlotMarkers = {
  roof: "roof_slot",
  wall: "wall_slot",
  sign: "sign_slot",
  frameLeft: "frame_left_slot",
  frameRight: "frame_right_slot",
  mat: "mat_slot",
  bowlFood: "bowl_food_slot",
  bowlWater: "bowl_water_slot"
};

const readGlbJson = (filePath) => {
  try {
    const data = fs.readFileSync(filePath);
    if (data.length < 20) {
      return null;
    }
    if (data.readUInt32LE(0) !== 0x46546c67) {
      return null;
    }
    const jsonLength = data.readUInt32LE(12);
    const jsonType = data.readUInt32LE(16);
    if (jsonType !== 0x4e4f534a) {
      return null;
    }
    const jsonText = data.toString("utf8", 20, 20 + jsonLength).trim();
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
};

const compareEntries = (category, a, b) => {
  const aNum = extractNumber(a.id);
  const bNum = extractNumber(b.id);
  if (aNum !== null && bNum !== null && aNum !== bNum) {
    return aNum - bNum;
  }
  return a.id.localeCompare(b.id);
};

const parseEnvironmentId = (id) => {
  const parts = id.split("_");
  const last = parts[parts.length - 1];
  if (envSeasons.includes(last)) {
    const base = parts.slice(0, -1).join("_");
    return { baseId: base || id, season: last };
  }
  return { baseId: id, season: null };
};

const makeEnvironmentOption = (baseId) => {
  const number = extractNumber(baseId);
  const isNumericId = /^[0-9]+$/.test(baseId);
  const labelNumber = isNumericId ? baseId : number;
  const name =
    envNameMap[baseId] ??
    (isNumericId
      ? `Поверхность ${labelNumber}`
      : humanize(baseId));
  return {
    id: baseId,
    name,
    description: "Автодобавлено"
  };
};

const readCategory = (category) => {
  const dirPath = path.join(ROOT, category.dir);
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  return fs
    .readdirSync(dirPath)
    .filter((file) => file.toLowerCase().endsWith(".glb"))
    .filter((file) => {
      if (!category.filePrefix) {
        return true;
      }
      return path.basename(file).startsWith(category.filePrefix);
    })
    .map((file) => ({
      file,
      id: toId(file, category.filePrefix)
    }))
    .sort((a, b) => compareEntries(category, a, b));
};

const mappings = {};
const options = {};
let houseSlotsGenerated = {};

const environmentCategory = categories.find((category) => category.key === "environment");
if (environmentCategory) {
  const items = readCategory(environmentCategory);
  const seasonalMap = {};
  const optionMap = new Map();

  items.forEach((item) => {
    const { baseId, season } = parseEnvironmentId(item.id);
    if (!seasonalMap[baseId]) {
      seasonalMap[baseId] = {};
    }
    const url = `${environmentCategory.urlPrefix}${item.file}`;
    if (season) {
      seasonalMap[baseId][season] = url;
    } else if (!seasonalMap[baseId].summer) {
      seasonalMap[baseId].summer = url;
    }
    if (!optionMap.has(baseId)) {
      optionMap.set(baseId, makeEnvironmentOption(baseId));
    }
  });

  const environmentOptions = Array.from(optionMap.values()).sort((a, b) => {
    const aNum = extractNumber(a.id);
    const bNum = extractNumber(b.id);
    if (aNum !== null && bNum !== null && aNum !== bNum) {
      return aNum - bNum;
    }
    return a.id.localeCompare(b.id);
  });

  const environmentModelMap = {};
  Object.entries(seasonalMap).forEach(([baseId, seasons]) => {
    environmentModelMap[baseId] = seasons.summer ?? Object.values(seasons)[0];
  });

  mappings.environment = environmentModelMap;
  mappings.environmentSeasonal = seasonalMap;
  options.environment = environmentOptions;
}

categories
  .filter((category) => category.key !== "environment")
  .forEach((category) => {
    const items = readCategory(category);
    const modelMap = {};
    const optionList = [];
    items.forEach((item) => {
      modelMap[item.id] = `${category.urlPrefix}${item.file}`;
      optionList.push({
        id: item.id,
        name: makeName(category, item.id),
        description: makeDescription(category, item.id)
      });
    });
    mappings[category.key] = modelMap;
    options[category.key] = optionList;
  });

const houseCategory = categories.find((category) => category.key === "house");
if (houseCategory) {
  const items = readCategory(houseCategory);
  const slotsMap = {};
  items.forEach((item) => {
    const filePath = path.join(ROOT, houseCategory.dir, item.file);
    const gltf = readGlbJson(filePath);
    if (!gltf || !Array.isArray(gltf.nodes)) {
      return;
    }
    const nodeNames = new Set(
      gltf.nodes
        .map((node) => (typeof node?.name === "string" ? node.name.toLowerCase() : ""))
        .filter(Boolean)
    );
    const slots = {};
    Object.entries(houseSlotMarkers).forEach(([slotKey, slotName]) => {
      if (nodeNames.has(slotName)) {
        slots[slotKey] = slotName;
      }
    });
    if (Object.keys(slots).length > 0) {
      slotsMap[item.id] = slots;
    }
  });
  houseSlotsGenerated = slotsMap;
}

const generatedModelsPath = path.resolve(process.cwd(), "lib", "memorial-models.generated.ts");
const generatedOptionsPath = path.resolve(process.cwd(), "lib", "memorial-options.generated.ts");
const generatedSlotsPath = path.resolve(process.cwd(), "lib", "memorial-slots.generated.ts");
const generatedMarkersPath = path.resolve(process.cwd(), "lib", "markers.generated.ts");
const generatedGiftsPath = path.resolve(process.cwd(), "lib", "gifts.generated.ts");

const formatExport = (name, value) =>
  `export const ${name} = ${JSON.stringify(value, null, 2)} as const;`;

const modelsFile = `// This file is auto-generated by scripts/generate-models.mjs. Do not edit manually.

${formatExport("environmentModelByIdGenerated", mappings.environment)}
${formatExport("environmentSeasonModelsByIdGenerated", mappings.environmentSeasonal ?? {})}
${formatExport("houseModelByIdGenerated", mappings.house)}
${formatExport("roofModelByIdGenerated", mappings.roof)}
${formatExport("wallModelByIdGenerated", mappings.wall)}
${formatExport("signModelByIdGenerated", mappings.sign)}
${formatExport("frameLeftModelByIdGenerated", mappings.frameLeft)}
${formatExport("frameRightModelByIdGenerated", mappings.frameRight)}
${formatExport("matModelByIdGenerated", mappings.mat)}
${formatExport("bowlFoodModelByIdGenerated", mappings.bowlFood)}
${formatExport("bowlWaterModelByIdGenerated", mappings.bowlWater)}
`;

const optionsFile = `// This file is auto-generated by scripts/generate-models.mjs. Do not edit manually.

export type GeneratedOptionItem = {
  id: string;
  name: string;
  description: string;
};

${formatExport("environmentOptionsGenerated", options.environment)}
${formatExport("houseOptionsGenerated", options.house)}
${formatExport("roofOptionsGenerated", options.roof)}
${formatExport("wallOptionsGenerated", options.wall)}
${formatExport("signOptionsGenerated", options.sign)}
${formatExport("frameLeftOptionsGenerated", options.frameLeft)}
${formatExport("frameRightOptionsGenerated", options.frameRight)}
${formatExport("matOptionsGenerated", options.mat)}
${formatExport("bowlFoodOptionsGenerated", options.bowlFood)}
${formatExport("bowlWaterOptionsGenerated", options.bowlWater)}
`;

fs.writeFileSync(generatedModelsPath, modelsFile, "utf8");
fs.writeFileSync(generatedOptionsPath, optionsFile, "utf8");

const slotsFile = `// This file is auto-generated by scripts/generate-models.mjs. Do not edit manually.

${formatExport("houseSlotsGenerated", houseSlotsGenerated)}
`;

fs.writeFileSync(generatedSlotsPath, slotsFile, "utf8");

const giftsRoot = path.resolve(process.cwd(), "public", "models", "gifts");
const giftTypeDirs = fs.existsSync(giftsRoot)
  ? fs
      .readdirSync(giftsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  : [];
const giftDefaultFiles = fs.existsSync(giftsRoot)
  ? fs
      .readdirSync(giftsRoot)
      .filter((file) => file.toLowerCase().endsWith(".glb"))
      .filter((file) => file.toLowerCase() !== "slot_placeholder.glb")
  : [];

const giftModels = {};

giftDefaultFiles.forEach((file) => {
  const code = path.basename(file, ".glb");
  giftModels[code] = { ...(giftModels[code] ?? {}), default: `/models/gifts/${file}` };
});

giftTypeDirs.forEach((type) => {
  const typeDir = path.join(giftsRoot, type);
  const files = fs
    .readdirSync(typeDir)
    .filter((file) => file.toLowerCase().endsWith(".glb"));
  files.forEach((file) => {
    const code = path.basename(file, ".glb");
    giftModels[code] = {
      ...(giftModels[code] ?? {}),
      [type]: `/models/gifts/${type}/${file}`
    };
  });
});

const giftsFile = `// This file is auto-generated by scripts/generate-models.mjs. Do not edit manually.

export const giftModelsGenerated = ${JSON.stringify(giftModels, null, 2)} as const;
`;

fs.writeFileSync(generatedGiftsPath, giftsFile, "utf8");

const giftTypeLabels = {
  candle: "Свеча",
  flower: "Цветок",
  star: "Звезда",
  toy: "Игрушка",
  meal: "Еда",
  bird: "Птица"
};

const giftTypePrices = {
  candle: 30
};

const giftsList = Object.entries(giftModels)
  .map(([code, entry]) => {
    const types = Object.keys(entry).filter((key) => key !== "default");
    const type = types[0] ?? "default";
    const modelUrl = entry[type] ?? entry.default;
    const numberMatch = code.match(/_(\d+)$/);
    const number = numberMatch ? Number(numberMatch[1]) : null;
    const label = giftTypeLabels[type] ?? "Подарок";
    const name = number ? `${label} ${number}` : label;
    let price = giftTypePrices[type] ?? 20;
    if (type === "candle" && number !== null && number >= 9) {
      price = 50;
    }
    return {
      code,
      name,
      price,
      modelUrl
    };
  })
  .filter((item) => item.modelUrl);

const apiGiftsPath = path.resolve(process.cwd(), "..", "api", "src", "gifts", "gifts.generated.ts");
const apiGiftsFile = `// This file is auto-generated by scripts/generate-models.mjs. Do not edit manually.\n\nexport const generatedGifts = ${JSON.stringify(giftsList, null, 2)} as const;\n`;
fs.mkdirSync(path.dirname(apiGiftsPath), { recursive: true });
fs.writeFileSync(apiGiftsPath, apiGiftsFile, "utf8");

const markersDir = path.resolve(process.cwd(), "public", "markers");
const markerIconsDir = path.resolve(process.cwd(), "public", "markers_icons");
const markerFiles = fs.existsSync(markersDir)
  ? fs
      .readdirSync(markersDir)
      .filter((file) => file.toLowerCase().endsWith(".png"))
  : [];
const markerIconFiles = fs.existsSync(markerIconsDir)
  ? fs
      .readdirSync(markerIconsDir)
      .filter((file) => file.toLowerCase().endsWith("_icon.png"))
  : [];
const markerIconMap = new Map(
  markerIconFiles.map((file) => {
    const id = path.basename(file, "_icon.png");
    return [id, `/markers_icons/${file}`];
  })
);

const markerVariants = markerFiles.map((file) => {
  const id = path.basename(file, ".png");
  const baseId = id.split("_")[0] ?? id;
  const iconUrl = markerIconMap.get(id) ?? `/markers/${file}`;
  return {
    id,
    baseId,
    url: `/markers/${file}`,
    iconUrl
  };
});

const markersFile = `// This file is auto-generated by scripts/generate-models.mjs. Do not edit manually.

export const markerVariantsGenerated = ${JSON.stringify(markerVariants, null, 2)} as const;
`;

fs.writeFileSync(generatedMarkersPath, markersFile, "utf8");

console.log("Generated memorial model + options files.");
