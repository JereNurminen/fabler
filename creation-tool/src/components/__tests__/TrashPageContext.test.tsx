import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider, useAtomValue } from "jotai";
import { saveStatusAtom } from "../../atoms/saveStatus";
import type { DeleteImpact } from "@fabler/types";
import { TrashPageProvider, useTrashPage } from "../TrashPageContext";
import api from "../../api";

vi.mock("../../api", () => ({
  default: {
    pageDeleteImpact: vi.fn(),
    trashPage: vi.fn().mockResolvedValue(undefined),
  },
}));

const impact: DeleteImpact = {
  page_id: "b7c1d",
  page_name: "Dark Tunnel",
  is_start_page: false,
  incoming: [],
};

/** Probe that lets a test trigger `requestTrash` for a fixed page id. */
function Probe({ pageId }: { pageId: string }) {
  const { requestTrash } = useTrashPage();
  const status = useAtomValue(saveStatusAtom);
  return (
    <>
      <button onClick={() => requestTrash(pageId)}>trigger</button>
      <span data-testid="save-status">{status.state}</span>
    </>
  );
}

function renderProvider() {
  return render(
    <Provider>
      <TrashPageProvider>
        <Probe pageId="b7c1d" />
      </TrashPageProvider>
    </Provider>,
  );
}

describe("TrashPageProvider", () => {
  afterEach(() => vi.clearAllMocks());

  it("requestTrash fetches the impact for that page and renders the confirmation", async () => {
    vi.mocked(api.pageDeleteImpact).mockResolvedValue(impact);
    renderProvider();

    await userEvent.click(screen.getByText("trigger"));

    expect(api.pageDeleteImpact).toHaveBeenCalledWith("b7c1d");
    expect(await screen.findByTestId("confirm-trash-dialog")).toBeTruthy();
  });

  it("confirming trashes the page and then dismisses the dialog", async () => {
    vi.mocked(api.pageDeleteImpact).mockResolvedValue(impact);
    renderProvider();

    await userEvent.click(screen.getByText("trigger"));
    await screen.findByTestId("confirm-trash-dialog");

    await userEvent.click(screen.getByRole("button", { name: /move to trash/i }));

    expect(api.trashPage).toHaveBeenCalledWith("b7c1d");
    await waitFor(() => expect(screen.queryByTestId("confirm-trash-dialog")).toBeNull());
  });

  it("cancelling dismisses the dialog without trashing", async () => {
    vi.mocked(api.pageDeleteImpact).mockResolvedValue(impact);
    renderProvider();

    await userEvent.click(screen.getByText("trigger"));
    await screen.findByTestId("confirm-trash-dialog");

    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(api.trashPage).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByTestId("confirm-trash-dialog")).toBeNull());
  });

  /**
   * Opening the dialog fetches the impact and writes nothing, so it must not
   * report a write. It used to run through `useTrackedAction`, which flashed
   * "Saving..." then "Saved" in the status bar for a read — training the
   * author to distrust the one indicator that tells them their work is safe.
   */
  it("does not report a save for merely opening the dialog", async () => {
    vi.mocked(api.pageDeleteImpact).mockResolvedValue(impact);
    renderProvider();

    await userEvent.click(screen.getByText("trigger"));
    await screen.findByTestId("confirm-trash-dialog");

    expect(screen.getByTestId("save-status").textContent).toBe("idle");
  });

  it("still reports a failure when the impact cannot be fetched", async () => {
    vi.mocked(api.pageDeleteImpact).mockRejectedValue(new Error("boom"));
    renderProvider();

    await userEvent.click(screen.getByText("trigger"));

    // The dialog never opens, so silence here would leave the author staring
    // at a menu item that appeared to do nothing.
    await waitFor(() =>
      expect(screen.getByTestId("save-status").textContent).toBe("failed"),
    );
    expect(screen.queryByTestId("confirm-trash-dialog")).toBeNull();
  });

  it("reports a save for the confirmation itself, which does write", async () => {
    vi.mocked(api.pageDeleteImpact).mockResolvedValue(impact);
    renderProvider();

    await userEvent.click(screen.getByText("trigger"));
    await screen.findByTestId("confirm-trash-dialog");
    await userEvent.click(screen.getByRole("button", { name: /move to trash/i }));

    await waitFor(() =>
      expect(screen.getByTestId("save-status").textContent).toBe("saved"),
    );
  });

  it("renders only one dialog even after requestTrash is called twice", async () => {
    vi.mocked(api.pageDeleteImpact).mockResolvedValue(impact);
    renderProvider();

    await userEvent.click(screen.getByText("trigger"));
    await screen.findByTestId("confirm-trash-dialog");

    await userEvent.click(screen.getByText("trigger"));

    expect(screen.getAllByTestId("confirm-trash-dialog")).toHaveLength(1);
  });
});
