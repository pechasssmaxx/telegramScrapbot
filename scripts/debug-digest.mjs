import fs from "node:fs/promises";

import Anthropic from "@anthropic-ai/sdk";

const sanitize = (value, limit = 180) => value.replace(/\s+/g, " ").trim().slice(0, limit);

const dedupe = (posts) => {
  const seen = new Set();
  return posts.filter((post) => {
    const key = sanitize(post.text, 220).toLowerCase();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const score = (post) => {
  const text = sanitize(post.text, 600);
  return (
    Math.min(text.length, 400) +
    ((text.match(/\d+/g) ?? []).length * 8) +
    ((text.match(/[A-ZА-Я]{2,}/g) ?? []).length * 5) +
    (text.includes("http") ? 10 : 0)
  );
};

const main = async () => {
  const [{ TelegramReader }, { appConfig }] = await Promise.all([
    import("../dist/services/telegram-reader.js"),
    import("../dist/config.js")
  ]);

  const anthropic = new Anthropic({ apiKey: appConfig.ANTHROPIC_API_KEY });
  const reader = new TelegramReader();
  const raw = await fs.readFile("./data/channels.json", "utf-8");
  const data = JSON.parse(raw);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  let posts = [];

  for (const channel of data.channels) {
    posts.push(...(await reader.fetchRecentPosts(channel, since)));
  }

  const prepared = dedupe(posts).filter((post) => sanitize(post.text, 300).length >= 80);
  const byChannel = new Map();

  for (const post of prepared) {
    const arr = byChannel.get(post.channelUsername) ?? [];
    arr.push(post);
    byChannel.set(post.channelUsername, arr);
  }

  const selected = Array.from(byChannel.values())
    .flatMap((channelPosts) =>
      channelPosts
        .slice()
        .sort((left, right) => score(right) - score(left))
        .slice(0, 3)
    )
    .slice()
    .sort((left, right) => score(right) - score(left))
    .slice(0, 18);

  const payload = selected
    .map(
      (post, index) =>
        `Candidate ${index + 1}\n` +
        `Channel: ${post.channelTitle} (@${post.channelUsername})\n` +
        `Published: ${post.publishedAt}\n` +
        `URL: ${post.url}\n` +
        `Snippet: ${sanitize(post.text, 180)}`
    )
    .join("\n\n---\n\n");

  console.log(
    JSON.stringify(
      {
        selected: selected.length,
        payloadChars: payload.length,
        sample: selected.slice(0, 5).map((post) => ({
          channel: post.channelUsername,
          textLength: post.text.length,
          url: post.url
        }))
      },
      null,
      2
    )
  );

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
                "You are given compact candidate posts selected from many Telegram channels during the last 24 hours. " +
                "Choose the top 5 most important themes overall. " +
                'Return JSON in the shape {"topics":[{"title":"...","summary":"...","sourceUrl":"https://..."}]}. ' +
                "Each summary must stay short, and each topic must cite one of the provided source URLs.\n\n" +
                payload
            }
          ]
        }
      ]
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          usage: response.usage,
          text: response.content
            .filter((item) => item.type === "text")
            .map((item) => item.text)
            .join("")
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error("REQUEST_FAILED");
    console.error(error);
    process.exit(1);
  }
};

void main();
