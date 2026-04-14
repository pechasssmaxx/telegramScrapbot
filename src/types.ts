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
