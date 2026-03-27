import { invoke } from "@tauri-apps/api/core";
import type { StorageAdapter, SavedState, SlotInfo } from "@fabler/player/engine/types";

export class TauriStorageAdapter implements StorageAdapter {
  async saveSlot(storyId: string, slotId: string, state: SavedState): Promise<void> {
    await invoke("save_slot", { storyId, slotId, state });
  }

  async loadSlot(storyId: string, slotId: string): Promise<SavedState | null> {
    return await invoke("load_slot", { storyId, slotId });
  }

  async listSlots(storyId: string): Promise<SlotInfo[]> {
    return await invoke("list_slots", { storyId });
  }

  async deleteSlot(storyId: string, slotId: string): Promise<void> {
    await invoke("delete_slot", { storyId, slotId });
  }
}
