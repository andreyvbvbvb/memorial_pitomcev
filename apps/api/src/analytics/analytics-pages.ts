const MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000;

export const TRACKED_PAGE_LABELS: Record<string, string> = {
  home: "Главная",
  map: "Карта",
  myPets: "Мои питомцы",
  memorial: "Мемориал",
  create: "Создание",
  profile: "Профиль",
  about: "О проекте",
  news: "Новости",
  charity: "Благотворительность",
  menu: "Меню",
  auth: "Вход",
  payment: "Оплата",
};

export const TRACKED_PAGE_KEYS = Object.keys(TRACKED_PAGE_LABELS);

export function getMoscowDay(date = new Date()) {
  return new Date(date.getTime() + MOSCOW_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(day: string, amount: number) {
  const [year, month, date] = day.split("-").map(Number);
  const next = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, date ?? 1));
  next.setUTCDate(next.getUTCDate() + amount);
  return next.toISOString().slice(0, 10);
}

export function getMoscowDayStartUtc(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(
    Date.UTC(year ?? 1970, (month ?? 1) - 1, date ?? 1) - MOSCOW_OFFSET_MS,
  );
}

export function normalizeAnalyticsPage(path: string) {
  const pathname = path.split("?")[0]?.split("#")[0] || "/";
  if (pathname === "/") {
    return "home";
  }
  if (pathname === "/map") {
    return "map";
  }
  if (pathname === "/my-pets") {
    return "myPets";
  }
  if (pathname === "/create" || pathname.startsWith("/create/")) {
    return "create";
  }
  if (pathname === "/profile") {
    return "profile";
  }
  if (pathname === "/about") {
    return "about";
  }
  if (pathname === "/news") {
    return "news";
  }
  if (pathname === "/charity") {
    return "charity";
  }
  if (pathname === "/menu") {
    return "menu";
  }
  if (pathname === "/auth") {
    return "auth";
  }
  if (pathname === "/payment") {
    return "payment";
  }
  if (pathname.startsWith("/pets/")) {
    return "memorial";
  }
  return null;
}
