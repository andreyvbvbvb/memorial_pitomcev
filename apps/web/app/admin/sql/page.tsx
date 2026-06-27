"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "../../../lib/config";
import {
  canAccessAdmin,
  canManageAdmins,
  type AccessLevel,
} from "../../../lib/access";
import { resolveGiftIconUrl } from "../../../lib/gifts";
import {
  bowlFoodOptions,
  bowlWaterOptions,
  environmentOptions,
  frameLeftOptions,
  frameRightOptions,
  houseOptions,
  matOptions,
  roofOptions,
  signOptions,
  wallOptions,
  type OptionItem,
} from "../../../lib/memorial-options";
import {
  resolveBowlFoodModel,
  resolveBowlWaterModel,
  resolveEnvironmentModel,
  resolveFrameLeftModel,
  resolveFrameRightModel,
  resolveHouseModel,
  resolveMatModel,
  resolveRoofModel,
  resolveSignModel,
  resolveWallModel,
} from "../../../lib/memorial-models";
import ErrorToast from "../../../components/ErrorToast";
import DirtModelPreview from "../../../components/admin/DirtModelPreview";
import SkyTuningPreview from "../../../components/admin/SkyTuningPreview";

const QUICK_QUERIES = [
  {
    label: "Пользователи (10)",
    query:
      'SELECT id, email, login, "coinBalance", "createdAt" FROM "User" ORDER BY "createdAt" DESC LIMIT 10;',
  },
  {
    label: "Питомцы (10)",
    query:
      'SELECT id, name, "ownerId", "createdAt", "isPublic" FROM "Pet" ORDER BY "createdAt" DESC LIMIT 10;',
  },
  {
    label: "Мемориалы (10)",
    query:
      'SELECT id, "petId", "environmentId", "houseId", "createdAt" FROM "Memorial" ORDER BY "createdAt" DESC LIMIT 10;',
  },
  {
    label: "Маркеры (10)",
    query:
      'SELECT id, "petId", lat, lng, "markerStyle", "createdAt" FROM "MapMarker" ORDER BY "createdAt" DESC LIMIT 10;',
  },
  {
    label: "Фото (10)",
    query:
      'SELECT id, "petId", url, "sortOrder", "createdAt" FROM "PetPhoto" ORDER BY "createdAt" DESC LIMIT 10;',
  },
  {
    label: "Подарки (10)",
    query:
      'SELECT id, code, name, description, price, "createdAt" FROM "GiftCatalog" ORDER BY "createdAt" DESC LIMIT 10;',
  },
  {
    label: "Размещения подарков (10)",
    query:
      'SELECT id, "petId", "giftId", "ownerId", "slotName", "placedAt", "expiresAt" FROM "GiftPlacement" ORDER BY "placedAt" DESC LIMIT 10;',
  },
] as const;

type LoadTestPreset = {
  label: string;
  totalRequests: number;
  concurrency: number;
  multiplier?: number;
};

type SyntheticUserPreset = {
  label: string;
  virtualUsers: number;
  durationMs: number;
  multiplier?: number;
};

const EXTREME_TEST_MULTIPLIERS = [5, 10, 50, 100] as const;
const HEAVIEST_LOAD_TEST = { totalRequests: 250, concurrency: 20 };
const HEAVIEST_SYNTHETIC_TEST = { virtualUsers: 100, durationMs: 45_000 };

const LOAD_TEST_PRESETS: LoadTestPreset[] = [
  { label: "Лёгкий", totalRequests: 30, concurrency: 5 },
  { label: "Средний", totalRequests: 100, concurrency: 10 },
  { label: "Тяжёлый", ...HEAVIEST_LOAD_TEST },
  ...EXTREME_TEST_MULTIPLIERS.map((multiplier) => ({
    label: `Экстремальный ×${multiplier}`,
    totalRequests: HEAVIEST_LOAD_TEST.totalRequests * multiplier,
    concurrency: HEAVIEST_LOAD_TEST.concurrency * multiplier,
    multiplier,
  })),
];

const SYNTHETIC_USER_PRESETS: SyntheticUserPreset[] = [
  { label: "20 VU", virtualUsers: 20, durationMs: 25_000 },
  { label: "50 VU", virtualUsers: 50, durationMs: 35_000 },
  { label: "100 VU", ...HEAVIEST_SYNTHETIC_TEST },
  ...EXTREME_TEST_MULTIPLIERS.map((multiplier) => ({
    label: `${HEAVIEST_SYNTHETIC_TEST.virtualUsers * multiplier} VU · ×${multiplier}`,
    virtualUsers: HEAVIEST_SYNTHETIC_TEST.virtualUsers * multiplier,
    durationMs: HEAVIEST_SYNTHETIC_TEST.durationMs,
    multiplier,
  })),
];

const SYNTHETIC_SCENARIOS = [
  { id: "map", label: "Карта", weight: 40 },
  { id: "myPets", label: "Мои питомцы", weight: 25 },
  { id: "memorial", label: "Страница мемориала", weight: 20 },
  { id: "gift", label: "Дарение подарка", weight: 10 },
  { id: "edit", label: "Редактирование", weight: 5 },
] as const;

const FONT_PREVIEW_OPTIONS = [
  {
    id: "inter",
    label: "Inter",
    badge: "Webfont",
    family: "var(--font-inter)",
    note: "Нейтральный интерфейсный webfont. Оставлен для сравнения с текущим шрифтом сайта.",
  },
  {
    id: "manrope",
    label: "Manrope",
    badge: "Webfont",
    family: "var(--font-manrope)",
    note: "Более мягкий и широкий гротеск, хорошо подходит для интерфейсов и крупной кириллицы.",
  },
  {
    id: "roboto",
    label: "Roboto",
    badge: "Android-like",
    family: "var(--font-roboto)",
    note: "Похож на стандартный Android-шрифт, но здесь загружается как webfont и одинаково работает на всех устройствах.",
  },
  {
    id: "nunito",
    label: "Nunito Sans",
    badge: "Мягкий",
    family: "var(--font-nunito)",
    note: "Более дружелюбный округлый вариант. Может лучше смотреться в карточках и подсказках.",
  },
  {
    id: "rubik",
    label: "Rubik",
    badge: "Плотный",
    family: "var(--font-rubik)",
    note: "Компактный webfont с выраженными формами. Удобен для кнопок и коротких заголовков.",
  },
  {
    id: "roboto-condensed",
    label: "Roboto Condensed",
    badge: "Сжатый",
    family: "var(--font-roboto-condensed)",
    note: "Самый близкий к Roboto вариант, но уже по ширине. Подходит, когда нужно больше текста в кнопках и панелях.",
  },
  {
    id: "noto-sans",
    label: "Noto Sans",
    badge: "Текущий",
    family: "var(--font-ui)",
    note: "Основной шрифт сайта. Загружается как webfont через Next, поэтому не зависит от San Francisco на iPhone или Roboto на Android.",
  },
  {
    id: "pt-sans-narrow",
    label: "PT Sans Narrow",
    badge: "Узкий",
    family: "var(--font-pt-sans-narrow)",
    note: "Сжатый кириллический webfont. Может быть полезен для компактных кнопок, но крупные заголовки лучше проверять отдельно.",
  },
  {
    id: "source-sans",
    label: "Source Sans 3",
    badge: "Мягкий",
    family: "var(--font-source-sans)",
    note: "Мягкий интерфейсный шрифт с хорошей читаемостью. Менее плотный, чем Roboto Condensed, но спокойнее визуально.",
  },
  {
    id: "onest",
    label: "Onest",
    badge: "Современный",
    family: "var(--font-onest)",
    note: "Современный кириллический webfont: компактный, но не слишком жёсткий. Хорошо подходит для мобильного UI.",
  },
  {
    id: "commissioner",
    label: "Commissioner",
    badge: "Гибкий",
    family: "var(--font-commissioner)",
    note: "Плотный и аккуратный гротеск с мягкими формами. Хорош для интерфейса, где нужно сохранить дружелюбный тон.",
  },
  {
    id: "system",
    label: "Системный стек",
    badge: "Сравнение",
    family:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
    note: "Только для сравнения: на iPhone будет ближе к San Francisco, на Android — к Roboto, поэтому вид отличается.",
  },
] as const;

type FontPreviewId = (typeof FONT_PREVIEW_OPTIONS)[number]["id"];

const MODEL_METADATA_GROUPS = [
  {
    category: "environment",
    label: "Поверхности",
    itemLabel: "Поверхность",
    options: environmentOptions,
    resolveModelUrl: (id?: string | null) => resolveEnvironmentModel(id, "summer"),
    resolveImageUrl: (id: string) => `/memorial/options/environment/${id}.png`,
  },
  {
    category: "house",
    label: "Домики",
    itemLabel: "Домик",
    options: houseOptions,
    resolveModelUrl: resolveHouseModel,
    resolveImageUrl: (id: string) => `/memorial/options/house-texture/${id}.png`,
  },
  {
    category: "roof",
    label: "Крыши",
    itemLabel: "Крыша",
    options: roofOptions,
    resolveModelUrl: resolveRoofModel,
    resolveImageUrl: () => null,
  },
  {
    category: "wall",
    label: "Стены",
    itemLabel: "Стена",
    options: wallOptions,
    resolveModelUrl: resolveWallModel,
    resolveImageUrl: () => null,
  },
  {
    category: "sign",
    label: "Украшения",
    itemLabel: "Украшение",
    options: signOptions,
    resolveModelUrl: resolveSignModel,
    resolveImageUrl: (id: string) => `/memorial/options/sign/${id}.png`,
  },
  {
    category: "frameLeft",
    label: "Левые рамки",
    itemLabel: "Левая рамка",
    options: frameLeftOptions,
    resolveModelUrl: resolveFrameLeftModel,
    resolveImageUrl: () => null,
  },
  {
    category: "frameRight",
    label: "Правые рамки",
    itemLabel: "Правая рамка",
    options: frameRightOptions,
    resolveModelUrl: resolveFrameRightModel,
    resolveImageUrl: () => null,
  },
  {
    category: "mat",
    label: "Коврики",
    itemLabel: "Коврик",
    options: matOptions,
    resolveModelUrl: resolveMatModel,
    resolveImageUrl: (id: string) => `/memorial/options/mat/${id}.png`,
  },
  {
    category: "bowlFood",
    label: "Миски с едой",
    itemLabel: "Миска с едой",
    options: bowlFoodOptions,
    resolveModelUrl: resolveBowlFoodModel,
    resolveImageUrl: (id: string) => `/memorial/options/bowl-food/${id}.png`,
  },
  {
    category: "bowlWater",
    label: "Миски с водой",
    itemLabel: "Миска с водой",
    options: bowlWaterOptions,
    resolveModelUrl: resolveBowlWaterModel,
    resolveImageUrl: (id: string) => `/memorial/options/bowl-water/${id}.png`,
  },
] as const satisfies readonly {
  category: string;
  label: string;
  itemLabel: string;
  options: OptionItem[];
  resolveModelUrl: (id?: string | null) => string | null | undefined;
  resolveImageUrl: (id: string) => string | null;
}[];

const MODEL_METADATA_GROUP_BY_CATEGORY = new Map<
  string,
  (typeof MODEL_METADATA_GROUPS)[number]
>(MODEL_METADATA_GROUPS.map((group) => [group.category, group]));

const MODEL_PLACEHOLDER_ICON =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'><rect width='128' height='128' rx='22' fill='%23f7f1ee'/><path d='M28 83V51l36-22 36 22v32L64 104 28 83z' fill='%23d3a27f'/><path d='M44 56l20-12 20 12v20L64 88 44 76V56z' fill='%23fff8f3'/></svg>";

type SqlResult = {
  type: "select" | "delete" | "update";
  rowCount?: number;
  affected?: number | string;
  rows?: unknown;
};

type SchemaColumn = {
  name: string;
  type: string;
  nullable: boolean;
};

type SchemaTable = {
  name: string;
  columns: SchemaColumn[];
};

type LoadingTip = {
  id: string;
  text: string;
  isActive: boolean;
  createdAt?: string;
};

type SiteBanner = {
  id: string;
  text: string;
  isActive: boolean;
  updatedAt?: string;
};

type MemorialPlanPrice = {
  years: number;
  price: number;
  updatedAt?: string;
};

type MemorialPublicationMode = {
  freeLifetime: boolean;
};

type GiftPrice = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  price: number;
  modelUrl: string;
};

type ModelMetadataItem = {
  id?: string;
  category: string;
  modelId: string;
  name: string;
  description: string;
  modelUrl: string | null;
  imageUrl: string | null;
};

type BulkAccountRow = {
  login: string;
  email: string;
  password: string;
  initialBalance: number;
};

type NewsPost = {
  id: string;
  title: string;
  body: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
};

type DocumentRevision = {
  id: string;
  documentType: "offer" | "politics" | string;
  title: string;
  fileUrl: string;
  fileName: string;
  createdAt: string;
};

type AccessUser = {
  id: string;
  email: string;
  login?: string | null;
  role: "USER" | "ADMIN";
  accessLevel: AccessLevel;
  isOwner: boolean;
  maxMemorials: number;
  memorialCount: number;
  createdAt?: string;
};

type LoadProbeResponse = {
  ok: boolean;
  dbMs: number;
  serverMs: number;
  at: string;
};

type LoadTestProgress = {
  label: string;
  totalRequests: number;
  concurrency: number;
  completed: number;
  okCount: number;
  failCount: number;
};

type LoadTestSummary = LoadTestProgress & {
  totalDurationMs: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
  minMs: number;
  requestsPerSecond: number;
  avgServerMs: number | null;
  p95ServerMs: number | null;
  wasAborted: boolean;
};

type SyntheticScenarioId = (typeof SYNTHETIC_SCENARIOS)[number]["id"];

type SyntheticScenarioCounts = Record<SyntheticScenarioId, number>;

type SyntheticAuthUser = {
  id: string;
};

type SyntheticMarker = {
  petId: string;
};

type SyntheticPetRecord = {
  id: string;
  ownerId?: string | null;
};

type SyntheticRunProgress = {
  label: string;
  virtualUsers: number;
  durationMs: number;
  elapsedMs: number;
  activeUsers: number;
  completedFlows: number;
  totalRequests: number;
  okCount: number;
  failCount: number;
  scenarioCounts: SyntheticScenarioCounts;
};

type SyntheticRunSummary = Omit<
  SyntheticRunProgress,
  "elapsedMs" | "activeUsers"
> & {
  actualDurationMs: number;
  avgRequestMs: number;
  p95RequestMs: number;
  maxRequestMs: number;
  avgFlowMs: number;
  p95FlowMs: number;
  flowsPerMinute: number;
  requestsPerSecond: number;
  wasAborted: boolean;
};

const buildSelectQuery = (tableName: string, limit = 50) =>
  `SELECT * FROM "${tableName}" LIMIT ${limit};`;

const buildCountQuery = (tableName: string) =>
  `SELECT count(*) FROM "${tableName}";`;
const escapeSqlLiteral = (value: string) => value.replace(/'/g, "''");

const getAverage = (values: number[]) => {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const getPercentile = (values: number[], percentile: number) => {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1),
  );
  return sorted[index] ?? 0;
};

const formatMs = (value: number | null) =>
  value === null ? "—" : `${value.toFixed(value >= 100 ? 0 : 1)} мс`;

const formatPlanYears = (years: number) => {
  if (years === 0) {
    return "Навсегда";
  }
  if (years === 1) {
    return "1 год";
  }
  return `${years} года`;
};

const modelMetadataKey = (category: string, modelId: string) =>
  `${category}:${modelId}`;

const buildModelMetadataDefaults = (): ModelMetadataItem[] =>
  MODEL_METADATA_GROUPS.flatMap((group) =>
    group.options
      .filter((option) => option.id !== "none")
      .map((option) => ({
        category: group.category,
        modelId: option.id,
        name: option.name,
        description: option.description,
        modelUrl: group.resolveModelUrl(option.id) ?? null,
        imageUrl: group.resolveImageUrl(option.id),
      })),
  );

const mergeModelMetadataItems = (
  savedItems: ModelMetadataItem[],
): ModelMetadataItem[] => {
  const savedByKey = new Map(
    savedItems.map((item) => [
      modelMetadataKey(item.category, item.modelId),
      item,
    ]),
  );
  return buildModelMetadataDefaults().map((defaults) => {
    const saved = savedByKey.get(
      modelMetadataKey(defaults.category, defaults.modelId),
    );
    return saved
      ? {
          ...defaults,
          id: saved.id,
          name: saved.name,
          description: saved.description ?? "",
          imageUrl: defaults.imageUrl,
        }
      : defaults;
  });
};

const isAbortError = (value: unknown) =>
  value instanceof DOMException && value.name === "AbortError";

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timeout = window.setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timeout);
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };
    const cleanup = () => {
      signal.removeEventListener("abort", onAbort);
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });

const createEmptySyntheticScenarioCounts = (): SyntheticScenarioCounts => ({
  map: 0,
  myPets: 0,
  memorial: 0,
  gift: 0,
  edit: 0,
});

const chooseWeightedScenario = () => {
  const totalWeight = SYNTHETIC_SCENARIOS.reduce(
    (sum, item) => sum + item.weight,
    0,
  );
  let point = Math.random() * totalWeight;
  for (const item of SYNTHETIC_SCENARIOS) {
    point -= item.weight;
    if (point <= 0) {
      return item;
    }
  }
  return (
    SYNTHETIC_SCENARIOS[SYNTHETIC_SCENARIOS.length - 1] ??
    SYNTHETIC_SCENARIOS[0]!
  );
};

const pickRandom = <T,>(items: T[]) =>
  items.length > 0
    ? (items[Math.floor(Math.random() * items.length)] ?? null)
    : null;

const describeLoadSummary = (summary: LoadTestSummary) => {
  if (summary.wasAborted) {
    return "Прогон остановлен вручную. Метрики ниже относятся только к уже завершённым запросам.";
  }
  if (summary.failCount > 0) {
    return "Есть ошибки ответов. На этой нагрузке сервис уже начал давать сбои или упёрся в лимиты.";
  }
  if (summary.p95Ms <= 250) {
    return "Прогон прошёл без ошибок и с низкой задержкой. Для такого профиля нагрузка лёгкая.";
  }
  if (summary.p95Ms <= 800) {
    return "Прогон прошёл без ошибок, но задержка уже заметна. Нагрузка умеренная.";
  }
  return "Прогон завершился без падения, но задержка высокая. Здесь уже есть смысл профилировать API и базу.";
};

const describeSyntheticSummary = (summary: SyntheticRunSummary) => {
  if (summary.wasAborted) {
    return "Сценарий остановлен вручную. Метрики относятся только к уже завершённым действиям виртуальных пользователей.";
  }
  if (summary.failCount > 0) {
    return "Есть ошибки ответов. Это уже похоже на перегрузку части сценариев или проблемы с таймингами под текущим числом виртуальных пользователей.";
  }
  if (summary.p95RequestMs <= 400 && summary.p95FlowMs <= 1800) {
    return "Сервис уверенно выдержал этот профиль синтетических пользователей. Для такого VU уровня запас ещё есть.";
  }
  if (summary.p95RequestMs <= 900 && summary.p95FlowMs <= 3500) {
    return "Сервис справился, но задержка уже заметна. Это рабочая, но не совсем комфортная нагрузка.";
  }
  return "Сценарий проходит тяжело: пользователи ещё не отваливаются массово, но задержка уже высокая. Имеет смысл профилировать web, API и базу.";
};

export default function AdminSqlPage() {
  const apiUrl = useMemo(() => API_BASE, []);
  const router = useRouter();
  const loadTestAbortRef = useRef<AbortController | null>(null);
  const syntheticAbortRef = useRef<AbortController | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [accessLevel, setAccessLevel] = useState<AccessLevel>("USER");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SqlResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [schema, setSchema] = useState<SchemaTable[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [schemaFilter, setSchemaFilter] = useState("");
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>(
    {},
  );
  const [passwordEmail, setPasswordEmail] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [coinsEmail, setCoinsEmail] = useState("");
  const [coinsAmount, setCoinsAmount] = useState("100");
  const [coinsNotice, setCoinsNotice] = useState<string | null>(null);
  const [coinsLoading, setCoinsLoading] = useState(false);
  const [bulkAccountRows, setBulkAccountRows] = useState<BulkAccountRow[]>([]);
  const [bulkAccountNotice, setBulkAccountNotice] = useState<string | null>(
    null,
  );
  const [bulkAccountLoading, setBulkAccountLoading] = useState(false);
  const [petId, setPetId] = useState("");
  const [loadingTips, setLoadingTips] = useState<LoadingTip[]>([]);
  const [loadingTipsLoading, setLoadingTipsLoading] = useState(false);
  const [loadingTipsError, setLoadingTipsError] = useState<string | null>(null);
  const [newTipText, setNewTipText] = useState("");
  const [savingTipId, setSavingTipId] = useState<string | null>(null);
  const [deletingTipId, setDeletingTipId] = useState<string | null>(null);
  const [creatingTip, setCreatingTip] = useState(false);
  const [siteBanner, setSiteBanner] = useState<SiteBanner>({
    id: "global",
    text: "",
    isActive: false,
  });
  const [siteBannerLoading, setSiteBannerLoading] = useState(false);
  const [siteBannerSaving, setSiteBannerSaving] = useState(false);
  const [siteBannerNotice, setSiteBannerNotice] = useState<string | null>(null);
  const [siteBannerError, setSiteBannerError] = useState<string | null>(null);
  const [newsPosts, setNewsPosts] = useState<NewsPost[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsSaving, setNewsSaving] = useState(false);
  const [deletingNewsId, setDeletingNewsId] = useState<string | null>(null);
  const [newsNotice, setNewsNotice] = useState<string | null>(null);
  const [newsTitle, setNewsTitle] = useState("");
  const [newsBody, setNewsBody] = useState("");
  const [newsActive, setNewsActive] = useState(true);
  const [documentRevisions, setDocumentRevisions] = useState<
    DocumentRevision[]
  >([]);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [documentUploading, setDocumentUploading] = useState(false);
  const [documentNotice, setDocumentNotice] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState<"offer" | "politics">("offer");
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [memorialPlanPrices, setMemorialPlanPrices] = useState<
    MemorialPlanPrice[]
  >([]);
  const [memorialPublicationMode, setMemorialPublicationMode] =
    useState<MemorialPublicationMode>({ freeLifetime: true });
  const [giftPrices, setGiftPrices] = useState<GiftPrice[]>([]);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [pricingNotice, setPricingNotice] = useState<string | null>(null);
  const [savingPlanYears, setSavingPlanYears] = useState<number | null>(null);
  const [savingPublicationMode, setSavingPublicationMode] = useState(false);
  const [savingGiftId, setSavingGiftId] = useState<string | null>(null);
  const [giftPriceFilter, setGiftPriceFilter] = useState("");
  const [modelMetadataItems, setModelMetadataItems] = useState<
    ModelMetadataItem[]
  >(() => buildModelMetadataDefaults());
  const [modelMetadataLoading, setModelMetadataLoading] = useState(false);
  const [modelMetadataSavingKey, setModelMetadataSavingKey] = useState<
    string | null
  >(null);
  const [modelMetadataFilter, setModelMetadataFilter] = useState("");
  const [modelMetadataNotice, setModelMetadataNotice] = useState<string | null>(
    null,
  );
  const [modelMetadataError, setModelMetadataError] = useState<string | null>(
    null,
  );
  const [accessUsers, setAccessUsers] = useState<AccessUser[]>([]);
  const [accessUsersLoading, setAccessUsersLoading] = useState(false);
  const [accessUsersError, setAccessUsersError] = useState<string | null>(null);
  const [roleEmail, setRoleEmail] = useState("");
  const [roleSaving, setRoleSaving] = useState<"USER" | "ADMIN" | null>(null);
  const [roleNotice, setRoleNotice] = useState<string | null>(null);
  const [limitEmails, setLimitEmails] = useState("");
  const [limitValue, setLimitValue] = useState("5");
  const [limitSaving, setLimitSaving] = useState(false);
  const [limitNotice, setLimitNotice] = useState<string | null>(null);
  const [loadTestRunning, setLoadTestRunning] = useState(false);
  const [loadTestError, setLoadTestError] = useState<string | null>(null);
  const [loadTestProgress, setLoadTestProgress] =
    useState<LoadTestProgress | null>(null);
  const [loadTestSummary, setLoadTestSummary] =
    useState<LoadTestSummary | null>(null);
  const [syntheticRunning, setSyntheticRunning] = useState(false);
  const [syntheticError, setSyntheticError] = useState<string | null>(null);
  const [syntheticProgress, setSyntheticProgress] =
    useState<SyntheticRunProgress | null>(null);
  const [syntheticSummary, setSyntheticSummary] =
    useState<SyntheticRunSummary | null>(null);
  const [fontPreviewId, setFontPreviewId] =
    useState<FontPreviewId>("noto-sans");

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setError(null);
      try {
        const response = await fetch(`${apiUrl}/auth/me`, {
          credentials: "include",
        });
        if (!response.ok) {
          router.replace("/auth");
          return;
        }
        const data = (await response.json()) as { accessLevel?: AccessLevel };
        if (!isMounted) {
          return;
        }
        const nextAccessLevel = data.accessLevel ?? "USER";
        setAccessLevel(nextAccessLevel);
        setIsAdmin(canAccessAdmin(nextAccessLevel));
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Ошибка авторизации");
        }
      } finally {
        if (isMounted) {
          setAuthChecked(true);
        }
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [apiUrl, router]);

  useEffect(() => {
    if (!authChecked || !isAdmin) {
      return;
    }
    let isMounted = true;
    const loadSchema = async () => {
      setSchemaLoading(true);
      setSchemaError(null);
      try {
        const response = await fetch(`${apiUrl}/admin/schema`, {
          credentials: "include",
        });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || "Не удалось загрузить схему");
        }
        const data = (await response.json()) as { tables?: SchemaTable[] };
        if (!isMounted) {
          return;
        }
        setSchema(Array.isArray(data.tables) ? data.tables : []);
      } catch (err) {
        if (isMounted) {
          setSchemaError(
            err instanceof Error ? err.message : "Ошибка загрузки схемы",
          );
        }
      } finally {
        if (isMounted) {
          setSchemaLoading(false);
        }
      }
    };
    void loadSchema();
    return () => {
      isMounted = false;
    };
  }, [apiUrl, authChecked, isAdmin]);

  useEffect(() => {
    if (!authChecked || !isAdmin) {
      return;
    }
    let isMounted = true;
    const loadContentTools = async () => {
      setNewsLoading(true);
      setDocumentLoading(true);
      setSiteBannerLoading(true);
      try {
        const [newsResponse, documentsResponse, bannerResponse] = await Promise.all([
          fetch(`${apiUrl}/admin/news`, { credentials: "include" }),
          fetch(`${apiUrl}/admin/documents`, { credentials: "include" }),
          fetch(`${apiUrl}/admin/site-banner`, { credentials: "include" }),
        ]);
        if (newsResponse.ok) {
          const data = (await newsResponse.json()) as { posts?: NewsPost[] };
          if (isMounted) {
            setNewsPosts(Array.isArray(data.posts) ? data.posts : []);
          }
        }
        if (documentsResponse.ok) {
          const data = (await documentsResponse.json()) as {
            revisions?: DocumentRevision[];
          };
          if (isMounted) {
            setDocumentRevisions(
              Array.isArray(data.revisions) ? data.revisions : [],
            );
          }
        }
        if (bannerResponse.ok) {
          const data = (await bannerResponse.json()) as { banner?: SiteBanner };
          if (isMounted && data.banner) {
            setSiteBanner(data.banner);
          }
        }
      } finally {
        if (isMounted) {
          setNewsLoading(false);
          setDocumentLoading(false);
          setSiteBannerLoading(false);
        }
      }
    };
    void loadContentTools();
    return () => {
      isMounted = false;
    };
  }, [apiUrl, authChecked, isAdmin]);

  useEffect(() => {
    if (!authChecked || !isAdmin) {
      return;
    }
    let isMounted = true;
    const loadPricing = async () => {
      setPricingLoading(true);
      setPricingError(null);
      try {
        const response = await fetch(`${apiUrl}/admin/pricing`, {
          credentials: "include",
        });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || "Не удалось загрузить цены");
        }
        const data = (await response.json()) as {
          memorialPlanPrices?: MemorialPlanPrice[];
          memorialPublicationMode?: MemorialPublicationMode;
          gifts?: GiftPrice[];
        };
        if (!isMounted) {
          return;
        }
        setMemorialPlanPrices(
          Array.isArray(data.memorialPlanPrices) ? data.memorialPlanPrices : [],
        );
        setMemorialPublicationMode({
          freeLifetime: data.memorialPublicationMode?.freeLifetime === true,
        });
        setGiftPrices(Array.isArray(data.gifts) ? data.gifts : []);
      } catch (err) {
        if (isMounted) {
          setPricingError(
            err instanceof Error ? err.message : "Ошибка загрузки цен",
          );
        }
      } finally {
        if (isMounted) {
          setPricingLoading(false);
        }
      }
    };
    void loadPricing();
    return () => {
      isMounted = false;
    };
  }, [apiUrl, authChecked, isAdmin]);

  useEffect(() => {
    if (!authChecked || !isAdmin) {
      return;
    }
    let isMounted = true;
    const loadModelMetadata = async () => {
      setModelMetadataLoading(true);
      setModelMetadataError(null);
      try {
        const response = await fetch(`${apiUrl}/admin/model-metadata`, {
          credentials: "include",
        });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || "Не удалось загрузить подписи моделей");
        }
        const data = (await response.json()) as {
          items?: ModelMetadataItem[];
        };
        if (!isMounted) {
          return;
        }
        setModelMetadataItems(
          mergeModelMetadataItems(Array.isArray(data.items) ? data.items : []),
        );
      } catch (err) {
        if (isMounted) {
          setModelMetadataError(
            err instanceof Error
              ? err.message
              : "Ошибка загрузки подписей моделей",
          );
        }
      } finally {
        if (isMounted) {
          setModelMetadataLoading(false);
        }
      }
    };
    void loadModelMetadata();
    return () => {
      isMounted = false;
    };
  }, [apiUrl, authChecked, isAdmin]);

  useEffect(() => {
    return () => {
      loadTestAbortRef.current?.abort();
      syntheticAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!authChecked || !isAdmin) {
      return;
    }
    let isMounted = true;
    const loadUsers = async () => {
      setAccessUsersLoading(true);
      setAccessUsersError(null);
      try {
        const response = await fetch(`${apiUrl}/admin/access/users`, {
          credentials: "include",
        });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || "Не удалось загрузить доступы");
        }
        const data = (await response.json()) as { users?: AccessUser[] };
        if (isMounted) {
          setAccessUsers(Array.isArray(data.users) ? data.users : []);
        }
      } catch (err) {
        if (isMounted) {
          setAccessUsersError(
            err instanceof Error ? err.message : "Ошибка загрузки доступов",
          );
        }
      } finally {
        if (isMounted) {
          setAccessUsersLoading(false);
        }
      }
    };
    void loadUsers();
    return () => {
      isMounted = false;
    };
  }, [apiUrl, authChecked, isAdmin]);

  useEffect(() => {
    if (!authChecked || !isAdmin) {
      return;
    }
    let isMounted = true;
    const loadTips = async () => {
      setLoadingTipsLoading(true);
      setLoadingTipsError(null);
      try {
        const response = await fetch(`${apiUrl}/admin/loading-tips`, {
          credentials: "include",
        });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || "Не удалось загрузить подсказки");
        }
        const data = (await response.json()) as { tips?: LoadingTip[] };
        if (!isMounted) {
          return;
        }
        setLoadingTips(Array.isArray(data.tips) ? data.tips : []);
      } catch (err) {
        if (isMounted) {
          setLoadingTipsError(
            err instanceof Error ? err.message : "Ошибка загрузки подсказок",
          );
        }
      } finally {
        if (isMounted) {
          setLoadingTipsLoading(false);
        }
      }
    };
    void loadTips();
    return () => {
      isMounted = false;
    };
  }, [apiUrl, authChecked, isAdmin]);

  const refreshSchema = async () => {
    if (!isAdmin) {
      return;
    }
    setSchemaLoading(true);
    setSchemaError(null);
    try {
      const response = await fetch(`${apiUrl}/admin/schema`, {
        credentials: "include",
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Не удалось загрузить схему");
      }
      const data = (await response.json()) as { tables?: SchemaTable[] };
      setSchema(Array.isArray(data.tables) ? data.tables : []);
    } catch (err) {
      setSchemaError(
        err instanceof Error ? err.message : "Ошибка загрузки схемы",
      );
    } finally {
      setSchemaLoading(false);
    }
  };

  const applyQuery = (nextQuery: string) => {
    setQuery(nextQuery);
    setResult(null);
    setError(null);
  };

  const runQueryWith = async (nextQuery: string) => {
    if (!nextQuery.trim()) {
      setError("Введите SQL запрос");
      return;
    }
    setQuery(nextQuery);
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch(`${apiUrl}/admin/sql`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ query: nextQuery }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Ошибка выполнения запроса");
      }
      const data = (await response.json()) as SqlResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка выполнения");
    } finally {
      setRunning(false);
    }
  };

  const runQuery = async () => runQueryWith(query);

  const handleResetPassword = async () => {
    const email = passwordEmail.trim().toLowerCase();
    const nextPassword = passwordValue.trim();
    if (!email || !nextPassword) {
      setError("Введите email и новый пароль");
      return;
    }
    setPasswordLoading(true);
    setPasswordNotice(null);
    setError(null);
    try {
      const response = await fetch(`${apiUrl}/admin/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, newPassword: nextPassword }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Не удалось изменить пароль");
      }
      setPasswordNotice("Пароль обновлён");
      setPasswordValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка изменения пароля");
    } finally {
      setPasswordLoading(false);
    }
  };

  const addCoinsByEmail = async () => {
    const email = coinsEmail.trim().toLowerCase();
    const amount = Number(coinsAmount);
    if (!email) {
      setError("Введите email пользователя");
      return;
    }
    if (!Number.isInteger(amount) || amount <= 0 || amount > 1_000_000) {
      setError("Количество монет должно быть целым числом от 1 до 1000000");
      return;
    }
    setCoinsLoading(true);
    setCoinsNotice(null);
    setError(null);
    try {
      const response = await fetch(`${apiUrl}/admin/wallet/add-coins`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, amount }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Не удалось добавить монеты");
      }
      const data = (await response.json()) as {
        user?: { email: string; coinBalance: number };
        amount?: number;
      };
      setCoinsNotice(
        `${data.user?.email ?? email}: +${data.amount ?? amount} монет. Баланс: ${data.user?.coinBalance ?? "—"}`,
      );
      setCoinsAmount("100");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка начисления монет");
    } finally {
      setCoinsLoading(false);
    }
  };

  const parseCsvLine = (line: string) => {
    const cells: string[] = [];
    let current = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1];
      if (char === '"' && quoted && next === '"') {
        current += '"';
        index += 1;
        continue;
      }
      if (char === '"') {
        quoted = !quoted;
        continue;
      }
      if (char === "," && !quoted) {
        cells.push(current.trim());
        current = "";
        continue;
      }
      current += char;
    }
    cells.push(current.trim());
    return cells;
  };

  const handleBulkCsvFile = async (file?: File | null) => {
    if (!file) {
      return;
    }
    setBulkAccountNotice(null);
    setError(null);
    const text = await file.text();
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const dataLines = lines.filter((line, index) => {
      if (index !== 0) {
        return true;
      }
      const lower = line.toLowerCase();
      return !(
        lower.includes("login") ||
        lower.includes("логин") ||
        lower.includes("email") ||
        lower.includes("имейл")
      );
    });
    const rows = dataLines
      .map(parseCsvLine)
      .filter((cells) => cells.length >= 4)
      .map((cells, index) => {
        const [login, email, password, balance] = cells;
        const initialBalance = Number(balance);
        if (!login || !email || !password || !Number.isFinite(initialBalance)) {
          throw new Error(
            `Строка ${index + 1}: нужен формат логин,email,пароль,начальный баланс`,
          );
        }
        return {
          login,
          email,
          password,
          initialBalance: Math.trunc(initialBalance),
        };
      });
    setBulkAccountRows(rows);
    setBulkAccountNotice(`Загружено строк: ${rows.length}`);
  };

  const createBulkAccounts = async () => {
    if (bulkAccountRows.length === 0) {
      setError("Сначала загрузите CSV");
      return;
    }
    setBulkAccountLoading(true);
    setBulkAccountNotice(null);
    setError(null);
    try {
      const response = await fetch(`${apiUrl}/admin/users/bulk-create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rows: bulkAccountRows }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Не удалось создать аккаунты");
      }
      const data = (await response.json()) as { createdCount?: number };
      setBulkAccountRows([]);
      setBulkAccountNotice(`Создано аккаунтов: ${data.createdCount ?? 0}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка CSV-импорта");
    } finally {
      setBulkAccountLoading(false);
    }
  };

  const refreshNews = async () => {
    const response = await fetch(`${apiUrl}/admin/news`, {
      credentials: "include",
    });
    if (response.ok) {
      const data = (await response.json()) as { posts?: NewsPost[] };
      setNewsPosts(Array.isArray(data.posts) ? data.posts : []);
    }
  };

  const createNewsPost = async () => {
    if (!newsTitle.trim() || !newsBody.trim()) {
      setError("Введите заголовок и текст новости");
      return;
    }
    setNewsSaving(true);
    setNewsNotice(null);
    setError(null);
    try {
      const response = await fetch(`${apiUrl}/admin/news`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: newsTitle.trim(),
          body: newsBody.trim(),
          isActive: newsActive,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Не удалось создать новость");
      }
      setNewsTitle("");
      setNewsBody("");
      setNewsActive(true);
      setNewsNotice("Новость опубликована");
      await refreshNews();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка новости");
    } finally {
      setNewsSaving(false);
    }
  };

  const deleteNewsPost = async (id: string) => {
    setDeletingNewsId(id);
    setNewsNotice(null);
    setError(null);
    try {
      const response = await fetch(
        `${apiUrl}/admin/news/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Не удалось удалить новость");
      }
      setNewsPosts((current) => current.filter((post) => post.id !== id));
      setNewsNotice("Новость удалена");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка удаления новости");
    } finally {
      setDeletingNewsId(null);
    }
  };

  const refreshDocuments = async () => {
    const response = await fetch(`${apiUrl}/admin/documents`, {
      credentials: "include",
    });
    if (response.ok) {
      const data = (await response.json()) as {
        revisions?: DocumentRevision[];
      };
      setDocumentRevisions(Array.isArray(data.revisions) ? data.revisions : []);
    }
  };

  const uploadDocumentRevision = async () => {
    if (!documentFile || !documentTitle.trim()) {
      setError("Выберите PDF и укажите название редакции");
      return;
    }
    setDocumentUploading(true);
    setDocumentNotice(null);
    setError(null);
    try {
      const body = new FormData();
      body.set("documentType", documentType);
      body.set("title", documentTitle.trim());
      body.set("file", documentFile);
      const response = await fetch(`${apiUrl}/admin/documents`, {
        method: "POST",
        credentials: "include",
        body,
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Не удалось загрузить документ");
      }
      setDocumentTitle("");
      setDocumentFile(null);
      setDocumentNotice("Документ загружен");
      await refreshDocuments();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ошибка загрузки документа",
      );
    } finally {
      setDocumentUploading(false);
    }
  };

  const updateLoadingTip = (id: string, patch: Partial<LoadingTip>) => {
    setLoadingTips((prev) =>
      prev.map((tip) => (tip.id === id ? { ...tip, ...patch } : tip)),
    );
  };

  const updateMemorialPlanPriceDraft = (years: number, price: number) => {
    setMemorialPlanPrices((prev) =>
      prev.map((plan) => (plan.years === years ? { ...plan, price } : plan)),
    );
  };

  const saveMemorialPublicationMode = async (freeLifetime: boolean) => {
    setSavingPublicationMode(true);
    setPricingError(null);
    setPricingNotice(null);
    try {
      const response = await fetch(
        `${apiUrl}/admin/pricing/memorial-publication-mode`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ freeLifetime }),
        },
      );
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Не удалось сохранить режим публикации");
      }
      const data = (await response.json()) as {
        memorialPublicationMode?: MemorialPublicationMode;
      };
      setMemorialPublicationMode({
        freeLifetime:
          data.memorialPublicationMode?.freeLifetime === true
            ? true
            : freeLifetime,
      });
      setPricingNotice(
        freeLifetime
          ? "Публикация мемориалов сделана бесплатной и бессрочной"
          : "Платные тарифы публикации снова включены",
      );
    } catch (err) {
      setPricingError(
        err instanceof Error
          ? err.message
          : "Ошибка сохранения режима публикации",
      );
      setMemorialPublicationMode((prev) => ({
        freeLifetime: !prev.freeLifetime,
      }));
    } finally {
      setSavingPublicationMode(false);
    }
  };

  const saveMemorialPlanPrice = async (plan: MemorialPlanPrice) => {
    if (!Number.isInteger(plan.price) || plan.price < 0) {
      setPricingError("Цена тарифа должна быть целым числом от 0");
      return;
    }
    setSavingPlanYears(plan.years);
    setPricingError(null);
    setPricingNotice(null);
    try {
      const response = await fetch(`${apiUrl}/admin/pricing/memorial-plan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ years: plan.years, price: plan.price }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Не удалось сохранить тариф");
      }
      const data = (await response.json()) as { plan?: MemorialPlanPrice };
      if (data.plan) {
        setMemorialPlanPrices((prev) =>
          prev.map((item) =>
            item.years === data.plan?.years ? data.plan : item,
          ),
        );
      }
      setPricingNotice("Тариф аренды обновлён");
    } catch (err) {
      setPricingError(
        err instanceof Error ? err.message : "Ошибка сохранения тарифа",
      );
    } finally {
      setSavingPlanYears(null);
    }
  };

  const updateGiftDraft = (
    id: string,
    patch: Partial<Pick<GiftPrice, "name" | "description" | "price">>,
  ) => {
    setGiftPrices((prev) =>
      prev.map((gift) => (gift.id === id ? { ...gift, ...patch } : gift)),
    );
  };

  const saveGiftPrice = async (gift: GiftPrice) => {
    const name = gift.name.trim();
    const description = gift.description?.trim() ?? "";
    if (!name) {
      setPricingError("Название подарка обязательно");
      return;
    }
    if (!Number.isInteger(gift.price) || gift.price < 0) {
      setPricingError("Цена подарка должна быть целым числом от 0");
      return;
    }
    setSavingGiftId(gift.id);
    setPricingError(null);
    setPricingNotice(null);
    try {
      const response = await fetch(`${apiUrl}/admin/pricing/gifts/${gift.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ price: gift.price, name, description }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Не удалось сохранить цену подарка");
      }
      const data = (await response.json()) as { gift?: GiftPrice };
      if (data.gift) {
        setGiftPrices((prev) =>
          prev.map((item) => (item.id === data.gift?.id ? data.gift : item)),
        );
      }
      setPricingNotice("Подарок обновлён");
    } catch (err) {
      setPricingError(
        err instanceof Error ? err.message : "Ошибка сохранения цены подарка",
      );
    } finally {
      setSavingGiftId(null);
    }
  };

  const updateModelMetadataDraft = (
    item: Pick<ModelMetadataItem, "category" | "modelId">,
    patch: Partial<Pick<ModelMetadataItem, "name" | "description">>,
  ) => {
    setModelMetadataItems((prev) =>
      prev.map((current) =>
        current.category === item.category && current.modelId === item.modelId
          ? { ...current, ...patch }
          : current,
      ),
    );
  };

  const saveModelMetadataItem = async (item: ModelMetadataItem) => {
    const name = item.name.trim();
    const description = item.description.trim();
    if (!name) {
      setModelMetadataError("Название модели обязательно");
      return;
    }
    const key = modelMetadataKey(item.category, item.modelId);
    setModelMetadataSavingKey(key);
    setModelMetadataNotice(null);
    setModelMetadataError(null);
    try {
      const response = await fetch(
        `${apiUrl}/admin/model-metadata/${encodeURIComponent(
          item.category,
        )}/${encodeURIComponent(item.modelId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name, description }),
        },
      );
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Не удалось сохранить подпись модели");
      }
      const data = (await response.json()) as { item?: ModelMetadataItem };
      if (data.item) {
        setModelMetadataItems((prev) =>
          prev.map((current) =>
            current.category === data.item?.category &&
            current.modelId === data.item?.modelId
              ? {
                  ...current,
                  id: data.item.id,
                  name: data.item.name,
                  description: data.item.description ?? "",
                }
              : current,
          ),
        );
      }
      setModelMetadataNotice("Подпись модели сохранена");
    } catch (err) {
      setModelMetadataError(
        err instanceof Error ? err.message : "Ошибка сохранения подписи модели",
      );
    } finally {
      setModelMetadataSavingKey(null);
    }
  };

  const saveSiteBanner = async () => {
    setSiteBannerSaving(true);
    setSiteBannerNotice(null);
    setSiteBannerError(null);
    try {
      const response = await fetch(`${apiUrl}/admin/site-banner`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          text: siteBanner.text,
          isActive: siteBanner.isActive,
        }),
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || "Не удалось сохранить плашку");
      }
      const data = (await response.json()) as { banner?: SiteBanner };
      if (data.banner) {
        setSiteBanner(data.banner);
      }
      setSiteBannerNotice("Плашка сохранена");
    } catch (err) {
      setSiteBannerError(
        err instanceof Error ? err.message : "Ошибка сохранения плашки",
      );
    } finally {
      setSiteBannerSaving(false);
    }
  };

  const saveLoadingTip = async (tip: LoadingTip) => {
    setSavingTipId(tip.id);
    setLoadingTipsError(null);
    try {
      const response = await fetch(`${apiUrl}/admin/loading-tips/${tip.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text: tip.text, isActive: tip.isActive }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Не удалось сохранить подсказку");
      }
    } catch (err) {
      setLoadingTipsError(
        err instanceof Error ? err.message : "Ошибка сохранения подсказки",
      );
    } finally {
      setSavingTipId(null);
    }
  };

  const createLoadingTip = async () => {
    const text = newTipText.trim();
    if (!text) {
      setLoadingTipsError("Введите текст подсказки");
      return;
    }
    setCreatingTip(true);
    setLoadingTipsError(null);
    try {
      const response = await fetch(`${apiUrl}/admin/loading-tips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text }),
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || "Не удалось добавить подсказку");
      }
      setNewTipText("");
      const listResponse = await fetch(`${apiUrl}/admin/loading-tips`, {
        credentials: "include",
      });
      if (listResponse.ok) {
        const data = (await listResponse.json()) as { tips?: LoadingTip[] };
        setLoadingTips(Array.isArray(data.tips) ? data.tips : []);
      }
    } catch (err) {
      setLoadingTipsError(
        err instanceof Error ? err.message : "Ошибка добавления подсказки",
      );
    } finally {
      setCreatingTip(false);
    }
  };

  const deleteLoadingTip = async (id: string) => {
    setDeletingTipId(id);
    setLoadingTipsError(null);
    try {
      const response = await fetch(`${apiUrl}/admin/loading-tips/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || "Не удалось удалить подсказку");
      }
      setLoadingTips((prev) => prev.filter((tip) => tip.id !== id));
    } catch (err) {
      setLoadingTipsError(
        err instanceof Error ? err.message : "Ошибка удаления подсказки",
      );
    } finally {
      setDeletingTipId(null);
    }
  };

  const updateAccessRole = async (role: "USER" | "ADMIN") => {
    const email = roleEmail.trim().toLowerCase();
    if (!email) {
      setError("Введите email пользователя");
      return;
    }
    setRoleSaving(role);
    setRoleNotice(null);
    setAccessUsersError(null);
    try {
      const response = await fetch(`${apiUrl}/admin/access/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, role }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Не удалось обновить доступ");
      }
      const data = (await response.json()) as { user?: AccessUser };
      if (data.user) {
        setAccessUsers((prev) => {
          const rest = prev.filter((item) => item.id !== data.user?.id);
          return [data.user as AccessUser, ...rest];
        });
      }
      setRoleNotice(
        role === "ADMIN"
          ? "Пользователь назначен админом"
          : "Пользователь понижен до user",
      );
      setRoleEmail("");
    } catch (err) {
      setAccessUsersError(
        err instanceof Error ? err.message : "Ошибка обновления доступа",
      );
    } finally {
      setRoleSaving(null);
    }
  };

  const updateMemorialLimit = async () => {
    const emails = limitEmails
      .split(/[,\n;]/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    const maxMemorials = Number(limitValue);
    if (emails.length === 0) {
      setError("Введите хотя бы один email");
      return;
    }
    if (
      !Number.isInteger(maxMemorials) ||
      maxMemorials < 0 ||
      maxMemorials > 10000
    ) {
      setError("Лимит должен быть целым числом от 0 до 10000");
      return;
    }
    setLimitSaving(true);
    setLimitNotice(null);
    setAccessUsersError(null);
    try {
      const response = await fetch(`${apiUrl}/admin/access/memorial-limit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ emails, maxMemorials }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Не удалось обновить лимит");
      }
      const data = (await response.json()) as {
        users?: AccessUser[];
        missingEmails?: string[];
        skippedOwners?: string[];
      };
      if (Array.isArray(data.users)) {
        setAccessUsers((prev) => {
          const next = new Map(prev.map((user) => [user.id, user]));
          data.users!.forEach((user) => next.set(user.id, user));
          return Array.from(next.values());
        });
      }
      const details = [
        data.missingEmails?.length
          ? `не найдены: ${data.missingEmails.join(", ")}`
          : "",
        data.skippedOwners?.length
          ? `owner не менялся: ${data.skippedOwners.join(", ")}`
          : "",
      ].filter(Boolean);
      setLimitNotice(
        details.length > 0
          ? `Лимит обновлён. ${details.join("; ")}`
          : "Лимит мемориалов обновлён",
      );
    } catch (err) {
      setAccessUsersError(
        err instanceof Error ? err.message : "Ошибка обновления лимита",
      );
    } finally {
      setLimitSaving(false);
    }
  };

  const handlePetAction = async (
    action: "disable" | "delete" | "memorial" | "photos",
  ) => {
    const rawId = petId.trim();
    if (!rawId) {
      setError("Укажите ID питомца");
      return;
    }
    const safeId = escapeSqlLiteral(rawId);
    let nextQuery = "";
    switch (action) {
      case "disable":
        nextQuery = `UPDATE "Pet" SET "isPublic" = false WHERE id = '${safeId}';`;
        break;
      case "delete":
        nextQuery = `DELETE FROM "Pet" WHERE id = '${safeId}';`;
        break;
      case "memorial":
        nextQuery = `DELETE FROM "Memorial" WHERE "petId" = '${safeId}';`;
        break;
      case "photos":
        nextQuery = `DELETE FROM "PetPhoto" WHERE "petId" = '${safeId}';`;
        break;
      default:
        return;
    }
    await runQueryWith(nextQuery);
  };

  const toggleTable = (name: string) => {
    setExpandedTables((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const stopLoadTest = () => {
    loadTestAbortRef.current?.abort();
  };

  const runLoadTest = async (preset: LoadTestPreset) => {
    if (loadTestRunning) {
      return;
    }
    const controller = new AbortController();
    loadTestAbortRef.current = controller;
    setLoadTestRunning(true);
    setLoadTestError(null);
    setLoadTestSummary(null);
    setLoadTestProgress({
      label: preset.label,
      totalRequests: preset.totalRequests,
      concurrency: preset.concurrency,
      completed: 0,
      okCount: 0,
      failCount: 0,
    });

    const latencies: number[] = [];
    const serverLatencies: number[] = [];
    let nextRequestIndex = 0;
    let completed = 0;
    let okCount = 0;
    let failCount = 0;
    const startedAt = performance.now();
    let lastProgressCommit = 0;

    const updateProgress = (force = false) => {
      const now = performance.now();
      if (!force && now - lastProgressCommit < 120) {
        return;
      }
      lastProgressCommit = now;
      setLoadTestProgress({
        label: preset.label,
        totalRequests: preset.totalRequests,
        concurrency: preset.concurrency,
        completed,
        okCount,
        failCount,
      });
    };

    const worker = async () => {
      while (true) {
        if (controller.signal.aborted) {
          return;
        }
        const currentIndex = nextRequestIndex;
        nextRequestIndex += 1;
        if (currentIndex >= preset.totalRequests) {
          return;
        }
        const requestStartedAt = performance.now();
        try {
          const response = await fetch(`${apiUrl}/admin/load-probe`, {
            credentials: "include",
            cache: "no-store",
            signal: controller.signal,
          });
          const duration = performance.now() - requestStartedAt;
          latencies.push(duration);
          if (!response.ok) {
            failCount += 1;
          } else {
            okCount += 1;
            const data = (await response.json()) as LoadProbeResponse;
            if (typeof data.serverMs === "number") {
              serverLatencies.push(data.serverMs);
            }
          }
        } catch (err) {
          if (controller.signal.aborted) {
            return;
          }
          latencies.push(performance.now() - requestStartedAt);
          failCount += 1;
        } finally {
          if (!controller.signal.aborted) {
            completed += 1;
            updateProgress();
          }
        }
      }
    };

    try {
      await Promise.all(
        Array.from({ length: preset.concurrency }, () => worker()),
      );
    } finally {
      const totalDurationMs = performance.now() - startedAt;
      const wasAborted = controller.signal.aborted;
      const summary: LoadTestSummary = {
        label: preset.label,
        totalRequests: preset.totalRequests,
        concurrency: preset.concurrency,
        completed,
        okCount,
        failCount,
        totalDurationMs,
        avgMs: getAverage(latencies),
        p95Ms: getPercentile(latencies, 95),
        maxMs: latencies.length > 0 ? Math.max(...latencies) : 0,
        minMs: latencies.length > 0 ? Math.min(...latencies) : 0,
        requestsPerSecond:
          totalDurationMs > 0 ? completed / (totalDurationMs / 1000) : 0,
        avgServerMs:
          serverLatencies.length > 0 ? getAverage(serverLatencies) : null,
        p95ServerMs:
          serverLatencies.length > 0
            ? getPercentile(serverLatencies, 95)
            : null,
        wasAborted,
      };
      setLoadTestSummary(summary);
      updateProgress(true);
      if (wasAborted) {
        setLoadTestError("Прогон остановлен вручную");
      }
      loadTestAbortRef.current = null;
      setLoadTestRunning(false);
    }
  };

  const stopSyntheticRun = () => {
    syntheticAbortRef.current?.abort();
  };

  const runSyntheticUsers = async (
    preset: SyntheticUserPreset,
  ) => {
    if (syntheticRunning) {
      return;
    }
    const controller = new AbortController();
    syntheticAbortRef.current = controller;
    setSyntheticRunning(true);
    setSyntheticError(null);
    setSyntheticSummary(null);

    const scenarioCounts = createEmptySyntheticScenarioCounts();
    const requestLatencies: number[] = [];
    const flowLatencies: number[] = [];
    let totalRequests = 0;
    let okCount = 0;
    let failCount = 0;
    let completedFlows = 0;
    let activeUsers = 0;
    const startedAt = performance.now();
    const runUntil = startedAt + preset.durationMs;
    let lastProgressCommit = 0;

    const commitProgress = (force = false) => {
      const now = performance.now();
      if (!force && now - lastProgressCommit < 180) {
        return;
      }
      lastProgressCommit = now;
      setSyntheticProgress({
        label: preset.label,
        virtualUsers: preset.virtualUsers,
        durationMs: preset.durationMs,
        elapsedMs: Math.min(preset.durationMs, now - startedAt),
        activeUsers,
        completedFlows,
        totalRequests,
        okCount,
        failCount,
        scenarioCounts: { ...scenarioCounts },
      });
    };

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const uniqueSuffix = () =>
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const withSyntheticQuery = (path: string) =>
      `${origin}${path}${path.includes("?") ? "&" : "?"}synthetic=${uniqueSuffix()}`;

    const requestText = async (url: string, init?: RequestInit) => {
      const requestStartedAt = performance.now();
      try {
        const response = await fetch(url, {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
          ...init,
        });
        const duration = performance.now() - requestStartedAt;
        requestLatencies.push(duration);
        totalRequests += 1;
        if (!response.ok) {
          failCount += 1;
          commitProgress();
          return null;
        }
        okCount += 1;
        commitProgress();
        return response;
      } catch (err) {
        if (isAbortError(err) || controller.signal.aborted) {
          throw err;
        }
        requestLatencies.push(performance.now() - requestStartedAt);
        totalRequests += 1;
        failCount += 1;
        commitProgress();
        return null;
      }
    };

    const requestJson = async <T,>(url: string, init?: RequestInit) => {
      const response = await requestText(url, init);
      if (!response) {
        return null;
      }
      try {
        return (await response.json()) as T;
      } catch {
        failCount += 1;
        return null;
      }
    };

    const me = await requestJson<SyntheticAuthUser>(`${apiUrl}/auth/me`);
    if (!me?.id) {
      setSyntheticRunning(false);
      setSyntheticError(
        "Не удалось подготовить сценарий: auth/me не вернул пользователя",
      );
      syntheticAbortRef.current = null;
      return;
    }
    const ownerPets =
      (await requestJson<SyntheticPetRecord[]>(
        `${apiUrl}/pets?ownerId=${encodeURIComponent(me.id)}`,
      )) ?? [];
    const publicMarkers =
      (await requestJson<SyntheticMarker[]>(`${apiUrl}/map/markers`)) ?? [];

    const ownerPetIds = ownerPets.map((item) => item.id).filter(Boolean);
    const publicPetIds = Array.from(
      new Set(publicMarkers.map((item) => item.petId).filter(Boolean)),
    );

    const pickOwnerPetId = () =>
      pickRandom(ownerPetIds) ?? pickRandom(publicPetIds);
    const pickPublicPetId = () =>
      pickRandom(publicPetIds) ?? pickRandom(ownerPetIds);

    const runScenario = async (scenarioId: SyntheticScenarioId) => {
      switch (scenarioId) {
        case "map": {
          const pageResponse = await requestText(withSyntheticQuery("/map"));
          await pageResponse?.text().catch(() => null);
          await requestJson<SyntheticMarker[]>(`${apiUrl}/map/markers`);
          const petId = pickPublicPetId();
          if (petId) {
            await requestJson<SyntheticPetRecord>(`${apiUrl}/pets/${petId}`);
          }
          return;
        }
        case "myPets": {
          const pageResponse = await requestText(
            withSyntheticQuery("/my-pets"),
          );
          await pageResponse?.text().catch(() => null);
          await requestJson<SyntheticAuthUser>(`${apiUrl}/auth/me`);
          await requestJson<SyntheticPetRecord[]>(
            `${apiUrl}/pets?ownerId=${encodeURIComponent(me.id)}`,
          );
          return;
        }
        case "memorial": {
          const petId = pickPublicPetId();
          if (!petId) {
            return runScenario("map");
          }
          const pageResponse = await requestText(
            withSyntheticQuery(`/pets/${petId}`),
          );
          await pageResponse?.text().catch(() => null);
          const pet = await requestJson<SyntheticPetRecord>(
            `${apiUrl}/pets/${petId}`,
          );
          await requestJson<SyntheticAuthUser>(`${apiUrl}/auth/me`);
          if (pet?.ownerId) {
            await requestJson<SyntheticPetRecord[]>(
              `${apiUrl}/pets?ownerId=${encodeURIComponent(pet.ownerId)}`,
            );
          }
          return;
        }
        case "gift": {
          const petId = pickPublicPetId();
          if (!petId) {
            return runScenario("memorial");
          }
          const pageResponse = await requestText(
            withSyntheticQuery(`/pets/${petId}`),
          );
          await pageResponse?.text().catch(() => null);
          await requestJson<SyntheticPetRecord>(`${apiUrl}/pets/${petId}`);
          await requestJson<SyntheticAuthUser>(`${apiUrl}/auth/me`);
          await requestJson<unknown[]>(`${apiUrl}/gifts`);
          await requestJson<unknown>(
            `${apiUrl}/wallet/${encodeURIComponent(me.id)}`,
          );
          return;
        }
        case "edit": {
          const petId = pickOwnerPetId();
          if (!petId) {
            return runScenario("myPets");
          }
          const pageResponse = await requestText(
            withSyntheticQuery(`/create?edit=${petId}`),
          );
          await pageResponse?.text().catch(() => null);
          await requestJson<SyntheticAuthUser>(`${apiUrl}/auth/me`);
          await requestJson<unknown[]>(`${apiUrl}/content/loading-tips`);
          await requestJson<unknown>(
            `${apiUrl}/wallet/${encodeURIComponent(me.id)}`,
          );
          await requestJson<SyntheticPetRecord>(`${apiUrl}/pets/${petId}`);
          return;
        }
      }
    };

    const worker = async () => {
      while (!controller.signal.aborted && performance.now() < runUntil) {
        const scenario = chooseWeightedScenario();
        activeUsers += 1;
        commitProgress();
        const flowStartedAt = performance.now();
        try {
          await runScenario(scenario.id);
        } catch (err) {
          if (isAbortError(err) || controller.signal.aborted) {
            return;
          }
          failCount += 1;
        } finally {
          flowLatencies.push(performance.now() - flowStartedAt);
          completedFlows += 1;
          scenarioCounts[scenario.id] += 1;
          activeUsers = Math.max(0, activeUsers - 1);
          commitProgress();
        }
        if (performance.now() >= runUntil || controller.signal.aborted) {
          return;
        }
        await sleep(1800 + Math.random() * 3400, controller.signal);
      }
    };

    setSyntheticProgress({
      label: preset.label,
      virtualUsers: preset.virtualUsers,
      durationMs: preset.durationMs,
      elapsedMs: 0,
      activeUsers: 0,
      completedFlows: 0,
      totalRequests,
      okCount,
      failCount,
      scenarioCounts: { ...scenarioCounts },
    });

    try {
      await Promise.all(
        Array.from({ length: preset.virtualUsers }, () => worker()),
      );
    } catch (err) {
      if (!isAbortError(err) && !controller.signal.aborted) {
        setSyntheticError(
          err instanceof Error ? err.message : "Ошибка синтетического прогона",
        );
      }
    } finally {
      const actualDurationMs = performance.now() - startedAt;
      const wasAborted = controller.signal.aborted;
      const summary: SyntheticRunSummary = {
        label: preset.label,
        virtualUsers: preset.virtualUsers,
        durationMs: preset.durationMs,
        completedFlows,
        totalRequests,
        okCount,
        failCount,
        scenarioCounts: { ...scenarioCounts },
        actualDurationMs,
        avgRequestMs: getAverage(requestLatencies),
        p95RequestMs: getPercentile(requestLatencies, 95),
        maxRequestMs:
          requestLatencies.length > 0 ? Math.max(...requestLatencies) : 0,
        avgFlowMs: getAverage(flowLatencies),
        p95FlowMs: getPercentile(flowLatencies, 95),
        flowsPerMinute:
          actualDurationMs > 0
            ? completedFlows / (actualDurationMs / 60000)
            : 0,
        requestsPerSecond:
          actualDurationMs > 0 ? totalRequests / (actualDurationMs / 1000) : 0,
        wasAborted,
      };
      setSyntheticSummary(summary);
      setSyntheticProgress({
        label: preset.label,
        virtualUsers: preset.virtualUsers,
        durationMs: preset.durationMs,
        elapsedMs: Math.min(preset.durationMs, actualDurationMs),
        activeUsers: 0,
        completedFlows,
        totalRequests,
        okCount,
        failCount,
        scenarioCounts: { ...scenarioCounts },
      });
      if (wasAborted) {
        setSyntheticError("Синтетический прогон остановлен вручную");
      }
      syntheticAbortRef.current = null;
      setSyntheticRunning(false);
    }
  };

  const normalizedFilter = schemaFilter.trim().toLowerCase();
  const filteredTables = normalizedFilter
    ? schema.filter((table) => {
        const nameMatch = table.name.toLowerCase().includes(normalizedFilter);
        if (nameMatch) {
          return true;
        }
        return table.columns.some((column) =>
          column.name.toLowerCase().includes(normalizedFilter),
        );
      })
    : schema;
  const normalizedGiftPriceFilter = giftPriceFilter.trim().toLowerCase();
  const filteredGiftPrices = normalizedGiftPriceFilter
    ? giftPrices.filter((gift) => {
        const haystack =
          `${gift.name} ${gift.code} ${gift.description ?? ""}`.toLowerCase();
        return haystack.includes(normalizedGiftPriceFilter);
      })
    : giftPrices;
  const normalizedModelMetadataFilter = modelMetadataFilter.trim().toLowerCase();
  const filteredModelMetadataItems = normalizedModelMetadataFilter
    ? modelMetadataItems.filter((item) => {
        const group = MODEL_METADATA_GROUP_BY_CATEGORY.get(item.category);
        const haystack =
          `${item.name} ${item.description} ${item.modelId} ${group?.label ?? ""}`.toLowerCase();
        return haystack.includes(normalizedModelMetadataFilter);
      })
    : modelMetadataItems;
  const selectedFontPreview =
    FONT_PREVIEW_OPTIONS.find((option) => option.id === fontPreviewId) ??
    FONT_PREVIEW_OPTIONS[0];

  let content: ReactNode = null;
  if (!authChecked) {
    content = (
      <div className="mt-6 text-sm text-slate-500">Проверка доступа...</div>
    );
  } else if (!isAdmin) {
    content = (
      <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Доступ запрещён.
      </div>
    );
  } else {
    content = (
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(340px,34%)_minmax(0,1fr)]">
        <div className="grid gap-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">
              Смена пароля
            </div>
            <div className="mt-3 grid gap-2">
              <input
                value={passwordEmail}
                onChange={(event) => setPasswordEmail(event.target.value)}
                placeholder="Email пользователя"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
              />
              <input
                type="password"
                value={passwordValue}
                onChange={(event) => setPasswordValue(event.target.value)}
                placeholder="Новый пароль"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
              />
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={passwordLoading}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-60"
              >
                {passwordLoading ? "Сохраняем..." : "Сменить пароль"}
              </button>
              {passwordNotice ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
                  {passwordNotice}
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">
              Начислить монеты
            </div>
            <div className="mt-3 grid gap-2">
              <input
                value={coinsEmail}
                onChange={(event) => setCoinsEmail(event.target.value)}
                placeholder="Email пользователя"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
              />
              <input
                type="number"
                min={1}
                max={1000000}
                value={coinsAmount}
                onChange={(event) => setCoinsAmount(event.target.value)}
                placeholder="Сколько монет добавить"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
              />
              <button
                type="button"
                onClick={addCoinsByEmail}
                disabled={coinsLoading}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-60"
              >
                {coinsLoading ? "Начисляем..." : "Добавить монеты"}
              </button>
              <p className="text-[11px] text-slate-500">
                Начисление идет напрямую на баланс пользователя. Это не
                считается оплатой и не увеличивает благотворительный фонд.
              </p>
              {coinsNotice ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
                  {coinsNotice}
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">
              CSV-аккаунты
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Формат строк: логин,email,пароль,начальный баланс. Первая строка с
              заголовками не нужна.
            </p>
            <div className="mt-3 grid gap-2">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  void handleBulkCsvFile(event.target.files?.[0] ?? null);
                  event.currentTarget.value = "";
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
              />
              {bulkAccountRows.length > 0 ? (
                <div className="max-h-[120px] overflow-auto rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600">
                  {bulkAccountRows.slice(0, 8).map((row) => (
                    <div key={`${row.email}-${row.login}`} className="truncate">
                      {row.login} · {row.email} · {row.initialBalance} монет
                    </div>
                  ))}
                  {bulkAccountRows.length > 8 ? (
                    <div className="mt-1 text-slate-400">
                      ...и ещё {bulkAccountRows.length - 8}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <button
                type="button"
                onClick={createBulkAccounts}
                disabled={bulkAccountLoading || bulkAccountRows.length === 0}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-60"
              >
                {bulkAccountLoading ? "Создаём..." : "Создать аккаунты"}
              </button>
              {bulkAccountNotice ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
                  {bulkAccountNotice}
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">
              Лимит мемориалов
            </div>
            <div className="mt-3 grid gap-2">
              <textarea
                value={limitEmails}
                onChange={(event) => setLimitEmails(event.target.value)}
                placeholder="Email или несколько email через запятую / с новой строки"
                className="min-h-[76px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
              />
              <input
                type="number"
                min={0}
                max={10000}
                value={limitValue}
                onChange={(event) => setLimitValue(event.target.value)}
                placeholder="Максимум мемориалов"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
              />
              <button
                type="button"
                onClick={updateMemorialLimit}
                disabled={limitSaving}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-60"
              >
                {limitSaving ? "Сохраняем..." : "Обновить лимит"}
              </button>
              <p className="text-[11px] text-slate-500">
                По умолчанию — 5 мемориалов. Для owner всегда действует лимит
                10000.
              </p>
              {limitNotice ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
                  {limitNotice}
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">
              Тарифы и подарки
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Цены указываются в монетах. Тарифы применяются при создании и
              продлении мемориалов, цены подарков — при дарении.
            </p>
            {pricingLoading &&
            memorialPlanPrices.length === 0 &&
            giftPrices.length === 0 ? (
              <div className="mt-3 text-xs text-slate-500">Загрузка...</div>
            ) : null}
            {pricingError ? (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                {pricingError}
              </div>
            ) : null}
            {pricingNotice ? (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
                {pricingNotice}
              </div>
            ) : null}
            <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
              <input
                type="checkbox"
                checked={memorialPublicationMode.freeLifetime}
                disabled={savingPublicationMode}
                onChange={(event) => {
                  const freeLifetime = event.target.checked;
                  setMemorialPublicationMode({ freeLifetime });
                  void saveMemorialPublicationMode(freeLifetime);
                }}
                className="mt-1 h-4 w-4 accent-emerald-500"
              />
              <span className="grid gap-1 text-xs text-slate-600">
                <span className="font-semibold text-slate-800">
                  Бесплатная бессрочная публикация
                </span>
                <span>
                  Если включено, пользователи не видят выбор аренды при
                  публикации, мемориал создается навсегда и монеты не
                  списываются. Тарифы ниже сохраняются для будущего платного
                  режима.
                </span>
                {savingPublicationMode ? (
                  <span className="text-[11px] text-slate-400">
                    Сохраняем режим...
                  </span>
                ) : null}
              </span>
            </label>
            <div className="mt-3 grid gap-2">
              <div className="text-[11px] font-semibold uppercase text-slate-500">
                Аренда мемориала
              </div>
              {memorialPlanPrices.map((plan) => (
                <div
                  key={plan.years}
                  className="grid grid-cols-[1fr_88px] items-center gap-2 rounded-lg border border-slate-200 bg-white p-2"
                >
                  <div className="text-xs font-semibold text-slate-700">
                    {formatPlanYears(plan.years)}
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      value={plan.price}
                      onChange={(event) =>
                        updateMemorialPlanPriceDraft(
                          plan.years,
                          Number(event.target.value),
                        )
                      }
                      className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() => saveMemorialPlanPrice(plan)}
                      disabled={savingPlanYears === plan.years}
                      className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-60"
                    >
                      {savingPlanYears === plan.years ? "..." : "OK"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-2">
              <div className="text-[11px] font-semibold uppercase text-slate-500">
                Подарки
              </div>
              <p className="text-[11px] text-slate-500">
                Настройте название, описание и цену. Карточка слева показывает,
                какой подарок редактируется.
              </p>
              <input
                value={giftPriceFilter}
                onChange={(event) => setGiftPriceFilter(event.target.value)}
                placeholder="Фильтр по названию, описанию или code"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
              />
              <div className="max-h-[520px] space-y-3 overflow-auto pr-1">
                {filteredGiftPrices.length === 0 && !pricingLoading ? (
                  <div className="text-xs text-slate-500">
                    Подарки не найдены
                  </div>
                ) : null}
                {filteredGiftPrices.map((gift) => {
                  const iconUrl = resolveGiftIconUrl(gift);
                  const fallbackIcon =
                    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'><rect width='128' height='128' rx='24' fill='%23f7f1ee'/><path d='M64 28l10 20 22 3-16 15 4 22-20-10-20 10 4-22-16-15 22-3 10-20z' fill='%23d3a27f'/></svg>";
                  return (
                    <div
                      key={gift.id}
                      className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[104px_1fr]"
                    >
                      <div className="min-w-0">
                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[#fffcf9] p-1 shadow-sm">
                          <img
                            src={iconUrl ?? fallbackIcon}
                            alt=""
                            className="aspect-square w-full rounded-xl object-cover"
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.onerror = null;
                              event.currentTarget.src = fallbackIcon;
                            }}
                          />
                          <div className="mt-1 truncate px-1 text-center text-[10px] font-semibold text-slate-500">
                            {gift.code}
                          </div>
                        </div>
                      </div>
                      <div className="grid min-w-0 gap-2">
                        <label className="grid gap-1">
                          <span className="text-[10px] font-semibold uppercase text-slate-500">
                            Название
                          </span>
                          <input
                            value={gift.name}
                            onChange={(event) =>
                              updateGiftDraft(gift.id, {
                                name: event.target.value,
                              })
                            }
                            maxLength={80}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800"
                          />
                        </label>
                        <label className="grid gap-1">
                          <span className="text-[10px] font-semibold uppercase text-slate-500">
                            Описание
                          </span>
                          <textarea
                            value={gift.description ?? ""}
                            onChange={(event) =>
                              updateGiftDraft(gift.id, {
                                description: event.target.value,
                              })
                            }
                            maxLength={260}
                            rows={3}
                            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700"
                          />
                        </label>
                        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
                          <label className="grid gap-1">
                            <span className="text-[10px] font-semibold uppercase text-slate-500">
                              Цена, монеты
                            </span>
                            <input
                              type="number"
                              min={0}
                              value={gift.price}
                              onChange={(event) =>
                                updateGiftDraft(gift.id, {
                                  price: Number(event.target.value),
                                })
                              }
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => saveGiftPrice(gift)}
                            disabled={savingGiftId === gift.id}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-60"
                          >
                            {savingGiftId === gift.id
                              ? "Сохраняем..."
                              : "Сохранить"}
                          </button>
                        </div>
                        <div className="truncate text-[10px] text-slate-400">
                          Модель: {gift.modelUrl}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              <div className="text-[11px] font-semibold uppercase text-slate-500">
                Домики и детали
              </div>
              <p className="text-[11px] text-slate-500">
                Настройте название и описание для домиков и деталей. Эти данные
                хранятся отдельно от генератора моделей и не слетают при
                обновлении ассетов.
              </p>
              {modelMetadataNotice ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
                  {modelMetadataNotice}
                </div>
              ) : null}
              {modelMetadataError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                  {modelMetadataError}
                </div>
              ) : null}
              <input
                value={modelMetadataFilter}
                onChange={(event) => setModelMetadataFilter(event.target.value)}
                placeholder="Фильтр по названию, описанию, id или типу"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
              />
              <div className="max-h-[620px] space-y-3 overflow-auto pr-1">
                {filteredModelMetadataItems.length === 0 &&
                !modelMetadataLoading ? (
                  <div className="text-xs text-slate-500">
                    Модели не найдены
                  </div>
                ) : null}
                {modelMetadataLoading ? (
                  <div className="text-xs text-slate-500">
                    Загружаем подписи моделей...
                  </div>
                ) : null}
                {filteredModelMetadataItems.map((item) => {
                  const group = MODEL_METADATA_GROUP_BY_CATEGORY.get(
                    item.category,
                  );
                  const saveKey = modelMetadataKey(
                    item.category,
                    item.modelId,
                  );
                  return (
                    <div
                      key={saveKey}
                      className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[104px_1fr]"
                    >
                      <div className="min-w-0">
                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[#fffcf9] p-2 shadow-sm">
                          <img
                            src={item.imageUrl ?? MODEL_PLACEHOLDER_ICON}
                            alt=""
                            className="aspect-square w-full rounded-xl bg-[#fff8f3] object-contain"
                            loading="lazy"
                            onError={(event) => {
                              event.currentTarget.onerror = null;
                              event.currentTarget.src = MODEL_PLACEHOLDER_ICON;
                            }}
                          />
                          <div className="mt-1 truncate px-1 text-center text-[10px] font-semibold text-slate-500">
                            {group?.itemLabel ?? item.category}
                          </div>
                        </div>
                      </div>
                      <div className="grid min-w-0 gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[#f7f1ee] px-2 py-1 text-[10px] font-semibold text-[#8d6e63]">
                            {group?.label ?? item.category}
                          </span>
                          <span className="truncate text-[10px] text-slate-400">
                            {item.modelId}
                          </span>
                        </div>
                        <label className="grid gap-1">
                          <span className="text-[10px] font-semibold uppercase text-slate-500">
                            Название
                          </span>
                          <input
                            value={item.name}
                            onChange={(event) =>
                              updateModelMetadataDraft(item, {
                                name: event.target.value,
                              })
                            }
                            maxLength={80}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-800"
                          />
                        </label>
                        <label className="grid gap-1">
                          <span className="text-[10px] font-semibold uppercase text-slate-500">
                            Описание
                          </span>
                          <textarea
                            value={item.description}
                            onChange={(event) =>
                              updateModelMetadataDraft(item, {
                                description: event.target.value,
                              })
                            }
                            maxLength={260}
                            rows={3}
                            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700"
                          />
                        </label>
                        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
                          <div className="truncate text-[10px] text-slate-400">
                            Модель: {item.modelUrl ?? "нет отдельной модели"}
                          </div>
                          <button
                            type="button"
                            onClick={() => saveModelMetadataItem(item)}
                            disabled={modelMetadataSavingKey === saveKey}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-60"
                          >
                            {modelMetadataSavingKey === saveKey
                              ? "Сохраняем..."
                              : "Сохранить"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">
              Шрифты интерфейса
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Сейчас сайт использует Noto Sans как webfont. Он загружается
              приложением и одинаково применяется на iPhone, Android и десктопе.
              Системный стек оставлен только для сравнения.
            </p>
            <div className="mt-3 grid gap-2">
              <div className="grid grid-cols-2 gap-2">
                {FONT_PREVIEW_OPTIONS.map((option) => {
                  const isActive = selectedFontPreview.id === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setFontPreviewId(option.id)}
                      className={`rounded-lg border px-3 py-2 text-left transition ${
                        isActive
                          ? "border-[#3bceac] bg-[#f0fffb] text-[#5d4037]"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      }`}
                      style={{ fontFamily: option.family }}
                    >
                      <span className="block text-sm font-black">
                        {option.label}
                      </span>
                      <span className="mt-1 inline-flex rounded-full bg-white/80 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-slate-500">
                        {option.badge}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div
                className="rounded-xl border border-white bg-white p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
                style={{ fontFamily: selectedFontPreview.family }}
              >
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d3a27f]">
                  Пример выбранного шрифта
                </div>
                <div className="mt-2 text-2xl font-black leading-tight text-[#5d4037]">
                  МЯУГАВ создаёт тёплые 3D‑мемориалы
                </div>
                <p className="mt-2 text-sm font-semibold leading-snug text-[#8d6e63]">
                  Барсик, 2014 — 2026. Создавайте памятные страницы, дарите
                  подарки и отмечайте питомцев на карте.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-[#111827] px-4 py-2 text-[11px] font-black uppercase tracking-[0.1em] text-white">
                    + создать
                  </span>
                  <span className="rounded-full border border-[#eadfd9] bg-[#fffcf9] px-4 py-2 text-[11px] font-black uppercase tracking-[0.1em] text-[#8d6e63]">
                    открыть мемориал
                  </span>
                </div>
                <p className="mt-3 text-[11px] font-semibold leading-snug text-slate-500">
                  {selectedFontPreview.note}
                </p>
              </div>
            </div>
          </div>

          {canManageAdmins(accessLevel) ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase text-slate-500">
                Управление доступами
              </div>
              <div className="mt-3 grid gap-2">
                <input
                  value={roleEmail}
                  onChange={(event) => setRoleEmail(event.target.value)}
                  placeholder="Email пользователя"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => updateAccessRole("ADMIN")}
                    disabled={roleSaving !== null}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-60"
                  >
                    {roleSaving === "ADMIN"
                      ? "Сохраняем..."
                      : "Сделать админом"}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateAccessRole("USER")}
                    disabled={roleSaving !== null}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-60"
                  >
                    {roleSaving === "USER"
                      ? "Сохраняем..."
                      : "Понизить до user"}
                  </button>
                </div>
                {roleNotice ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
                    {roleNotice}
                  </div>
                ) : null}
                {accessUsersError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                    {accessUsersError}
                  </div>
                ) : null}
                <div className="max-h-[240px] space-y-2 overflow-auto pr-1">
                  {accessUsersLoading && accessUsers.length === 0 ? (
                    <div className="text-xs text-slate-500">Загрузка...</div>
                  ) : null}
                  {accessUsers.map((user) => (
                    <div
                      key={user.id}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600"
                    >
                      <div className="font-semibold text-slate-800">
                        {user.email}
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span>{user.login || "—"}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 font-semibold ${
                            user.accessLevel === "OWNER"
                              ? "bg-amber-100 text-amber-700"
                              : user.accessLevel === "ADMIN"
                                ? "bg-sky-100 text-sky-700"
                                : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {user.accessLevel}
                        </span>
                      </div>
                      <div className="mt-1 text-[10px] text-slate-500">
                        Мемориалов: {user.memorialCount ?? 0}/
                        {user.maxMemorials ?? 5}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">
              Питомец по ID
            </div>
            <input
              value={petId}
              onChange={(event) => setPetId(event.target.value)}
              placeholder="ID питомца"
              className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
            />
            <div className="mt-3 grid gap-2">
              <button
                type="button"
                onClick={() => handlePetAction("disable")}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:border-slate-300"
              >
                Отключить питомца (сделать приватным)
              </button>
              <button
                type="button"
                onClick={() => handlePetAction("memorial")}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:border-slate-300"
              >
                Удалить мемориал
              </button>
              <button
                type="button"
                onClick={() => handlePetAction("photos")}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:border-slate-300"
              >
                Удалить фото питомца
              </button>
              <button
                type="button"
                onClick={() => handlePetAction("delete")}
                className="rounded-lg border border-red-200 bg-white px-3 py-2 text-left text-xs font-semibold text-red-700 hover:border-red-300"
              >
                Удалить питомца полностью
              </button>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Удаление питомца также удалит маркер, мемориал и фото по каскаду.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">
              Верхняя плашка
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Тонкая плашка показывается сверху на главной странице, карте и
              странице «Мои питомцы».
            </p>
            <div className="mt-3 grid gap-2">
              <textarea
                value={siteBanner.text}
                onChange={(event) =>
                  setSiteBanner((prev) => ({
                    ...prev,
                    text: event.target.value,
                  }))
                }
                placeholder="Например: Сегодня ночью возможны технические работы."
                className="min-h-[70px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                maxLength={220}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-[11px] text-slate-600">
                  <input
                    type="checkbox"
                    checked={siteBanner.isActive}
                    onChange={(event) =>
                      setSiteBanner((prev) => ({
                        ...prev,
                        isActive: event.target.checked,
                      }))
                    }
                  />
                  Показывать плашку
                </label>
                <span className="text-[10px] text-slate-400">
                  {siteBanner.text.length}/220
                </span>
              </div>
              <button
                type="button"
                onClick={saveSiteBanner}
                disabled={siteBannerSaving || siteBannerLoading}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-60"
              >
                {siteBannerSaving
                  ? "Сохраняем..."
                  : siteBannerLoading
                    ? "Загрузка..."
                    : "Сохранить плашку"}
              </button>
              {siteBannerNotice ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
                  {siteBannerNotice}
                </div>
              ) : null}
              {siteBannerError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                  {siteBannerError}
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">
              Подсказки загрузки
            </div>
            <div className="mt-3 grid gap-2">
              <div className="flex flex-col gap-2">
                <input
                  value={newTipText}
                  onChange={(event) => setNewTipText(event.target.value)}
                  placeholder="Новая подсказка"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                />
                <button
                  type="button"
                  onClick={createLoadingTip}
                  disabled={creatingTip}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-60"
                >
                  {creatingTip ? "Добавляем..." : "Добавить подсказку"}
                </button>
              </div>
              {loadingTipsError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                  {loadingTipsError}
                </div>
              ) : null}
              <div className="max-h-[260px] space-y-2 overflow-auto pr-1">
                {loadingTipsLoading && loadingTips.length === 0 ? (
                  <div className="text-xs text-slate-500">Загрузка...</div>
                ) : null}
                {!loadingTipsLoading && loadingTips.length === 0 ? (
                  <div className="text-xs text-slate-500">
                    Пока нет подсказок
                  </div>
                ) : null}
                {loadingTips.map((tip) => (
                  <div
                    key={tip.id}
                    className="rounded-lg border border-slate-200 bg-white p-2"
                  >
                    <textarea
                      value={tip.text}
                      onChange={(event) =>
                        updateLoadingTip(tip.id, { text: event.target.value })
                      }
                      className="min-h-[60px] w-full rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-700"
                    />
                    <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-600">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={tip.isActive}
                          onChange={(event) =>
                            updateLoadingTip(tip.id, {
                              isActive: event.target.checked,
                            })
                          }
                        />
                        Активна
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => saveLoadingTip(tip)}
                          className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900"
                          disabled={savingTipId === tip.id}
                        >
                          {savingTipId === tip.id
                            ? "Сохраняем..."
                            : "Сохранить"}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteLoadingTip(tip.id)}
                          className="rounded-md border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-600 hover:text-red-700"
                          disabled={deletingTipId === tip.id}
                        >
                          {deletingTipId === tip.id ? "Удаляем..." : "Удалить"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">
              Новости
            </div>
            <div className="mt-3 grid gap-2">
              <input
                value={newsTitle}
                onChange={(event) => setNewsTitle(event.target.value)}
                placeholder="Заголовок новости"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
              />
              <textarea
                value={newsBody}
                onChange={(event) => setNewsBody(event.target.value)}
                placeholder="Текст новости или предупреждения"
                className="min-h-[90px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
              />
              <label className="flex items-center gap-2 text-[11px] text-slate-600">
                <input
                  type="checkbox"
                  checked={newsActive}
                  onChange={(event) => setNewsActive(event.target.checked)}
                />
                Активна
              </label>
              <button
                type="button"
                onClick={createNewsPost}
                disabled={newsSaving}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-60"
              >
                {newsSaving ? "Публикуем..." : "Опубликовать новость"}
              </button>
              {newsNotice ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
                  {newsNotice}
                </div>
              ) : null}
              <div className="max-h-[220px] space-y-2 overflow-auto pr-1">
                {newsLoading && newsPosts.length === 0 ? (
                  <div className="text-xs text-slate-500">Загрузка...</div>
                ) : null}
                {newsPosts.map((post) => (
                  <div
                    key={post.id}
                    className="rounded-lg border border-slate-200 bg-white p-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 text-xs font-semibold text-slate-800">
                        {post.title}
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteNewsPost(post.id)}
                        disabled={deletingNewsId === post.id}
                        className="shrink-0 rounded-md border border-red-200 px-2 py-1 text-[10px] font-semibold text-red-600 hover:text-red-700 disabled:opacity-60"
                      >
                        {deletingNewsId === post.id ? "Удаляем..." : "Удалить"}
                      </button>
                    </div>
                    <div className="mt-1 line-clamp-3 text-[11px] text-slate-500">
                      {post.body}
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400">
                      {post.isActive ? "активна" : "скрыта"} ·{" "}
                      {new Date(post.createdAt).toLocaleDateString("ru-RU")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">
              Документы PDF
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Загруженные PDF попадают в историю документа на страницах
              политики и оферты.
            </p>
            <div className="mt-3 grid gap-2">
              <select
                value={documentType}
                onChange={(event) =>
                  setDocumentType(event.target.value as "offer" | "politics")
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
              >
                <option value="offer">Публичная оферта</option>
                <option value="politics">
                  Политика обработки персональных данных
                </option>
              </select>
              <input
                value={documentTitle}
                onChange={(event) => setDocumentTitle(event.target.value)}
                placeholder="Название редакции"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
              />
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) =>
                  setDocumentFile(event.target.files?.[0] ?? null)
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
              />
              <button
                type="button"
                onClick={uploadDocumentRevision}
                disabled={documentUploading}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:border-slate-300 disabled:opacity-60"
              >
                {documentUploading
                  ? "Загружаем..."
                  : "Загрузить новый документ"}
              </button>
              {documentNotice ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
                  {documentNotice}
                </div>
              ) : null}
              <div className="max-h-[180px] space-y-2 overflow-auto pr-1">
                {documentLoading && documentRevisions.length === 0 ? (
                  <div className="text-xs text-slate-500">Загрузка...</div>
                ) : null}
                {documentRevisions.slice(0, 12).map((revision) => (
                  <a
                    key={revision.id}
                    href={revision.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-lg border border-slate-200 bg-white p-2 text-[11px] text-slate-600 hover:border-slate-300"
                  >
                    <span className="font-semibold text-slate-800">
                      {revision.documentType === "politics"
                        ? "Политика"
                        : "Оферта"}{" "}
                      · {revision.title}
                    </span>
                    <span className="mt-1 block text-slate-400">
                      {new Date(revision.createdAt).toLocaleDateString("ru-RU")}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">
              Быстрые запросы
            </div>
            <div className="mt-3 grid gap-2">
              {QUICK_QUERIES.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => applyQuery(item.query)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:border-slate-300"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">
              Нагрузочный прогон
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Браузер запускает серию параллельных admin-only запросов к API с
              DB probe. Это удобный smoke-тест под реальной HTTP-нагрузкой, но
              не полноценный benchmark.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {LOAD_TEST_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => runLoadTest(preset)}
                  disabled={loadTestRunning}
                  className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold disabled:opacity-60 ${
                    preset.multiplier
                      ? "border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-400"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <div>{preset.label}</div>
                  <div className="mt-1 text-[10px] font-normal text-slate-500">
                    {preset.totalRequests.toLocaleString("ru-RU")} запросов,
                    concurrency {preset.concurrency.toLocaleString("ru-RU")}
                  </div>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] font-semibold text-amber-700">
              Экстремальные пресеты создают реальную нагрузку. Запускайте их
              только в согласованное окно и будьте готовы остановить прогон.
            </p>
            {loadTestRunning ? (
              <button
                type="button"
                onClick={stopLoadTest}
                className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 text-left text-xs font-semibold text-red-700 hover:border-red-300"
              >
                Остановить прогон
              </button>
            ) : null}
            {loadTestProgress ? (
              <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-800">
                    {loadTestProgress.label}: {loadTestProgress.completed}/
                    {loadTestProgress.totalRequests}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    ok {loadTestProgress.okCount} · fail{" "}
                    {loadTestProgress.failCount} · concurrency{" "}
                    {loadTestProgress.concurrency}
                  </div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-slate-900 transition-[width] duration-150 ease-out"
                    style={{
                      width: `${Math.min(
                        100,
                        loadTestProgress.totalRequests > 0
                          ? (loadTestProgress.completed /
                              loadTestProgress.totalRequests) *
                              100
                          : 0,
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ) : null}
            {loadTestSummary ? (
              <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                <div className="grid gap-2 text-[11px] text-slate-600 sm:grid-cols-2">
                  <div>
                    Всего времени:{" "}
                    <span className="font-semibold text-slate-800">
                      {formatMs(loadTestSummary.totalDurationMs)}
                    </span>
                  </div>
                  <div>
                    Скорость:{" "}
                    <span className="font-semibold text-slate-800">
                      {loadTestSummary.requestsPerSecond.toFixed(1)} req/s
                    </span>
                  </div>
                  <div>
                    Средняя задержка:{" "}
                    <span className="font-semibold text-slate-800">
                      {formatMs(loadTestSummary.avgMs)}
                    </span>
                  </div>
                  <div>
                    P95:{" "}
                    <span className="font-semibold text-slate-800">
                      {formatMs(loadTestSummary.p95Ms)}
                    </span>
                  </div>
                  <div>
                    Max:{" "}
                    <span className="font-semibold text-slate-800">
                      {formatMs(loadTestSummary.maxMs)}
                    </span>
                  </div>
                  <div>
                    Server P95:{" "}
                    <span className="font-semibold text-slate-800">
                      {formatMs(loadTestSummary.p95ServerMs)}
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-slate-500">
                  {describeLoadSummary(loadTestSummary)}
                </p>
              </div>
            ) : null}
            {loadTestError ? (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                {loadTestError}
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase text-slate-500">
              Синтетические пользователи
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Это приближённая симуляция онлайн-пользователей: виртуальные
              пользователи крутят реальные сценарии проекта с паузами между
              действиями. Профиль: карта 40%, мои питомцы 25%, мемориал 20%,
              подарок 10%, редактирование 5%.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {SYNTHETIC_USER_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => runSyntheticUsers(preset)}
                  disabled={syntheticRunning}
                  className={`rounded-lg border px-3 py-2 text-left text-xs font-semibold disabled:opacity-60 ${
                    preset.multiplier
                      ? "border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-400"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <div>{preset.label}</div>
                  <div className="mt-1 text-[10px] font-normal text-slate-500">
                    {Math.round(preset.durationMs / 1000)} сек, до{" "}
                    {preset.virtualUsers.toLocaleString("ru-RU")} VU
                  </div>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] font-semibold text-amber-700">
              Пресеты ×50 и ×100 могут заметно нагрузить браузер вместе с
              сервером. Кнопка остановки остаётся доступной во время теста.
            </p>
            {syntheticRunning ? (
              <button
                type="button"
                onClick={stopSyntheticRun}
                className="mt-3 rounded-lg border border-red-200 bg-white px-3 py-2 text-left text-xs font-semibold text-red-700 hover:border-red-300"
              >
                Остановить сценарий
              </button>
            ) : null}
            {syntheticProgress ? (
              <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-800">
                    {syntheticProgress.label}:{" "}
                    {Math.round(syntheticProgress.elapsedMs / 1000)} /{" "}
                    {Math.round(syntheticProgress.durationMs / 1000)} сек
                  </div>
                  <div className="text-[11px] text-slate-500">
                    active {syntheticProgress.activeUsers} · flows{" "}
                    {syntheticProgress.completedFlows} · req{" "}
                    {syntheticProgress.totalRequests}
                  </div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-slate-900 transition-[width] duration-150 ease-out"
                    style={{
                      width: `${Math.min(
                        100,
                        syntheticProgress.durationMs > 0
                          ? (syntheticProgress.elapsedMs /
                              syntheticProgress.durationMs) *
                              100
                          : 0,
                      )}%`,
                    }}
                  />
                </div>
                <div className="mt-3 grid gap-2 text-[11px] text-slate-600 sm:grid-cols-2">
                  <div>
                    ok {syntheticProgress.okCount} · fail{" "}
                    {syntheticProgress.failCount}
                  </div>
                  <div>
                    виртуальных пользователей: {syntheticProgress.virtualUsers}
                  </div>
                  {SYNTHETIC_SCENARIOS.map((scenario) => (
                    <div key={scenario.id}>
                      {scenario.label}:{" "}
                      {syntheticProgress.scenarioCounts[scenario.id]}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {syntheticSummary ? (
              <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                <div className="grid gap-2 text-[11px] text-slate-600 sm:grid-cols-2">
                  <div>
                    Длительность:{" "}
                    <span className="font-semibold text-slate-800">
                      {formatMs(syntheticSummary.actualDurationMs)}
                    </span>
                  </div>
                  <div>
                    Скорость:{" "}
                    <span className="font-semibold text-slate-800">
                      {syntheticSummary.requestsPerSecond.toFixed(1)} req/s
                    </span>
                  </div>
                  <div>
                    Средний request:{" "}
                    <span className="font-semibold text-slate-800">
                      {formatMs(syntheticSummary.avgRequestMs)}
                    </span>
                  </div>
                  <div>
                    P95 request:{" "}
                    <span className="font-semibold text-slate-800">
                      {formatMs(syntheticSummary.p95RequestMs)}
                    </span>
                  </div>
                  <div>
                    Средний flow:{" "}
                    <span className="font-semibold text-slate-800">
                      {formatMs(syntheticSummary.avgFlowMs)}
                    </span>
                  </div>
                  <div>
                    P95 flow:{" "}
                    <span className="font-semibold text-slate-800">
                      {formatMs(syntheticSummary.p95FlowMs)}
                    </span>
                  </div>
                  <div>
                    Max request:{" "}
                    <span className="font-semibold text-slate-800">
                      {formatMs(syntheticSummary.maxRequestMs)}
                    </span>
                  </div>
                  <div>
                    Flow/min:{" "}
                    <span className="font-semibold text-slate-800">
                      {syntheticSummary.flowsPerMinute.toFixed(1)}
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-slate-500">
                  {describeSyntheticSummary(syntheticSummary)}
                </p>
              </div>
            ) : null}
            {syntheticError ? (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                {syntheticError}
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase text-slate-500">
                Таблицы
              </div>
              <button
                type="button"
                onClick={refreshSchema}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                disabled={schemaLoading}
              >
                {schemaLoading ? "..." : "Обновить"}
              </button>
            </div>
            <input
              value={schemaFilter}
              onChange={(event) => setSchemaFilter(event.target.value)}
              placeholder="Фильтр таблиц"
              className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
            />
            {schemaError ? (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {schemaError}
              </div>
            ) : null}
            <div className="mt-3 max-h-[360px] space-y-2 overflow-auto pr-1">
              {schemaLoading && schema.length === 0 ? (
                <div className="text-xs text-slate-500">Загрузка...</div>
              ) : null}
              {!schemaLoading && filteredTables.length === 0 ? (
                <div className="text-xs text-slate-500">Ничего не найдено</div>
              ) : null}
              {filteredTables.map((table) => (
                <div
                  key={table.name}
                  className="rounded-lg border border-slate-200 bg-white p-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => toggleTable(table.name)}
                      className="text-left text-xs font-semibold text-slate-800"
                    >
                      {expandedTables[table.name] ? "▾" : "▸"} {table.name}
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => applyQuery(buildSelectQuery(table.name))}
                        className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:text-slate-900"
                      >
                        SELECT
                      </button>
                      <button
                        type="button"
                        onClick={() => applyQuery(buildCountQuery(table.name))}
                        className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:text-slate-900"
                      >
                        COUNT
                      </button>
                    </div>
                  </div>
                  {expandedTables[table.name] ? (
                    <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                      {table.columns.map((column) => (
                        <div
                          key={column.name}
                          className="flex items-center justify-between"
                        >
                          <span>{column.name}</span>
                          <span className="text-slate-400">
                            {column.type}
                            {column.nullable ? " · null" : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          <SkyTuningPreview />
          <DirtModelPreview />

          <textarea
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder='SELECT * FROM "User" LIMIT 20;'
            className="min-h-[180px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={runQuery}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              disabled={running}
            >
              {running ? "Выполняю..." : "Выполнить"}
            </button>
            {result ? (
              <span className="text-sm text-slate-500">
                {result.type === "select"
                  ? `Строк: ${result.rowCount ?? 0}`
                  : result.rows
                    ? `${result.type === "update" ? "Обновлено" : "Удалено"} строк: ${result.rowCount ?? 0}`
                    : `${result.type === "update" ? "Обновлено" : "Удалено"}: ${result.affected ?? 0}`}
              </span>
            ) : null}
          </div>

          {result ? (
            <pre className="max-h-[420px] overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
              {JSON.stringify(result, null, 2)}
            </pre>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-var(--app-header-height,56px))] bg-[#fcf8f5] px-6 py-10">
      <div className="mx-auto w-full max-w-[90vw] rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-slate-900">
            Админ · SQL консоль
          </h1>
          <div className="flex flex-wrap gap-2">
            <a
              href="/admin/video"
              className="rounded-[16px] bg-[#fffcf9] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#5d4037] shadow-[0_10px_24px_rgba(93,64,55,0.12)] transition hover:-translate-y-0.5"
            >
              Видео
            </a>
            <a
              href="/admin/moderation"
              className="rounded-[16px] bg-[#fffcf9] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#5d4037] shadow-[0_10px_24px_rgba(93,64,55,0.12)] transition hover:-translate-y-0.5"
            >
              Модерация
            </a>
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Разрешены только SELECT, DELETE и UPDATE. Выполняется на сервере API.
        </p>
        {content}
      </div>
      {error ? (
        <ErrorToast message={error} onClose={() => setError(null)} />
      ) : null}
    </main>
  );
}
