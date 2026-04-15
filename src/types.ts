export interface TrackedChannel {
  id: string;
  input: string;
  username: string;
  title: string;
  url: string;
  addedAt: string;
}

export interface StoredState {
  channels: TrackedChannel[];
}

export interface RecentPost {
  channelId: string;
  channelTitle: string;
  channelUsername: string;
  messageId: number;
  publishedAt: string;
  text: string;
  url: string;
}

export interface DigestTopic {
  title: string;
  summary: string;
  sourceUrl: string;
}

export interface PostFeatures {
  lengthChars: number;
  containsNumbers: boolean;
  containsTimeReference: boolean;
  containsNamedEntities: boolean;
  containsActionVerb: boolean;
  containsClaimPattern: boolean;
  isForwardLike: boolean;
  isOpinionLike: boolean;
  isAlertLike: boolean;
  isSummaryLike: boolean;
  keywords: string[];
  entities: string[];
  eventness: number;
  contentDensity: number;
  freshness: number;
  sourcePrior: number;
  noisePenalty: number;
  informationGain: number;
  postRelevance: number;
}

export interface EnrichedPost extends RecentPost {
  textClean: string;
  features: PostFeatures;
}

export interface ImportanceCluster {
  id: string;
  posts: EnrichedPost[];
  representativePosts: EnrichedPost[];
  channelsCount: number;
  postsCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  topEntities: string[];
  topKeywords: string[];
  topicTitleCandidate: string;
  impactClass: string;
  factSet: string[];
  noveltySignature: string;
  confidence: number;
  importance: number;
  importanceBreakdown: {
    breadth: number;
    depth: number;
    impact: number;
    novelty: number;
    corroboration: number;
      urgency: number;
      penalties: number;
    };
}
