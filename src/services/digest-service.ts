import Anthropic from "@anthropic-ai/sdk";

import { appConfig } from "../config.js";
import type { DigestTopic, RecentPost } from "../types.js";

const anthropic = new Anthropic({
  apiKey: appConfig.ANTHROPIC_API_KEY
});

export class DigestServiceError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
  }
}

interface ClaudeResponse {
  topics: DigestTopic[];
}

export class DigestService {
  async buildDigest(posts: RecentPost[]): Promise<DigestTopic[]> {
    if (posts.length === 0) {
      return [];
    }

    const payload = this.packPosts(posts);

    try {
      const response = await anthropic.messages.create({
        model: appConfig.ANTHROPIC_MODEL,
        max_tokens: 900,
        temperature: 0.2,
        system:
          "You create concise Telegram digests. Return valid JSON only. Keep each summary to 2-3 short sentences.",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Analyze the Telegram posts below from the last 24 hours. Identify the top 5 most important themes. " +
                  "Return JSON in the shape {\"topics\":[{\"title\":\"...\",\"summary\":\"...\",\"sourceUrl\":\"https://...\"}]}. " +
                  "Every topic must cite one sourceUrl from the provided posts.\n\n" +
                  payload
              }
            ]
          }
        ]
      });

      const text = response.content
        .filter((item) => item.type === "text")
        .map((item) => item.text)
        .join("");

      const parsed = JSON.parse(text) as ClaudeResponse;

      if (!parsed.topics || !Array.isArray(parsed.topics)) {
        throw new DigestServiceError("Claude response did not contain topics.", "invalid_response");
      }

      return parsed.topics.slice(0, 5);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown LLM error.";

      if (
        message.toLowerCase().includes("prompt is too long") ||
        message.toLowerCase().includes("maximum context length") ||
        message.toLowerCase().includes("token")
      ) {
        throw new DigestServiceError(
          "Digest input exceeded model limits. Reduce channels or recent posts and try again.",
          "token_limit"
        );
      }

      if (error instanceof DigestServiceError) {
        throw error;
      }

      throw new DigestServiceError(message, "provider_error");
    }
  }

  private packPosts(posts: RecentPost[]): string {
    const trimmed = posts
      .slice()
      .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))
      .slice(0, 80);

    return trimmed
      .map(
        (post, index) =>
          `Post ${index + 1}\nChannel: ${post.channelTitle} (@${post.channelUsername})\nPublished: ${post.publishedAt}\nURL: ${post.url}\nText: ${sanitize(post.text)}`
      )
      .join("\n\n---\n\n");
  }
}

function sanitize(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 1500);
}
