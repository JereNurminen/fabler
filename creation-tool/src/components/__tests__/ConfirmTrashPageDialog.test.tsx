import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DeleteImpact } from "@fabler/types";
import { ConfirmTrashPageDialog } from "../ConfirmTrashPageDialog";
import { translations } from "../../i18n";

const base: DeleteImpact = {
  page_id: "b7c1d",
  page_name: "Dark Tunnel",
  is_start_page: false,
  incoming: [],
};

describe("ConfirmTrashPageDialog", () => {
  it("names the page and says the delete is reversible", () => {
    render(<ConfirmTrashPageDialog impact={base} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(/Dark Tunnel/)).toBeTruthy();
    expect(screen.getByText(/restore it later/i)).toBeTruthy();
  });

  it("warns when the page is the start page", () => {
    render(
      <ConfirmTrashPageDialog
        impact={{ ...base, is_start_page: true }}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByTestId("trash-start-page-warning")).toBeTruthy();
  });

  it("says nothing about the start page when it is not the start page", () => {
    render(<ConfirmTrashPageDialog impact={base} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByTestId("trash-start-page-warning")).toBeNull();
  });

  it("lists every choice the delete would strand, with its page", () => {
    render(
      <ConfirmTrashPageDialog
        impact={{
          ...base,
          incoming: [
            { page_id: "a1b2c", page_name: "Entrance", choice_id: "c1", choice_text: "Go north" },
            { page_id: "d4e5f", page_name: "Great Hall", choice_id: "c2", choice_text: "Descend" },
          ],
        }}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const items = screen.getAllByTestId("trash-stranded-choice");
    expect(items).toHaveLength(2);
    // Exact-match the whole rendered sentence (built from the same
    // translation function the component uses) rather than two independent
    // `.toContain()` checks -- those pass regardless of argument order, so
    // they would not catch a `strandedItem(pageName, choiceText)` call
    // accidentally getting its two arguments swapped.
    expect(items[0].textContent).toBe(translations.trash.strandedItem("Entrance", "Go north"));
    expect(items[1].textContent).toBe(translations.trash.strandedItem("Great Hall", "Descend"));
  });

  it("confirms and cancels", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmTrashPageDialog impact={base} onConfirm={onConfirm} onCancel={onCancel} />);

    await userEvent.click(screen.getByRole("button", { name: /move to trash/i }));
    expect(onConfirm).toHaveBeenCalledOnce();

    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
