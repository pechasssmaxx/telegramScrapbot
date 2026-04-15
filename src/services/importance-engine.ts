import type { EnrichedPost, ImportanceCluster, RecentPost } from "../types.js";

const MIN_POST_CHARS = 60;
const MAX_POSTS_PER_CHANNEL = 6;
const MAX_CLUSTERS = 12;
const INITIAL_CLUSTER_THRESHOLD = 0.22;
const MERGE_CLUSTER_THRESHOLD = 0.33;
const MAX_REPRESENTATIVE_POSTS = 3;
const FINAL_TOPICS_LIMIT = 8;

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "into", "after", "have",
  "also", "just", "about", "where", "when", "which", "their", "there", "them",
  "will", "would", "could", "they", "been", "were", "over", "more",
  "это", "этот", "эта", "эти", "что", "как", "для", "или", "при", "над", "под",
  "его", "ее", "она", "они", "оно", "были", "будет", "если", "уже", "еще",
  "после", "через", "сегодня", "вчера", "завтра", "только", "которые", "который",
  "чтобы", "среди", "между", "около", "почти", "сразу", "очень", "просто",
  "одной", "главное", "ночь", "день", "итоги", "сводка", "обзор", "дайджест"
]);

const ACTION_VERBS = [
  "заявил", "заявили", "объявил", "объявили", "подтвердил", "подтвердили", "сообщил", "сообщили",
  "ввел", "ввели", "вступил", "вступили", "принял", "приняли", "подписал", "подписали",
  "атаковал", "атаковали", "обстреляли", "ударили", "запустил", "запустили", "выпустил", "выпустили",
  "задержали", "арестовали", "открыли", "закрыли", "заблокировали", "разрешили", "запретили",
  "raised", "lowered", "launched", "released", "announced", "confirmed", "approved",
  "blocked", "detected", "signed", "attacked", "struck", "filed"
];

const CLAIM_PATTERNS = [
  "по данным", "стало известно", "со ссылкой", "reported", "according to", "sources say"
];

const OPINION_MARKERS = [
  "мнение", "кажется", "думаю", "похоже", "мне кажется", "на мой взгляд", "opinion", "i think"
];

const ALERT_MARKERS = [
  "срочно", "breaking", "urgent", "alert", "атака", "взрыв", "пожар", "дрон", "беспилот",
  "hack", "exploit", "breach", "liquidation"
];

const SUMMARY_MARKERS = [
  "итоги", "сводка", "главное", "summary", "digest", "обзор", "дайджест"
];

const IMPACT_MARKERS = [
  "санкц", "банкрот", "взрыв", "атака", "обстрел", "дрон", "ракет", "удар", "погиб",
  "security", "exploit", "hack", "breach", "рынок", "бирж", "регуля", "закон",
  "войск", "strike", "tariff", "ipo", "etf", "банк", "frs", "фрс", "telegram", "vpn"
];

type MutableCluster = {
  posts: EnrichedPost[];
  keywords: string[];
  entities: string[];
  signatures: string[];
  avgTimestamp: number;
};

export class ImportanceEngine {
  rankTopics(posts: RecentPost[]): ImportanceCluster[] {
    const enriched = enrichPosts(posts);
    const filtered = applyNoiseGate(enriched);
    const shortlisted = shortlistPosts(filtered);
    const clusters = buildClusters(shortlisted);
    const merged = mergeClusters(clusters);
    const scored = scoreClusters(merged);
    return selectDigestTopics(scored);
  }
}

function enrichPosts(posts: RecentPost[]): EnrichedPost[] {
  const channelCounts = new Map<string, number>();
  for (const post of posts) {
    channelCounts.set(post.channelUsername, (channelCounts.get(post.channelUsername) ?? 0) + 1);
  }

  const seenSignatures = new Set<string>();

  return posts.map((post) => {
    const textClean = sanitize(stripLinks(post.text), 1400);
    const keywords = tokenize(textClean);
    const entities = extractEntities(textClean);
    const signature = buildSignature(textClean, keywords);
    const containsNumbers = /\d/.test(textClean);
    const containsTimeReference = /\b(\d{1,2}:\d{2}|\d{4}|сегодня|вчера|утром|ночью|днем|today|yesterday)\b/i.test(textClean);
    const containsNamedEntities = entities.length > 0;
    const containsActionVerb = ACTION_VERBS.some((verb) => textClean.toLowerCase().includes(verb));
    const containsClaimPattern = CLAIM_PATTERNS.some((pattern) => textClean.toLowerCase().includes(pattern));
    const isForwardLike = /(репост|forwarded from|переслано)/i.test(textClean);
    const isOpinionLike = OPINION_MARKERS.some((marker) => textClean.toLowerCase().includes(marker));
    const isAlertLike = ALERT_MARKERS.some((marker) => textClean.toLowerCase().includes(marker));
    const isSummaryLike = SUMMARY_MARKERS.some((marker) => textClean.toLowerCase().includes(marker));
    const contentDensity =
      (containsNumbers ? 0.18 : 0) +
      (containsNamedEntities ? 0.22 : 0) +
      (containsActionVerb ? 0.24 : 0) +
      (containsTimeReference ? 0.08 : 0) +
      Math.min(textClean.length / 700, 0.18) +
      Math.min(keywords.length / 20, 0.1);
    const eventness =
      (containsActionVerb ? 0.34 : 0) +
      (containsClaimPattern ? 0.12 : 0) +
      (isAlertLike ? 0.24 : 0) +
      (containsNamedEntities ? 0.15 : 0) +
      (containsNumbers ? 0.1 : 0);
    const freshness = computeFreshness(post.publishedAt);
    const sourcePrior = computeSourcePrior(channelCounts.get(post.channelUsername) ?? 1);
    const noisePenalty =
      (isForwardLike ? 0.12 : 0) +
      (isOpinionLike ? 0.18 : 0) +
      (isSummaryLike ? 0.08 : 0) +
      (textClean.length < MIN_POST_CHARS ? 0.28 : 0);
    const informationGain = seenSignatures.has(signature) ? 0.06 : 0.28;
    seenSignatures.add(signature);
    const postRelevance =
      0.3 * clamp01(eventness) +
      0.25 * clamp01(contentDensity) +
      0.2 * clamp01(informationGain) +
      0.15 * clamp01(freshness) +
      0.1 * clamp01(sourcePrior) -
      noisePenalty;

    return {
      ...post,
      textClean,
      features: {
        lengthChars: textClean.length,
        containsNumbers,
        containsTimeReference,
        containsNamedEntities,
        containsActionVerb,
        containsClaimPattern,
        isForwardLike,
        isOpinionLike,
        isAlertLike,
        isSummaryLike,
        keywords,
        entities,
        eventness: clamp01(eventness),
        contentDensity: clamp01(contentDensity),
        freshness: clamp01(freshness),
        sourcePrior: clamp01(sourcePrior),
        noisePenalty,
        informationGain: clamp01(informationGain),
        postRelevance
      }
    };
  });
}

function applyNoiseGate(posts: EnrichedPost[]): EnrichedPost[] {
  return posts.filter((post) => {
    const text = post.textClean.toLowerCase();
    const hardReject =
      post.textClean.length < 30 ||
      (
        /(подписывайтесь|subscribe|реклама|advert|партнерский материал)/i.test(text) &&
        !post.features.containsActionVerb &&
        !post.features.containsNumbers
      );

    return !hardReject;
  });
}

function shortlistPosts(posts: EnrichedPost[]): EnrichedPost[] {
  const deduped = dedupeBySignature(posts);
  const byChannel = new Map<string, EnrichedPost[]>();

  for (const post of deduped) {
    const current = byChannel.get(post.channelUsername) ?? [];
    current.push(post);
    byChannel.set(post.channelUsername, current);
  }

  return Array.from(byChannel.values()).flatMap((channelPosts) =>
    channelPosts
      .slice()
      .sort((left, right) => {
        const leftScore = left.features.postRelevance + channelBalanceBonus(left);
        const rightScore = right.features.postRelevance + channelBalanceBonus(right);
        return rightScore - leftScore;
      })
      .slice(0, MAX_POSTS_PER_CHANNEL)
  );
}

function buildClusters(posts: EnrichedPost[]): MutableCluster[] {
  const sorted = posts
    .slice()
    .sort((left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime());
  const clusters: MutableCluster[] = [];

  for (const post of sorted) {
    let bestIndex = -1;
    let bestSimilarity = 0;

    for (let index = 0; index < clusters.length; index += 1) {
      const cluster = clusters[index];
      const similarity = clusterSimilarityWithPost(cluster, post);

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestIndex = index;
      }
    }

    if (bestIndex >= 0 && bestSimilarity >= INITIAL_CLUSTER_THRESHOLD) {
      const cluster = clusters[bestIndex];
      cluster.posts.push(post);
      cluster.keywords = mergeUnique(cluster.keywords, post.features.keywords, 16);
      cluster.entities = mergeUnique(cluster.entities, post.features.entities, 16);
      cluster.signatures = mergeUnique(cluster.signatures, [buildSignature(post.textClean, post.features.keywords)], 12);
      cluster.avgTimestamp = average(cluster.posts.map((item) => new Date(item.publishedAt).getTime()));
      continue;
    }

    clusters.push({
      posts: [post],
      keywords: [...post.features.keywords],
      entities: [...post.features.entities],
      signatures: [buildSignature(post.textClean, post.features.keywords)],
      avgTimestamp: new Date(post.publishedAt).getTime()
    });
  }

  return clusters;
}

function mergeClusters(clusters: MutableCluster[]): MutableCluster[] {
  const merged = clusters.slice();
  let changed = true;

  while (changed) {
    changed = false;

    outer: for (let leftIndex = 0; leftIndex < merged.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < merged.length; rightIndex += 1) {
        const similarity = clusterSimilarity(merged[leftIndex], merged[rightIndex]);

        if (similarity < MERGE_CLUSTER_THRESHOLD) {
          continue;
        }

        const next: MutableCluster = {
          posts: [...merged[leftIndex].posts, ...merged[rightIndex].posts],
          keywords: mergeUnique(merged[leftIndex].keywords, merged[rightIndex].keywords, 16),
          entities: mergeUnique(merged[leftIndex].entities, merged[rightIndex].entities, 16),
          signatures: mergeUnique(merged[leftIndex].signatures, merged[rightIndex].signatures, 16),
          avgTimestamp: average([
            merged[leftIndex].avgTimestamp,
            merged[rightIndex].avgTimestamp
          ])
        };

        merged.splice(rightIndex, 1);
        merged.splice(leftIndex, 1, next);
        changed = true;
        break outer;
      }
    }
  }

  return merged;
}

function scoreClusters(clusters: MutableCluster[]): ImportanceCluster[] {
  return clusters
    .map((cluster, index) => toImportanceCluster(index, cluster))
    .map((cluster) => {
      const breadth = saturating(cluster.channelsCount, 4);
      const depth = average(cluster.posts.map((post) => post.features.contentDensity));
      const impact = average(cluster.posts.map(estimateImpact));
      const novelty = average(cluster.posts.map((post) => post.features.informationGain));
      const corroboration = cluster.channelsCount > 1
        ? clamp01(0.45 + breadth * 0.55)
        : cluster.postsCount > 1
          ? 0.28
          : 0.12;
      const urgency = average(cluster.posts.map((post) => post.features.freshness));
      const penalties = computeHypePenalty(cluster) + computeSummaryPenalty(cluster);
      const importance =
        0.24 * breadth +
        0.18 * depth +
        0.24 * impact +
        0.14 * novelty +
        0.12 * corroboration +
        0.08 * urgency -
        penalties;
      const confidence = clamp01(0.45 * corroboration + 0.35 * breadth + 0.2 * depth);

      return {
        ...cluster,
        confidence,
        importance,
        importanceBreakdown: {
          breadth,
          depth,
          impact,
          novelty,
          corroboration,
          urgency,
          penalties
        }
      };
    })
    .sort((left, right) => right.importance - left.importance);
}

function selectDigestTopics(clusters: ImportanceCluster[]): ImportanceCluster[] {
  const ranked = clusters.slice();
  const selected: ImportanceCluster[] = [];

  while (ranked.length > 0 && selected.length < FINAL_TOPICS_LIMIT) {
    let bestIndex = 0;
    let bestScore = -Infinity;

    for (let index = 0; index < ranked.length; index += 1) {
      const candidate = ranked[index];
      const redundancyPenalty = selected.length === 0
        ? 0
        : Math.max(...selected.map((item) => finalClusterSimilarity(candidate, item))) * 0.38;
      const singleSourcePenalty =
        candidate.channelsCount === 1 && selected.some((item) => item.channelsCount > 1) ? 0.06 : 0;
      const digestSelectionScore = candidate.importance - redundancyPenalty - singleSourcePenalty;

      if (digestSelectionScore > bestScore) {
        bestScore = digestSelectionScore;
        bestIndex = index;
      }
    }

    selected.push(ranked.splice(bestIndex, 1)[0]);
  }

  return selected;
}

function toImportanceCluster(index: number, cluster: MutableCluster): ImportanceCluster {
  const representativePosts = selectRepresentativePosts(cluster.posts);
  const channelSet = new Set(cluster.posts.map((post) => post.channelUsername));
  const timestamps = cluster.posts.map((post) => new Date(post.publishedAt).getTime());
  const factSet = buildFactSet(cluster.posts);
  const noveltySignature = buildClusterNoveltySignature(cluster.posts, cluster.keywords, cluster.entities);
  const impactClass = classifyImpact(cluster.posts);

  return {
    id: `cluster-${index + 1}`,
    posts: cluster.posts,
    representativePosts,
    channelsCount: channelSet.size,
    postsCount: cluster.posts.length,
    firstSeenAt: new Date(Math.min(...timestamps)).toISOString(),
    lastSeenAt: new Date(Math.max(...timestamps)).toISOString(),
    topEntities: cluster.entities.slice(0, 8),
    topKeywords: cluster.keywords.slice(0, 8),
    topicTitleCandidate: buildTopicTitle(representativePosts[0]),
    impactClass,
    factSet,
    noveltySignature,
    confidence: 0,
    importance: 0,
    importanceBreakdown: {
      breadth: 0,
      depth: 0,
      impact: 0,
      novelty: 0,
      corroboration: 0,
      urgency: 0,
      penalties: 0
    }
  };
}

function clusterSimilarityWithPost(cluster: MutableCluster, post: EnrichedPost): number {
  const keywordSim = jaccard(cluster.keywords, post.features.keywords);
  const entitySim = jaccard(cluster.entities, post.features.entities);
  const signatureSim = Math.max(
    ...cluster.signatures.map((signature) => signatureSimilarity(signature, buildSignature(post.textClean, post.features.keywords))),
    0
  );
  const timeScore = timeWindowScore(cluster.avgTimestamp, new Date(post.publishedAt).getTime());
  const sameChannelPenalty = cluster.posts.some((item) => item.channelUsername === post.channelUsername) ? 0.04 : 0;

  return 0.38 * keywordSim + 0.27 * entitySim + 0.23 * signatureSim + 0.12 * timeScore - sameChannelPenalty;
}

function clusterSimilarity(left: MutableCluster, right: MutableCluster): number {
  const keywordSim = jaccard(left.keywords, right.keywords);
  const entitySim = jaccard(left.entities, right.entities);
  const signatureSim = maxPairSimilarity(left.signatures, right.signatures);
  const timeScore = timeWindowScore(left.avgTimestamp, right.avgTimestamp);

  return 0.36 * keywordSim + 0.28 * entitySim + 0.24 * signatureSim + 0.12 * timeScore;
}

function finalClusterSimilarity(left: ImportanceCluster, right: ImportanceCluster): number {
  return (
    0.35 * jaccard(left.topKeywords, right.topKeywords) +
    0.3 * jaccard(left.topEntities, right.topEntities) +
    0.2 * maxPairSimilarity(
      left.representativePosts.map((post) => buildSignature(post.textClean, post.features.keywords)),
      right.representativePosts.map((post) => buildSignature(post.textClean, post.features.keywords))
    ) +
    0.15 * signatureSimilarity(left.noveltySignature, right.noveltySignature)
  );
}

function estimateImpact(post: EnrichedPost): number {
  const text = post.textClean.toLowerCase();
  let score = 0;

  if (IMPACT_MARKERS.some((marker) => text.includes(marker))) {
    score += 0.45;
  }
  if (post.features.containsNumbers) score += 0.12;
  if (post.features.containsNamedEntities) score += 0.14;
  if (post.features.isAlertLike) score += 0.14;
  if (post.features.containsActionVerb) score += 0.1;
  if (/(погиб|ранен|убит|банкрот|санкции|ликвидац|взлом|выпуск|релиз|etf|ipo)/i.test(text)) {
    score += 0.12;
  }

  return clamp01(score);
}

function computeHypePenalty(cluster: ImportanceCluster): number {
  const lowFactPosts = cluster.posts.filter(
    (post) => post.features.contentDensity < 0.3 && post.features.eventness < 0.28
  ).length;
  const ratio = cluster.posts.length === 0 ? 0 : lowFactPosts / cluster.posts.length;
  const allFromOneChannelPenalty = cluster.channelsCount === 1 ? 0.08 : 0;

  if (ratio > 0.65) return 0.18 + allFromOneChannelPenalty;
  if (ratio > 0.4) return 0.08 + allFromOneChannelPenalty;
  return allFromOneChannelPenalty;
}

function computeSummaryPenalty(cluster: ImportanceCluster): number {
  const summaryRatio =
    cluster.posts.length === 0
      ? 0
      : cluster.posts.filter((post) => post.features.isSummaryLike).length / cluster.posts.length;

  if (summaryRatio > 0.7) return 0.14;
  if (summaryRatio > 0.35) return 0.07;
  return 0;
}

function channelBalanceBonus(post: EnrichedPost): number {
  return post.features.containsNamedEntities ? 0.04 : 0;
}

function representativeBonus(post: EnrichedPost): number {
  return (
    (post.features.containsNamedEntities ? 0.05 : 0) +
    (post.features.containsNumbers ? 0.03 : 0) +
    (post.features.containsActionVerb ? 0.04 : 0)
  );
}

function selectRepresentativePosts(posts: EnrichedPost[]): EnrichedPost[] {
  if (posts.length <= MAX_REPRESENTATIVE_POSTS) {
    return posts
      .slice()
      .sort((left, right) => {
        const leftScore = left.features.postRelevance + representativeBonus(left);
        const rightScore = right.features.postRelevance + representativeBonus(right);
        return rightScore - leftScore;
      });
  }

  const mostFactual = posts
    .slice()
    .sort((left, right) => {
      const leftScore = left.features.contentDensity + left.features.eventness + representativeBonus(left);
      const rightScore = right.features.contentDensity + right.features.eventness + representativeBonus(right);
      return rightScore - leftScore;
    })[0];

  const earliestStrong = posts
    .filter((post) => post.features.postRelevance > 0.28)
    .slice()
    .sort((left, right) => new Date(left.publishedAt).getTime() - new Date(right.publishedAt).getTime())[0] ?? mostFactual;

  const mostComplete = posts
    .slice()
    .sort((left, right) => right.textClean.length - left.textClean.length)[0];

  return Array.from(new Set([mostFactual, earliestStrong, mostComplete])).slice(0, MAX_REPRESENTATIVE_POSTS);
}

function computeFreshness(publishedAt: string): number {
  const ageHours = (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60);
  if (ageHours <= 2) return 1;
  if (ageHours <= 6) return 0.8;
  if (ageHours <= 12) return 0.62;
  if (ageHours <= 24) return 0.42;
  return 0.2;
}

function computeSourcePrior(postsPerChannel: number): number {
  return postsPerChannel >= 12 ? 0.66 : postsPerChannel >= 6 ? 0.56 : 0.45;
}

function dedupeBySignature(posts: EnrichedPost[]): EnrichedPost[] {
  const seen = new Set<string>();

  return posts.filter((post) => {
    const signature = buildSignature(post.textClean, post.features.keywords);
    if (!signature || seen.has(signature)) {
      return false;
    }
    seen.add(signature);
    return true;
  });
}

function tokenize(text: string): string[] {
  return Array.from(
    new Set(
      sanitize(text, 700)
        .toLowerCase()
        .replace(/https?:\/\/\S+/g, " ")
        .replace(/[^\p{L}\p{N}\s-]/gu, " ")
        .split(/\s+/)
        .map(normalizeToken)
        .filter((token) => token.length >= 4 && !STOPWORDS.has(token))
    )
  ).slice(0, 16);
}

function normalizeToken(token: string): string {
  let normalized = token.toLowerCase().replace(/^-+|-+$/g, "");

  if (normalized.length <= 4) {
    return normalized;
  }

  normalized = normalized
    .replace(/(ами|ями|ого|ему|ому|ыми|ими|ать|ить|ться|лись|лась|лись)$/u, "")
    .replace(/(ов|ев|ий|ый|ой|ая|яя|ое|ее|ые|ие|ам|ям|ах|ях|ом|ем|ую|юю|а|я|ы|и|е|о|у|ю)$/u, "");

  return normalized;
}

function extractEntities(text: string): string[] {
  return Array.from(
    new Set(
      sanitize(text, 700)
        .split(/\s+/)
        .map((token) => token.replace(/[^\p{L}\p{N}-]/gu, ""))
        .filter((token) => /^[A-ZА-ЯЁ][A-Za-zА-ЯЁа-яё0-9-]{2,}$/.test(token))
    )
  ).slice(0, 16);
}

function buildSignature(text: string, keywords: string[]): string {
  const signatureKeywords = keywords.slice(0, 6).join(" ");
  const head = sanitize(text, 120)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map(normalizeToken)
    .filter((token) => token.length >= 4 && !STOPWORDS.has(token))
    .slice(0, 10)
    .join(" ");

  return `${signatureKeywords} ${head}`.trim();
}

function buildTopicTitle(post?: EnrichedPost): string {
  if (!post) {
    return "Тема без названия";
  }

  return sanitize(post.textClean, 110);
}

function buildFactSet(posts: EnrichedPost[]): string[] {
  const facts = posts
    .map((post) => sanitize(post.textClean, 180))
    .filter((text) => text.length >= 40)
    .slice(0, 6);

  return Array.from(new Set(facts)).slice(0, 5);
}

function buildClusterNoveltySignature(posts: EnrichedPost[], keywords: string[], entities: string[]): string {
  const pieces = [
    ...entities.slice(0, 4),
    ...keywords.slice(0, 6),
    ...posts
      .slice()
      .sort((left, right) => new Date(right.publishedAt).getTime() - new Date(left.publishedAt).getTime())
      .slice(0, 2)
      .map((post) => buildSignature(post.textClean, post.features.keywords))
  ];

  return pieces.join(" ").trim();
}

function classifyImpact(posts: EnrichedPost[]): string {
  const text = posts.map((post) => post.textClean.toLowerCase()).join(" ");

  if (/(атака|обстрел|взрыв|дрон|беспилот|погиб|ранен|strike|attack|exploit|hack|breach)/i.test(text)) {
    return "security_incident";
  }
  if (/(закон|регуля|санкц|суд|запрет|разрешил|правительство|евросоюз|выборы|орбан)/i.test(text)) {
    return "politics_regulation";
  }
  if (/(etf|ipo|рынок|бирж|фрс|банк|trade|tariff|fund|ethereum|btc|token)/i.test(text)) {
    return "markets_finance";
  }
  if (/(выпустил|запустил|release|launch|релиз|product|модель|платформ)/i.test(text)) {
    return "product_release";
  }

  return "general_news";
}

function stripLinks(text: string): string {
  return text.replace(/https?:\/\/\S+/g, " ");
}

function timeWindowScore(leftTimestamp: number, rightTimestamp: number): number {
  const hours = Math.abs(leftTimestamp - rightTimestamp) / (1000 * 60 * 60);
  if (hours <= 2) return 1;
  if (hours <= 6) return 0.75;
  if (hours <= 12) return 0.48;
  if (hours <= 24) return 0.24;
  return 0.08;
}

function signatureSimilarity(left: string, right: string): number {
  return jaccard(left.split(/\s+/), right.split(/\s+/));
}

function maxPairSimilarity(left: string[], right: string[]): number {
  let best = 0;

  for (const leftItem of left) {
    for (const rightItem of right) {
      best = Math.max(best, signatureSimilarity(leftItem, rightItem));
    }
  }

  return best;
}

function jaccard(left: string[], right: string[]): number {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let intersection = 0;

  for (const token of leftSet) {
    if (rightSet.has(token)) {
      intersection += 1;
    }
  }

  const union = new Set([...leftSet, ...rightSet]).size;
  return union === 0 ? 0 : intersection / union;
}

function mergeUnique(current: string[], next: string[], limit: number): string[] {
  return Array.from(new Set([...current, ...next])).slice(0, limit);
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function saturating(value: number, cap: number): number {
  return clamp01(value / cap);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function sanitize(value: string, limit = 1500): string {
  return value.replace(/\s+/g, " ").trim().slice(0, limit);
}
