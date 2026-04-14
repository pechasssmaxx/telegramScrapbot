import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { config as loadEnv } from "dotenv";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";

loadEnv();

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH ?? "";

if (!apiId || !apiHash) {
  throw new Error("Set TELEGRAM_API_ID and TELEGRAM_API_HASH before generating a session.");
}

const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
  connectionRetries: 5
});

const rl = readline.createInterface({ input, output });

await client.start({
  phoneNumber: async () => rl.question("Telegram phone number: "),
  password: async () => rl.question("2FA password (leave blank if none): "),
  phoneCode: async () => rl.question("Telegram login code: "),
  onError: (error) => {
    throw error;
  }
});

console.log("\nTELEGRAM_SESSION_STRING=");
console.log(client.session.save());

await rl.close();
await client.disconnect();
