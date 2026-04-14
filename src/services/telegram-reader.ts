import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";

import { appConfig } from "../config.js";
import type { RecentPost, TrackedChannel } from "../types.js";
import { toTelegramUrl } from "../utils/channel.js";

export class TelegramReaderError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
  }
}

export class TelegramReader {
  private readonly client: TelegramClient;
  private connected = false;

  constructor() {
    this.client = new TelegramClient(
      new StringSession(appConfig.TELEGRAM_SESSION_STRING),
      appConfig.TELEGRAM_API_ID,
      appConfig.TELEGRAM_API_HASH,
      {
        connectionRetries: 5
      }
    );
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    if (!appConfig.TELEGRAM_SESSION_STRING) {
      throw new TelegramReaderError(
        "TELEGRAM_SESSION_STRING is empty. Generate a Telegram user session before using /digest.",
        "missing_session"
      );
    }

    await this.client.connect();
    this.connected = true;
  }

  async resolveChannel(username: string): Promise<TrackedChannel> {
    await this.connect();

    try {
      const entity = await this.client.getEntity(username);
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
      throw this.mapError(error);
    }
  }

  async fetchRecentPosts(channel: TrackedChannel, since: Date): Promise<RecentPost[]> {
    await this.connect();

    try {
      const messages = await this.client.getMessages(channel.username, {
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
      throw this.mapError(error);
    }
  }

  private mapError(error: unknown): TelegramReaderError {
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

function toMessageDate(value: Date | number): Date {
  return value instanceof Date ? value : new Date(value * 1000);
}
