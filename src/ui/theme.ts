// Light/dark theme choice. The only thing the app stores (spec §2/§3): one localStorage entry.
// Without a stored choice the CSS follows the system setting via prefers-color-scheme.

export type Theme = "light" | "dark";

const KEY = "upn-epc-converter.theme";

export function readStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null; // storage blocked (private mode, disabled site data)
  }
}

export function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // not remembered, but the toggle still works for this visit
  }
}

export function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Set (or clear, to follow the system) the theme on <html data-theme>. */
export function applyTheme(theme: Theme | null): void {
  if (theme) document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}
