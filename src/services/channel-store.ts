import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { StoredState, TrackedChannel } from "../types.js";
import { ensureDir } from "../utils/fs.js";

const DEFAULT_STATE: StoredState = {
  channels: []
};

export class ChannelStore {
  private readonly filePath: string;

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, "channels.json");
  }

  async list(): Promise<TrackedChannel[]> {
    const state = await this.readState();
    return state.channels;
  }

  async add(channel: TrackedChannel): Promise<boolean> {
    const state = await this.readState();
    const exists = state.channels.some((item) => item.username === channel.username);

    if (exists) {
      return false;
    }

    state.channels.push(channel);
    await this.writeState(state);
    return true;
  }

  async remove(username: string): Promise<TrackedChannel | null> {
    const state = await this.readState();
    const index = state.channels.findIndex((item) => item.username === username);

    if (index === -1) {
      return null;
    }

    const [removed] = state.channels.splice(index, 1);
    await this.writeState(state);
    return removed;
  }

  private async readState(): Promise<StoredState> {
    try {
      const content = await readFile(this.filePath, "utf-8");
      return DEFAULT_STATE_MERGED(JSON.parse(content) as Partial<StoredState>);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        await this.writeState(DEFAULT_STATE);
        return structuredClone(DEFAULT_STATE);
      }

      throw error;
    }
  }

  private async writeState(state: StoredState): Promise<void> {
    await ensureDir(path.dirname(this.filePath));
    await writeFile(this.filePath, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
  }
}

function DEFAULT_STATE_MERGED(state: Partial<StoredState>): StoredState {
  return {
    channels: state.channels ?? []
  };
}
