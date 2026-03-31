interface PlayerBarProps {
  onBack: () => void;
  onSave: () => void;
  onSettings: () => void;
}

export function PlayerBar({ onBack, onSave, onSettings }: PlayerBarProps) {
  return (
    <nav className="player-bar" aria-label="Player controls">
      <button
        onClick={onBack}
        aria-label="Back to library"
        className="player-bar-btn"
      >
        ←
      </button>
      <button
        onClick={onSave}
        aria-label="Save and load"
        className="player-bar-btn"
      >
        💾
      </button>
      <button
        onClick={onSettings}
        aria-label="Settings"
        className="player-bar-btn"
      >
        ⚙️
      </button>
    </nav>
  );
}
