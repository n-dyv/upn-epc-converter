// UPN QR payload parser (spec sections 4 and 8). Lenient on input.

import { issue, type Issue } from "./issues";

export interface UpnFields {
  leadingStyle: string; //   1
  payerIban: string; //      2
  deposit: string; //        3
  withdrawal: string; //     4
  payerReference: string; // 5
  payerName: string; //      6
  payerStreet: string; //    7
  payerCity: string; //      8
  amount: string; //         9
  paymentDate: string; //   10
  urgent: string; //        11
  purposeCode: string; //   12
  purpose: string; //       13
  paymentDeadline: string; // 14
  recipientIban: string; // 15
  recipientReference: string; // 16
  recipientName: string; // 17
  recipientStreet: string; // 18
  recipientCity: string; // 19
  controlSum: string; //    20 (empty when absent)
}

/** Field names in UPN order (index 0 = field 1). */
export const UPN_FIELD_ORDER: readonly (keyof UpnFields)[] = [
  "leadingStyle", "payerIban", "deposit", "withdrawal", "payerReference",
  "payerName", "payerStreet", "payerCity", "amount", "paymentDate",
  "urgent", "purposeCode", "purpose", "paymentDeadline", "recipientIban",
  "recipientReference", "recipientName", "recipientStreet", "recipientCity", "controlSum",
];

export type UpnParseErrorCode = "not-upn" | "too-few-fields";

export type UpnParseResult =
  | { ok: true; fields: UpnFields; lines: string[]; warnings: Issue[] }
  | { ok: false; error: UpnParseErrorCode; fieldCount: number; message: string };

/** True when the decoded QR text is a UPN QR payload: `UPNQR` followed by a line break. */
export function looksLikeUpn(text: string): boolean {
  return /^UPNQR\r?\n/.test(text);
}

const charLength = (s: string) => Array.from(s).length;

/** Control sum: sum of (length + 1) over fields 1–19, counted in characters of the raw (untrimmed) field. */
export function computeControlSum(rawFields: readonly string[]): number {
  let sum = 0;
  for (let i = 0; i < 19; i++) sum += charLength(rawFields[i] ?? "") + 1;
  return sum;
}

export function parseUpn(text: string): UpnParseResult {
  const raw = text.split(/\r?\n/);
  if ((raw[0] ?? "").trim() !== "UPNQR") {
    return { ok: false, error: "not-upn", fieldCount: raw.length, message: "This QR code is not a UPN QR payment code." };
  }
  if (raw.length < 19) {
    return {
      ok: false,
      error: "too-few-fields",
      fieldCount: raw.length,
      message: `This UPN QR code is incomplete (${raw.length} of 20 fields).`,
    };
  }
  // Fields 1–20; anything after field 20 (the reserve, extra lines) is ignored.
  const rawFields = raw.slice(0, 20);
  const trimmed = UPN_FIELD_ORDER.map((_, i) => (rawFields[i] ?? "").trim());
  const fields = Object.fromEntries(UPN_FIELD_ORDER.map((k, i) => [k, trimmed[i]])) as unknown as UpnFields;

  const warnings: Issue[] = [];
  if (fields.controlSum === "") {
    warnings.push(issue("checksum-missing"));
  } else if (!/^\d+$/.test(fields.controlSum) || Number(fields.controlSum) !== computeControlSum(rawFields)) {
    warnings.push(issue("checksum-mismatch"));
  }
  return { ok: true, fields, lines: trimmed, warnings };
}
