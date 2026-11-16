// English interface text. This catalog defines the shape every other language must match (see Messages).

import { MESSAGES } from "../core/issues";
import { displayAmount } from "../core/payment";
import type { UpnParseErrorCode } from "../core/upn";
import type { FileError, Source } from "../scan/types";

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const en = {
  htmlLang: "en",
  docTitle: "UPN to EPC QR",

  // header
  tagline: "Turns the Slovenian UPN QR code on a bill into a SEPA (EPC) QR code that Revolut, N26 or Wise can scan from this screen.",
  privacy: "Everything is processed in your browser. Your bills are never uploaded or stored.",
  toLight: "Switch to light mode",
  toDark: "Switch to dark mode",
  language: "Language",

  // drop zone
  dropHere: "Drop bills here",
  addBill: "Add a bill",
  dropFormats: "PDF, PNG, JPEG or WebP — several at once is fine",
  chooseFiles: "Choose files",
  pasteHint: "or paste a screenshot",
  dropOverlay: "Drop to read the payment codes",
  pastedImage: (n?: number) => (n ? `Pasted image ${n}` : "Pasted image"),
  progress: (fileName: string, page: number | undefined, pageCount: number | undefined, waiting: number) =>
    `Reading ${fileName}${page ? ` — page ${page} of ${pageCount}` : "…"}${waiting > 0 ? ` (${waiting} more waiting)` : ""}`,

  // first-visit steps
  stepAdd: "Add a bill",
  stepAddPointer: "Drop a PDF or image, or paste a screenshot of the payment slip.",
  stepAddTouch: "Choose a PDF, a photo or a screenshot of the payment slip.",
  stepCheck: "Check the details",
  stepCheckText: "Review recipient, IBAN, amount and reference; fix anything that is off.",
  stepScan: "Scan from the screen",
  stepScanText: "Open your banking app's QR scanner and point it at the code.",

  // list and footer
  payments: "Payments",
  paymentsCount: (unpaid: number, total: number) => `${unpaid} to pay · ${total} found`,
  footerWarning: "Always check the recipient, amount and reference in your banking app before confirming the payment.",
  clearAll: "Clear all",

  // card header
  amountNotSet: "Amount not set",
  amountInvalid: "Invalid amount",
  noName: "(no recipient name)",
  ready: "Ready",
  toFix: (n: number) => `${n} to fix`,
  paid: "Paid",

  // card form
  groupRecipient: "Recipient",
  recipientName: "Recipient name",
  iban: "IBAN",
  groupPayment: "Payment",
  amount: "Amount",
  amountPlaceholder: "not set",
  purposeCode: "Purpose code",
  groupReference: "Reference",
  remittance: "Remittance",
  rfOnly: "Only a valid RF reference can be sent as a structured reference.",
  structured: "Structured reference (RF)",
  freeText: "Free text",
  reference: "Reference",
  freeTextPurpose: "Free text (purpose)",

  // also on the bill
  alsoOnBill: "Also on the bill",
  notSent: "(not sent to the bank)",
  payer: "Payer",
  recipientAddress: "Recipient address",
  dueDate: "Due date",
  payerReference: "Payer reference",

  // code panel
  scanCaption: "Scan with your banking app",
  qrLabel: (name: string) => `EPC QR code for ${name}`,
  summaryTo: "To",
  enterInBank: "enter in your bank app",
  none: "none",
  downloadPng: "Download PNG",
  copied: "Copied",
  copyEpc: "Copy EPC text",
  fixToGetCode: "Fix these to get the QR code:",

  // technical details
  technical: "Technical details",
  decodedUpn: (charset: string, eci: number | undefined) =>
    `Decoded UPN (${charset}${eci !== undefined ? `, ECI ${eci}` : ", no ECI"})`,
  epcPayload: "EPC payload",
  payloadUnavailable: "Not available while errors are present.",
  upnFields: [
    "Leading style", "Payer IBAN", "Deposit", "Withdrawal", "Payer reference", "Payer name", "Payer street",
    "Payer city", "Amount", "Payment date", "Urgent", "Purpose code", "Purpose", "Payment deadline",
    "Recipient IBAN", "Recipient reference", "Recipient name", "Recipient street", "Recipient city", "Control sum",
  ],

  // values and messages produced by the core and scan layers
  formatAmount: displayAmount,
  issues: MESSAGES,
  sourceLabel: (s: Source) => (s.page ? `${s.fileName}, page ${s.page}` : s.fileName),
  brokenUpn: (code: UpnParseErrorCode, fieldCount: number) =>
    code === "not-upn"
      ? "This QR code is not a UPN QR payment code."
      : `This UPN QR code is incomplete (${fieldCount} of 20 fields).`,
  noQrFound: (fileName: string) =>
    `No QR code was found in ${fileName}. Try a sharper screenshot or a higher-resolution scan.`,
  noUpnFound: (fileName: string) => `No UPN payment code was found in ${fileName}.`,
  otherIgnored: (n: number) => `${n} other QR ${plural(n, "code was", "codes were")} ignored.`,
  duplicatesSkipped: (n: number) => `${n} ${plural(n, "duplicate", "duplicates")} skipped.`,
  fileError: (e: FileError): string => {
    switch (e.code) {
      case "unsupported":
        return `${e.fileName} is not a supported file. Use a PDF, PNG, JPEG or WebP file.`;
      case "image-unreadable":
        return `${e.fileName} could not be opened as an image.`;
      case "failed":
        return `${e.fileName} could not be processed (${e.detail}).`;
      case "pdf-password":
        return "This PDF is password-protected. Remove the password and try again.";
      case "pdf-invalid":
        return "This file is not a valid PDF or is damaged.";
      case "pdf-unreadable":
        return `The PDF could not be read (${e.detail}).`;
      case "pdf-too-many-pages":
        return `This PDF has ${e.pages} pages. The limit is ${e.limit} pages.`;
    }
  },
};

export type Messages = typeof en;
