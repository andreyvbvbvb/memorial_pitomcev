import type { OptionItem } from "./memorial-options";

export const HOUSE_VARIANT_SEPARATOR = "__";

export type HouseVariant = {
  id: string;
  baseId: string;
  textureId: string | null;
};

const extractNumber = (value: string) => {
  const match = value.match(/_(\d+)$/);
  return match ? Number(match[1]) : null;
};

const humanize = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());

const houseBaseMetadata: Record<string, { name: string; description: string }> = {
  budka_1: {
    name: "Классическая будка",
    description: "Небольшая деревянная будка на настиле с тёмной черепичной крышей."
  },
  budka_2: {
    name: "Домик с кустиками",
    description: "Светлый деревянный домик на платформе с крышей и зелёными кустиками у входа."
  },
  budka_3: {
    name: "Домик с террасой",
    description: "Уютный домик с ограждением, лестницей и небольшой открытой террасой."
  },
  budka_4: {
    name: "Будка с крыльцом",
    description: "Деревянная будка с крыльцом, лесенкой и маленьким цветочным акцентом."
  },
  budka_5: {
    name: "Будка с арочным входом",
    description: "Массивная деревянная будка с глубоким арочным входом и объёмной крышей."
  },
  budka_6: {
    name: "Домик на ножках",
    description: "Приподнятый домик с окнами, крышей и аккуратной лестницей."
  },
  budka_7: {
    name: "Мини-будка",
    description: "Компактная будка на квадратной подставке для спокойной лаконичной сцены."
  },
  budka_8: {
    name: "Домик с лестницей",
    description: "Приподнятый деревянный домик с лестницей, перилами и тёмной крышей."
  },
  kotik_1: {
    name: "Когтеточка с домиком",
    description: "Компактный кошачий комплекс с когтеточками, лежанкой и маленьким домиком."
  },
  kotik_2: {
    name: "Комплекс с лежанкой",
    description: "Кошачий комплекс с лежанкой наверху, домиком, лестницей и подвесной игрушкой."
  },
  kotik_3: {
    name: "Двойной кошачий комплекс",
    description: "Светлый двухуровневый комплекс с двумя домиками и мягкими площадками."
  },
  kotik_4: {
    name: "Домик-башня",
    description: "Высокий деревянный домик-башня с площадками, лестницами и окошком."
  },
  kotik_5: {
    name: "Высокий игровой комплекс",
    description: "Многоуровневый кошачий комплекс с домиком, лежанками, лестницей и полками."
  },
  kotik_6: {
    name: "Комплекс с голубой лежанкой",
    description: "Кошачий комплекс с круглым домиком, голубой лежанкой, полкой и подвесной игрушкой."
  },
  mat_1: {
    name: "Круглая лежанка",
    description: "Мягкая круглая лежанка с подушками для тихого уютного места рядом с мемориалом."
  }
};

const houseTextureMetadataByVariant: Record<string, { name: string; description: string }> = {
  budka_1__base: {
    name: "Серая крыша",
    description: "Базовый вариант с тёплым деревом и серой черепичной крышей."
  },
  budka_2__base: {
    name: "Голубая крыша",
    description: "Светлый деревянный вариант с голубой крышей."
  },
  budka_2__second: {
    name: "Синяя крыша",
    description: "Более яркий вариант с насыщенной синей крышей."
  },
  budka_3__base: {
    name: "Терраса",
    description: "Базовый вариант домика с ограждением, лестницей и открытой террасой."
  },
  budka_4__base: {
    name: "Красная крыша",
    description: "Деревянная будка с красной черепичной крышей и крыльцом."
  },
  budka_5__base: {
    name: "Тёмная крыша",
    description: "Светлое дерево с тёмной объёмной крышей."
  },
  budka_5__second: {
    name: "Коричневая крыша",
    description: "Более тёплый коричневый вариант будки."
  },
  budka_6__base: {
    name: "Зелёная крыша",
    description: "Приподнятый домик с зелёной крышей, окнами и лестницей."
  },
  budka_7__base: {
    name: "Светлая",
    description: "Компактная светлая будка на простой подставке."
  },
  budka_7__brown: {
    name: "Тёмная",
    description: "Мини-будка с тёмным деревом и графитовой крышей."
  },
  budka_7__soso: {
    name: "Досчатая",
    description: "Светлая мини-будка на тёплой досчатой подставке."
  },
  budka_7__tuntun: {
    name: "Розовая",
    description: "Небольшая будка с розовыми стенами и мягкой светлой крышей."
  },
  budka_7__white: {
    name: "Белая",
    description: "Белая мини-будка с чёрной крышей на серой подставке."
  },
  budka_8__base: {
    name: "Тёмная крыша",
    description: "Базовый вариант домика с лестницей и тёмной крышей."
  },
  budka_8__brown: {
    name: "Коричневая",
    description: "Тёплая коричневая отделка домика с лестницей."
  },
  budka_8__stone: {
    name: "Светлая",
    description: "Светлый вариант с зелёной крышей и спокойной палитрой."
  },
  budka_8__toy: {
    name: "Игрушечная",
    description: "Яркая цветная текстура с голубой крышей и розовыми стенами."
  },
  budka_8__white: {
    name: "Белая",
    description: "Белый вариант домика с чёрной крышей и светлой лестницей."
  },
  kotik_1__base: {
    name: "Тёплая",
    description: "Базовая тёплая отделка когтеточного домика."
  },
  kotik_1__second: {
    name: "Светлая",
    description: "Светлый вариант когтеточного комплекса."
  },
  kotik_2__base: {
    name: "Бежевая",
    description: "Бежевый комплекс с верхней лежанкой, лестницей и подвесной игрушкой."
  },
  kotik_2__second: {
    name: "Светлая",
    description: "Светлый вариант комплекса с круглым входом и мягкой верхней лежанкой."
  },
  kotik_3__base: {
    name: "Двойная",
    description: "Светлый двойной комплекс с двумя домиками и мягкими площадками."
  },
  kotik_4__base: {
    name: "Деревянная",
    description: "Базовая деревянная башня с тёплой крышей."
  },
  kotik_4__second: {
    name: "Открытая",
    description: "Вариант башни с более открытыми площадками."
  },
  kotik_4__third: {
    name: "Розовая",
    description: "Розовый вариант домика-башни."
  },
  kotik_5__base: {
    name: "Тёплая",
    description: "Базовый многоуровневый комплекс с тёплой отделкой."
  },
  kotik_5__second: {
    name: "Светлая",
    description: "Светлый высокий комплекс с мягкими лежанками."
  },
  kotik_6__base: {
    name: "Голубая",
    description: "Комплекс с голубой лежанкой, круглым входом и подвесной игрушкой."
  },
  mat_1__base: {
    name: "Зелёная",
    description: "Зелёная круглая лежанка с мягкими подушками."
  },
  mat_1__second: {
    name: "Кремовая",
    description: "Светлая лежанка с маленькой косточкой."
  },
  mat_1__third: {
    name: "Клетчатая",
    description: "Розовая лежанка с клетчатым бортиком."
  },
  mat_1__fourth: {
    name: "Пончик",
    description: "Мягкая лежанка в форме розового пончика."
  }
};

export const splitHouseVariantId = (id?: string | null): HouseVariant => {
  const safeId = id ?? "";
  if (!safeId) {
    return { id: "", baseId: "", textureId: null };
  }
  const separatorIndex = safeId.indexOf(HOUSE_VARIANT_SEPARATOR);
  if (separatorIndex === -1) {
    return { id: safeId, baseId: safeId, textureId: null };
  }
  const baseId = safeId.slice(0, separatorIndex);
  const textureId = safeId.slice(separatorIndex + HOUSE_VARIANT_SEPARATOR.length) || null;
  return { id: safeId, baseId, textureId };
};

export const buildHouseVariantId = (baseId: string, textureId?: string | null) => {
  const cleanBase = baseId?.trim?.() ?? "";
  const cleanTexture = textureId?.trim?.() ?? "";
  if (!cleanBase) {
    return "";
  }
  if (!cleanTexture || cleanTexture === "default" || cleanTexture === "base") {
    return `${cleanBase}${HOUSE_VARIANT_SEPARATOR}base`;
  }
  return `${cleanBase}${HOUSE_VARIANT_SEPARATOR}${cleanTexture}`;
};

export const makeHouseBaseName = (baseId: string) => {
  const metadata = houseBaseMetadata[baseId];
  if (metadata) {
    return metadata.name;
  }
  const number = extractNumber(baseId);
  const lower = baseId.toLowerCase();
  const withNumber = (label: string) => (number !== null ? `${label} ${number}` : label);
  if (lower.startsWith("budka")) {
    return withNumber("Будка");
  }
  if (lower.startsWith("kotik")) {
    return withNumber("Котик");
  }
  if (lower.startsWith("mat")) {
    return withNumber("Матрас");
  }
  if (number !== null) {
    return `Домик ${number}`;
  }
  const human = humanize(baseId);
  return human || "Домик";
};

export const makeHouseBaseDescription = (baseId: string) =>
  houseBaseMetadata[baseId]?.description ?? "";

export const makeHouseTextureName = (
  textureId: string | null,
  variantId?: string | null
) => {
  const metadata = variantId ? houseTextureMetadataByVariant[variantId] : null;
  if (metadata) {
    return metadata.name;
  }
  if (!textureId || textureId === "default" || textureId === "base") {
    return "Базовая";
  }
  return humanize(textureId);
};

export const makeHouseTextureDescription = (variantId?: string | null) =>
  variantId ? houseTextureMetadataByVariant[variantId]?.description ?? "" : "";

export type HouseVariantOption = OptionItem & HouseVariant;

export type HouseVariantGroup = {
  baseOptions: OptionItem[];
  textureOptionsByBase: Record<string, OptionItem[]>;
  defaultVariantByBase: Record<string, string>;
};

export const buildHouseVariantGroup = (houseOptions: OptionItem[]): HouseVariantGroup => {
  const variants: HouseVariantOption[] = houseOptions.map((option) => {
    const parsed = splitHouseVariantId(option.id);
    return { ...option, ...parsed };
  });

  const variantsByBase: Record<string, HouseVariantOption[]> = {};
  variants.forEach((variant) => {
    if (!variantsByBase[variant.baseId]) {
      variantsByBase[variant.baseId] = [];
    }
    const list = variantsByBase[variant.baseId];
    if (list) {
      list.push(variant);
    } else {
      variantsByBase[variant.baseId] = [variant];
    }
  });

  Object.values(variantsByBase).forEach((list) => {
    list.sort((a, b) => {
      const aIsDefault = !a.textureId || a.textureId === "default" || a.textureId === "base";
      const bIsDefault = !b.textureId || b.textureId === "default" || b.textureId === "base";
      if (aIsDefault !== bIsDefault) {
        return aIsDefault ? -1 : 1;
      }
      return (a.textureId ?? "").localeCompare(b.textureId ?? "");
    });
  });

  const baseOptionsMap = new Map<string, OptionItem>();
  Object.keys(variantsByBase).forEach((baseId) => {
    baseOptionsMap.set(baseId, {
      id: baseId,
      name: makeHouseBaseName(baseId),
      description: makeHouseBaseDescription(baseId)
    });
  });

  const baseOptions = Array.from(baseOptionsMap.values()).sort((a, b) => {
    const aNum = extractNumber(a.id);
    const bNum = extractNumber(b.id);
    if (aNum !== null && bNum !== null && aNum !== bNum) {
      return aNum - bNum;
    }
    return a.id.localeCompare(b.id);
  });

  const textureOptionsByBase: Record<string, OptionItem[]> = {};
  const defaultVariantByBase: Record<string, string> = {};

  Object.entries(variantsByBase).forEach(([baseId, list]) => {
    textureOptionsByBase[baseId] = list.map((variant) => ({
      id: variant.id,
      name: makeHouseTextureName(variant.textureId, variant.id),
      description: makeHouseTextureDescription(variant.id)
    }));
    defaultVariantByBase[baseId] = list[0]?.id ?? baseId;
  });

  return { baseOptions, textureOptionsByBase, defaultVariantByBase };
};
