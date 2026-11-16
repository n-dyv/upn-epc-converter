// Interface language: English or Slovenian. A stored choice wins; otherwise the browser language decides.
// Besides the theme, the language choice is the only thing the app stores (one localStorage entry).

import { en, type Messages } from "./en";
import { sl } from "./sl";

export type Lang = "en" | "sl";
export type { Messages };

export const LANGS: readonly Lang[] = ["en", "sl"];
export const CATALOGS: Record<Lang, Messages> = { en, sl };
export { en, sl };

const KEY = "upn-epc-converter.lang";

export function readStoredLang(): Lang | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "en" || v === "sl" ? v : null;
  } catch {
    return null; // storage blocked (private mode, disabled site data)
  }
}

export function storeLang(lang: Lang): void {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // not remembered, but the switch still works for this visit
  }
}

/** Slovenian if the browser lists Slovenian among its preferred languages, else English. */
export function browserLang(): Lang {
  const prefs = typeof navigator === "undefined" ? [] : (navigator.languages ?? [navigator.language]);
  return prefs.some((l) => /^sl\b/i.test(l ?? "")) ? "sl" : "en";
}

export function initialLang(): Lang {
  return readStoredLang() ?? browserLang();
}

/** Set <html lang> and the page title. */
export function applyLang(lang: Lang): void {
  const m = CATALOGS[lang];
  document.documentElement.lang = m.htmlLang;
  document.title = m.docTitle;
}
