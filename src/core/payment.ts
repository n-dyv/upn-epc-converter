// The editable payment state behind one card (spec section 10), and amount helpers (spec 6.2).

export type RemittanceMode = "structured" | "text";

export interface Payment {
  /** Recipient name (EPC line 6). */
  name: string;
  /** Recipient IBAN (EPC line 7), may contain spaces while editing. */
  iban: string;
  /**
   * Amount in euros as the user sees and edits it, e.g. "81.05"; empty = no amount.
   * Parsed to integer cents by {@link parseAmount}. Kept as text so an invalid value from the
   * bill (or a half-typed one) is representable and blocks the code until fixed.
   */
  amount: string;
  /** ISO 20022 purpose code (EPC line 9). */
  purposeCode: string;
  /** "structured" puts a valid RF reference in line 10; "text" puts reference + text in line 11. */
  mode: RemittanceMode;
  /** Recipient reference (UPN field 16). */
  reference: string;
  /** Purpose / free text (UPN field 13). */
  text: string;
}

export const MAX_AMOUNT_CENTS = 99_999_999_999; // 999,999,999.99 EUR

export type AmountParse =
  | { kind: "none" } // empty or zero
  | { kind: "cents"; cents: number }
  | { kind: "invalid" }
  | { kind: "out-of-range" };

/** Parse a user-facing euro amount ("81.05", "81,05", "81", " 1 268.74 ") to integer cents. No floating point. */
export function parseAmount(input: string): AmountParse {
  const s = input.replace(/\s+/g, "");
  if (s === "") return { kind: "none" };
  const m = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(s);
  if (!m) return { kind: "invalid" };
  const euros = (m[1] ?? "").replace(/^0+(?=\d)/, "");
  if (euros.length > 9) return { kind: "out-of-range" };
  const cents = Number(euros) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  if (cents === 0) return { kind: "none" };
  if (cents > MAX_AMOUNT_CENTS) return { kind: "out-of-range" };
  return { kind: "cents", cents };
}

/** Integer cents → "81.05" (no leading zeros, no thousands separator). */
export function formatCents(cents: number): string {
  const s = String(cents).padStart(3, "0");
  return `${s.slice(0, -2)}.${s.slice(-2)}`;
}

/** "81.05" → "81.05 EUR", "1268.74" → "1,268.74 EUR" for display only. */
export function displayAmount(cents: number): string {
  const [eur, ct] = formatCents(cents).split(".");
  return `${(eur ?? "").replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${ct} EUR`;
}
