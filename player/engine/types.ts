// Types that cross the Rust boundary are generated — see @fabler/types.
// Re-exported here so `@fabler/player/engine/types` stays a complete public
// API for embedders who have not installed @fabler/types directly.
export type {
  Manifest,
  ManifestStory,
  Flag,
  Page,
  Choice,
  FlagOperation,
  Condition,
  Document,
  Block,
  Inline,
  Mark,
} from "@fabler/types";

// Imported rather than re-exported above, because the interfaces below
// reference them. Exporting them twice would be a duplicate-export error.
import type { GameState, SavedState, SlotInfo } from "@fabler/types";
export type { GameState, SavedState, SlotInfo };

// -- Types with no Rust counterpart --

/** Convenience alias; Rust expresses this inline as HashMap<String, bool>. */
export type FlagState = Record<string, boolean>;

export interface StorageAdapter {
  saveSlot(storyId: string, slotId: string, state: SavedState): Promise<void>;
  loadSlot(storyId: string, slotId: string): Promise<SavedState | null>;
  listSlots(storyId: string): Promise<SlotInfo[]>;
  deleteSlot(storyId: string, slotId: string): Promise<void>;
}

export interface AssetResolver {
  getAssetUrl(assetPath: string): string | Promise<string>;
}

export type FontSize = "small" | "medium" | "large" | "extra-large";
export type Theme = "light" | "dark" | "system";

export interface UserPreferences {
  fontSize: FontSize;
  theme: Theme;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  fontSize: "medium",
  theme: "system",
};
