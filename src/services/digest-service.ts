import Anthropic from "@anthropic-ai/sdk";

import { appConfig } from "../config.js";
import { ImportanceEngine } from "./importance-engine.js";
import type { DigestTopic, RecentPost } from "../types.js";

const anthropic = new Anthropic({
  apiKey: appConfig.ANTHROPIC_API_KEY
});

const importanceEngine = new ImportanceEngine();
const MAX_REPRESENTATIVE_CHARS = 140;

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

    const clusters = importanceEngine.rankTopics(posts);

    if (clusters.length === 0) {
      return [];
    }

    const payload = clusters
      .map(
        (cluster, index) =>
          `Topic Card ${index + 1}\n` +
          `Title candidate: ${cluster.topicTitleCandidate}\n` +
          `Importance score: ${cluster.importance.toFixed(3)}\n` +
          `Confidence: ${cluster.confidence.toFixed(3)}\n` +
          `Impact class: ${cluster.impactClass}\n` +
          `Channels count: ${cluster.channelsCount}\n` +
          `Posts count: ${cluster.postsCount}\n` +
          `Keywords: ${cluster.topKeywords.join(", ")}\n` +
          `Entities: ${cluster.topEntities.join(", ")}\n` +
          `Breadth: ${cluster.importanceBreakdown.breadth.toFixed(2)}\n` +
          `Depth: ${cluster.importanceBreakdown.depth.toFixed(2)}\n` +
          `Impact: ${cluster.importanceBreakdown.impact.toFixed(2)}\n` +
          `Novelty: ${cluster.importanceBreakdown.novelty.toFixed(2)}\n` +
          `Corroboration: ${cluster.importanceBreakdown.corroboration.toFixed(2)}\n` +
          `Urgency: ${cluster.importanceBreakdown.urgency.toFixed(2)}\n` +
          `Novelty signature: ${cluster.noveltySignature}\n` +
          `Phrasing mode: ${cluster.confidence >= 0.6 ? "confirmed" : cluster.channelsCount > 1 ? "developing" : "single_source"}\n` +
          `Representative source: ${cluster.representativePosts[0]?.url ?? ""}\n` +
          `Representative snippet: ${sanitize(cluster.representativePosts[0]?.textClean ?? "", MAX_REPRESENTATIVE_CHARS)}\n` +
          `Fact bullets:\n${cluster.factSet.map((fact) => `- ${fact}`).join("\n")}\n` +
          cluster.representativePosts
            .map(
              (post, sampleIndex) =>
                `Sample ${sampleIndex + 1}: @${post.channelUsername} | ${post.url} | ${sanitize(post.textClean, 120)}`
            )
            .join("\n")
      )
      .join("\n\n---\n\n");

    try {
      const response = await anthropic.messages.create({
        model: appConfig.ANTHROPIC_MODEL,
        max_tokens: 900,
        temperature: 0.2,
        system:
          "You create concise Telegram digests. Return valid JSON only. Write titles and summaries in Russian. Keep each summary to 2-3 short sentences.",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Below are already ranked topic cards extracted from Telegram channels during the last 24 hours. " +
                  "Choose the final top 5 most important topics overall. " +
                  "Treat topic cards as the unit of ranking, not individual posts. " +
                  "Strongly prefer topics with better cross-channel corroboration, higher impact, better factual density, stronger novelty, and higher confidence. " +
                  "Avoid selecting near-duplicate topics about the same event chain unless the later one is clearly a different sub-event with separate impact. " +
                  "Down-rank single-channel noise, recap posts, weak signals, memes, chatter, and low-impact discussion. " +
                  "If a topic has low confidence, phrase it cautiously. " +
                  'Return JSON in the shape {"topics":[{"title":"...","summary":"...","sourceUrl":"https://..."}]}. ' +
                  "Each topic must cite one provided sourceUrl.\n\n" +
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

      const parsed = JSON.parse(extractJson(text)) as ClaudeResponse;

      if (!parsed.topics || !Array.isArray(parsed.topics)) {
        throw new DigestServiceError("Claude response did not contain topics.", "invalid_response");
      }

      return parsed.topics.filter(isValidTopic).slice(0, 5);
    } catch (error) {
      throw normalizeProviderError(error);
    }
  }
}

function isValidTopic(topic: DigestTopic): boolean {
  return Boolean(topic?.title && topic?.summary && topic?.sourceUrl);
}

function normalizeProviderError(error: unknown): DigestServiceError {
  const message = error instanceof Error ? error.message : "Unknown LLM error.";

  if (
    message.toLowerCase().includes("prompt is too long") ||
    message.toLowerCase().includes("maximum context length") ||
    message.toLowerCase().includes("token")
  ) {
    return new DigestServiceError(
      "Digest input exceeded model limits after candidate selection.",
      "token_limit"
    );
  }

  if (error instanceof DigestServiceError) {
    return error;
  }

  return new DigestServiceError(message, "provider_error");
}

function sanitize(value: string, limit = 1500): string {
  return value.replace(/\s+/g, " ").trim().slice(0, limit);
}

function extractJson(text: string): string {
  const trimmed = text.trim();

  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }

  return trimmed;
}
