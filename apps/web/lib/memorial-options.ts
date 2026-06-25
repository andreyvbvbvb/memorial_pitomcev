import {
  environmentOptionsGenerated,
  houseOptionsGenerated,
  roofOptionsGenerated,
  wallOptionsGenerated,
  signOptionsGenerated,
  frameLeftOptionsGenerated,
  frameRightOptionsGenerated,
  matOptionsGenerated,
  bowlFoodOptionsGenerated,
  bowlWaterOptionsGenerated,
  partOptionGroupsGenerated
} from "./memorial-options.generated";

export type OptionItem = {
  id: string;
  name: string;
  description: string;
  allowedUsers?: readonly string[];
};

export const DEFAULT_OPTION: OptionItem = {
  id: "unknown",
  name: "Не выбрано",
  description: ""
};

export const environmentOptions: OptionItem[] = [...environmentOptionsGenerated];

export const houseOptions: OptionItem[] = [...houseOptionsGenerated];

export const roofOptions: OptionItem[] = [...roofOptionsGenerated];

export const wallOptions: OptionItem[] = [...wallOptionsGenerated];

export const signOptions: OptionItem[] = [
  { id: "none", name: "Без украшения", description: "Не добавлять элемент" },
  ...signOptionsGenerated
];

export const frameLeftOptions: OptionItem[] = [
  { id: "none", name: "Без рамки", description: "Не добавлять элемент" },
  ...frameLeftOptionsGenerated
];

export const frameRightOptions: OptionItem[] = [
  { id: "none", name: "Без рамки", description: "Не добавлять элемент" },
  ...frameRightOptionsGenerated
];

export const matOptions: OptionItem[] = [
  { id: "none", name: "Без коврика", description: "Не добавлять элемент" },
  ...matOptionsGenerated
];

export const bowlFoodOptions: OptionItem[] = [
  { id: "none", name: "Без миски (еда)", description: "Не добавлять элемент" },
  ...bowlFoodOptionsGenerated
];

export const bowlWaterOptions: OptionItem[] = [
  { id: "none", name: "Без миски (вода)", description: "Не добавлять элемент" },
  ...bowlWaterOptionsGenerated
];

const withNoneOption = (options: readonly OptionItem[], label: string) => [
  { id: "none", name: `Без ${label.toLowerCase()}`, description: "Не добавлять элемент" },
  ...options
];

export const partOptionsByCategory: Record<string, OptionItem[]> = {
  ...Object.fromEntries(
    Object.entries(partOptionGroupsGenerated).map(([category, options]) => [
      category,
      withNoneOption(options as readonly OptionItem[], category)
    ])
  ),
  roof: roofOptions,
  wall: wallOptions,
  sign: signOptions,
  frame_left: frameLeftOptions,
  frame_right: frameRightOptions,
  mat: matOptions,
  bowl_food: bowlFoodOptions,
  bowl_water: bowlWaterOptions
};

export const getPartOptions = (category?: string | null): OptionItem[] =>
  category ? (partOptionsByCategory[category] ?? []) : [];

export const frameOptions: OptionItem[] = [
  { id: "wood", name: "Дерево", description: "Естественный тёплый тон" },
  { id: "gold", name: "Золото", description: "Нарядный и светлый" },
  { id: "stone", name: "Камень", description: "Строгий и спокойный" }
];

export const ambienceOptions: OptionItem[] = [
  { id: "morning", name: "Утро", description: "Мягкий свет" },
  { id: "day", name: "День", description: "Яркое освещение" },
  { id: "sunset", name: "Закат", description: "Тёплые оттенки" },
  { id: "night", name: "Ночь", description: "Звёздное небо" }
];

export const normalizeModelUserKey = (value?: string | null) =>
  value?.trim().toLowerCase() ?? "";

export const optionAllowedForUser = (option: OptionItem, username?: string | null) => {
  if (!option.allowedUsers?.length) {
    return true;
  }
  const normalizedUsername = normalizeModelUserKey(username);
  if (!normalizedUsername) {
    return false;
  }
  return option.allowedUsers.some(
    (allowedUser) => normalizeModelUserKey(allowedUser) === normalizedUsername
  );
};

export const filterOptionsForUser = (
  options: OptionItem[],
  username?: string | null
) => options.filter((option) => optionAllowedForUser(option, username));

export const optionById = (options: OptionItem[], id?: string): OptionItem =>
  options.find((item) => item.id === id) ?? options[0] ?? DEFAULT_OPTION;
