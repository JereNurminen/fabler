import { describe, it, expect } from "vitest";
import { upsertFlagRule, removeFlagRule } from "../flagRules";

interface Rule { flag_id: string; value: string }

describe("upsertFlagRule", () => {
  it("appends a rule for a flag that has none", () => {
    const list: Rule[] = [{ flag_id: "a", value: "1" }];
    expect(upsertFlagRule(list, { flag_id: "b", value: "2" })).toEqual([
      { flag_id: "a", value: "1" },
      { flag_id: "b", value: "2" },
    ]);
  });

  it("replaces rather than duplicating an existing flag's rule", () => {
    // Duplicates would silently give one flag two conflicting rules.
    const list: Rule[] = [
      { flag_id: "a", value: "1" },
      { flag_id: "b", value: "2" },
    ];
    const result = upsertFlagRule(list, { flag_id: "a", value: "99" });
    expect(result).toHaveLength(2);
    expect(result.filter((r) => r.flag_id === "a")).toEqual([
      { flag_id: "a", value: "99" },
    ]);
  });

  it("does not mutate the input", () => {
    const list: Rule[] = [{ flag_id: "a", value: "1" }];
    upsertFlagRule(list, { flag_id: "a", value: "2" });
    expect(list).toEqual([{ flag_id: "a", value: "1" }]);
  });
});

describe("removeFlagRule", () => {
  it("removes only the matching flag", () => {
    const list: Rule[] = [
      { flag_id: "a", value: "1" },
      { flag_id: "b", value: "2" },
    ];
    expect(removeFlagRule(list, "a")).toEqual([{ flag_id: "b", value: "2" }]);
  });

  it("is a no-op for a flag that is not present", () => {
    const list: Rule[] = [{ flag_id: "a", value: "1" }];
    expect(removeFlagRule(list, "zzz")).toEqual(list);
  });

  it("does not mutate the input", () => {
    const list: Rule[] = [{ flag_id: "a", value: "1" }];
    removeFlagRule(list, "a");
    expect(list).toHaveLength(1);
  });
});
