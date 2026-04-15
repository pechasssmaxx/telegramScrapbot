import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";

import { appConfig } from "../config.js";
import type { RecentPost, TrackedChannel } from "../types.js";
import { toTelegramUrl } from "../utils/channel.js";

const TELEGRAM_WEB_BASE = "https://t.me/s/";

export class TelegramReaderError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
  }
}

export class TelegramReader {
  private readonly client: TelegramClient | null;
  private connected = false;

  constructor() {
    if (
      appConfig.TELEGRAM_SESSION_STRING &&
      appConfig.TELEGRAM_API_ID &&
      appConfig.TELEGRAM_API_HASH
    ) {
      this.client = new TelegramClient(
        new StringSession(appConfig.TELEGRAM_SESSION_STRING),
        appConfig.TELEGRAM_API_ID,
        appConfig.TELEGRAM_API_HASH,
        {
          connectionRetries: 5
        }
      );
    } else {
      this.client = null;
    }
  }

  async resolveChannel(username: string): Promise<TrackedChannel> {
    try {
      return await this.resolveChannelViaWeb(username);
    } catch (error) {
      if (this.canFallbackToClient(error)) {
        return this.resolveChannelViaClient(username);
      }

      throw error;
    }
  }

  async fetchRecentPosts(channel: TrackedChannel, since: Date): Promise<RecentPost[]> {
    try {
      return await this.fetchRecentPostsViaWeb(channel, since);
    } catch (error) {
      if (this.canFallbackToClient(error)) {
        return this.fetchRecentPostsViaClient(channel, since);
      }

      throw error;
    }
  }

  private async resolveChannelViaWeb(username: string): Promise<TrackedChannel> {
    const html = await this.fetchChannelPage(username);
    const title = parseChannelTitle(html) ?? username;

    return {
      id: username,
      input: `@${username}`,
      username,
      title,
      url: toTelegramUrl(username),
      addedAt: new Date().toISOString()
    };
  }

  private async fetchRecentPostsViaWeb(
    channel: TrackedChannel,
    since: Date
  ): Promise<RecentPost[]> {
    const html = await this.fetchChannelPage(channel.username);
    const posts = parsePostsFromHtml(channel, html);

    return posts.filter((post) => new Date(post.publishedAt).getTime() >= since.getTime());
  }

  private async fetchChannelPage(username: string): Promise<string> {
    const response = await fetch(`${TELEGRAM_WEB_BASE}${username}`, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
      }
    });

    if (response.status === 404) {
      throw new TelegramReaderError("Channel was not found.", "not_found");
    }

    if (!response.ok) {
      throw new TelegramReaderError(
        `Telegram web returned HTTP ${response.status}.`,
        "web_error"
      );
    }

    const html = await response.text();

    if (looksLikePrivateOrMissing(html)) {
      throw new TelegramReaderError("Channel is private or inaccessible.", "private");
    }

    if (!html.includes("tgme_channel_info_header_title") && !html.includes("tgme_widget_message_wrap")) {
      throw new TelegramReaderError("Channel page could not be parsed.", "parse_error");
    }

    return html;
  }

  private async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    if (!appConfig.TELEGRAM_SESSION_STRING) {
      throw new TelegramReaderError(
        "TELEGRAM_SESSION_STRING is empty. Generate a Telegram user session before using /digest fallback.",
        "missing_session"
      );
    }

    if (!this.client) {
      throw new TelegramReaderError(
        "Telegram client fallback is not configured. Set TELEGRAM_API_ID, TELEGRAM_API_HASH, and TELEGRAM_SESSION_STRING.",
        "missing_client_config"
      );
    }

    await this.client.connect();
    this.connected = true;
  }

  private async resolveChannelViaClient(username: string): Promise<TrackedChannel> {
    await this.connect();
    const client = this.client!;

    try {
      const entity = await client.getEntity(username);
      const channel = entity as Api.Channel;

      if (!("username" in channel) || !channel.username) {
        throw new TelegramReaderError("Channel does not have a public username.", "not_public");
      }

      return {
        id: String(channel.id),
        input: `@${username}`,
        username: channel.username.toLowerCase(),
        title: channel.title ?? channel.username,
        url: toTelegramUrl(channel.username),
        addedAt: new Date().toISOString()
      };
    } catch (error) {
      throw this.mapClientError(error);
    }
  }

  private async fetchRecentPostsViaClient(
    channel: TrackedChannel,
    since: Date
  ): Promise<RecentPost[]> {
    await this.connect();
    const client = this.client!;

    try {
      const messages = await client.getMessages(channel.username, {
        limit: 100
      });

      return messages
        .filter((message) => {
          if (!message.message || !message.date || !message.id) {
            return false;
          }

          return toMessageDate(message.date).getTime() >= since.getTime();
        })
        .map((message) => ({
          channelId: channel.id,
          channelTitle: channel.title,
          channelUsername: channel.username,
          messageId: message.id!,
          publishedAt: toMessageDate(message.date!).toISOString(),
          text: message.message!,
          url: toTelegramUrl(channel.username, message.id!)
        }));
    } catch (error) {
      throw this.mapClientError(error);
    }
  }

  private canFallbackToClient(error: unknown): boolean {
    if (!appConfig.TELEGRAM_SESSION_STRING) {
      return false;
    }

    if (!(error instanceof TelegramReaderError)) {
      return true;
    }

    return !["not_found", "private", "not_public"].includes(error.code);
  }

  private mapClientError(error: unknown): TelegramReaderError {
    const message =
      error instanceof Error ? error.message : "Unknown Telegram client error.";
    const upper = message.toUpperCase();

    if (upper.includes("USERNAME_NOT_OCCUPIED")) {
      return new TelegramReaderError("Channel was not found.", "not_found");
    }

    if (
      upper.includes("CHANNEL_PRIVATE") ||
      upper.includes("INVITE_HASH_EXPIRED") ||
      upper.includes("CHAT_ADMIN_REQUIRED")
    ) {
      return new TelegramReaderError("Channel is private or inaccessible.", "private");
    }

    if (error instanceof TelegramReaderError) {
      return error;
    }

    return new TelegramReaderError(message, "unknown");
  }
}

function parseChannelTitle(html: string): string | null {
  const match =
    html.match(/<meta property="og:title" content="([^"]+)"/i) ??
    html.match(/<div class="tgme_channel_info_header_title">[\s\S]*?<span dir="auto">([\s\S]*?)<\/span>/i);

  if (!match) {
    return null;
  }

  return decodeHtml(stripHtml(match[1])).trim() || null;
}

function parsePostsFromHtml(channel: TrackedChannel, html: string): RecentPost[] {
  const posts: RecentPost[] = [];
  const postBlockRegex =
    /<div class="tgme_widget_message_wrap js-widget_message_wrap">[\s\S]*?(?=<div class="tgme_widget_message_wrap js-widget_message_wrap">|<div class="tgme_widget_message_centered|<\/section>)/g;

  let match: RegExpExecArray | null;
  while ((match = postBlockRegex.exec(html)) !== null) {
    const block = match[0];
    const postIdMatch = block.match(/data-post="[^/]+\/(\d+)"/i);
    const textMatch = block.match(
      /<div class="tgme_widget_message_text js-message_text"[^>]*>([\s\S]*?)<\/div>/i
    );
    const dateMatch = block.match(/<time datetime="([^"]+)"/i);

    if (!postIdMatch || !dateMatch) {
      continue;
    }

    const messageId = Number(postIdMatch[1]);
    const text = decodeHtml(stripHtml(textMatch?.[1] ?? "")).trim();

    if (!text) {
      continue;
    }

    posts.push({
      channelId: channel.id,
      channelTitle: channel.title,
      channelUsername: channel.username,
      messageId,
      publishedAt: new Date(dateMatch[1]).toISOString(),
      text,
      url: toTelegramUrl(channel.username, messageId)
    });
  }

  return dedupePosts(posts);
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "");
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function dedupePosts(posts: RecentPost[]): RecentPost[] {
  const seen = new Set<number>();
  return posts.filter((post) => {
    if (seen.has(post.messageId)) {
      return false;
    }

    seen.add(post.messageId);
    return true;
  });
}

function looksLikePrivateOrMissing(html: string): boolean {
  return (
    html.includes("tgme_page_description") &&
    html.includes("If you have Telegram") &&
    !html.includes("tgme_widget_message_wrap") &&
    !html.includes("tgme_channel_info_header_title")
  );
}

function toMessageDate(value: Date | number): Date {
  return value instanceof Date ? value : new Date(value * 1000);
}
