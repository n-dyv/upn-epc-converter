// Error and warning codes (spec section 8) and their user-facing messages.

export type ErrorCode =
  | "iban-missing"
  | "iban-invalid"
  | "name-missing"
  | "amount-invalid"
  | "amount-out-of-range"
  | "payload-too-long";

export type WarningCode =
  | "checksum-mismatch"
  | "checksum-missing"
  | "si-reference-in-text"
  | "purpose-dropped"
  | "rf-invalid"
  | "purpose-code-invalid"
  | "amount-omitted"
  | "withdrawal-or-deposit"
  | "text-truncated";

/** Form field an issue belongs to, so the UI can show it beside that field. */
export type PaymentField = "name" | "iban" | "amount" | "purposeCode" | "mode" | "reference" | "text";

export interface Issue<C extends string = ErrorCode | WarningCode> {
  code: C;
  field?: PaymentField;
  message: string;
}

export const MESSAGES: Record<ErrorCode | WarningCode, string> = {
  "iban-missing": "The recipient IBAN is missing.",
  "iban-invalid": "The recipient IBAN is not valid (check digits do not match).",
  "name-missing": "The recipient name is missing.",
  "amount-invalid": "The amount is not a valid number. Use digits with an optional decimal point, e.g. 81.05.",
  "amount-out-of-range": "The amount must not exceed 999,999,999.99 EUR.",
  "payload-too-long": "The payment data is too long for an EPC QR code (over 331 bytes). Shorten the free text or name.",
  "checksum-mismatch": "The control sum in the UPN code does not match its contents. Check the details carefully.",
  "checksum-missing": "The UPN code has no control sum. Check the details carefully.",
  "si-reference-in-text":
    "The recipient may not match this payment automatically. Check the reference in your banking app.",
  "purpose-dropped": "Only the reference is sent to the bank; this purpose text is not transferred.",
  "rf-invalid": "The RF reference fails its check digits, so it is sent as free text.",
  "purpose-code-invalid": "The purpose code is not four letters A–Z and was left out.",
  "amount-omitted": "This bill has no fixed amount. Enter the amount in your banking app.",
  "withdrawal-or-deposit": "This slip is marked as a cash deposit or withdrawal.",
  "text-truncated": "A value was too long for the EPC code and was shortened.",
};

export function issue<C extends ErrorCode | WarningCode>(code: C, field?: PaymentField): Issue<C> {
  return field ? { code, field, message: MESSAGES[code] } : { code, message: MESSAGES[code] };
}
