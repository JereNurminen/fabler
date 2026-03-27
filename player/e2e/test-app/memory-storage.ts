import type { StorageAdapter, SavedState, SlotInfo } from "../../engine/types";

export class MemoryStorage implements StorageAdapter {
  private store = new Map<string, Map<string, SavedState>>();

  private getStoryStore(storyId: string): Map<string, SavedState> {
    if (!this.store.has(storyId)) {
      this.store.set(storyId, new Map());
    }
    return this.store.get(storyId)!;
  }

  async saveSlot(storyId: string, slotId: string, state: SavedState): Promise<void> {
    this.getStoryStore(storyId).set(slotId, state);
  }

  async loadSlot(storyId: string, slotId: string): Promise<SavedState | null> {
    return this.getStoryStore(storyId).get(slotId) ?? null;
  }

  async listSlots(storyId: string): Promise<SlotInfo[]> {
    const store = this.getStoryStore(storyId);
    return Array.from(store.entries()).map(([slotId, saved]) => ({
      slotId,
      name: saved.name,
      timestamp: saved.timestamp,
    }));
  }

  async deleteSlot(storyId: string, slotId: string): Promise<void> {
    this.getStoryStore(storyId).delete(slotId);
  }
}
