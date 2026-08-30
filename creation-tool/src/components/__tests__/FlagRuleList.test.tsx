import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { FlagRuleList } from "../FlagRuleList";

// This project's vitest config does not set `globals: true`, so
// @testing-library/react's automatic afterEach(cleanup) never registers
// (it only self-installs when it finds a global `afterEach`). Without this,
// every render in this file stays mounted and later tests' getByTestId
// queries collide with elements left over from earlier tests.
afterEach(cleanup);

const FLAGS = [
  { id: "f1", name: "has_key", default_value: false },
  { id: "f2", name: "is_night", default_value: false },
];

const VALUES = [
  { value: "on", label: "turn on" },
  { value: "off", label: "turn off" },
];

describe("FlagRuleList", () => {
  it("shows an empty state when there are no rules", () => {
    render(
      <FlagRuleList
        rules={[]}
        availableFlags={FLAGS}
        valueOptions={VALUES}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        addLabel="Add"
        valueLabel="Value"
      />,
    );
    expect(screen.getByTestId("flag-rules-empty")).toBeTruthy();
  });

  it("renders a rule using the flag's name and its value label", () => {
    render(
      <FlagRuleList
        rules={[{ flag_id: "f1", value: "on" }]}
        availableFlags={FLAGS}
        valueOptions={VALUES}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        addLabel="Add"
        valueLabel="Value"
      />,
    );
    const row = screen.getByTestId("flag-rule-f1");
    expect(row.textContent).toContain("has_key");
    expect(row.textContent).toContain("turn on");
  });

  it("excludes already-ruled flags from the add control", () => {
    // Offering a flag that already has a rule invites silently overwriting it.
    render(
      <FlagRuleList
        rules={[{ flag_id: "f1", value: "on" }]}
        availableFlags={FLAGS}
        valueOptions={VALUES}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        addLabel="Add"
        valueLabel="Value"
      />,
    );
    const select = screen.getByTestId("flag-rule-add-flag") as HTMLSelectElement;
    const offered = Array.from(select.options).map((o) => o.value);
    expect(offered).not.toContain("f1");
    expect(offered).toContain("f2");
  });

  it("emits onAdd with the chosen flag and value", () => {
    const onAdd = vi.fn();
    render(
      <FlagRuleList
        rules={[]}
        availableFlags={FLAGS}
        valueOptions={VALUES}
        onAdd={onAdd}
        onRemove={vi.fn()}
        addLabel="Add"
        valueLabel="Value"
      />,
    );
    fireEvent.change(screen.getByTestId("flag-rule-add-flag"), {
      target: { value: "f2" },
    });
    fireEvent.change(screen.getByTestId("flag-rule-add-value"), {
      target: { value: "off" },
    });
    fireEvent.click(screen.getByTestId("flag-rule-add"));
    expect(onAdd).toHaveBeenCalledWith("f2", "off");
  });

  it("emits onRemove for the right flag", () => {
    const onRemove = vi.fn();
    render(
      <FlagRuleList
        rules={[{ flag_id: "f1", value: "on" }]}
        availableFlags={FLAGS}
        valueOptions={VALUES}
        onAdd={vi.fn()}
        onRemove={onRemove}
        addLabel="Add"
        valueLabel="Value"
      />,
    );
    fireEvent.click(screen.getByTestId("flag-rule-remove-f1"));
    expect(onRemove).toHaveBeenCalledWith("f1");
  });
});
