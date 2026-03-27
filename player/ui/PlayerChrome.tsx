import type { ReactNode } from "react";

interface PlayerChromeProps {
  title: string;
  onSettingsOpen: () => void;
  onSaveOpen: () => void;
  children: ReactNode;
}

export function PlayerChrome({
  title,
  onSettingsOpen,
  onSaveOpen,
  children,
}: PlayerChromeProps) {
  return (
    <div className="flex flex-col h-full">
      <header
        className="flex items-center justify-between px-[1em] py-[0.5em] shrink-0"
        style={{
          backgroundColor: "var(--player-surface)",
          borderBottom: "1px solid var(--player-border)",
        }}
      >
        <h2
          className="text-[0.875em] font-medium truncate"
          style={{ color: "var(--player-text-muted)" }}
        >
          {title}
        </h2>
        <div className="flex gap-[0.5em]">
          <button
            onClick={onSaveOpen}
            aria-label="Save and load"
            className="p-[0.5em] rounded min-w-[44px] min-h-[44px]
                       flex items-center justify-center cursor-pointer"
            style={{ color: "var(--player-text-muted)" }}
          >
            💾
          </button>
          <button
            onClick={onSettingsOpen}
            aria-label="Settings"
            className="p-[0.5em] rounded min-w-[44px] min-h-[44px]
                       flex items-center justify-center cursor-pointer"
            style={{ color: "var(--player-text-muted)" }}
          >
            ⚙️
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-[1.5em]">
        {children}
      </main>
    </div>
  );
}
