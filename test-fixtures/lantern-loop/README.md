# The Lantern Loop — feature-coverage test story

A creation-tool project (open `story.json`) written to exercise every authoring
feature at once. The prose is filler; the graph is the point.

13 pages, 7 flags, 23 choices, 3 endings — a mostly linear spine with **two**
loop-backs, so the editor has something to draw without turning into a hub.

## Map

```
Entrance
   │
   ▼
Great Hall ◀───────────────────────────────┐  loop-back 2
   │  └──▶ END: Swallowed by the Dark      │
   ▼                                       │
Storeroom                                  │
   │                                       │
   ▼                                       │
Library                                    │
   │                                       │
   ▼                                       │
Dark Stair ──▶ END: Swallowed by the Dark  │
   │                                       │
   ▼                                       │
Crypt ⟲  loop-back 1 (self)                │
   │                                       │
   ▼                                       │
Iron Door ──────────┐                      │
   │                ▼                      │
   │           Secret Vault                │
   ▼                │                      │
Guard Post ◀────────┘                      │
   │  └────────────────────────────────────┘
   ▼
Courtyard ──▶ END: Out of the Keep
          └─▶ END: The Cursed Crown
```

Everything else runs forward. The Great Hall also offers a shortcut straight
back to the Guard Post once you have been seen, so the second lap is short.

### The two loop-backs

1. **Crypt → Crypt** — "Lay your hand on the sarcophagus" targets its own page
   and toggles `Cursed`. A self-edge in the story map; touch it an odd number
   of times to reach the cursed ending.
2. **Guard Post → Great Hall** — "Bluff him, and lose your nerve halfway
   through" throws you back to the second page of the story. It sets
   `Seen by the sentry` and toggles your torch out, so the Great Hall you come
   back to is not the one you left: the shortcut passage and the fatal dark
   route are both open now, and neither was before.

## What each feature is exercised by

| Feature | Where |
| --- | --- |
| Flag default `false` | six of the seven flags |
| Flag default `true` | `f20b2` *Torch is lit* — the only flag that starts set |
| Page-level `flag_operations` | Storeroom (grants the lantern), Crypt (records the visit) |
| Choice-level `set_true` | Library "Read the ledger", Vault "Take the crown", Guard Post "Bluff him" |
| Choice-level `set_false` | Entrance "Pinch out your torch", Storeroom "Put the lantern back" |
| Choice-level `toggle` | Crypt "Lay your hand on the sarcophagus", Guard Post "Shutter your torch" / "Bluff him" |
| Two operations on one choice | Guard Post "Bluff him" — `set_true` spotted **and** `toggle` torch |
| Condition `required_value: true` | Dark Stair → Crypt, Iron Door → Vault, Great Hall shortcut |
| Condition `required_value: false` | Great Hall → dark ending, Dark Stair → dark ending, Courtyard endings |
| Multiple conditions (AND) | Iron Door "Speak the word" (ledger **and** crypt), Courtyard "crown cold against your ribs" |
| Self-loop | Crypt |
| Loop-back to an earlier page | Guard Post → Great Hall |
| Ending pages (no choices) | Out of the Keep, The Cursed Crown, Swallowed by the Dark |
| Image assets | `gate.png`, `lantern.png`, `crown.png` under `assets/`, referenced from markdown |
| Markdown rendering | headings, bold, italic, links, ordered/unordered/nested/task lists, blockquote, nested blockquote, table, code span, fenced code, strikethrough, horizontal rule |
| Graph positions | every page carries `editor.position` for the story map |

## Reaching each ending

- **Out of the Keep** — the straight run. Take the lantern, go down, come back
  up, reach the Courtyard uncursed.
- **The Cursed Crown** — touch the sarcophagus an *odd* number of times, read
  the ledger, open the iron door, take the crown, then climb the wall.
- **Swallowed by the Dark** — go on without light. Snuff the torch at the
  Entrance and feel along the wall in the Great Hall, or leave the lantern on
  the shelf and grope down the stair. Also reachable *after* the loop-back,
  because bluffing the sentry puts your torch out.

## Block types the editor cannot author

The page editor stores a body as a single `markdown` block (`PageCard.tsx`
reads `body.content[0]` and writes one block back), so a page using
`paragraph`, `blockquote`, `image` or `horizontal_rule` blocks would be
overwritten the first time it is edited. Every page here is therefore a single
markdown block.

Those block types are covered separately by `../rich-blocks.json`, a bundle
manifest for the player/reader — paragraph inlines with bold, italic and both
marks together, a blockquote nesting another blockquote, an image block, and
horizontal rules.
