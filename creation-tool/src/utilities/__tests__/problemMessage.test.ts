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

describe("problemMessage", () => {
  it("produces a non-empty message for every problem code", () => {
    // Guards against adding a ProblemDetail variant without a message.
    for (const detail of ALL_CODES) {
      const message = problemMessage(detail);
      expect(message, `missing message for ${detail.code}`).toBeTruthy();
      expect(message).not.toContain("undefined");
    }
  });

  it("names the offending choice and target", () => {
    const message = problemMessage(ALL_CODES[0]);
    expect(message).toContain("Go deeper");
    expect(message).toContain("gone9");
  });
});
