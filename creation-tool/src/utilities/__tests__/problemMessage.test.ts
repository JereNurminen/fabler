import { describe, it, expect } from "vitest";
import { problemMessage } from "../problemMessage";
import type { ProblemDetail } from "../../types";

const ALL_CODES: ProblemDetail[] = [
  { code: "dangling_choice_target", choice_id: "c1", choice_text: "Go deeper", target: "gone9" },
  { code: "dangling_page_flag_operation", flag_id: "gonef" },
  { code: "dangling_choice_flag_operation", choice_id: "c1", choice_text: "Open", flag_id: "gonef" },
  { code: "dangling_choice_condition", choice_id: "c1", choice_text: "Open", flag_id: "gonef" },
  { code: "start_page_unset" },
  { code: "start_page_missing", start_page: "nope9" },
  { code: "unreachable_page" },
];

// Full expected sentences, written out literally (NOT built by calling
// translations.problems.messages.* — that would just compare the
// implementation against itself). Exact equality is position-sensitive, so
// it catches swapped fields (e.g. choice_text and flag_id landing in each
// other's slot), reworded templates, and missing interpolations, unlike a
// substring check, which cannot tell which slot a value landed in.
const EXPECTED_MESSAGES: Record<ProblemDetail["code"], string> = {
  dangling_choice_target: 'Choice "Go deeper" leads to a page that no longer exists (gone9).',
  dangling_page_flag_operation: "This page sets a flag that no longer exists (gonef).",
  dangling_choice_flag_operation: 'Choice "Open" sets a flag that no longer exists (gonef).',
  dangling_choice_condition: 'Choice "Open" is shown based on a flag that no longer exists (gonef).',
  start_page_unset: "This story has no start page set.",
  start_page_missing: "The start page does not exist (nope9).",
  unreachable_page: "No choice leads to this page, so a reader can never see it.",
};

describe("problemMessage", () => {
  it("produces a non-empty message for every problem code", () => {
    // Guards against adding a ProblemDetail variant without a message.
    for (const detail of ALL_CODES) {
      const message = problemMessage(detail);
      expect(message, `missing message for ${detail.code}`).toBeTruthy();
      expect(message).not.toContain("undefined");
    }
  });

  it("produces the exact expected sentence for every problem code", () => {
    for (const detail of ALL_CODES) {
      expect(problemMessage(detail), `mismatch for ${detail.code}`).toBe(
        EXPECTED_MESSAGES[detail.code],
      );
    }
  });
});
