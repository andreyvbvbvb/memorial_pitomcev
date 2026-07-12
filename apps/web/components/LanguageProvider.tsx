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
import { API_BASE } from "../lib/config";

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
  | "nav.tiktok"
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
  | "menu.tiktokStudio"
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
    "nav.tiktok": "TikTok",
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
      "Сохраните память о вашем любимом питомце",
    "home.createMemorial": "Создать мемориал",
    "home.openMap": "Открыть карту",
    "home.howItWorks": "Как это работает",
    "home.builderTitle": "Мемориал создается как пошаговый инструктор",
    "home.builderText":
      "Можно будет написать истории связанные с вашим питомцем, разместить мемориал в его любимом месте, построить для него самый уютный мемориал и добавить на память фотографии. В любой момент вы сможете добавить новые данные или удалить их",
    "home.step": "Шаг",
    "home.stepProfileTitle": "Анкета питомца",
    "home.stepProfileText":
      "Имя, его история и фотографии создают память, которую не хочется забыть",
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
      "Вы можете украсить подарками как мемориалы ваших питомцев, так и других хозяев, им будет очень приятно",
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
    "menu.tiktokStudio": "TikTok-студия",
    "payment.balanceTitle": "Баланс",
    "payment.balanceHeading": "Пополнение баланса",
    "payment.balanceCurrent": "Баланс: {count} монет",
    "payment.topUpAction": "Пополнить",
    "about.eyebrow": "О проекте",
    "about.title":
      "Я хотел бы, чтобы каждый хозяин смог создать место, где он сможет увидеться со своим маленьким питомцем",
    "about.text":
      "Всем привет! Меня зовут Андрей. У меня был лабрадор Арчи, ему немного не хватило до 11 лет, очень тяжело заболел и не смогли с ним выкарабкаться. Уже прошло больше года с его ухода, но все равно иногда замечаю его шерсть в углах и на одежде, не говоря о родных потертостях на диване. Арчи был очень добрым и дружелюбным, идеальным лабрадором.\n\nИ знаете, раньше люди верили, что звезды на небе это души наших близких людей, любимых питомцев, которые теперь следят за нами оттуда. И я решил сделать что-то подобное, решил, что раз он там, на небе, то ему нужен свой домик, в котором он может находиться.\n\nМЯУГАВ делается уже почти год, благодаря которому я и другие хозяева смогут сделать для своих питомцев что-нибудь хорошее и запоминающиеся, чтобы было место, куда можно прийти и вспомнить разные истории о друге. Я также решил, что с помощью этого сайта я смогу финансово помочь приютам с хвостиками, которые, к сожалению, так и не нашли своих хозяев.\n\nУ меня к вам просьба, помогите сделать его лучше и распространить для тех, кому он может быть правда полезен. Я не очень хочу заниматься какой-либо специальной рекламой и заставлять людей что-то делать. Будет лучше, если этот сайт найдет именно тот человек и именно в то время, когда он будет ему необходим.",
    "about.contacts": "Контакты",
    "about.contactsText":
      "По вопросам аккаунта, восстановления доступа и работы сервиса можно написать на почту",
    "about.documents": "Документы",
    "about.documentsText":
      "Юридические документы вынесены на отдельные страницы, чтобы страница о проекте оставалась короткой и понятной.",
    "about.politics": "Политика обработки персональных данных",
    "about.offer": "Публичная оферта",
    "about.businessDetails": "Реквизиты",
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
    brand: "МЯУГАВ",
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
    "nav.tiktok": "TikTok",
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
      "Preserve the memory of your beloved pet",
    "home.createMemorial": "Create memorial",
    "home.openMap": "Open map",
    "home.howItWorks": "How it works",
    "home.builderTitle": "A memorial is created as a step-by-step guide",
    "home.builderText":
      "You will be able to write stories connected with your pet, place the memorial in their favorite spot, build the coziest memorial for them and add photos as keepsakes. At any time you can add new details or delete them.",
    "home.step": "Step",
    "home.stepProfileTitle": "Pet profile",
    "home.stepProfileText":
      "The name, story and photos create a memory you do not want to forget.",
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
      "You can decorate memorials of your own pets and other owners' pets with gifts. It will mean a lot to them.",
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
    "menu.tiktokStudio": "TikTok studio",
    "payment.balanceTitle": "Balance",
    "payment.balanceHeading": "Top up balance",
    "payment.balanceCurrent": "Balance: {count} coins",
    "payment.topUpAction": "Top up",
    "about.eyebrow": "About",
    "about.title":
      "I wanted every owner to be able to create a place where they can meet their little pet again",
    "about.text":
      "Hello everyone! My name is Andrey. I had a labrador named Archie. He was just a little short of 11 years old, became very seriously ill, and we could not get through it together. More than a year has passed since he left, but I still sometimes notice his fur in corners and on clothes, not to mention the familiar worn places on the sofa. Archie was very kind and friendly, an ideal labrador.\n\nPeople used to believe that the stars in the sky are the souls of our loved ones and beloved pets, watching over us from there. I decided to make something similar: if he is there, in the sky, then he needs his own little house where he can stay.\n\nМЯУГАВ has been in the making for almost a year, so that I and other owners can do something good and memorable for our pets, a place where we can come back and remember stories about a friend. I also decided that through this site I could financially help shelters with pets who, unfortunately, never found their owners.\n\nI have a request: please help make it better and share it with those who may truly need it. I do not really want to do special advertising or force people to do anything. It would be better if this site finds exactly the right person, exactly when they need it.",
    "about.contacts": "Contacts",
    "about.contactsText":
      "For account questions, access recovery or service support, email us at",
    "about.documents": "Documents",
    "about.documentsText":
      "Legal documents are kept on separate pages so this project page stays short and clear.",
    "about.politics": "Personal data processing policy",
    "about.offer": "Public offer",
    "about.businessDetails": "Details",
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
const LANGUAGE_STORAGE_KEY = "meowgav-language";

const isAppLanguage = (value: unknown): value is AppLanguage =>
  value === "ru" || value === "en";

function resolveInitialLanguage(): AppLanguage {
  if (typeof window === "undefined") {
    return "ru";
  }
  const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return isAppLanguage(saved) ? saved : "ru";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(resolveInitialLanguage);
  const [accountUserId, setAccountUserId] = useState<string | null>(null);
  const apiUrl = useMemo(() => API_BASE, []);

  useEffect(() => {
    document.documentElement.lang = language;
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    window.dispatchEvent(new CustomEvent("meowgav-language-changed", { detail: language }));
  }, [language]);

  const loadAccountLanguage = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/auth/me`, { credentials: "include" });
      if (!response.ok) {
        setAccountUserId(null);
        return;
      }
      const data = (await response.json()) as {
        id?: string;
        preferredLanguage?: string | null;
      };
      setAccountUserId(data.id ?? null);
      if (isAppLanguage(data.preferredLanguage)) {
        setLanguageState(data.preferredLanguage);
      }
    } catch {
      setAccountUserId(null);
    }
  }, [apiUrl]);

  useEffect(() => {
    void loadAccountLanguage();
    window.addEventListener("memorial-auth-changed", loadAccountLanguage);
    return () => {
      window.removeEventListener("memorial-auth-changed", loadAccountLanguage);
    };
  }, [loadAccountLanguage]);

  const persistAccountLanguage = useCallback(
    async (nextLanguage: AppLanguage) => {
      if (!accountUserId) {
        return;
      }
      try {
        await fetch(`${apiUrl}/users/${encodeURIComponent(accountUserId)}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preferredLanguage: nextLanguage }),
        });
      } catch {
        // The local change remains active; the next account load will reconcile it.
      }
    },
    [accountUserId, apiUrl],
  );

  const setLanguage = useCallback((nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);
    void persistAccountLanguage(nextLanguage);
  }, [persistAccountLanguage]);

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
  const languages: Array<{ id: AppLanguage; flag: string; label: string }> = [
    { id: "ru", flag: "🇷🇺", label: "Русский" },
    { id: "en", flag: "🇺🇸", label: "English" },
  ];

  return (
    <div
      className={`inline-flex items-center ${
        compact
          ? "gap-1"
          : "gap-1 rounded-[14px] border border-white/80 bg-[#f6efea] p-1 shadow-[0_10px_24px_-18px_rgba(93,64,55,0.55),inset_0_1px_0_rgba(255,255,255,0.95)]"
      }`}
      aria-label={t("nav.language")}
    >
      {languages.map((item) => {
        const isActive = language === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`grid place-items-center leading-none transition-[transform,background-color,color,box-shadow] duration-150 ease-out active:scale-[0.96] ${
              compact
                ? "h-10 w-10 rounded-full px-0 text-base"
                : "min-h-10 min-w-11 rounded-[10px] px-2 text-xl"
            } ${
              isActive
                ? "bg-[#111827] text-white shadow-[0_3px_0_0_#000]"
                : "text-[#8d6e63] hover:bg-white"
            }`}
            onClick={() => setLanguage(item.id)}
            aria-pressed={isActive}
            aria-label={item.label}
            title={item.label}
          >
            {item.flag}
          </button>
        );
      })}
    </div>
  );
}
