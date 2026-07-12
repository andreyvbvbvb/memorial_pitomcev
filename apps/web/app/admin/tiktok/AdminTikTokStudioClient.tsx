"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../../lib/config";
import { canAccessAdmin, type AccessLevel } from "../../../lib/access";

type ClipLanguage = "ru" | "en";
type ClipDuration = 15 | 30 | 45 | 60;
type ClipTone = "warm" | "tutorial" | "calm" | "product";
type ClipGoal = "awareness" | "education" | "feature" | "update";

type TikTokIdea = {
  id: string;
  title: string;
  label: string;
  goal: ClipGoal;
  format: string;
  hook: Record<ClipLanguage, string>;
  core: Record<ClipLanguage, string>;
  shots: Record<ClipLanguage, string[]>;
  overlays: Record<ClipLanguage, string[]>;
  hashtags: string[];
};

type GeneratedScene = {
  time: string;
  shot: string;
  overlay: string;
  voice: string;
};

type GeneratedPlan = {
  title: string;
  hook: string;
  scenes: GeneratedScene[];
  description: string;
  checklist: string[];
  hashtags: string;
};

const TIKTOK_IDEAS: TikTokIdea[] = [
  {
    id: "memory-place",
    title: "Из фото в место памяти",
    label: "Эмоциональный ролик про превращение фотографии в 3D-мемориал",
    goal: "awareness",
    format: "story",
    hook: {
      ru: "Одна фотография может стать целым местом памяти.",
      en: "One photo can become a whole place of memory.",
    },
    core: {
      ru: "Покажи, как из имени, дат, истории и 3D-сцены рождается личный мемориал МЯУГАВ.",
      en: "Show how a name, dates, story and 3D scene become a personal МЯУГАВ memorial.",
    },
    shots: {
      ru: [
        "Крупно: фото питомца или мягкий кадр с домашним архивом.",
        "Экран создания: имя, даты и теплые слова появляются по шагам.",
        "3D-сцена: домик, поверхность, детали и душа питомца.",
        "Финал: мемориал на карте и спокойный общий план.",
      ],
      en: [
        "Close-up: pet photo or a soft family archive shot.",
        "Builder screen: name, dates and warm words appear step by step.",
        "3D scene: house, surface, details and the pet soul.",
        "Final: memorial on the map and a calm wide shot.",
      ],
    },
    overlays: {
      ru: ["Фото", "История", "3D-мемориал", "Место на карте памяти"],
      en: ["Photo", "Story", "3D memorial", "A place on the memory map"],
    },
    hashtags: ["#мяугав", "#памятьопитомце", "#3Dмемориал"],
  },
  {
    id: "one-minute",
    title: "Как создать за минуту",
    label: "Пошаговый туториал для новых пользователей",
    goal: "education",
    format: "tutorial",
    hook: {
      ru: "Мемориал питомца можно собрать за несколько простых шагов.",
      en: "A pet memorial can be created in a few simple steps.",
    },
    core: {
      ru: "Покажи короткий путь: данные, фотографии, карта, 3D-сцена, публикация.",
      en: "Show the short path: details, photos, map, 3D scene, publishing.",
    },
    shots: {
      ru: [
        "Шаг 1: заполнение имени и вида питомца.",
        "Шаг 2: добавление истории и фотографий.",
        "Шаг 3: выбор точки на карте.",
        "Шаг 4: сборка 3D-мемориала и публикация.",
      ],
      en: [
        "Step 1: add pet name and type.",
        "Step 2: add story and photos.",
        "Step 3: choose a place on the map.",
        "Step 4: build the 3D memorial and publish.",
      ],
    },
    overlays: {
      ru: ["1. Данные", "2. История", "3. Карта", "4. 3D-сцена"],
      en: ["1. Details", "2. Story", "3. Map", "4. 3D scene"],
    },
    hashtags: ["#мяугав", "#туториал", "#питомцы"],
  },
  {
    id: "gifts",
    title: "Подарки на мемориале",
    label: "Фича-ролик про свечи, цветы, игрушки и уход",
    goal: "feature",
    format: "feature",
    hook: {
      ru: "Иногда маленький знак внимания говорит больше слов.",
      en: "Sometimes a small sign of care says more than words.",
    },
    core: {
      ru: "Покажи выбор подарка, слот на мемориале и результат в 3D-сцене.",
      en: "Show gift selection, the slot on the memorial and the result in the 3D scene.",
    },
    shots: {
      ru: [
        "Открыт мемориал, подсвечены места для подарков.",
        "Выбор свечи, цветов, игрушки или угощения.",
        "Подарок появляется на своем месте в 3D.",
        "Крупный план подарков и финальный кадр мемориала.",
      ],
      en: [
        "Memorial open, gift places highlighted.",
        "Choose a candle, flowers, toy or treat.",
        "The gift appears in its 3D slot.",
        "Close-up of gifts and a final memorial shot.",
      ],
    },
    overlays: {
      ru: ["Выберите подарок", "Найдите место", "Подарок появился", "Память жива"],
      en: ["Choose a gift", "Find a place", "Gift appears", "Memory stays alive"],
    },
    hashtags: ["#мяугав", "#подарок", "#свечапамяти"],
  },
  {
    id: "map",
    title: "Карта памяти",
    label: "Ролик про общую карту и поиск мемориалов",
    goal: "feature",
    format: "map",
    hook: {
      ru: "У каждого питомца может быть свое место на карте памяти.",
      en: "Every pet can have a place on the memory map.",
    },
    core: {
      ru: "Покажи карту, переход в карточку, затем 3D-просмотр мемориала.",
      en: "Show the map, open a card, then enter the 3D memorial view.",
    },
    shots: {
      ru: [
        "Общий экран карты с несколькими мемориалами.",
        "Клик по маркеру питомца.",
        "Открытие карточки и переход в 3D.",
        "Финальный кадр: мемориал плывет в небе.",
      ],
      en: [
        "Wide map screen with several memorials.",
        "Tap a pet marker.",
        "Open the card and switch to 3D.",
        "Final shot: memorial floating in the sky.",
      ],
    },
    overlays: {
      ru: ["Общая карта", "Маркер питомца", "3D-просмотр", "МЯУГАВ"],
      en: ["Shared map", "Pet marker", "3D view", "МЯУГАВ"],
    },
    hashtags: ["#мяугав", "#картапамяти", "#питомцы"],
  },
  {
    id: "care",
    title: "Уход за мемориалом",
    label: "Ролик про чистоту мемориала и возвращение к странице",
    goal: "education",
    format: "before-after",
    hook: {
      ru: "Мемориал выглядит теплее, когда к нему возвращаются.",
      en: "A memorial feels warmer when people come back to care for it.",
    },
    core: {
      ru: "Покажи грязь на мемориале, клик по пятну и чистый финальный вид.",
      en: "Show dirt on the memorial, click a spot and reveal the clean final view.",
    },
    shots: {
      ru: [
        "Мемориал с несколькими пятнами грязи.",
        "Наведение на пятно и подсветка контура.",
        "Очистка одного пятна.",
        "Чистый мемориал и мягкий финальный кадр.",
      ],
      en: [
        "Memorial with several dirt spots.",
        "Hover a spot and show its outline.",
        "Clean one spot.",
        "Clean memorial and a soft final shot.",
      ],
    },
    overlays: {
      ru: ["Вернуться", "Почистить", "Осталось меньше", "Спасибо за заботу"],
      en: ["Come back", "Clean it", "Fewer spots left", "Thank you for caring"],
    },
    hashtags: ["#мяугав", "#уход", "#память"],
  },
  {
    id: "service-update",
    title: "Новость сервиса",
    label: "Короткое объявление о новых возможностях или работах",
    goal: "update",
    format: "announcement",
    hook: {
      ru: "У МЯУГАВ появилось важное обновление.",
      en: "МЯУГАВ has an important update.",
    },
    core: {
      ru: "Используй ролик для новости, технических работ или демонстрации новой функции.",
      en: "Use this for news, maintenance notices or a new feature showcase.",
    },
    shots: {
      ru: [
        "Короткий кадр главной страницы.",
        "Плашка новости или новая функция в интерфейсе.",
        "Один конкретный пример пользы.",
        "Призыв открыть сервис и посмотреть.",
      ],
      en: [
        "Short shot of the home page.",
        "News banner or the new feature in the interface.",
        "One clear user benefit.",
        "Call to open the service and check it.",
      ],
    },
    overlays: {
      ru: ["Обновление", "Что изменилось", "Зачем это нужно", "Посмотрите на сайте"],
      en: ["Update", "What changed", "Why it matters", "See it on the site"],
    },
    hashtags: ["#мяугав", "#обновление", "#сервис"],
  },
];
const DEFAULT_TIKTOK_IDEA = TIKTOK_IDEAS[0]!;

const TONE_COPY: Record<ClipTone, Record<ClipLanguage, string>> = {
  warm: {
    ru: "тепло и бережно, без спешки",
    en: "warm and careful, without rushing",
  },
  tutorial: {
    ru: "коротко, понятно и по шагам",
    en: "short, clear and step by step",
  },
  calm: {
    ru: "спокойно, почти как тихая открытка",
    en: "calmly, almost like a quiet card",
  },
  product: {
    ru: "продуктово: показать пользу и действие",
    en: "product-led: show value and action",
  },
};

const CTA_COPY: Record<ClipGoal, Record<ClipLanguage, string>> = {
  awareness: {
    ru: "Создайте теплое место памяти на МЯУГАВ.",
    en: "Create a warm place of memory on МЯУГАВ.",
  },
  education: {
    ru: "Откройте МЯУГАВ и попробуйте собрать мемориал.",
    en: "Open МЯУГАВ and try building a memorial.",
  },
  feature: {
    ru: "Зайдите на мемориал и посмотрите, как это выглядит в 3D.",
    en: "Open a memorial and see how it looks in 3D.",
  },
  update: {
    ru: "Подробности уже доступны на сайте МЯУГАВ.",
    en: "Details are already available on the МЯУГАВ website.",
  },
};

const CHECKLIST: Record<ClipLanguage, string[]> = {
  ru: [
    "Записывать вертикально 9:16, крупные элементы держать в центральной зоне.",
    "Первый кадр должен объяснять тему без звука.",
    "Титры делать короткими: 3-6 слов на экран.",
    "Не закрывать кнопками TikTok имя питомца и главный 3D-объект.",
  ],
  en: [
    "Record vertical 9:16 and keep key elements in the center safe area.",
    "The first frame should explain the topic without sound.",
    "Keep overlays short: 3-6 words per screen.",
    "Do not cover the pet name or main 3D object with TikTok UI.",
  ],
};

function buildGeneratedPlan(
  idea: TikTokIdea,
  duration: ClipDuration,
  tone: ClipTone,
  language: ClipLanguage,
): GeneratedPlan {
  const scenes = idea.shots[language];
  const overlays = idea.overlays[language];
  const sceneLength = Math.max(3, Math.floor(duration / scenes.length));
  const generatedScenes = scenes.map((shot, index) => {
    const start = index * sceneLength;
    const end = index === scenes.length - 1 ? duration : Math.min(duration, start + sceneLength);
    return {
      time: `${start}-${end} c`,
      shot,
      overlay: overlays[index] ?? overlays[overlays.length - 1] ?? idea.title,
      voice:
        index === 0
          ? idea.hook[language]
          : index === scenes.length - 1
            ? CTA_COPY[idea.goal][language]
            : idea.core[language],
    };
  });

  return {
    title: idea.title,
    hook: idea.hook[language],
    scenes: generatedScenes,
    description:
      language === "ru"
        ? `${idea.core.ru} Тон ролика: ${TONE_COPY[tone].ru}.`
        : `${idea.core.en} Tone: ${TONE_COPY[tone].en}.`,
    checklist: CHECKLIST[language],
    hashtags: idea.hashtags.join(" "),
  };
}

function formatPlan(plan: GeneratedPlan, language: ClipLanguage) {
  const labels =
    language === "ru"
      ? {
          topic: "Тема",
          hook: "Хук",
          scenes: "Сцены",
          overlay: "Титр",
          voice: "Закадр",
          description: "Описание",
          hashtags: "Хэштеги",
          checklist: "Проверить перед публикацией",
        }
      : {
          topic: "Topic",
          hook: "Hook",
          scenes: "Scenes",
          overlay: "Overlay",
          voice: "Voiceover",
          description: "Description",
          hashtags: "Hashtags",
          checklist: "Before publishing",
        };
  return [
    `${labels.topic}: ${plan.title}`,
    `${labels.hook}: ${plan.hook}`,
    "",
    `${labels.scenes}:`,
    ...plan.scenes.map(
      (scene) =>
        `${scene.time} — ${scene.shot}\n${labels.overlay}: ${scene.overlay}\n${labels.voice}: ${scene.voice}`,
    ),
    "",
    `${labels.description}: ${plan.description}`,
    `${labels.hashtags}: ${plan.hashtags}`,
    "",
    `${labels.checklist}:`,
    ...plan.checklist.map((item) => `- ${item}`),
  ].join("\n");
}

export default function AdminTikTokStudioClient() {
  const apiUrl = useMemo(() => API_BASE, []);
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIdeaId, setSelectedIdeaId] = useState(DEFAULT_TIKTOK_IDEA.id);
  const [duration, setDuration] = useState<ClipDuration>(30);
  const [tone, setTone] = useState<ClipTone>("warm");
  const [language, setLanguage] = useState<ClipLanguage>("ru");
  const [copied, setCopied] = useState(false);

  const selectedIdea =
    TIKTOK_IDEAS.find((idea) => idea.id === selectedIdeaId) ?? DEFAULT_TIKTOK_IDEA;
  const plan = useMemo(
    () => buildGeneratedPlan(selectedIdea, duration, tone, language),
    [duration, language, selectedIdea, tone],
  );
  const formattedPlan = useMemo(() => formatPlan(plan, language), [language, plan]);

  useEffect(() => {
    let isMounted = true;
    const checkAccess = async () => {
      try {
        const response = await fetch(`${apiUrl}/auth/me`, {
          credentials: "include",
        });
        if (!response.ok) {
          router.replace(`/auth?next=${encodeURIComponent("/admin/tiktok")}`);
          return;
        }
        const data = (await response.json()) as { accessLevel?: AccessLevel };
        if (!canAccessAdmin(data.accessLevel ?? "USER")) {
          router.replace("/");
          return;
        }
        if (isMounted) {
          setIsAdmin(true);
        }
      } catch {
        if (isMounted) {
          setError("Не удалось проверить доступ к TikTok-студии");
        }
      } finally {
        if (isMounted) {
          setAuthChecked(true);
        }
      }
    };
    void checkAccess();
    return () => {
      isMounted = false;
    };
  }, [apiUrl, router]);

  const copyPlan = async () => {
    try {
      await navigator.clipboard.writeText(formattedPlan);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Не удалось скопировать сценарий");
    }
  };

  const randomizeIdea = () => {
    const currentIndex = TIKTOK_IDEAS.findIndex((idea) => idea.id === selectedIdeaId);
    const nextIndex = (currentIndex + 1 + Math.floor(Math.random() * (TIKTOK_IDEAS.length - 1))) % TIKTOK_IDEAS.length;
    setSelectedIdeaId((TIKTOK_IDEAS[nextIndex] ?? DEFAULT_TIKTOK_IDEA).id);
  };

  if (!authChecked) {
    return (
      <main className="min-h-[calc(100vh-var(--app-header-height,56px))] bg-[#f5efe9] px-4 py-8 text-[#5d4037]">
        <div className="mx-auto max-w-3xl rounded-[28px] border border-white bg-[#fffcf9] p-6 text-sm font-black uppercase tracking-[0.14em] shadow-[0_20px_46px_-34px_rgba(93,64,55,0.55)]">
          Проверяем доступ...
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <main className="min-h-[calc(100vh-var(--app-header-height,56px))] bg-[#f5efe9] px-4 py-5 text-[#5d4037] sm:px-6">
      <div className="mx-auto grid w-full max-w-[1440px] gap-4">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white bg-[#fffcf9] px-5 py-4 shadow-[0_18px_46px_-34px_rgba(93,64,55,0.55)]">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#d3a27f]">
              Админ · TikTok
            </p>
            <h1 className="text-2xl font-black tracking-tight text-balance">
              TikTok-студия МЯУГАВ
            </h1>
            <p className="mt-1 max-w-3xl text-sm font-semibold leading-relaxed text-[#8d6e63] text-pretty">
              Быстрые сценарии для роликов: выберите идею, длительность, тон и язык, затем скопируйте готовый план съемки.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/sql"
              className="rounded-[16px] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#5d4037] shadow-sm transition-transform duration-150 active:scale-[0.96]"
            >
              Админка
            </Link>
            <Link
              href="/admin/video"
              className="rounded-[16px] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#5d4037] shadow-sm transition-transform duration-150 active:scale-[0.96]"
            >
              Видео
            </Link>
            <Link
              href="/admin/moderation"
              className="rounded-[16px] bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#5d4037] shadow-sm transition-transform duration-150 active:scale-[0.96]"
            >
              Модерация
            </Link>
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[440px_minmax(0,1fr)]">
          <section className="rounded-[28px] border border-white bg-[#fffcf9] p-4 shadow-[0_20px_50px_-38px_rgba(93,64,55,0.55)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d3a27f]">
                  Генератор
                </p>
                <h2 className="text-lg font-black">Настройки ролика</h2>
              </div>
              <button
                type="button"
                onClick={randomizeIdea}
                className="rounded-[16px] bg-[#111827] px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-white shadow-[0_4px_0_0_#000] transition-[transform,box-shadow] duration-150 active:translate-y-[3px] active:scale-[0.96] active:shadow-none"
              >
                Случайная идея
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#8d6e63]">
                  Идея
                </p>
                <div className="grid gap-2">
                  {TIKTOK_IDEAS.map((idea) => {
                    const isActive = selectedIdeaId === idea.id;
                    return (
                      <button
                        key={idea.id}
                        type="button"
                        onClick={() => setSelectedIdeaId(idea.id)}
                        className={`rounded-[20px] px-4 py-3 text-left transition-[transform,background-color,box-shadow] duration-150 active:scale-[0.96] ${
                          isActive
                            ? "bg-[#111827] text-white shadow-[0_5px_0_0_#000]"
                            : "bg-[#f7f1ee] text-[#5d4037] hover:bg-white"
                        }`}
                      >
                        <span className="block text-sm font-black">{idea.title}</span>
                        <span className={`mt-1 block text-xs leading-relaxed ${isActive ? "text-white/76" : "text-[#8d6e63]"}`}>
                          {idea.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div>
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#8d6e63]">
                    Длительность
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {([15, 30, 45, 60] as ClipDuration[]).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setDuration(value)}
                        className={`min-h-10 rounded-[14px] text-xs font-black tabular-nums transition-[transform,background-color,box-shadow] duration-150 active:scale-[0.96] ${
                          duration === value
                            ? "bg-[#111827] text-white shadow-[0_3px_0_0_#000]"
                            : "bg-[#f7f1ee] text-[#8d6e63] hover:bg-white"
                        }`}
                      >
                        {value} c
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#8d6e63]">
                    Язык ролика
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      ["ru", "Русский"],
                      ["en", "English"],
                    ] as Array<[ClipLanguage, string]>).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setLanguage(value)}
                        className={`min-h-10 rounded-[14px] text-xs font-black transition-[transform,background-color,box-shadow] duration-150 active:scale-[0.96] ${
                          language === value
                            ? "bg-[#111827] text-white shadow-[0_3px_0_0_#000]"
                            : "bg-[#f7f1ee] text-[#8d6e63] hover:bg-white"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#8d6e63]">
                  Тон
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {([
                    ["warm", "Теплый"],
                    ["tutorial", "Обучающий"],
                    ["calm", "Спокойный"],
                    ["product", "Продуктовый"],
                  ] as Array<[ClipTone, string]>).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTone(value)}
                      className={`min-h-10 rounded-[14px] text-xs font-black transition-[transform,background-color,box-shadow] duration-150 active:scale-[0.96] ${
                        tone === value
                          ? "bg-[#111827] text-white shadow-[0_3px_0_0_#000]"
                          : "bg-[#f7f1ee] text-[#8d6e63] hover:bg-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4">
            <div className="rounded-[28px] border border-white bg-[#fffcf9] p-5 shadow-[0_20px_50px_-38px_rgba(93,64,55,0.55)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d3a27f]">
                    Сценарий
                  </p>
                  <h2 className="text-xl font-black text-balance">{plan.title}</h2>
                </div>
                <button
                  type="button"
                  onClick={copyPlan}
                  className="rounded-[16px] bg-[#111827] px-5 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-white shadow-[0_4px_0_0_#000] transition-[transform,box-shadow] duration-150 active:translate-y-[3px] active:scale-[0.96] active:shadow-none"
                >
                  {copied ? "Скопировано" : "Скопировать"}
                </button>
              </div>

              <div className="mt-4 rounded-[22px] bg-[#f7f1ee] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#d3a27f]">
                  Хук
                </p>
                <p className="mt-1 text-lg font-black leading-snug text-pretty">
                  {plan.hook}
                </p>
              </div>

              <div className="mt-4 grid gap-3">
                {plan.scenes.map((scene) => (
                  <article
                    key={`${scene.time}-${scene.overlay}`}
                    className="rounded-[22px] border border-white bg-white p-4 shadow-[0_14px_30px_-26px_rgba(93,64,55,0.5)]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="rounded-full bg-[#111827] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white tabular-nums">
                        {scene.time}
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#d3a27f]">
                        Титр: {scene.overlay}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-bold leading-relaxed text-[#5d4037] text-pretty">
                      {scene.shot}
                    </p>
                    <p className="mt-2 rounded-[16px] bg-[#f7f1ee] px-3 py-2 text-sm font-semibold leading-relaxed text-[#8d6e63] text-pretty">
                      {scene.voice}
                    </p>
                  </article>
                ))}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="rounded-[28px] border border-white bg-[#fffcf9] p-5 shadow-[0_20px_50px_-38px_rgba(93,64,55,0.55)]">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d3a27f]">
                  Описание
                </p>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-[#8d6e63] text-pretty">
                  {plan.description}
                </p>
                <p className="mt-4 rounded-[18px] bg-[#f7f1ee] px-4 py-3 text-sm font-black leading-relaxed text-[#5d4037]">
                  {plan.hashtags}
                </p>
              </div>
              <div className="rounded-[28px] border border-white bg-[#fffcf9] p-5 shadow-[0_20px_50px_-38px_rgba(93,64,55,0.55)]">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d3a27f]">
                  Чеклист
                </p>
                <ul className="mt-3 grid gap-2">
                  {plan.checklist.map((item) => (
                    <li
                      key={item}
                      className="rounded-[18px] bg-[#f7f1ee] px-4 py-3 text-sm font-semibold leading-relaxed text-[#8d6e63] text-pretty"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </div>

        {error ? (
          <div className="fixed bottom-5 right-5 z-[1000] max-w-sm rounded-[22px] border border-white bg-[#fffcf9] px-5 py-4 text-sm font-bold text-[#5d4037] shadow-[0_18px_44px_-28px_rgba(93,64,55,0.6)]">
            {error}
            <button
              type="button"
              className="ml-4 text-[#d3a27f]"
              onClick={() => setError(null)}
            >
              Закрыть
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
