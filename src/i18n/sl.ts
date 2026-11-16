// Slovenian interface text (slovenščina).

import type { ErrorCode, WarningCode } from "../core/issues";
import { formatCents } from "../core/payment";
import type { Messages } from "./en";

/**
 * Slovenian plural forms, chosen by the last two digits:
 * 1 → ednina, 2 → dvojina, 3–4 → množina, 0 and 5+ → rodilnik množine.
 */
export function pluralSl(n: number, one: string, two: string, few: string, many: string): string {
  const r = n % 100;
  if (r === 1) return one;
  if (r === 2) return two;
  if (r === 3 || r === 4) return few;
  return many;
}

/** 126874 → "1.268,74 EUR" (Slovenian separators: thousands ".", decimals ","). */
function formatAmountSl(cents: number): string {
  const [eur, ct] = formatCents(cents).split(".");
  return `${(eur ?? "").replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${ct} EUR`;
}

const issues: Record<ErrorCode | WarningCode, string> = {
  "iban-missing": "Manjka IBAN prejemnika.",
  "iban-invalid": "IBAN prejemnika ni veljaven (kontrolni števki se ne ujemata).",
  "name-missing": "Manjka ime prejemnika.",
  "amount-invalid": "Znesek ni veljavno število. Vnesite števke in po želji decimalno vejico, npr. 81,05.",
  "amount-out-of-range": "Znesek ne sme presegati 999.999.999,99 EUR.",
  "payload-too-long":
    "Podatki o plačilu so predolgi za kodo EPC QR (več kot 331 bajtov). Skrajšajte prosto besedilo ali ime.",
  "checksum-mismatch": "Kontrolna vsota v kodi UPN se ne ujema z njeno vsebino. Natančno preverite podatke.",
  "checksum-missing": "Koda UPN nima kontrolne vsote. Natančno preverite podatke.",
  "si-reference-in-text":
    "Prejemnik tega plačila morda ne bo samodejno povezal z računom. Preverite referenco v bančni aplikaciji.",
  "purpose-dropped": "Banki se pošlje samo referenca; to besedilo namena se ne prenese.",
  "rf-invalid": "Kontrolni števki reference RF nista pravilni, zato se referenca pošlje kot prosto besedilo.",
  "purpose-code-invalid": "Koda namena ni sestavljena iz štirih črk A–Z, zato je bila izpuščena.",
  "amount-omitted": "Ta račun nima določenega zneska. Znesek vnesite v bančni aplikaciji.",
  "withdrawal-or-deposit": "Ta nalog je označen kot gotovinski polog ali dvig.",
  "text-truncated": "Vrednost je bila predolga za kodo EPC, zato je bila skrajšana.",
};

export const sl: Messages = {
  htmlLang: "sl",
  docTitle: "UPN v EPC QR",

  tagline: "Pretvori kodo UPN QR z računa v kodo SEPA (EPC) QR, ki jo Revolut, N26 ali Wise lahko skenira s tega zaslona.",
  privacy: "Vse se obdela v vašem brskalniku. Vaši računi se nikoli ne naložijo in ne shranijo.",
  toLight: "Preklopi na svetli način",
  toDark: "Preklopi na temni način",
  language: "Jezik",

  dropHere: "Spustite račune sem",
  addBill: "Dodajte račun",
  dropFormats: "PDF, PNG, JPEG ali WebP — lahko tudi več hkrati",
  chooseFiles: "Izberite datoteke",
  pasteHint: "ali prilepite posnetek zaslona",
  dropOverlay: "Spustite za branje plačilnih kod",
  pastedImage: (n?: number) => (n ? `Prilepljena slika ${n}` : "Prilepljena slika"),
  progress: (fileName, page, pageCount, waiting) =>
    `Berem ${fileName}${page ? ` — stran ${page} od ${pageCount}` : "…"}${waiting > 0 ? ` (v čakalni vrsti še ${waiting})` : ""}`,

  stepAdd: "Dodajte račun",
  stepAddPointer: "Spustite PDF ali sliko ali prilepite posnetek zaslona plačilnega naloga.",
  stepAddTouch: "Izberite PDF, fotografijo ali posnetek zaslona plačilnega naloga.",
  stepCheck: "Preverite podatke",
  stepCheckText: "Preglejte prejemnika, IBAN, znesek in referenco ter popravite, kar ni prav.",
  stepScan: "Skenirajte z zaslona",
  stepScanText: "V bančni aplikaciji odprite bralnik kod QR in ga usmerite v kodo.",

  payments: "Plačila",
  paymentsCount: (unpaid, total) => `za plačilo: ${unpaid} · najdeno: ${total}`,
  footerWarning: "Pred potrditvijo plačila v bančni aplikaciji vedno preverite prejemnika, znesek in referenco.",
  clearAll: "Počisti vse",

  amountNotSet: "Znesek ni določen",
  amountInvalid: "Neveljaven znesek",
  noName: "(brez imena prejemnika)",
  ready: "Pripravljeno",
  toFix: (n) => `Za popravek: ${n}`,
  paid: "Plačano",

  groupRecipient: "Prejemnik",
  recipientName: "Ime prejemnika",
  iban: "IBAN",
  groupPayment: "Plačilo",
  amount: "Znesek",
  amountPlaceholder: "ni določen",
  purposeCode: "Koda namena",
  groupReference: "Referenca",
  remittance: "Način sporočila prejemniku",
  rfOnly: "Kot strukturirano referenco je mogoče poslati samo veljavno referenco RF.",
  structured: "Strukturirana referenca (RF)",
  freeText: "Prosto besedilo",
  reference: "Referenca",
  freeTextPurpose: "Prosto besedilo (namen)",

  alsoOnBill: "Na računu je še",
  notSent: "(se ne pošlje banki)",
  payer: "Plačnik",
  recipientAddress: "Naslov prejemnika",
  dueDate: "Rok plačila",
  payerReference: "Referenca plačnika",

  scanCaption: "Skenirajte z bančno aplikacijo",
  qrLabel: (name) => `Koda EPC QR za ${name}`,
  summaryTo: "Prejemnik",
  enterInBank: "vnesite v bančni aplikaciji",
  none: "brez",
  downloadPng: "Prenesi PNG",
  copied: "Kopirano",
  copyEpc: "Kopiraj besedilo EPC",
  fixToGetCode: "Za kodo QR popravite naslednje:",

  technical: "Tehnične podrobnosti",
  decodedUpn: (charset, eci) => `Dekodirana koda UPN (${charset}${eci !== undefined ? `, ECI ${eci}` : ", brez ECI"})`,
  epcPayload: "Vsebina kode EPC",
  payloadUnavailable: "Ni na voljo, dokler so prisotne napake.",
  upnFields: [
    "Vodilni slog", "IBAN plačnika", "Polog", "Dvig", "Referenca plačnika", "Ime plačnika", "Ulica plačnika",
    "Kraj plačnika", "Znesek", "Datum plačila", "Nujno", "Koda namena", "Namen plačila", "Rok plačila",
    "IBAN prejemnika", "Referenca prejemnika", "Ime prejemnika", "Ulica prejemnika", "Kraj prejemnika", "Kontrolna vsota",
  ],

  formatAmount: formatAmountSl,
  issues,
  sourceLabel: (s) => (s.page ? `${s.fileName}, stran ${s.page}` : s.fileName),
  brokenUpn: (code, fieldCount) =>
    code === "not-upn"
      ? "Ta koda QR ni plačilna koda UPN QR."
      : `Ta koda UPN QR je nepopolna (${fieldCount} od 20 polj).`,
  noQrFound: (fileName) =>
    `V datoteki ${fileName} ni bilo mogoče najti nobene kode QR. Poskusite z ostrejšim posnetkom zaslona ali skenom v višji ločljivosti.`,
  noUpnFound: (fileName) => `V datoteki ${fileName} ni bilo mogoče najti plačilne kode UPN.`,
  otherIgnored: (n) =>
    `${n} ${pluralSl(n,
      "druga koda QR je bila prezrta",
      "drugi kodi QR sta bili prezrti",
      "druge kode QR so bile prezrte",
      "drugih kod QR je bilo prezrtih",
    )}.`,
  duplicatesSkipped: (n) =>
    `${n} ${pluralSl(n,
      "podvojena koda je bila preskočena",
      "podvojeni kodi sta bili preskočeni",
      "podvojene kode so bile preskočene",
      "podvojenih kod je bilo preskočenih",
    )}.`,
  fileError: (e) => {
    switch (e.code) {
      case "unsupported":
        return `Datoteka ${e.fileName} ni podprta. Uporabite datoteko PDF, PNG, JPEG ali WebP.`;
      case "image-unreadable":
        return `Datoteke ${e.fileName} ni bilo mogoče odpreti kot sliko.`;
      case "failed":
        return `Datoteke ${e.fileName} ni bilo mogoče obdelati (${e.detail}).`;
      case "pdf-password":
        return "Ta PDF je zaščiten z geslom. Odstranite geslo in poskusite znova.";
      case "pdf-invalid":
        return "Ta datoteka ni veljaven PDF ali je poškodovana.";
      case "pdf-unreadable":
        return `Datoteke PDF ni bilo mogoče prebrati (${e.detail}).`;
      case "pdf-too-many-pages":
        return `Ta PDF ima ${e.pages} ${pluralSl(e.pages, "stran", "strani", "strani", "strani")}. Omejitev je ${e.limit} strani.`;
    }
  },
};
