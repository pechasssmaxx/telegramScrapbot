# Telegram Digest Bot MVP

Technical MVP of a Telegram bot that tracks public Telegram channels and generates a daily-style digest on demand.

## What it does

- `/start` replies with a greeting and command list
- `/add <@channelname | https://t.me/channelname>` adds a public channel to monitoring
- `/list` shows tracked channels
- `/remove <@channelname | https://t.me/channelname>` removes a tracked channel
- `/digest` fetches posts from the last 24 hours and asks Claude Haiku to produce the top 5 themes

## Stack

- `Node.js 22`
- `TypeScript`
- `Telegraf` for Telegram bot commands
- `GramJS` (`telegram` package) for reading public channel history
- `Anthropic SDK` with `claude-3-5-haiku-latest` for digest generation
- Local JSON storage for single-user MVP persistence
- `Docker Compose` as the main submission/runtime path

## Why Claude Haiku

I chose Claude Haiku because this bot needs structured summarization with relatively low latency and low cost per digest. For an MVP that may process many posts every day, Haiku is a better fit than a heavier model: fast enough for an interactive `/digest`, cheaper for repeated use, and still strong at extracting themes and returning compact structured output.

## Project structure

```text
src/
  bot.ts                       Telegram command handlers
  config.ts                    Environment validation
  index.ts                     App entrypoint
  logger.ts                    Logging
  services/
    channel-store.ts           Local persistence
    digest-service.ts          Claude digest generation
    telegram-reader.ts         Public channel access via GramJS
  scripts/
    generate-session.ts        Helper to create TELEGRAM_SESSION_STRING
  utils/
    channel.ts                 Input normalization and URL helpers
```

## Environment variables

Copy `.env.example` to `.env` and fill in:

- `BOT_TOKEN` - Telegram bot token from BotFather
- `TELEGRAM_API_ID` - Telegram API ID from `my.telegram.org`
- `TELEGRAM_API_HASH` - Telegram API hash from `my.telegram.org`
- `TELEGRAM_SESSION_STRING` - Telegram user session for reading channel history
- `ANTHROPIC_API_KEY` - Anthropic API key
- `ANTHROPIC_MODEL` - defaults to `claude-3-5-haiku-latest`
- `BOT_OWNER_CHAT_ID` - optional, restricts the bot to one chat
- `DATA_DIR` - defaults to `/app/data` in Docker
- `LOG_LEVEL` - defaults to `info`

## Important Telegram note

Telegram Bot API alone cannot reliably read arbitrary public channel history. This MVP uses:

- a bot token for user-facing commands
- a Telegram user session for channel reading

Generate the session string once:

```bash
npm install
cp .env.example .env
# fill TELEGRAM_API_ID and TELEGRAM_API_HASH first
npm run telegram:login
```

The script prints `TELEGRAM_SESSION_STRING`; copy it into `.env`.

## Run with Docker Compose

Primary submission path:

```bash
cp .env.example .env
# fill all required variables
docker compose up --build
```

Persistent tracked channels are stored in `./data/channels.json`.

## Run locally without Docker

```bash
npm install
cp .env.example .env
# fill variables
npm run dev
```

## Verification flow

1. Open Telegram and start the bot.
2. Send `/start`.
3. Add channels:
   - `/add @channelname`
   - `/add https://t.me/channelname`
4. Check `/list`.
5. Run `/digest`.
6. Remove one channel with `/remove`.

## Known limitations

- Single-user oriented MVP; no per-user isolation
- Local JSON persistence instead of SQLite or a database
- No scheduler yet; digest is manual via `/digest`
- Digest prompt currently truncates large volumes of source messages instead of doing multi-pass clustering
- Requires a Telegram user session, which makes first-time setup slightly more involved
- No automated test suite yet; verification is currently build-time + manual Telegram flow

## Next iteration improvements

- Move persistence to SQLite with migrations
- Add scheduled daily digest delivery
- Add multi-user support and per-user channel lists
- Add pre-clustering/ranking before LLM summarization
- Add retries/backoff and richer Telegram API diagnostics
- Add automated integration tests around command handlers and storage

## Submission docs

- Business and pricing answers: [docs/BUSINESS.md](docs/BUSINESS.md)
- Demo recording checklist: [docs/DEMO_CHECKLIST.md](docs/DEMO_CHECKLIST.md)
