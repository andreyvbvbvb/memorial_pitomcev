export type OptionItem = {
  id: string;
  name: string;
  description: string;
};

export const DEFAULT_OPTION: OptionItem = {
  id: "unknown",
  name: "Не выбрано",
  description: ""
};

export const environmentOptions: OptionItem[] = [
  { id: "summer", name: "Лето", description: "Светлая зелёная поверхность" },
  { id: "summer_1", name: "Лето 2", description: "Альтернативная летняя поверхность" },
  { id: "spring", name: "Весна", description: "Весенняя поверхность" },
  { id: "autumn", name: "Осень", description: "Осенняя поверхность" },
  { id: "winter", name: "Зима", description: "Снежная поверхность" },
  { id: "winter_1", name: "Зима 2", description: "Альтернативная зимняя поверхность" }
];

export const houseOptions: OptionItem[] = [
  { id: "budka_1", name: "Будка 1", description: "Базовый домик для собаки" },
  { id: "budka_2", name: "Будка 2", description: "Альтернативный домик для собаки" }
];

export const roofOptions: OptionItem[] = [
  { id: "roof_1", name: "Крыша 1", description: "Базовый вариант" },
  { id: "roof_2", name: "Крыша 2", description: "Альтернативный вариант" }
];

export const wallOptions: OptionItem[] = [
  { id: "wall_1", name: "Стены 1", description: "Базовый вариант" },
  { id: "wall_2", name: "Стены 2", description: "Альтернативный вариант" }
];

export const signOptions: OptionItem[] = [
  { id: "none", name: "Без украшения", description: "Не добавлять элемент" },
  { id: "sign_1", name: "Украшение 1", description: "Вариант 1" },
  { id: "sign_2", name: "Украшение 2", description: "Вариант 2" }
];

export const frameLeftOptions: OptionItem[] = [
  { id: "none", name: "Без рамки", description: "Не добавлять элемент" },
  { id: "frame_left_1", name: "Рамка слева 1", description: "Вариант 1" },
  { id: "frame_left_2", name: "Рамка слева 2", description: "Вариант 2" }
];

export const frameRightOptions: OptionItem[] = [
  { id: "none", name: "Без рамки", description: "Не добавлять элемент" },
  { id: "frame_right_1", name: "Рамка справа 1", description: "Вариант 1" },
  { id: "frame_right_2", name: "Рамка справа 2", description: "Вариант 2" }
];

export const matOptions: OptionItem[] = [
  { id: "none", name: "Без коврика", description: "Не добавлять элемент" },
  { id: "mat_1", name: "Коврик 1", description: "Вариант 1" },
  { id: "mat_2", name: "Коврик 2", description: "Вариант 2" }
];

export const bowlFoodOptions: OptionItem[] = [
  { id: "none", name: "Без миски (еда)", description: "Не добавлять элемент" },
  { id: "bowl_food_1", name: "Миска еды 1", description: "Вариант 1" },
  { id: "bowl_food_2", name: "Миска еды 2", description: "Вариант 2" },
  { id: "bowl_food_3", name: "Миска еды 3", description: "Вариант 3" }
];

export const bowlWaterOptions: OptionItem[] = [
  { id: "none", name: "Без миски (вода)", description: "Не добавлять элемент" },
  { id: "bowl_water_1", name: "Миска воды 1", description: "Вариант 1" },
  { id: "bowl_water_2", name: "Миска воды 2", description: "Вариант 2" }
];

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

export const optionById = (options: OptionItem[], id?: string): OptionItem =>
  options.find((item) => item.id === id) ?? options[0] ?? DEFAULT_OPTION;
