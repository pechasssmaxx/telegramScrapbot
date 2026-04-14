import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const configSchema = z.object({
  BOT_TOKEN: z.string().min(1, "BOT_TOKEN is required"),
  TELEGRAM_API_ID: z
    .string()
    .min(1, "TELEGRAM_API_ID is required")
    .transform((value) => Number(value))
    .pipe(z.number().int().positive()),
  TELEGRAM_API_HASH: z.string().min(1, "TELEGRAM_API_HASH is required"),
  TELEGRAM_SESSION_STRING: z.string().default(""),
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  ANTHROPIC_MODEL: z.string().default("claude-3-5-haiku-latest"),
  BOT_OWNER_CHAT_ID: z
    .string()
    .optional()
    .transform((value) => (value ? Number(value) : undefined))
    .pipe(z.number().int().positive().optional()),
  DATA_DIR: z.string().default("./data"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info")
});

export type AppConfig = z.infer<typeof configSchema>;

export const appConfig = configSchema.parse(process.env);
