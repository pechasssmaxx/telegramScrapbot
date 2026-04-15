# Telegram Digest Bot

![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Telegraf](https://img.shields.io/badge/Telegraf-Telegram%20Bot-26A5E4?logo=telegram&logoColor=white)
![Claude](https://img.shields.io/badge/Claude-Haiku%204.5-D97706)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)

> MVP Telegram-бота, который мониторит публичные Telegram-каналы, собирает посты за последние 24 часа и присылает пользователю выжимку из 5 самых важных тем.

## Что делает бот

- отвечает на `/start`
- добавляет публичный канал через `/add @channel` или `/add https://t.me/channel`
- показывает список каналов через `/list`
- удаляет канал через `/remove`
- запускает ручной digest через `/digest`
- читает посты только за последние 24 часа
- формирует итоговую выжимку через LLM

## Стек

- `Node.js 22`
- `TypeScript`
- `Telegraf` для Telegram-команд
- парсинг публичных каналов через `https://t.me/s/<channel>`
- `GramJS` как optional fallback
- `Claude Haiku 4.5` для финальной выжимки
- локальное хранение в `JSON`
- `Docker Compose` как основной путь запуска

## Почему выбран Claude Haiku

Для MVP важны:

- низкая стоимость одного digest-запроса
- хорошая скорость ответа
- нормальная структурированная суммаризация

Практический ориентир на 1 digest-запрос при компактном shortlist — около `0.1 цента`.

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

Перед LLM бот не отправляет весь поток постов.

Сначала локально выполняется:

1. очистка и нормализация текста
2. отбор шума
3. post scoring
4. кластеризация похожих тем между каналами
5. topic ranking
6. diversity-aware отбор shortlist

### 3. LLM Formatting Layer

`Claude Haiku` получает уже shortlist тем, а не все сообщения.

Его задача:

- выбрать финальный top-5
- сформулировать заголовки и краткие описания
- вернуть ссылку на исходный пост

## Команды

| Команда | Что делает |
| --- | --- |
| `/start` | приветствие и список команд |
| `/add <@channel / link>` | добавить публичный канал |
| `/list` | показать отслеживаемые каналы |
| `/remove <@channel / link>` | удалить канал |
| `/digest` | собрать digest за 24 часа |

## Быстрый запуск

### Вариант 1. Основной путь: Docker Compose

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
- проверяющий добавляет свои каналы вручную через `/add`

### Вариант 2. Локальный запуск

```bash
npm install
cp .env.example .env
# заполнить переменные окружения
npm run dev
```

При первом запуске список каналов будет пустым. Это ожидаемое поведение для submission-сборки.

## Переменные окружения

Обязательные:

- `BOT_TOKEN`
- `ANTHROPIC_API_KEY`

Опциональные:

- `TELEGRAM_API_ID`
- `TELEGRAM_API_HASH`
- `TELEGRAM_SESSION_STRING`
- `ANTHROPIC_MODEL`
- `BOT_OWNER_CHAT_ID`
- `DATA_DIR`
- `LOG_LEVEL`

## Структура проекта

```text
src/
  bot.ts
  config.ts
  index.ts
  logger.ts
  services/
    channel-store.ts
    digest-service.ts
    importance-engine.ts
    telegram-reader.ts
  scripts/
    generate-session.ts
  utils/
    channel.ts
docs/
  ONE_PAGER.md
```

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

## Что уже закрывает ТЗ

- 5 обязательных команд
- мониторинг публичных каналов
- digest по последним 24 часам
- локальное хранение списка каналов
- упаковка через `docker-compose`
- README с инструкцией запуска
- короткий one-pager по стоимости, монетизации и go-to-market

## Известные ограничения

- бот ориентирован на одного пользователя
- нет scheduler, digest запускается вручную
- ranking тем уже локальный, но cross-channel clustering еще можно усиливать
- нет historical memory по темам за 3-7 дней
- нет автоматических интеграционных тестов

## Следующий этап

- усилить объединение одной темы между несколькими каналами
- добавить memory для novelty vs continuation
- добавить scheduled digest
- перевести хранение в SQLite
- добавить многопользовательский режим
- покрыть bot flow автотестами

## One Pager

- [ONE_PAGER.md](./docs/ONE_PAGER.md)
