import { createBot } from "./bot.js";
import { logger } from "./logger.js";

async function main(): Promise<void> {
  const bot = createBot();
  await bot.launch();
  logger.info("Bot started");

  process.once("SIGINT", () => void bot.stop("SIGINT"));
  process.once("SIGTERM", () => void bot.stop("SIGTERM"));
}

void main().catch((error) => {
  logger.error({ error }, "Failed to start the bot");
  process.exit(1);
});
