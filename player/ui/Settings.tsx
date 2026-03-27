import type { FontSize, Theme, UserPreferences } from "../engine/types";

interface SettingsProps {
  preferences: UserPreferences;
  onUpdate: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) => void;
  onClose: () => void;
}

const FONT_SIZES: { value: FontSize; label: string }[] = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
  { value: "extra-large", label: "Extra Large" },
];

const THEMES: { value: Theme; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function Settings({ preferences, onUpdate, onClose }: SettingsProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-label="Settings"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative w-full max-w-md rounded-t-2xl sm:rounded-2xl p-[1.5em]"
        style={{
          backgroundColor: "var(--player-surface)",
          color: "var(--player-text)",
        }}
      >
        <div className="flex items-center justify-between mb-[1.5em]">
          <h2 className="text-[1.25em] font-bold">Settings</h2>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="p-[0.5em] min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
          >
            ✕
          </button>
        </div>
        <fieldset className="mb-[1.5em]">
          <legend className="text-[0.875em] font-medium mb-[0.5em]"
            style={{ color: "var(--player-text-muted)" }}
          >
            Font Size
          </legend>
          <div className="flex gap-[0.5em] flex-wrap">
            {FONT_SIZES.map((size) => (
              <button
                key={size.value}
                onClick={() => onUpdate("fontSize", size.value)}
                className="px-[1em] py-[0.5em] rounded-lg border min-h-[44px] cursor-pointer"
                style={{
                  backgroundColor:
                    preferences.fontSize === size.value
                      ? "var(--player-accent)"
                      : "var(--player-choice-bg)",
                  color:
                    preferences.fontSize === size.value
                      ? "var(--player-accent-text)"
                      : "var(--player-choice-text)",
                  borderColor:
                    preferences.fontSize === size.value
                      ? "var(--player-accent)"
                      : "var(--player-choice-border)",
                }}
                aria-pressed={preferences.fontSize === size.value}
              >
                {size.label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-[0.875em] font-medium mb-[0.5em]"
            style={{ color: "var(--player-text-muted)" }}
          >
            Theme
          </legend>
          <div className="flex gap-[0.5em]">
            {THEMES.map((theme) => (
              <button
                key={theme.value}
                onClick={() => onUpdate("theme", theme.value)}
                className="px-[1em] py-[0.5em] rounded-lg border min-h-[44px] cursor-pointer"
                style={{
                  backgroundColor:
                    preferences.theme === theme.value
                      ? "var(--player-accent)"
                      : "var(--player-choice-bg)",
                  color:
                    preferences.theme === theme.value
                      ? "var(--player-accent-text)"
                      : "var(--player-choice-text)",
                  borderColor:
                    preferences.theme === theme.value
                      ? "var(--player-accent)"
                      : "var(--player-choice-border)",
                }}
                aria-pressed={preferences.theme === theme.value}
              >
                {theme.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </div>
  );
}
