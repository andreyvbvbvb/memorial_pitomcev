import fs from "fs";
import path from "path";

const ROOT = path.resolve(process.cwd(), "public", "models");
const EXTRA_DIR_NAME = "extra";
const SHARED_USER_SEPARATOR = "+";

const envNameMap = {
  summer: "Лето",
  winter: "Зима",
  spring: "Весна",
  autumn: "Осень"
};

const envSeasons = ["spring", "summer", "autumn", "winter"];

const optionMetadataByCategory = {
  environment: {
    "2": {
      name: "Лужайка с деревьями",
      description: "Парящая зелёная поверхность с небольшими деревьями и открытым местом для домика."
    },
    "3": {
      name: "Большая лужайка",
      description: "Просторная травяная поверхность с деревьями, мягким рельефом и большим местом для деталей."
    }
  },
  house: {
    budka_1__base: {
      name: "Классическая будка",
      description: "Небольшая деревянная будка на настиле с тёмной черепичной крышей."
    },
    budka_2__base: {
      name: "Домик с голубой крышей",
      description: "Светлый деревянный домик на платформе с голубой крышей и зелёными кустиками."
    },
    budka_2__second: {
      name: "Домик с синей крышей",
      description: "Тёплый деревянный домик с яркой синей крышей и аккуратным настилом."
    },
    budka_3__base: {
      name: "Домик с террасой",
      description: "Уютный домик с ограждением, лестницей и небольшой открытой террасой."
    },
    budka_4__base: {
      name: "Будка с красной крышей",
      description: "Деревянная будка с красной черепичной крышей, лесенкой и маленьким цветочным акцентом."
    },
    budka_5__base: {
      name: "Будка с тёмной крышей",
      description: "Массивная деревянная будка с арочным входом и тёмной мягкой крышей."
    },
    budka_5__second: {
      name: "Будка с коричневой крышей",
      description: "Тёплая деревянная будка с объёмной коричневой крышей и глубоким входом."
    },
    budka_6__base: {
      name: "Домик на ножках",
      description: "Приподнятый домик с зелёной крышей, окнами и аккуратной лестницей."
    },
    budka_7__base: {
      name: "Мини-будка на плите",
      description: "Компактная деревянная будка на светлой квадратной подставке."
    },
    budka_7__brown: {
      name: "Тёмная мини-будка",
      description: "Мини-будка с тёмным деревом, графитовой крышей и серой подставкой."
    },
    budka_7__soso: {
      name: "Светлая мини-будка",
      description: "Светлая деревянная мини-будка на тёплой досчатой подставке."
    },
    budka_7__tuntun: {
      name: "Розовая мини-будка",
      description: "Небольшая будка с розовыми стенами и мягкой светлой крышей."
    },
    budka_7__white: {
      name: "Белая мини-будка",
      description: "Белая мини-будка с чёрной крышей на строгой серой подставке."
    },
    budka_8__base: {
      name: "Домик с лестницей",
      description: "Приподнятый деревянный домик с лестницей, перилами и тёмной крышей."
    },
    budka_8__brown: {
      name: "Тёплый домик с лестницей",
      description: "Коричневый домик на ножках с лестницей и выразительной деревянной отделкой."
    },
    budka_8__stone: {
      name: "Светлый домик с лестницей",
      description: "Светлый вариант домика с зелёной крышей, лестницей и спокойной палитрой."
    },
    budka_8__toy: {
      name: "Яркий домик с лестницей",
      description: "Игрушечный цветной домик с голубой крышей, розовыми стенами и яркой подставкой."
    },
    budka_8__white: {
      name: "Белый домик с лестницей",
      description: "Белый домик с чёрной крышей, светлой лестницей и аккуратной подставкой."
    },
    kotik_1__base: {
      name: "Когтеточка с домиком",
      description: "Компактный кошачий комплекс с когтеточками, лежанкой и маленьким домиком."
    },
    kotik_1__second: {
      name: "Светлая когтеточка",
      description: "Светлый кошачий комплекс с домиком, лежанкой и несколькими уровнями."
    },
    kotik_2__base: {
      name: "Комплекс с лежанкой",
      description: "Кошачий комплекс с лежанкой наверху, домиком, лестницей и подвесной игрушкой."
    },
    kotik_2__second: {
      name: "Светлый комплекс с лежанкой",
      description: "Светлый кошачий комплекс с мягкой верхней лежанкой и круглым входом."
    },
    kotik_3__base: {
      name: "Двойной кошачий комплекс",
      description: "Светлый двухуровневый комплекс с двумя домиками и мягкими площадками."
    },
    kotik_4__base: {
      name: "Деревянный домик-башня",
      description: "Высокий деревянный домик-башня с площадками, лестницами и окошком."
    },
    kotik_4__second: {
      name: "Башня с площадками",
      description: "Деревянная башня с несколькими площадками, двумя лестницами и круглым входом."
    },
    kotik_4__third: {
      name: "Розовый домик-башня",
      description: "Розовый вариант башни с лестницами, площадками и уютным домиком."
    },
    kotik_5__base: {
      name: "Высокий игровой комплекс",
      description: "Многоуровневый кошачий комплекс с домиком, лежанками, лестницей и полками."
    },
    kotik_5__second: {
      name: "Светлый высокий комплекс",
      description: "Светлый высокий комплекс с домиком, несколькими площадками и мягкими лежанками."
    },
    kotik_6__base: {
      name: "Комплекс с голубой лежанкой",
      description: "Кошачий комплекс с круглым домиком, голубой лежанкой, полкой и подвесной игрушкой."
    },
    mat_1__base: {
      name: "Зелёная лежанка",
      description: "Круглая зелёная лежанка с мягкими подушками и маленькой декоративной подушечкой."
    },
    mat_1__second: {
      name: "Кремовая лежанка",
      description: "Светлая круглая лежанка с мягкой подушкой и маленькой косточкой."
    },
    mat_1__third: {
      name: "Клетчатая лежанка",
      description: "Круглая розовая лежанка с клетчатым бортиком и мягким светлым центром."
    },
    mat_1__fourth: {
      name: "Лежанка-пончик",
      description: "Мягкая лежанка в форме розового пончика с декоративной посыпкой."
    }
  },
  roof: {
    roof_1: {
      name: "Классическая крыша",
      description: "Спокойная базовая крыша для домика без лишнего декоративного акцента."
    },
    roof_2: {
      name: "Уютная крыша",
      description: "Более мягкий вариант крыши, который делает домик визуально теплее."
    }
  },
  wall: {
    wall_1: {
      name: "Светлые стены",
      description: "Базовый светлый вариант стен для спокойного деревянного домика."
    },
    wall_2: {
      name: "Тёплые стены",
      description: "Более насыщенный вариант стен с тёплым деревянным оттенком."
    }
  },
  frameLeft: {
    frame_left_1: {
      name: "Левая деревянная рамка",
      description: "Аккуратная левая рамка для фотографии в тёплом деревянном стиле."
    },
    frame_left_2: {
      name: "Левая светлая рамка",
      description: "Более светлая левая рамка для мягкого оформления фотографии."
    }
  },
  frameRight: {
    frame_right_1: {
      name: "Правая деревянная рамка",
      description: "Аккуратная правая рамка для фотографии в тёплом деревянном стиле."
    },
    frame_right_2: {
      name: "Правая светлая рамка",
      description: "Более светлая правая рамка для мягкого оформления фотографии."
    }
  },
  sign: {
    sign_1: {
      name: "Табличка с рыбкой",
      description: "Овальная деревянная табличка с маленькой рыбкой, подходит для спокойного природного акцента."
    },
    sign_2: {
      name: "Прямоугольная табличка с рыбкой",
      description: "Деревянная прямоугольная табличка с рыбкой и металлическими уголками."
    },
    sign_3: {
      name: "Табличка с косточкой",
      description: "Овальная деревянная табличка с белой косточкой, простой знак для верного друга."
    },
    sign_4: {
      name: "Прямоугольная табличка с косточкой",
      description: "Классическая деревянная табличка с косточкой и аккуратными креплениями."
    },
    sign_5: {
      name: "Табличка с солнышком",
      description: "Овальная табличка с улыбающимся солнцем, добавляет мемориалу тёплый светлый акцент."
    },
    sign_6: {
      name: "Прямоугольная табличка с солнышком",
      description: "Деревянная табличка с солнечным символом для доброго и яркого настроения."
    },
    sign_7: {
      name: "Табличка с облачком",
      description: "Овальная табличка с мягким облачком, спокойная деталь для нежной сцены."
    },
    sign_8: {
      name: "Прямоугольная табличка с облачком",
      description: "Деревянная табличка с белым облачком, лёгкий и тихий декоративный знак."
    },
    sign_9: {
      name: "Табличка с медалью",
      description: "Овальная табличка с медалью, символ важного места питомца в семье."
    },
    sign_10: {
      name: "Прямоугольная табличка с медалью",
      description: "Деревянная табличка с медалью на ленте, заметный знак благодарности."
    },
    sign_11: {
      name: "Табличка с теннисным мячом",
      description: "Овальная табличка с зелёным мячиком, напоминает о прогулках и игре."
    },
    sign_12: {
      name: "Прямоугольная табличка с теннисным мячом",
      description: "Деревянная табличка с теннисным мячом для памяти об активном питомце."
    }
  },
  mat: {
    mat_1: {
      name: "Коврик-звёздочка",
      description: "Мягкий коврик необычной формы со следом лапки и голубой окантовкой."
    },
    mat_2: {
      name: "Зелёный коврик в горошек",
      description: "Небольшой зелёный коврик с белым горошком, спокойная домашняя деталь."
    },
    mat_3: {
      name: "Клетчатый коврик",
      description: "Розово-белый клетчатый коврик с мягкими краями для уютного места у домика."
    },
    mat_4: {
      name: "Коврик-косточка",
      description: "Светлый коврик в форме косточки с тёплой оранжевой окантовкой."
    },
    mat_5: {
      name: "Голубой коврик с лапками",
      description: "Прямоугольный голубой коврик с рисунком следов, лёгкий и аккуратный."
    },
    mat_6: {
      name: "Синий коврик с косточкой",
      description: "Синий прямоугольный коврик с белой косточкой в центре."
    },
    mat_7: {
      name: "Коричневый коврик с лапкой",
      description: "Тёплый коричневый коврик со светлым следом лапы."
    },
    mat_8: {
      name: "Светлый коврик с рамкой",
      description: "Светлый прямоугольный коврик с клетчатой окантовкой и спокойным центром."
    },
    mat_9: {
      name: "Коврик-клубничка",
      description: "Яркий коврик в форме клубнички с маленьким цветком."
    },
    mat_10: {
      name: "Коврик-кед",
      description: "Голубой коврик в форме кеда, игривая деталь для живой сцены."
    },
    mat_11: {
      name: "Коврик-облачко",
      description: "Голубой коврик с облаками, луной и маленькими звёздами."
    },
    mat_12: {
      name: "Зелёная лежанка",
      description: "Круглая зелёная лежанка с мягкими подушками для уютного уголка."
    },
    mat_13: {
      name: "Кремовая лежанка",
      description: "Светлая круглая лежанка с мягким центром и маленькой косточкой."
    },
    mat_14: {
      name: "Розовая лежанка",
      description: "Круглая розовая лежанка с клетчатым бортиком и мягкой подушкой."
    },
    mat_15: {
      name: "Лежанка-пончик",
      description: "Забавная мягкая лежанка в форме розового пончика."
    }
  },
  bowlFood: {
    bowl_food_1: {
      name: "Персиковая миска с кормом",
      description: "Низкая персиковая миска, наполненная сухим кормом."
    },
    bowl_food_2: {
      name: "Белая миска с кормом",
      description: "Аккуратная белая миска с тёмным основанием и рыжим кормом."
    },
    bowl_food_3: {
      name: "Металлическая миска на подставке",
      description: "Металлическая миска с кормом на деревянной подставке со следом лапы."
    },
    bowl_food_4: {
      name: "Синяя миска с питомцами",
      description: "Синяя миска с рисунками животных и наполнением из сухого корма."
    },
    bowl_food_5: {
      name: "Оранжевая миска с косточкой",
      description: "Оранжевая миска с белой косточкой на боку и аккуратной порцией корма."
    },
    bowl_food_6: {
      name: "Серая миска на ножках",
      description: "Серая миска с кормом на деревянных ножках, выглядит устойчиво и тепло."
    },
    bowl_food_7: {
      name: "Белая миска на сиреневой ножке",
      description: "Светлая миска с кормом на мягкой сиреневой подставке."
    }
  },
  bowlWater: {
    bowl_water_1: {
      name: "Белая миска с косточкой",
      description: "Белая миска с голубой водой и жёлтой косточкой на передней части."
    },
    bowl_water_2: {
      name: "Металлическая миска с водой",
      description: "Квадратная металлическая миска с голубой водой и маленькой косточкой."
    },
    bowl_water_3: {
      name: "Салатовая миска-лапка",
      description: "Салатовая миска с водой, украшенная следом лапы и мягкими краями."
    },
    bowl_water_4: {
      name: "Синяя миска на ножках",
      description: "Глубокая синяя миска с водой на деревянных ножках."
    },
    bowl_water_5: {
      name: "Светлая каменная миска",
      description: "Минималистичная светлая миска с водой и мягкой округлой формой."
    },
    bowl_water_6: {
      name: "Белая миска на сиреневой ножке",
      description: "Светлая миска с водой на сиреневой подставке."
    },
    bowl_water_7: {
      name: "Лист с водой",
      description: "Миска в форме зелёного листа с прозрачной водой внутри."
    },
    bowl_water_8: {
      name: "Поилка с бутылью",
      description: "Автоматическая поилка с голубой бутылью и прозрачным основанием."
    },
    bowl_water_9: {
      name: "Большая поилка с бутылью",
      description: "Высокая автоматическая поилка с голубой бутылью для запаса воды."
    }
  }
};

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

const toPosixPath = (value) => value.split(path.sep).join("/");

const normalizeUserKey = (value) => value.trim().toLowerCase();

const serializeAllowedUsers = (allowedUsers) =>
  Array.isArray(allowedUsers) && allowedUsers.length > 0
    ? [...allowedUsers].map(normalizeUserKey).sort().join(",")
    : "";

const readFilesRecursive = (dirPath) => {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      return readFilesRecursive(entryPath);
    }
    return [entryPath];
  });
};

const readAllowedUsers = (categoryDirPath, filePath) => {
  const relativeDir = path.relative(categoryDirPath, path.dirname(filePath));
  if (!relativeDir || relativeDir === ".") {
    return undefined;
  }
  const segments = relativeDir.split(path.sep).filter(Boolean);
  const extraIndex = segments.indexOf(EXTRA_DIR_NAME);
  if (extraIndex === -1) {
    return undefined;
  }
  const usersSegment = segments[extraIndex + 1];
  if (!usersSegment) {
    return undefined;
  }
  const allowedUsers = usersSegment
    .split(SHARED_USER_SEPARATOR)
    .map(normalizeUserKey)
    .filter(Boolean);
  return allowedUsers.length > 0 ? allowedUsers : undefined;
};

const makeOptionItem = (id, name, description, allowedUsers) => ({
  id,
  name,
  description,
  ...(allowedUsers?.length ? { allowedUsers } : {})
});

const makeName = (category, id) => {
  if (category.naming === "environment") {
    const baseName = envNameMap[id] ?? humanize(id);
    return baseName;
  }
  const number = extractNumber(id);
  return number ? `${category.label} ${number}` : category.label;
};

const makeDescription = (category, id) => {
  const metadata = optionMetadataByCategory[category.key]?.[id];
  if (metadata?.description) {
    return metadata.description;
  }
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

const makeEnvironmentOption = (baseId, allowedUsers) => {
  const metadata = optionMetadataByCategory.environment?.[baseId];
  if (metadata) {
    return makeOptionItem(baseId, metadata.name, metadata.description, allowedUsers);
  }
  const number = extractNumber(baseId);
  const isNumericId = /^[0-9]+$/.test(baseId);
  const labelNumber = isNumericId ? baseId : number;
  const name =
    envNameMap[baseId] ??
    (isNumericId
      ? `Поверхность ${labelNumber}`
      : humanize(baseId));
  return makeOptionItem(baseId, name, "Автодобавлено", allowedUsers);
};

const readCategory = (category) => {
  const dirPath = path.join(ROOT, category.dir);
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  return readFilesRecursive(dirPath)
    .filter((filePath) => filePath.toLowerCase().endsWith(".glb"))
    .filter((filePath) => {
      const file = path.basename(filePath);
      if (!category.filePrefix) {
        return true;
      }
      return path.basename(file).startsWith(category.filePrefix);
    })
    .map((filePath) => {
      const file = path.basename(filePath);
      return {
        file,
        relativePath: toPosixPath(path.relative(dirPath, filePath)),
        id: toId(file, category.filePrefix),
        allowedUsers: readAllowedUsers(dirPath, filePath)
      };
    })
    .sort((a, b) => compareEntries(category, a, b));
};

const parseDirtModelFileName = (filePath) => {
  const id = path.basename(filePath, ".glb");
  const match = id.match(/^dirt_(\d+)(?:_([1-4]))?$/i);
  if (!match) {
    return { modelId: id, slot: null, sortNumber: Number.MAX_SAFE_INTEGER };
  }
  return {
    modelId: id,
    slot: match[2] ? Number(match[2]) : null,
    sortNumber: Number(match[1])
  };
};

const readDirtSlotModels = () => {
  const dirtRoot = path.join(ROOT, "dirt");
  if (!fs.existsSync(dirtRoot)) {
    return [];
  }
  const groups = [];
  const globalSlotsDir = path.join(dirtRoot, "slots");
  if (fs.existsSync(globalSlotsDir)) {
    groups.push({
      scope: "global",
      houseId: null,
      dirPath: globalSlotsDir,
      urlPrefix: "/models/dirt/slots/"
    });
  }
  fs.readdirSync(dirtRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => entry.name !== "slots")
    .forEach((entry) => {
      const slotsDir = path.join(dirtRoot, entry.name, "slots");
      if (!fs.existsSync(slotsDir)) {
        return;
      }
      groups.push({
        scope: "house",
        houseId: entry.name,
        dirPath: slotsDir,
        urlPrefix: `/models/dirt/${entry.name}/slots/`
      });
    });

  return groups
    .flatMap((group) =>
      readFilesRecursive(group.dirPath)
        .filter((filePath) => filePath.toLowerCase().endsWith(".glb"))
        .map((filePath) => {
          const parsed = parseDirtModelFileName(filePath);
          const relative = toPosixPath(path.relative(group.dirPath, filePath));
          return {
            id: group.houseId ? `${group.houseId}/${parsed.modelId}` : parsed.modelId,
            modelId: parsed.modelId,
            name:
              parsed.slot === null
                ? `Грязь ${
                    parsed.sortNumber === Number.MAX_SAFE_INTEGER
                      ? parsed.modelId
                      : parsed.sortNumber
                  }`
                : `Грязь ${parsed.sortNumber} · слот ${parsed.slot}`,
            url: `${group.urlPrefix}${relative}`,
            slot: parsed.slot,
            scope: group.scope,
            ...(group.houseId ? { houseId: group.houseId } : {}),
            sortNumber: parsed.sortNumber
          };
        })
    )
    .sort((a, b) => {
      const scopeOrder = a.scope.localeCompare(b.scope);
      if (scopeOrder !== 0) {
        return scopeOrder;
      }
      const houseOrder = (a.houseId ?? "").localeCompare(b.houseId ?? "");
      if (houseOrder !== 0) {
        return houseOrder;
      }
      const slotA = a.slot ?? 0;
      const slotB = b.slot ?? 0;
      if (slotA !== slotB) {
        return slotA - slotB;
      }
      if (a.sortNumber !== b.sortNumber) {
        return a.sortNumber - b.sortNumber;
      }
      return a.modelId.localeCompare(b.modelId);
    })
    .map(({ sortNumber, ...item }) => item);
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
    const url = `${environmentCategory.urlPrefix}${item.relativePath}`;
    if (season) {
      seasonalMap[baseId][season] = url;
    } else if (!seasonalMap[baseId].summer) {
      seasonalMap[baseId].summer = url;
    }
    const existingOption = optionMap.get(baseId);
    if (existingOption) {
      if (serializeAllowedUsers(existingOption.allowedUsers) !== serializeAllowedUsers(item.allowedUsers)) {
        throw new Error(
          `Environment option "${baseId}" mixes public and extra access. Keep all seasonal files in the same visibility scope.`
        );
      }
    } else {
      optionMap.set(baseId, makeEnvironmentOption(baseId, item.allowedUsers));
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
      const url = `${category.urlPrefix}${item.relativePath}`;
      if (modelMap[item.id] && modelMap[item.id] !== url) {
        throw new Error(
          `Duplicate model id "${item.id}" in category "${category.key}". Use unique file names inside the category, including extra user folders.`
        );
      }
      modelMap[item.id] = url;
      optionList.push(
        makeOptionItem(
          item.id,
          optionMetadataByCategory[category.key]?.[item.id]?.name ??
            makeName(category, item.id),
          makeDescription(category, item.id),
          item.allowedUsers
        )
      );
    });
    mappings[category.key] = modelMap;
    options[category.key] = optionList;
  });

const houseCategory = categories.find((category) => category.key === "house");
if (houseCategory) {
  const items = readCategory(houseCategory);
  const slotsMap = {};
  items.forEach((item) => {
    const filePath = path.join(ROOT, houseCategory.dir, item.relativePath);
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
const generatedDirtPath = path.resolve(process.cwd(), "lib", "dirt-models.generated.ts");

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
  allowedUsers?: readonly string[];
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

const dirtModelsFile = `// This file is auto-generated by scripts/generate-models.mjs. Do not edit manually.

export type GeneratedDirtModelOption = {
  id: string;
  modelId: string;
  name: string;
  url: string;
  slot: 1 | 2 | 3 | 4 | null;
  scope: "global" | "house";
  houseId?: string;
};

${formatExport("dirtModelOptionsGenerated", readDirtSlotModels())}
`;

fs.writeFileSync(generatedDirtPath, dirtModelsFile, "utf8");

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
