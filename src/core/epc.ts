// Payment → EPC QR payload (spec sections 5, 6.2–6.4). Strict on output.

import { normalizeIban, isValidIban } from "./iban";
import { issue, type ErrorCode, type Issue, type WarningCode } from "./issues";
import { formatCents, parseAmount, type Payment } from "./payment";
import { isValidRf, normalizeReference } from "./rf";

export const EPC_MAX_BYTES = 331;
const MAX_NAME = 70;
const MAX_TEXT = 140;

export type EpcResult =
  | { ok: true; payload: string; lines: string[]; warnings: Issue<WarningCode>[] }
  | { ok: false; errors: Issue<ErrorCode>[]; warnings: Issue<WarningCode>[] };

/** Cut to `max` characters (code points). Returns [value, wasCut]. */
function cut(s: string, max: number): [string, boolean] {
  const chars = Array.from(s);
  return chars.length > max ? [chars.slice(0, max).join(""), true] : [s, false];
}

/**
 * Lines 10 and 11 from reference, free text and mode (spec 6.3). Whenever a reference is sent —
 * structured or as free text — it is sent on its own and the purpose text is dropped.
 */
function remittance(p: Payment, warnings: Issue<WarningCode>[]): { structured: string; text: string } {
  const ref = normalizeReference(p.reference);
  const purpose = p.text.trim();
  if (ref === "" || ref === "SI99") return { structured: "", text: purpose };
  if (purpose !== "") warnings.push(issue("purpose-dropped", "text"));
  if (p.mode === "structured" && isValidRf(ref)) return { structured: ref, text: "" };
  if (ref.startsWith("RF") && !isValidRf(ref)) warnings.push(issue("rf-invalid", "reference"));
  if (ref.startsWith("SI")) warnings.push(issue("si-reference-in-text", "reference"));
  return { structured: "", text: ref };
}

/** A line break inside a value would shift every following EPC line; turn it into a space. */
const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ");

export function buildEpc(input: Payment): EpcResult {
  const p: Payment = {
    ...input,
    name: oneLine(input.name),
    iban: oneLine(input.iban),
    amount: oneLine(input.amount),
    purposeCode: oneLine(input.purposeCode),
    reference: oneLine(input.reference),
    text: oneLine(input.text),
  };
  const errors: Issue<ErrorCode>[] = [];
  const warnings: Issue<WarningCode>[] = [];
  let truncated = false;

  // Line 6: name
  let name = p.name.trim();
  if (name === "") errors.push(issue("name-missing", "name"));
  [name, truncated] = cut(name, MAX_NAME);

  // Line 7: IBAN
  const iban = normalizeIban(p.iban);
  if (iban === "") errors.push(issue("iban-missing", "iban"));
  else if (!isValidIban(iban)) errors.push(issue("iban-invalid", "iban"));

  // Line 8: amount
  let amountLine = "";
  const amount = parseAmount(p.amount);
  if (amount.kind === "invalid") errors.push(issue("amount-invalid", "amount"));
  else if (amount.kind === "out-of-range") errors.push(issue("amount-out-of-range", "amount"));
  else if (amount.kind === "none") warnings.push(issue("amount-omitted", "amount"));
  else amountLine = `EUR${formatCents(amount.cents)}`;

  // Line 9: purpose code
  let purposeCode = p.purposeCode.trim();
  if (purposeCode !== "" && !/^[A-Z]{4}$/.test(purposeCode)) {
    warnings.push(issue("purpose-code-invalid", "purposeCode"));
    purposeCode = "";
  }

  // Lines 10 / 11: remittance
  const rem = remittance(p, warnings);
  const [text, textCut] = cut(rem.text, MAX_TEXT);
  if (truncated) warnings.push(issue("text-truncated", "name"));
  if (textCut) warnings.push(issue("text-truncated", "text"));

  if (errors.length > 0) return { ok: false, errors, warnings };

  const lines = ["BCD", "002", "1", "SCT", "", name, iban, amountLine, purposeCode, rem.structured, text, ""];
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  const payload = lines.join("\n");

  if (new TextEncoder().encode(payload).length > EPC_MAX_BYTES) {
    return { ok: false, errors: [issue("payload-too-long")], warnings };
  }
  return { ok: true, payload, lines, warnings };
}
