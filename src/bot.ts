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

export function createBot(): Telegraf {
  const bot = new Telegraf(appConfig.BOT_TOKEN);
  const store = new ChannelStore(appConfig.DATA_DIR);
  const reader = new TelegramReader();
  const digestService = new DigestService();

  bot.use(async (ctx, next) => {
    if (
      appConfig.BOT_OWNER_CHAT_ID &&
      ctx.chat?.id &&
      ctx.chat.id !== appConfig.BOT_OWNER_CHAT_ID
    ) {
      await ctx.reply("This MVP bot is configured for a single owner chat only.");
      return;
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
    const channels = await store.list();

    if (channels.length === 0) {
      await ctx.reply("Channel list is empty. Add at least one public channel before running /digest.");
      return;
    }

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

    try {
      const topics = await digestService.buildDigest(collected);

      if (topics.length === 0) {
        await ctx.reply("Recent posts were found, but the digest came back empty.");
        return;
      }

      const chunks = topics.map(
        (topic, index) =>
          `${index + 1}. ${topic.title}\n${topic.summary}\nSource: ${topic.sourceUrl}`
      );

      await replyLong(ctx, `Top themes from the last 24 hours:\n\n${chunks.join("\n\n")}`);

      if (issues.length > 0) {
        await replyLong(ctx, `Some channels had issues:\n${issues.join("\n")}`);
      }
    } catch (error) {
      await ctx.reply(mapUserError(error));
    }
  });

  bot.catch((error) => {
    logger.error({ error }, "Unhandled Telegraf error");
  });

  return bot;
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
