import type { Theme, UserPreferences } from "../engine/types";

export function getEffectiveTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return theme;
}

export function applyPreferences(
  element: HTMLElement,
  preferences: UserPreferences,
): void {
  element.setAttribute("data-font-size", preferences.fontSize);
  element.setAttribute("data-theme", getEffectiveTheme(preferences.theme));
}
