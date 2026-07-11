"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type AppLanguage = "ru" | "en";

type TranslationKey =
  | "brand"
  | "nav.create"
  | "nav.checking"
  | "nav.myPets"
  | "nav.pets"
  | "nav.profile"
  | "nav.map"
  | "nav.login"
  | "nav.menu"
  | "nav.openMenu"
  | "nav.closeMenu"
  | "nav.about"
  | "nav.charity"
  | "nav.news"
  | "nav.admin"
  | "nav.video"
  | "nav.giftSlots"
  | "nav.logout"
  | "nav.account"
  | "nav.balance"
  | "nav.coins"
  | "nav.topUp"
  | "nav.close"
  | "nav.continue"
  | "nav.memorialLimit"
  | "nav.ok"
  | "nav.usdInProgress"
  | "nav.mainMobileNav"
  | "nav.language"
  | "home.hero"
  | "home.createMemorial"
  | "home.openMap"
  | "home.howItWorks"
  | "home.builderTitle"
  | "home.builderText"
  | "home.step"
  | "home.stepProfileTitle"
  | "home.stepProfileText"
  | "home.stepMapTitle"
  | "home.stepMapText"
  | "home.step3dTitle"
  | "home.step3dText"
  | "home.stepGiftsTitle"
  | "home.stepGiftsText"
  | "home.features"
  | "home.everythingNearby"
  | "home.viewMap"
  | "home.archiveTitle"
  | "home.archiveText"
  | "home.sharedMapTitle"
  | "home.sharedMapText"
  | "home.livingMemoryTitle"
  | "home.livingMemoryText"
  | "home.start"
  | "home.startTitle"
  | "home.aboutProject"
  | "home.createAuthTitle"
  | "home.createAuthHelper"
  | "home.createGuest"
  | "auth.guestSection"
  | "auth.guestHint"
  | "home.checking"
  | "home.limitMessage"
  | "menu.loadingAccount"
  | "menu.adminPanel"
  | "menu.videoStudio"
  | "menu.giftCheck"
  | "payment.balanceTitle"
  | "payment.balanceHeading"
  | "payment.balanceCurrent"
  | "payment.topUpAction"
  | "about.eyebrow"
  | "about.title"
  | "about.text"
  | "about.contacts"
  | "about.contactsText"
  | "about.documents"
  | "about.documentsText"
  | "about.politics"
  | "about.offer"
  | "about.businessDetails"
  | "about.legalName"
  | "about.ogrn"
  | "about.inn"
  | "about.account"
  | "about.bank"
  | "about.bik"
  | "about.corrAccount"
  | "about.email";

const translations: Record<AppLanguage, Record<TranslationKey, string>> = {
  ru: {
    brand: "МЯУГАВ",
    "nav.create": "создать",
    "nav.checking": "проверка",
    "nav.myPets": "Мои питомцы",
    "nav.pets": "Питомцы",
    "nav.profile": "Профиль",
    "nav.map": "Карта",
    "nav.login": "Войти",
    "nav.menu": "Меню",
    "nav.openMenu": "Раскрыть меню",
    "nav.closeMenu": "Закрыть меню",
    "nav.about": "О проекте",
    "nav.charity": "Благотворительность",
    "nav.news": "Новости",
    "nav.admin": "Админ",
    "nav.video": "Видео",
    "nav.giftSlots": "Слоты подарков",
    "nav.logout": "Выйти",
    "nav.account": "Аккаунт",
    "nav.balance": "Баланс",
    "nav.coins": "монет",
    "nav.topUp": "Пополнение баланса",
    "nav.close": "Закрыть",
    "nav.continue": "Продолжить",
    "nav.memorialLimit": "Лимит мемориалов",
    "nav.ok": "Понятно",
    "nav.usdInProgress": "В разработке",
    "nav.mainMobileNav": "Основная мобильная навигация",
    "nav.language": "Язык",
    "home.hero":
      "Создавайте тёплые 3D-мемориалы, сохраняйте фотографии и истории, отмечайте любимцев на общей карте памяти.",
    "home.createMemorial": "Создать мемориал",
    "home.openMap": "Открыть карту",
    "home.howItWorks": "Как это работает",
    "home.builderTitle": "Мемориал создаётся как спокойный пошаговый конструктор",
    "home.builderText":
      "Сначала вы заполняете данные, затем выбираете место, собираете 3D-сцену и публикуете страницу. В любой момент мемориал можно открыть, дополнить или оставить приватным.",
    "home.step": "Шаг",
    "home.stepProfileTitle": "Анкета питомца",
    "home.stepProfileText":
      "Имя, вид, даты, история и фотографии собираются в аккуратный профиль.",
    "home.stepMapTitle": "Место на карте",
    "home.stepMapText": "Публичный мемориал можно разместить на общей карте памяти.",
    "home.step3dTitle": "3D-пространство",
    "home.step3dText":
      "Домик, окружение, детали и цвета настраиваются в визуальном редакторе.",
    "home.stepGiftsTitle": "Подарки",
    "home.stepGiftsText":
      "Близкие могут оставить свечу, цветы, игрушку или другой знак внимания.",
    "home.features": "Возможности",
    "home.everythingNearby": "Всё важное рядом",
    "home.viewMap": "Посмотреть карту",
    "home.archiveTitle": "Личный архив",
    "home.archiveText":
      "Фотографии, теплые слова и история питомца хранятся в одном месте.",
    "home.sharedMapTitle": "Общая карта",
    "home.sharedMapText": "Мемориалы можно искать по карте и открывать в 3D-режиме.",
    "home.livingMemoryTitle": "Живые знаки памяти",
    "home.livingMemoryText":
      "Подарки отображаются в мемориале и помогают поддерживать страницу.",
    "home.start": "Начать",
    "home.startTitle": "Создайте первый мемориал и сохраните историю питомца",
    "home.aboutProject": "О проекте",
    "home.createAuthTitle": "Создание мемориала",
    "home.createAuthHelper":
      "Войдите или зарегистрируйтесь, чтобы сразу сохранить мемориал в аккаунте.",
    "home.createGuest": "Создать без входа",
    "auth.guestSection": "Продолжить без входа",
    "auth.guestHint":
      "Можно собрать мемориал без входа. Сохранить и опубликовать его получится в конце после входа или регистрации.",
    "home.checking": "Проверка...",
    "home.limitMessage":
      "На данный момент можно создать только {count} мемориалов. Для увеличения лимита напишите запрос на support@мяугав.com.",
    "menu.loadingAccount": "Проверяем аккаунт...",
    "menu.adminPanel": "Админ-панель",
    "menu.videoStudio": "Видеостудия",
    "menu.giftCheck": "Проверка подарков",
    "payment.balanceTitle": "Баланс",
    "payment.balanceHeading": "Пополнение баланса",
    "payment.balanceCurrent": "Баланс: {count} монет",
    "payment.topUpAction": "Пополнить",
    "about.eyebrow": "О проекте",
    "about.title": "МяуГав хранит память о питомцах в теплых 3D-мемориалах.",
    "about.text":
      "Здесь можно создать страницу любимца, добавить фотографии и историю, отметить мемориал на карте памяти и вернуться к нему в любой момент.",
    "about.contacts": "Контакты",
    "about.contactsText":
      "По вопросам аккаунта, восстановления доступа и работы сервиса можно написать на почту",
    "about.documents": "Документы сервиса",
    "about.documentsText":
      "Юридические документы вынесены на отдельные страницы, чтобы страница о проекте оставалась короткой и понятной.",
    "about.politics": "Политика обработки персональных данных",
    "about.offer": "Публичная оферта",
    "about.businessDetails": "Реквизиты ИП",
    "about.legalName": "Наименование",
    "about.ogrn": "ОГРН / ОГРНИП",
    "about.inn": "ИНН",
    "about.account": "Расчётный счёт",
    "about.bank": "Название банка",
    "about.bik": "БИК",
    "about.corrAccount": "Корреспондентский счёт",
    "about.email": "Адрес электронной почты",
  },
  en: {
    brand: "MEOWGAV",
    "nav.create": "create",
    "nav.checking": "checking",
    "nav.myPets": "My pets",
    "nav.pets": "Pets",
    "nav.profile": "Profile",
    "nav.map": "Map",
    "nav.login": "Sign in",
    "nav.menu": "Menu",
    "nav.openMenu": "Open menu",
    "nav.closeMenu": "Close menu",
    "nav.about": "About",
    "nav.charity": "Charity",
    "nav.news": "News",
    "nav.admin": "Admin",
    "nav.video": "Video",
    "nav.giftSlots": "Gift slots",
    "nav.logout": "Log out",
    "nav.account": "Account",
    "nav.balance": "Balance",
    "nav.coins": "coins",
    "nav.topUp": "Top up balance",
    "nav.close": "Close",
    "nav.continue": "Continue",
    "nav.memorialLimit": "Memorial limit",
    "nav.ok": "Got it",
    "nav.usdInProgress": "In development",
    "nav.mainMobileNav": "Main mobile navigation",
    "nav.language": "Language",
    "home.hero":
      "Create warm 3D memorials, keep photos and stories, and place beloved pets on a shared memory map.",
    "home.createMemorial": "Create memorial",
    "home.openMap": "Open map",
    "home.howItWorks": "How it works",
    "home.builderTitle": "A calm step-by-step builder for a personal memorial",
    "home.builderText":
      "Fill in the details, choose a place, assemble the 3D scene and publish the page. You can open, update or keep the memorial private at any time.",
    "home.step": "Step",
    "home.stepProfileTitle": "Pet profile",
    "home.stepProfileText":
      "Name, species, dates, story and photos are collected in a neat profile.",
    "home.stepMapTitle": "Place on the map",
    "home.stepMapText": "A public memorial can be placed on the shared memory map.",
    "home.step3dTitle": "3D space",
    "home.step3dText":
      "House, environment, details and colors are configured in the visual editor.",
    "home.stepGiftsTitle": "Gifts",
    "home.stepGiftsText":
      "Loved ones can leave a candle, flowers, a toy or another sign of care.",
    "home.features": "Features",
    "home.everythingNearby": "Everything important, close by",
    "home.viewMap": "View map",
    "home.archiveTitle": "Personal archive",
    "home.archiveText": "Photos, warm words and the pet's story stay in one place.",
    "home.sharedMapTitle": "Shared map",
    "home.sharedMapText": "Memorials can be found on the map and opened in 3D mode.",
    "home.livingMemoryTitle": "Living signs of memory",
    "home.livingMemoryText":
      "Gifts appear inside the memorial and help support the page.",
    "home.start": "Start",
    "home.startTitle": "Create your first memorial and preserve your pet's story",
    "home.aboutProject": "About",
    "home.createAuthTitle": "Create a memorial",
    "home.createAuthHelper":
      "Sign in or create an account to save the memorial right away.",
    "home.createGuest": "Create as guest",
    "auth.guestSection": "Continue without signing in",
    "auth.guestHint":
      "You can assemble a memorial without signing in. Saving and publishing will be available at the end after sign-in or registration.",
    "home.checking": "Checking...",
    "home.limitMessage":
      "You can currently create only {count} memorials. To raise the limit, contact support@мяугав.com.",
    "menu.loadingAccount": "Checking account...",
    "menu.adminPanel": "Admin panel",
    "menu.videoStudio": "Video studio",
    "menu.giftCheck": "Gift check",
    "payment.balanceTitle": "Balance",
    "payment.balanceHeading": "Top up balance",
    "payment.balanceCurrent": "Balance: {count} coins",
    "payment.topUpAction": "Top up",
    "about.eyebrow": "About",
    "about.title": "MeowGav preserves pet memories in warm 3D memorials.",
    "about.text":
      "You can create a page for a beloved pet, add photos and a story, place the memorial on the memory map and return to it at any time.",
    "about.contacts": "Contacts",
    "about.contactsText":
      "For account questions, access recovery or service support, email us at",
    "about.documents": "Service documents",
    "about.documentsText":
      "Legal documents are kept on separate pages so this project page stays short and clear.",
    "about.politics": "Personal data processing policy",
    "about.offer": "Public offer",
    "about.businessDetails": "Sole proprietor details",
    "about.legalName": "Legal name",
    "about.ogrn": "OGRN / OGRNIP",
    "about.inn": "Tax ID",
    "about.account": "Bank account",
    "about.bank": "Bank name",
    "about.bik": "BIK",
    "about.corrAccount": "Correspondent account",
    "about.email": "Email address",
  },
};

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function resolveInitialLanguage(): AppLanguage {
  if (typeof window === "undefined") {
    return "ru";
  }
  const saved = window.localStorage.getItem("meowgav-language");
  return saved === "en" ? "en" : "ru";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(resolveInitialLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
    window.localStorage.setItem("meowgav-language", language);
    window.dispatchEvent(new CustomEvent("meowgav-language-changed", { detail: language }));
  }, [language]);

  const setLanguage = useCallback((nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => {
      let value = translations[language][key] ?? translations.ru[key] ?? key;
      if (params) {
        Object.entries(params).forEach(([param, replacement]) => {
          value = value.split(`{${param}}`).join(String(replacement));
        });
      }
      return value;
    },
    [language],
  );

  const value = useMemo(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return context;
}

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage, t } = useLanguage();
  const languages: AppLanguage[] = ["ru", "en"];

  return (
    <div
      className={`inline-flex items-center rounded-[14px] border border-white/80 bg-[#f6efea] p-1 shadow-[0_10px_24px_-18px_rgba(93,64,55,0.55),inset_0_1px_0_rgba(255,255,255,0.95)] ${
        compact ? "gap-0.5" : "gap-1"
      }`}
      aria-label={t("nav.language")}
    >
      {languages.map((item) => {
        const isActive = language === item;
        return (
          <button
            key={item}
            type="button"
            className={`grid min-h-8 min-w-8 place-items-center rounded-[10px] px-2 text-[10px] font-black uppercase tracking-[0.08em] transition-[transform,background-color,color,box-shadow] duration-150 ease-out active:scale-[0.96] ${
              isActive
                ? "bg-[#111827] text-white shadow-[0_3px_0_0_#000]"
                : "text-[#8d6e63] hover:bg-white"
            }`}
            onClick={() => setLanguage(item)}
            aria-pressed={isActive}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}
