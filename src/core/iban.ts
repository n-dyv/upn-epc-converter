import { passesMod97 } from "./mod97";

/** Remove all whitespace and uppercase. */
export function normalizeIban(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

/** Structural check (country code, check digits, 11–30 alphanumerics, max 34 total) plus mod-97. Expects a normalized IBAN. */
export function isValidIban(iban: string): boolean {
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  return passesMod97(iban);
}
