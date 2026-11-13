// UPN fields → editable payment draft (spec section 6.1).

import { issue, type Issue } from "./issues";
import { formatCents, type Payment } from "./payment";
import { isValidRf, normalizeReference } from "./rf";
import type { UpnFields } from "./upn";

/** Information from the bill that has no EPC equivalent; shown read-only on the card. */
export interface ReadOnlyDetails {
  payerName: string;
  recipientAddress: string;
  dueDate: string;
  payerReference: string;
}

export interface Conversion {
  payment: Payment;
  /** Warnings fixed by the source code itself (not affected by editing). */
  warnings: Issue[];
  details: ReadOnlyDetails;
}

/** UPN field 9 (digits, cents, leading zeros) → editable euro text. Zero → "". Non-digits are kept so the error shows. */
function upnAmountToText(field: string): string {
  if (!/^\d+$/.test(field)) return field;
  const cents = Number(field.replace(/^0+/, "") || "0");
  return cents === 0 ? "" : formatCents(cents);
}

export function upnToPayment(f: UpnFields): Conversion {
  const reference = normalizeReference(f.recipientReference);
  const payment: Payment = {
    name: f.recipientName,
    iban: f.recipientIban,
    amount: upnAmountToText(f.amount),
    purposeCode: f.purposeCode,
    mode: isValidRf(reference) ? "structured" : "text",
    reference,
    text: f.purpose,
  };
  const warnings: Issue[] = [];
  if (f.deposit.toUpperCase() === "X" || f.withdrawal.toUpperCase() === "X") {
    warnings.push(issue("withdrawal-or-deposit"));
  }
  const details: ReadOnlyDetails = {
    payerName: f.payerName,
    recipientAddress: [f.recipientStreet, f.recipientCity].filter(Boolean).join(", "),
    dueDate: f.paymentDeadline,
    payerReference: f.payerReference,
  };
  return { payment, warnings, details };
}
