import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "jotai";
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
  return <button onClick={() => requestTrash(pageId)}>trigger</button>;
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

  it("renders only one dialog even after requestTrash is called twice", async () => {
    vi.mocked(api.pageDeleteImpact).mockResolvedValue(impact);
    renderProvider();

    await userEvent.click(screen.getByText("trigger"));
    await screen.findByTestId("confirm-trash-dialog");

    await userEvent.click(screen.getByText("trigger"));

    expect(screen.getAllByTestId("confirm-trash-dialog")).toHaveLength(1);
  });
});
