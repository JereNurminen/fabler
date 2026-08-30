// -- Manifest types (matches Rust Manifest struct from shared/src/bundle.rs) --

export interface Manifest {
  format_version: number;
  story: ManifestStory;
  flags: ManifestFlag[];
  pages: ManifestPage[];
}

export interface ManifestStory {
  id: string;
  title: string;
  start_page: string;
}

export interface ManifestFlag {
  id: string;
  name: string;
  default_value: boolean;
}

export interface ManifestPage {
  id: string;
  name: string;
  body: Document;
  assets: string[];
  flag_operations: ManifestFlagOperation[];
  choices: ManifestChoice[];
}

export interface ManifestChoice {
  id: string;
  text: string;
  target: string;
  flag_operations: ManifestFlagOperation[];
  conditions: ManifestCondition[];
}

export interface ManifestFlagOperation {
  flag_id: string;
  operation: "set_true" | "set_false" | "toggle";
}

export interface ManifestCondition {
  flag_id: string;
  required_value: boolean;
}

// -- Rich text document types --

export interface Document {
  content: Block[];
}

export type Block =
  | { type: "paragraph"; content: Inline[] }
  | { type: "blockquote"; content: Block[] }
  | { type: "image"; src: string; alt: string }
  | { type: "horizontal_rule" }
  | { type: "markdown"; source: string };

export interface Inline {
  text: string;
  marks: Mark[];
}

export type Mark = "bold" | "italic";

// -- Game state --

export type FlagState = Record<string, boolean>;

export interface GameState {
  currentPageId: string;
  flags: FlagState;
}

// -- Save/load --

export interface SavedState {
  gameState: GameState;
  name: string;
  timestamp: number;
}

export interface SlotInfo {
  slotId: string;
  name: string;
  timestamp: number;
}

// -- Adapter interfaces --

export interface StorageAdapter {
  saveSlot(storyId: string, slotId: string, state: SavedState): Promise<void>;
  loadSlot(storyId: string, slotId: string): Promise<SavedState | null>;
  listSlots(storyId: string): Promise<SlotInfo[]>;
  deleteSlot(storyId: string, slotId: string): Promise<void>;
}

export interface AssetResolver {
  getAssetUrl(assetPath: string): string | Promise<string>;
}

// -- User preferences --

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
