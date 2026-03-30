# Fabler Player & Reader App — Design Spec

## Overview

A client-side player for Fabler interactive fiction stories, designed as a single shared engine consumed by three hosts: embedded in the creation tool (preview + playtest), a standalone Tauri Mobile/Desktop reader app, and (future) a self-contained HTML export. Mobile-first, accessible-first.

## Bundle Format (`.fabler`)

A `.fabler` file is a zip archive:

```
story.fabler
├── manifest.json
└── assets/
    ├── page-1-hero.png
    ├── chapter-art.jpg
    └── ...
```

### `manifest.json`

```json
{
  "format_version": 1,
  "story": {
    "id": "uuid-string",
    "title": "My Adventure",
    "start_page": "page-uuid"
  },
  "flags": [
    { "id": "flag-uuid", "name": "has_key", "default_value": false }
  ],
  "pages": [
    {
      "id": "page-uuid",
      "name": "The Beginning",
      "body": "Styled text content",
      "assets": ["page-1-hero.png"],
      "flag_operations": [
        { "flag_id": "flag-uuid", "operation": "set_true" }
      ],
      "choices": [
        {
          "id": "choice-uuid",
          "text": "Open the door",
          "target": "page-uuid-2",
          "flag_operations": [],
          "conditions": [
            { "flag_id": "flag-uuid", "required_value": true }
          ]
        }
      ]
    }
  ]
}
```

Key decisions:

- **UUIDs** instead of integer IDs — avoids collisions across distributed stories.
- **JSON** — native to the web player, no parser dependency needed.
- **`format_version`** — for forward compatibility.
- **Asset references** — filenames pointing into the `assets/` directory.
- **Styled text** — body field holds formatted content. Exact format TBD when rich text is added to the editor (likely markdown or ProseMirror JSON).

Rust handles zip packing/unpacking via the `zip` crate in `shared/src/bundle.rs`.

## Player Engine (TypeScript)

### Core Runtime — Pure TypeScript, No Framework

A pure state machine with no dependencies on React, Tauri, or any UI framework.

**Types:**

- `Manifest` — the parsed `manifest.json`
- `GameState` — current page ID + flag values map
- `SavedState` — GameState + metadata (timestamp, slot name)
- `SlotInfo` — slot ID, name, timestamp (for listing)

**Functions:**

- `evaluateConditions(conditions, flagState) → boolean` — AND logic, matching current editor behavior.
- `applyFlagOperations(operations, flagState) → FlagState` — returns new immutable state.
- `getAvailableChoices(page, flagState) → Choice[]` — filters by evaluated conditions.
- `navigate(choice, gameState) → GameState` — applies flag operations and moves to target page.

### Adapter Interfaces

```typescript
interface StorageAdapter {
  saveSlot(storyId: string, slotId: string, state: SavedState): Promise<void>
  loadSlot(storyId: string, slotId: string): Promise<SavedState | null>
  listSlots(storyId: string): Promise<SlotInfo[]>
  deleteSlot(storyId: string, slotId: string): Promise<void>
}

interface AssetResolver {
  getAssetUrl(assetPath: string): string | Promise<string>
}
```

These interfaces enable multiple hosts:

- **Tauri reader app**: StorageAdapter backed by filesystem (JSON files via Tauri commands), AssetResolver backed by Tauri asset protocol.
- **Creation tool embed**: In-memory StorageAdapter, AssetResolver reads from editor state.
- **Future HTML export**: StorageAdapter backed by localStorage, AssetResolver returns inline base64/blob URLs.

### React UI Layer

Top-level component:

```
<StoryPlayer manifest={...} storage={...} assets={...} />
```

Components:

- `PageView` — renders styled body text + inline images via AssetResolver
- `ChoiceList` — accessible choice navigation
- `SaveLoadMenu` — save slot management (manual save slots, per-story, unlimited slots with user-provided names)
- `Settings` — font size and theme controls

Mobile-first: full-screen page view, large touch targets, portrait-primary.

## Accessibility

Accessibility is a first-class requirement, not an afterthought.

### Semantic HTML

- `<article>` for page content, `<nav>` for choices, `<button>` for interactive elements.
- No div-soup. Semantic structure is the foundation.

### Screen Reader Support

- ARIA live regions for page transitions — screen readers announce new page content on navigation.
- Focus management: after choosing an option, focus moves to the top of the new page content.
- Hidden choices (failed conditions) are excluded from the DOM entirely — no confusing gaps.

### Keyboard Navigation

- All choices focusable and navigable with arrow keys + Enter.
- Save/load UI fully keyboard accessible.
- Tab order follows visual order.

### Images

- Alt text required for images (enforced in the creation tool editor when adding images).

### User Preferences (persisted per-device, not per-story)

- **Font size**: adjustable scale — small / medium / large / extra large. Applied via CSS `rem` scaling on the player root.
- **Theme**: light / dark / system-default. Implemented with CSS custom properties for all colors.
- Both themes meet WCAG AA contrast ratios minimum.
- Preferences stored via StorageAdapter (separate key space from save slots).
- Settings accessible from a gear icon in player chrome, always reachable.

### Readability

- Highly legible default font.
- Adequate line height and max content width for comfortable reading on all screen sizes.

## Reader App (Tauri Mobile + Desktop)

A single Tauri project targeting iOS, Android, and desktop from one codebase. Mobile-first.

### Rust Backend

- **File type registration**: UTI on iOS, intent filter on Android, file association on desktop for `.fabler` files.
- **Bundle management**: Unpack zip to managed storage directory.
- **StorageAdapter implementation**: Save slots as JSON files alongside the unpacked story.
- **AssetResolver implementation**: Serve assets from unpacked story directory via Tauri asset protocol.
- **Library management**: List installed stories, delete stories, report storage usage.

### App Screens

- **Library**: Grid/list of installed stories (title, optional cover image). Tap to play, long-press/swipe to delete.
- **Player**: The shared `<StoryPlayer>` component, full screen.
- **Settings**: Font size, theme. Accessible from both library and player.

### Story Installation Flow

- **iOS**: Receive `.fabler` file via AirDrop, Files, email, Messages, cloud drive → tap → "Open with Fabler Reader" → app unpacks and adds to library.
- **Android**: Same via intent filter.
- **Desktop**: Double-click `.fabler` file or drag onto app window.

### Mobile UI Considerations

- Touch targets minimum 44x44pt (Apple HIG) / 48dp (Material).
- Swipe gestures for common actions (e.g. back to library).
- Safe area insets respected (notch, home indicator, status bar).
- Portrait-primary, landscape supported.

### No Server Dependency

The reader app is purely a local file viewer. No accounts, no content hosting, no moderation. Authors distribute `.fabler` files however they choose.

## Embedding in Creation Tool

The shared player components are imported directly — no iframe, no bundle file.

- **Preview mode**: Renders the current page as a reader would see it. Fed data from editor atoms. Read-only, no save/load.
- **Playtest mode**: Constructs a manifest from the current story state. Uses an in-memory StorageAdapter. Full navigation from start page (or "play from here").

## Workspace Structure

```
cyoa2/
├── shared/                    # Rust shared types (existing)
│   └── src/
│       ├── models.rs          # Core data model
│       ├── export.rs          # Export types (updated)
│       └── bundle.rs          # (new) Zip packing/unpacking, manifest JSON
├── player/                    # (new) Player package
│   ├── engine/                # Pure TS — types, runtime, adapter interfaces
│   │   └── __tests__/
│   └── ui/                    # React components — StoryPlayer, PageView, etc.
├── creation-tool/             # Tauri creation tool (existing)
│   ├── src/
│   │   └── components/
│   │       ├── Preview.tsx    # (new) Embeds player for page preview
│   │       └── Playtest.tsx   # (new) Embeds player for full playtest
│   └── src-tauri/
├── reader/                    # (new) Tauri Mobile reader app
│   ├── src/                   # Library screen + mounts StoryPlayer
│   └── src-tauri/             # File associations, bundle mgmt, storage
└── engine/                    # Existing placeholder — unused
```

### Dependency Graph

```
shared (Rust)  <── creation-tool/src-tauri (Rust)
               <── reader/src-tauri (Rust)

player/engine (TS)  <── player/ui (React)
                          <── creation-tool/src (embedded)
                          <── reader/src (main UI)
```

Player package consumed via yarn/npm workspaces. No publishing needed.

Cargo workspace expands to include `reader/src-tauri`.

## Testing Strategy

### Layer 1: Player Engine Unit Tests (vitest)

The pure TS runtime is the most critical and most testable layer. Comprehensive unit tests for:

- `evaluateConditions` — all combinations of flag states and condition sets, empty conditions, missing flags.
- `applyFlagOperations` — set_true, set_false, toggle, multiple operations, immutability.
- `getAvailableChoices` — filtering logic, all-hidden edge case, no-conditions passthrough.
- `navigate` — state transitions, flag operations applied in correct order, target page validation.

These are fast, pure-function tests with no setup. They run on every change.

### Layer 2: Bundle Round-Trip Tests (Rust integration tests)

Tests in the `shared` crate that verify:

- Pack a story into a `.fabler` zip → unpack → manifest matches original data.
- Asset files survive the round trip intact (binary comparison).
- Invalid/corrupt bundles produce clear errors.
- Forward compatibility: a bundle with unknown `format_version` or extra fields is handled gracefully.

### Layer 3: Player UI Component Tests (vitest + testing-library)

Component-level tests for the React player UI:

- `PageView` renders body text and images correctly.
- `ChoiceList` renders only available choices (respects conditions).
- Keyboard navigation works (arrow keys, Enter).
- Focus moves to page content after navigation.
- `SaveLoadMenu` creates, loads, and deletes slots via a mock StorageAdapter.
- Font size and theme settings apply correctly.
- Screen reader concerns: ARIA live regions present, semantic elements used.

### Layer 4: Player Integration Tests (Playwright)

End-to-end tests running the player UI against a test story (served via Vite dev server, no Tauri needed):

- Play through a multi-page story, verify correct pages and choices appear.
- Flag operations affect choice visibility across pages.
- Save a game, reload, verify state restored.
- Accessibility audit via `@axe-core/playwright` on each page.

### Layer 5: Creation Tool to Player E2E Tests (Playwright, stretch goal)

Full pipeline tests using the creation tool's existing Playwright setup:

- Create a story in the editor → export as `.fabler` → load in the player → play through it.
- Verify the playtest mode within the creation tool works correctly.
- These are slow and brittle by nature — a small suite covering the critical path, not exhaustive.

### Test Story Fixtures

A set of `.fabler` bundles (and corresponding manifest JSON files) in a shared `test-fixtures/` directory:

- **minimal.fabler** — single page, no choices, no flags.
- **branching.fabler** — multiple pages with branching choices.
- **flags.fabler** — flags, flag operations, and conditional choices.
- **assets.fabler** — story with embedded images.

Used by layers 2-5. Maintained as checked-in fixtures, not generated on the fly.

## Implementation Order

1. **Bundle format** — `shared/src/bundle.rs`, manifest JSON types, export command in creation tool.
2. **Player engine** — pure TS runtime with unit tests.
3. **Player UI** — React components, mobile-first, accessible.
4. **Embed in creation tool** — preview + playtest modes.
5. **Reader app** — Tauri Mobile shell, file associations, library screen.

Each step produces something testable before the next begins.

## Future Considerations (Out of Scope)

### Standalone HTML Export

The adapter interfaces (StorageAdapter, AssetResolver) are designed to support this. Implementation would:

- Bake story JSON + base64-encoded assets into the HTML bundle alongside the player JS.
- Use localStorage for save persistence.
- Produce a single `.html` file.

### Debug Log / Bug Reporting

The player engine records a game session log (page entries, flag evaluations, choices made). A "Report issue" button exports this as a text file the user can send to the story author. No network calls, no personal data.

For the reader app itself, standard Rust `tracing` to a rotating log file, exportable from settings.

### Rudimentary DRM

Password-based encryption of bundle contents:

- AES-256-GCM encryption, key derived from password via Argon2.
- Unencrypted header with encryption flag + key derivation parameters.
- Reader app prompts for password, decrypts to temporary directory, cleans up on close.
- "Honest user" DRM — prevents casual redistribution, not determined extraction.
