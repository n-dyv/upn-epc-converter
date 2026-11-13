// Builds UPN QR payload text for tests. Computes the control sum itself (independent of src/core).

export interface UpnInput {
  payerIban?: string;
  deposit?: string;
  withdrawal?: string;
  payerReference?: string;
  payerName?: string;
  payerStreet?: string;
  payerCity?: string;
  amount?: string;
  paymentDate?: string;
  urgent?: string;
  purposeCode?: string;
  purpose?: string;
  paymentDeadline?: string;
  recipientIban?: string;
  recipientReference?: string;
  recipientName?: string;
  recipientStreet?: string;
  recipientCity?: string;
}

export interface BuildOptions {
  /** Use CRLF instead of LF. */
  crlf?: boolean;
  /** Reserve text after field 20 (default: none). */
  reserve?: string;
  /** Leave out field 20 entirely. */
  omitControlSum?: boolean;
  /** Write this instead of the computed control sum. */
  controlSumOverride?: string;
}

/** Spec section 11 reference example. */
export const REFERENCE_EXAMPLE: Required<UpnInput> = {
  payerIban: "",
  deposit: "",
  withdrawal: "",
  payerReference: "",
  payerName: "Janez Novak",
  payerStreet: "Dunajska 1",
  payerCity: "1000 Ljubljana",
  amount: "00000008105",
  paymentDate: "",
  urgent: "",
  purposeCode: "COST",
  purpose: "Payment of obligations 10/2016",
  paymentDeadline: "",
  recipientIban: "SI56051008010486080",
  recipientReference: "SI0598765432100",
  recipientName: "Novo podjetje d.o.o.",
  recipientStreet: "Lepa cesta 15",
  recipientCity: "3698 Loški Potok",
};

export function upnFieldList(input: UpnInput): string[] {
  const f = { ...REFERENCE_EXAMPLE, ...input };
  return [
    "UPNQR", f.payerIban, f.deposit, f.withdrawal, f.payerReference, f.payerName, f.payerStreet,
    f.payerCity, f.amount, f.paymentDate, f.urgent, f.purposeCode, f.purpose, f.paymentDeadline,
    f.recipientIban, f.recipientReference, f.recipientName, f.recipientStreet, f.recipientCity,
  ];
}

export function controlSumOf(fields19: string[]): string {
  const sum = fields19.reduce((acc, f) => acc + [...f].length + 1, 0);
  return String(sum).padStart(3, "0");
}

export function buildUpnText(input: UpnInput = {}, opts: BuildOptions = {}): string {
  const fields = upnFieldList(input);
  const nl = opts.crlf ? "\r\n" : "\n";
  let text = fields.map((f) => f + nl).join("");
  if (!opts.omitControlSum) text += (opts.controlSumOverride ?? controlSumOf(fields)) + nl;
  return text + (opts.reserve ?? "");
}
