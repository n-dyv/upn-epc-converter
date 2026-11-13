import { passesMod97 } from "./mod97";

/** Remove all whitespace and uppercase. */
export function normalizeReference(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

/** ISO 11649: `RF` + 2 check digits + 1–21 alphanumerics, mod-97 check passes. Expects a normalized reference. */
export function isValidRf(ref: string): boolean {
  if (!/^RF\d{2}[A-Z0-9]{1,21}$/.test(ref)) return false;
  return passesMod97(ref);
}
