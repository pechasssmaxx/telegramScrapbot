import { Context, Telegraf } from "telegraf";

import { appConfig } from "./config.js";
import { logger } from "./logger.js";
import { ChannelStore } from "./services/channel-store.js";
import { DigestService, DigestServiceError } from "./services/digest-service.js";
import { TelegramReader, TelegramReaderError } from "./services/telegram-reader.js";
import { normalizeChannelInput } from "./utils/channel.js";

const HELP_TEXT = [
  "Available commands:",
  "/start - show greeting",
  "/add <@channel or link> - track a public Telegram channel",
  "/list - show tracked channels",
  "/remove <@channel or link> - stop tracking a channel",
  "/digest - fetch the last 24h and build a digest"
].join("\n");

const COMMAND_COOLDOWN_MS = 1200;
const BOT_COMMANDS = [
  { command: "start", description: "Start bot and show help" },
  { command: "add", description: "Add a public Telegram channel" },
  { command: "list", description: "Show tracked channels" },
  { command: "remove", description: "Remove a tracked channel" },
  { command: "digest", description: "Build a 24h digest now" }
] as const;

export function createBot(): Telegraf {
  const bot = new Telegraf(appConfig.BOT_TOKEN);
  const store = new ChannelStore(appConfig.DATA_DIR);
  const reader = new TelegramReader();
  const digestService = new DigestService();
  const commandUsage = new Map<number, number>();
  const digestLocks = new Set<number>();

  bot.use(async (ctx, next) => {
    if (
      appConfig.BOT_OWNER_CHAT_ID &&
      ctx.chat?.id &&
      ctx.chat.id !== appConfig.BOT_OWNER_CHAT_ID
    ) {
      await ctx.reply("This MVP bot is configured for a single owner chat only.");
      return;
    }

    const chatId = ctx.chat?.id;
    if (chatId && isCommandUpdate(ctx)) {
      const now = Date.now();
      const lastUsedAt = commandUsage.get(chatId) ?? 0;

      if (now - lastUsedAt < COMMAND_COOLDOWN_MS) {
        await ctx.reply("Too many commands in a row. Wait 1-2 seconds and try again.");
        return;
      }

      commandUsage.set(chatId, now);
    }

    await next();
  });

  bot.start(async (ctx) => {
    await replyLong(
      ctx,
      "Telegram Digest Bot is ready.\n" +
        "I can track public channels and summarize the last 24 hours.\n\n" +
        HELP_TEXT
    );
  });

  bot.command("add", async (ctx) => {
    const [, rawInput] = splitCommand(ctx.message.text);

    if (!rawInput) {
      await ctx.reply("Usage: /add @channelname or /add https://t.me/channelname");
      return;
    }

    try {
      const username = normalizeChannelInput(rawInput);
      const resolved = await reader.resolveChannel(username);
      const added = await store.add(resolved);

      if (!added) {
        await ctx.reply(`Channel @${resolved.username} is already tracked.`);
        return;
      }

      await ctx.reply(`Added ${resolved.title} (${resolved.url})`);
    } catch (error) {
      await ctx.reply(mapUserError(error));
    }
  });

  bot.command("list", async (ctx) => {
    const channels = await store.list();

    if (channels.length === 0) {
      await ctx.reply("No channels tracked yet. Use /add to add a public channel.");
      return;
    }

    const lines = channels.map(
      (channel, index) => `${index + 1}. ${channel.title} - @${channel.username}\n${channel.url}`
    );
    await replyLong(ctx, lines.join("\n\n"));
  });

  bot.command("remove", async (ctx) => {
    const [, rawInput] = splitCommand(ctx.message.text);

    if (!rawInput) {
      await ctx.reply("Usage: /remove @channelname or /remove https://t.me/channelname");
      return;
    }

    try {
      const username = normalizeChannelInput(rawInput);
      const removed = await store.remove(username);

      if (!removed) {
        await ctx.reply(`Channel @${username} is not in the tracking list.`);
        return;
      }

      await ctx.reply(`Removed ${removed.title} (@${removed.username}).`);
    } catch (error) {
      await ctx.reply(mapUserError(error));
    }
  });

  bot.command("digest", async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      await ctx.reply("Digest can only run from a chat.");
      return;
    }

    if (digestLocks.has(chatId)) {
      await ctx.reply("Digest is already running for this chat. Wait for it to finish.");
      return;
    }

    const channels = await store.list();

    if (channels.length === 0) {
      await ctx.reply("Channel list is empty. Add at least one public channel before running /digest.");
      return;
    }

    digestLocks.add(chatId);
    const progress = startProgress(ctx, [
      "Collecting recent posts from tracked channels...",
      "Preparing digest input for Claude Haiku...",
      "Summarizing the top themes..."
    ]);

    try {
      await ctx.reply(`Building digest for ${channels.length} tracked channel(s). This can take a moment...`);

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const collected = [];
      const issues: string[] = [];

      for (const channel of channels) {
        try {
          const posts = await reader.fetchRecentPosts(channel, since);
          collected.push(...posts);
        } catch (error) {
          issues.push(`@${channel.username}: ${mapUserError(error)}`);
        }
      }

      if (collected.length === 0) {
        await replyLong(
          ctx,
          "I could not find any recent public posts in the last 24 hours.\n" +
            (issues.length > 0 ? `\nIssues:\n${issues.join("\n")}` : "")
        );
        return;
      }

      const topics = await digestService.buildDigest(collected);

      if (topics.length === 0) {
        await ctx.reply("Recent posts were found, but the digest came back empty.");
        return;
      }

      const chunks = topics.map((topic, index) => {
        return `${index + 1}. ${topic.title}\n${topic.summary}\nИсточник: ${topic.sourceUrl}`;
      });

      await replyLong(ctx, `Главные темы за последние 24 часа:\n\n${chunks.join("\n\n")}`);

      if (issues.length > 0) {
        await replyLong(ctx, `Some channels had issues:\n${issues.join("\n")}`);
      }
    } catch (error) {
      await ctx.reply(mapUserError(error));
    } finally {
      progress.stop();
      digestLocks.delete(chatId);
    }
  });

  bot.catch((error) => {
    logger.error({ error }, "Unhandled Telegraf error");
  });

  return bot;
}

export async function registerBotCommands(bot: Telegraf): Promise<void> {
  await bot.telegram.setMyCommands(BOT_COMMANDS);
}

function splitCommand(text: string): [string, string | undefined] {
  const [command, ...rest] = text.trim().split(/\s+/);
  return [command, rest.join(" ") || undefined];
}

function mapUserError(error: unknown): string {
  if (error instanceof TelegramReaderError || error instanceof DigestServiceError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error. Check logs for details.";
}

function isCommandUpdate(ctx: Context): boolean {
  const message = "message" in ctx.update ? ctx.update.message : undefined;
  return !!message && "text" in message && typeof message.text === "string" && message.text.startsWith("/");
}

function startProgress(ctx: Context, messages: string[]) {
  let index = 0;
  let active = true;

  const tick = async () => {
    if (!active) {
      return;
    }

    try {
      await ctx.sendChatAction("typing");

      if (index < messages.length) {
        await ctx.reply(messages[index]);
        index += 1;
      }
    } catch (error) {
      logger.warn({ error }, "Failed to send progress update");
    }
  };

  void tick();
  const interval = setInterval(() => {
    void tick();
  }, 7000);

  return {
    stop() {
      active = false;
      clearInterval(interval);
    }
  };
}

async function replyLong(
  ctx: Context,
  text: string
): Promise<void> {
  const chunks = splitIntoTelegramMessages(text, 3500);

  for (const chunk of chunks) {
    await ctx.reply(chunk);
  }
}

function splitIntoTelegramMessages(text: string, limit: number): string[] {
  if (text.length <= limit) {
    return [text];
  }

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of text.split("\n\n")) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;

    if (candidate.length <= limit) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
      current = "";
    }

    if (paragraph.length <= limit) {
      current = paragraph;
      continue;
    }

    for (let index = 0; index < paragraph.length; index += limit) {
      chunks.push(paragraph.slice(index, index + limit));
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}
