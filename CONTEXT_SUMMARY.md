# Контекст проекта memorial_pitomcev — актуальная сводка

Документ для быстрого вхождения в проект и продолжения работ без потери контекста.

## 1) Архитектура и инфраструктура
- **Монорепо pnpm workspaces**.
  - `apps/web` — Next.js (App Router).
  - `apps/api` — NestJS + Prisma + PostgreSQL.
  - `packages` — общие модули (минимально).
- **Деплой**: Timeweb Apps (Docker Compose). Сервисы: `web`, `api`.
- **Локальные порты**: Web `3002`, API `3001`.
- **S3**: Timeweb Object Storage (S3‑compatible).

## 2) Главные фичи
- Мемориалы питомцев (public/private), точка на карте.
- 5‑шаговый мастер создания мемориала.
- 3D‑превью с выбором деталей и цветами.
- Глобальная карта с фильтрами и кастомными маркерами.
- Подарки: покупка, срок (1/2/3/6/12), слоты на 3D.
- Внутренняя валюта и пополнение.
- Профиль пользователя.

## 3) Ключевые изменения UI
- **Главная**: вместо видео — полноэкранная 3D‑сцена (модель `main_page.glb`) с плавным вращением.
- **Общий стиль**: фон `#fbf7f5`, текст `#6b6a69`.
- **/map**:
  - Карта ~55% (min 400px), список ~25% (min 360px), общий контейнер на всю ширину.
  - Фильтры по виду/имени в ширину карты+списка.
  - Список справа той же высоты, скролл внутри.
  - Hover карточки → маркер bounce.
- **/my-pets**:
  - Доступ только авторизованным (иначе /auth).
  - 5 режимов отображения (1–4 карточные + **5‑й 3D обзор** с фокусом камеры и правым инфо‑окном).
- **/pets/[id]** (мемориал):
  - Выбор подарка/срока/слота находится над 3D‑превью.
  - По клику на слот показывается примерка; повторный клик снимает примерку.
  - Tooltip по подаркам компактный, уменьшенный шрифт.
  - Блок дарения скрывается для неавторизованных.

## 4) 3D система
- **Terrain** и **House** — отдельные модели.
- В terrain обязателен `dom_slot`.
- **Слоты подарков**: `gift_slot_1..gift_slot_n`.
  - Дефолтный список слотов — **10**.
  - Фактически используются **только реальные anchors**, найденные в GLB.
- **Заглушка слота**: `/models/gifts/slot_placeholder.glb` (подставляется в каждый доступный slot).

### Детали домика (слоты)
`roof_slot`, `wall_slot`, `sign_slot`, `frame_left_slot`, `frame_right_slot`, `mat_slot`, `bowl_food_slot`, `bowl_water_slot`.

## 5) Управление моделями (автогенерация)
- Скрипт: `apps/web/scripts/generate-models.mjs`.
- Генерирует:
  - `apps/web/lib/memorial-models.generated.ts`
  - `apps/web/lib/memorial-options.generated.ts`
  - `apps/web/lib/markers.generated.ts`
- Запускается автоматически в `predev` и `prebuild`.
- Достаточно **положить .glb** в нужную папку, списки обновятся автоматически.

### Папки моделей
- Terrains: `apps/web/public/models/terrains` (`TERRAIN_*.glb`)
- Houses: `apps/web/public/models/houses` (`DOM_*.glb`)
- Parts: `apps/web/public/models/parts/*` (`roof_*.glb`, `wall_*.glb`, `bowl_food_*.glb`, `bowl_water_*.glb`, etc.)

## 6) Превью‑картинки деталей (Create)
- Путь формата: `/memorial/options/{category}/{id}.png`.
- Пример: `bowl_food_3` → `apps/web/public/memorial/options/bowl-food/bowl_food_3.png`.

## 7) Маркеры карты
- **Маркеры**: `apps/web/public/markers/*.png`.
- **Иконки выбора**: `apps/web/public/markers_icons/*_icon.png`.
- В UI выбора маркера сначала показываются варианты выбранного вида питомца, ниже — остальные.
- На карте показываются PNG из `markers`, **а на кнопках выбора** — из `markers_icons`.
- В `markers.generated.ts` сохраняются `url` (для карты) и `iconUrl` (для выбора).
- **Размеры**:
  - Маркеры уменьшены до **128 px** по ширине.
  - Иконки выбора — **100 px** по ширине.

## 8) Создание мемориала (/create)
- 5 шагов.
- Шаг 3 (3D): контейнер шире — `~75vw`.
- Шаг 4: фото без сильного кропа, галерея.
- Шаг 5: проверка — без вида питомца/публичности; 3D превью уменьшено.

## 9) Профиль и Auth
- Auth: центрированный блок, вход по Enter, минимум текста.
- Header: после входа меню‑«книжка» с балансом; кнопка `+` (создать мемориал) с hover‑анимацией и подсказкой.

## 10) Важные env
### API
`DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`, `S3_*`, `SMTP_*`

### WEB
`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

## 11) Частые проблемы
- Prisma v7: datasource в `prisma.config.ts`.
- Timeweb: env нужен и для build, и для runtime.
- R3F JSX: используем `const Group = "group" as React.ComponentType<any>` и т.п.

---
Если нужно, могу дополнить этот документ под конкретные задачи.
