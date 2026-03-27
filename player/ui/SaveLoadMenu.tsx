import { useState, useEffect, useCallback } from "react";
import type {
  StorageAdapter,
  GameState,
  SavedState,
  SlotInfo,
} from "../engine/types";

interface SaveLoadMenuProps {
  storyId: string;
  storage: StorageAdapter;
  gameState: GameState;
  onRestore: (state: GameState) => void;
  onClose: () => void;
}

export function SaveLoadMenu({
  storyId,
  storage,
  gameState,
  onRestore,
  onClose,
}: SaveLoadMenuProps) {
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [saveName, setSaveName] = useState("");

  const refreshSlots = useCallback(async () => {
    const list = await storage.listSlots(storyId);
    list.sort((a, b) => b.timestamp - a.timestamp);
    setSlots(list);
  }, [storage, storyId]);

  useEffect(() => {
    refreshSlots();
  }, [refreshSlots]);

  const handleSave = async () => {
    const name = saveName.trim() || `Save ${new Date().toLocaleString()}`;
    const slotId = `slot-${Date.now()}`;
    const saved: SavedState = {
      gameState,
      name,
      timestamp: Date.now(),
    };
    await storage.saveSlot(storyId, slotId, saved);
    setSaveName("");
    refreshSlots();
  };

  const handleLoad = async (slotId: string) => {
    const saved = await storage.loadSlot(storyId, slotId);
    if (saved) {
      onRestore(saved.gameState);
      onClose();
    }
  };

  const handleDelete = async (slotId: string) => {
    await storage.deleteSlot(storyId, slotId);
    refreshSlots();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-label="Save and Load"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative w-full max-w-md max-h-[80vh] rounded-t-2xl sm:rounded-2xl p-[1.5em]
                    flex flex-col"
        style={{
          backgroundColor: "var(--player-surface)",
          color: "var(--player-text)",
        }}
      >
        <div className="flex items-center justify-between mb-[1em]">
          <h2 className="text-[1.25em] font-bold">Save / Load</h2>
          <button
            onClick={onClose}
            aria-label="Close save menu"
            className="p-[0.5em] min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
          >
            ✕
          </button>
        </div>
        <div className="flex gap-[0.5em] mb-[1.5em]">
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Save name (optional)"
            className="flex-1 px-[0.75em] py-[0.5em] rounded-lg border min-h-[44px]"
            style={{
              backgroundColor: "var(--player-bg)",
              borderColor: "var(--player-border)",
              color: "var(--player-text)",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
          />
          <button
            onClick={handleSave}
            className="px-[1em] py-[0.5em] rounded-lg min-h-[44px] font-medium cursor-pointer"
            style={{
              backgroundColor: "var(--player-accent)",
              color: "var(--player-accent-text)",
            }}
          >
            Save
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {slots.length === 0 ? (
            <p
              className="text-center italic py-[2em]"
              style={{ color: "var(--player-text-muted)" }}
            >
              No saves yet
            </p>
          ) : (
            <ul className="list-none p-0 m-0 flex flex-col gap-[0.5em]">
              {slots.map((slot) => (
                <li
                  key={slot.slotId}
                  className="flex items-center justify-between p-[0.75em] rounded-lg border"
                  style={{
                    backgroundColor: "var(--player-choice-bg)",
                    borderColor: "var(--player-choice-border)",
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{slot.name}</div>
                    <div
                      className="text-[0.75em]"
                      style={{ color: "var(--player-text-muted)" }}
                    >
                      {new Date(slot.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-[0.25em] ml-[0.5em]">
                    <button
                      onClick={() => handleLoad(slot.slotId)}
                      aria-label={`Load ${slot.name}`}
                      className="px-[0.75em] py-[0.25em] rounded min-h-[44px] cursor-pointer"
                      style={{
                        backgroundColor: "var(--player-accent)",
                        color: "var(--player-accent-text)",
                      }}
                    >
                      Load
                    </button>
                    <button
                      onClick={() => handleDelete(slot.slotId)}
                      aria-label={`Delete ${slot.name}`}
                      className="px-[0.75em] py-[0.25em] rounded min-h-[44px] cursor-pointer"
                      style={{ color: "var(--player-text-muted)" }}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
