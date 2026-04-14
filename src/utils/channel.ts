const TELEGRAM_LINK_PREFIX = "https://t.me/";

export function normalizeChannelInput(raw: string): string {
  const value = raw.trim();

  if (!value) {
    throw new Error("Channel reference is required.");
  }

  if (value.startsWith("@")) {
    const username = value.slice(1);
    validateUsername(username);
    return username.toLowerCase();
  }

  if (value.startsWith(TELEGRAM_LINK_PREFIX)) {
    const url = new URL(value);
    const username = url.pathname.replaceAll("/", "");
    validateUsername(username);
    return username.toLowerCase();
  }

  throw new Error("Use @channelname or https://t.me/channelname.");
}

function validateUsername(username: string): void {
  if (!/^[a-zA-Z0-9_]{5,32}$/.test(username)) {
    throw new Error("Telegram channel username looks invalid.");
  }
}

export function toTelegramUrl(username: string, messageId?: number): string {
  const base = `${TELEGRAM_LINK_PREFIX}${username}`;
  return messageId ? `${base}/${messageId}` : base;
}
