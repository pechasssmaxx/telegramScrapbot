# Telegram Digest Bot

![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Telegraf](https://img.shields.io/badge/Telegraf-Telegram%20Bot-26A5E4?logo=telegram&logoColor=white)
![Claude](https://img.shields.io/badge/Claude-Haiku%204.5-D97706)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

> MVP Telegram-бота, который мониторит публичные Telegram-каналы, собирает посты за последние 24 часа и присылает пользователю выжимку из 5 самых важных тем.

```text
┌──────────────────────────────────────────────────────────────────────┐
│                    TELEGRAM DIGEST BOT MVP                          │
│                                                                      │
│  /add   /list   /remove   /digest   /start                           │
│                                                                      │
│  Публичные каналы  ──▶  Web Parser  ──▶  Importance Engine          │
│   t.me/s/<channel>          │                 │                       │
│                              │                 ▼                       │
│                              │        Topic Clusters + Ranking         │
│                              │                 │                       │
│                              └────────────▶ Claude Haiku              │
│                                                │                       │
│                                                ▼                       │
│                                   Top-5 тем + ссылки на посты         │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Что делает бот

- отвечает на `/start`
- добавляет публичный канал через `/add @channel` или `/add https://t.me/channel`
- показывает список каналов через `/list`
- удаляет канал через `/remove`
- запускает ручной digest через `/digest`
- читает посты только за последние 24 часа
- формирует итоговую выжимку через LLM

---

## Почему этот стек

### Telegram

- `Telegraf` для команд и UX бота
- парсинг публичных каналов через `https://t.me/s/<channel>` как основной ingest path
- `GramJS` оставлен как optional fallback, если web-путь недоступен

### LLM

- `Claude Haiku 4.5`

Причина выбора:

- низкая стоимость на один digest
- хорошая скорость ответа
- достаточно сильная структурированная суммаризация для MVP

### Хранение

- локальный `JSON`-файл

Это соответствует ТЗ:

- один пользователь
- без облачной БД
- без мультиюзерности

---

## Архитектура

### 1. Ingest Layer

Бот читает публичные каналы через Telegram web view:

- `https://t.me/s/<channel>`

На выходе получаем нормализованные посты:

- `channelUsername`
- `publishedAt`
- `text`
- `url`

### 2. Importance Engine

Перед LLM бот не отправляет весь сырой поток постов.

Сначала локально выполняется:

1. очистка и нормализация текста
2. отбор слабого шума
3. scoring отдельных постов
4. кластеризация похожих тем между каналами
5. ranking тем по важности
6. diversity-aware отбор shortlist

### 3. LLM Formatting Layer

`Claude Haiku` получает уже shortlist тем, а не весь поток сообщений.

Его задача:

- выбрать финальный top-5
- сформулировать заголовки и краткие описания
- вернуть ссылку на исходный пост

---

## Команды

| Команда | Что делает |
| --- | --- |
| `/start` | приветствие и список команд |
| `/add <@channel / link>` | добавить публичный канал |
| `/list` | показать отслеживаемые каналы |
| `/remove <@channel / link>` | удалить канал |
| `/digest` | собрать digest за 24 часа |

---

## Быстрый запуск

### Вариант 1. Основной путь сдачи: Docker Compose

```bash
cp .env.example .env
# заполнить переменные окружения
docker compose up --build
```

Данные хранятся в:

- `./data/channels.json`

Важно:

- файл со списком каналов не коммитится в репозиторий
- при первом запуске бот сам создаст пустой `data/channels.json`
- проверяющий добавит свои каналы вручную через `/add`

### Вариант 2. Локальный запуск

```bash
npm install
cp .env.example .env
# заполнить переменные окружения
npm run dev
```

При первом запуске список каналов будет пустым. Это ожидаемое поведение для submission-сборки.

---

## Переменные окружения

Обязательные:

- `BOT_TOKEN` — токен Telegram-бота от BotFather
- `ANTHROPIC_API_KEY` — ключ Anthropic
---
## Структура проекта

```text
src/
  bot.ts                       Telegram bot handlers
  config.ts                    Валидация env
  index.ts                     Точка входа
  logger.ts                    Логирование
  services/
    channel-store.ts           Хранение списка каналов
    digest-service.ts          Оркестрация digest + вызов Claude
    importance-engine.ts       Локальный ranking тем
    telegram-reader.ts         Парсинг публичных каналов
  scripts/
    generate-session.ts        Генерация TELEGRAM_SESSION_STRING
  utils/
    channel.ts                 Нормализация ссылок и username
docs/
  BUSINESS.md                  Ответы по стоимости и монетизации
  DEMO_CHECKLIST.md            Чеклист для 2-минутного видео
```

---

## Как проверить руками

1. Запустить бот
2. Открыть Telegram
3. Отправить `/start`
4. Добавить каналы:
   - `/add @channelname`
   - `/add https://t.me/channelname`
5. Проверить `/list`
6. Выполнить `/digest`
7. Удалить канал через `/remove`

---

## Что уже закрывает ТЗ

- 5 обязательных команд
- мониторинг публичных каналов
- digest по последним 24 часам
- локальное хранение списка каналов
- упаковка через `docker-compose`
- README с инструкцией запуска
- отдельный документ по стоимости и монетизации
- отдельный чеклист для demo-видео

---

## Известные ограничения

- бот ориентирован на одного пользователя
- нет ежедневного scheduler, digest запускается вручную
- ranking тем уже выполняется локально, но cross-channel clustering все еще можно усилить
- нет полноценного historical memory по темам за 3–7 дней
- нет автоматических интеграционных тестов

---

## Что улучшать следующим этапом

- усилить объединение одной темы между несколькими каналами
- добавить memory для novelty vs continuation
- добавить scheduled digest раз в сутки
- перевести хранение в SQLite
- добавить многопользовательский режим
- покрыть bot flow автотестами

---

## Стоимость и запуск как продукта

### Оценка стоимости

- ориентир на 1 digest-запрос через Claude Haiku: около `0.01 цент` при компактном shortlist
- ориентир на 30 каналов и 1 digest в день: основная переменная затрат — размер входного контекста
- хостинг для MVP на маленьком VPS: обычно `4-10 USD / месяц`
