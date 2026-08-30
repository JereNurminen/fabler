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

// Expected substrings per code. Distinguishes each variant's own fields so a
// builder wired to the wrong same-shaped field (e.g. choice_text where flag_id
// belongs) fails, rather than merely producing "some non-empty string".
const EXPECTED_SUBSTRINGS: Record<ProblemDetail["code"], string[]> = {
  dangling_choice_target: ["Go deeper", "gone9"],
  dangling_page_flag_operation: ["gonef"],
  dangling_choice_flag_operation: ["Open", "gonef"],
  dangling_choice_condition: ["Open", "gonef"],
  start_page_unset: [],
  start_page_missing: ["nope9"],
  unreachable_page: [],
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

  it("names the specific values carried by each problem variant", () => {
    // For the two variants that carry both choice_text and flag_id, this
    // catches a swap between those two fields, not just a missing one.
    for (const detail of ALL_CODES) {
      const message = problemMessage(detail);
      for (const expected of EXPECTED_SUBSTRINGS[detail.code]) {
        expect(message, `expected "${expected}" in message for ${detail.code}`).toContain(expected);
      }
    }
  });
});
