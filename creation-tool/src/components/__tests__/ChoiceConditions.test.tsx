import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ChoiceConditions } from "../ChoiceConditions";

// See FlagRuleList.test.tsx: this project's vitest config has no
// `globals: true`, so @testing-library/react's automatic afterEach(cleanup)
// never self-registers. Without this, renders from earlier tests in this
// file stay mounted and collide with later getByTestId queries.
afterEach(cleanup);

const FLAGS = [
  { id: "f1", name: "has_key", default_value: false },
  { id: "f2", name: "is_night", default_value: false },
];

describe("ChoiceConditions boolean adapter", () => {
  it("renders the false badge for a required_value: false condition, not absent or true", () => {
    render(
      <ChoiceConditions
        conditions={[{ flag_id: "f1", required_value: false }]}
        availableFlags={FLAGS}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    const row = screen.getByTestId("flag-rule-f1");
    expect(row.textContent).toContain("false");
    // A truthiness bug (`required_value ?? true`, or coercing "false" as
    // truthy) would render the positive/green pill here instead.
    expect(row.querySelector(".bg-danger")).toBeTruthy();
    expect(row.querySelector(".bg-success")).toBeNull();
  });

  it("renders the true badge for a required_value: true condition", () => {
    render(
      <ChoiceConditions
        conditions={[{ flag_id: "f1", required_value: true }]}
        availableFlags={FLAGS}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    const row = screen.getByTestId("flag-rule-f1");
    expect(row.textContent).toContain("true");
    expect(row.querySelector(".bg-success")).toBeTruthy();
    expect(row.querySelector(".bg-danger")).toBeNull();
  });

  it("emits onAdd with a real boolean true, not the string \"true\"", () => {
    const onAdd = vi.fn();
    render(
      <ChoiceConditions
        conditions={[]}
        availableFlags={FLAGS}
        onAdd={onAdd}
        onRemove={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId("flag-rule-add-flag"), {
      target: { value: "f2" },
    });
    fireEvent.change(screen.getByTestId("flag-rule-add-value"), {
      target: { value: "true" },
    });
    fireEvent.click(screen.getByTestId("flag-rule-add"));
    expect(onAdd).toHaveBeenCalledWith("f2", true);
    expect(onAdd).not.toHaveBeenCalledWith("f2", "true");
  });

  it("emits onAdd with a real boolean false, not the string \"false\"", () => {
    const onAdd = vi.fn();
    render(
      <ChoiceConditions
        conditions={[]}
        availableFlags={FLAGS}
        onAdd={onAdd}
        onRemove={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByTestId("flag-rule-add-flag"), {
      target: { value: "f2" },
    });
    fireEvent.change(screen.getByTestId("flag-rule-add-value"), {
      target: { value: "false" },
    });
    fireEvent.click(screen.getByTestId("flag-rule-add"));
    expect(onAdd).toHaveBeenCalledWith("f2", false);
    expect(onAdd).not.toHaveBeenCalledWith("f2", "false");
  });
});
