// Classify decoded symbols of one file (spec 7.5). Pure.

import { decodeQrBytesDetailed } from "../core/charset";
import { upnToPayment } from "../core/convert";
import { looksLikeUpn, parseUpn } from "../core/upn";
import type { FileReport, QrSymbol, Source } from "./types";

export interface PageSymbols {
  source: Source;
  symbols: QrSymbol[];
}

export function classify(fileName: string, pages: PageSymbols[]): FileReport {
  const report: FileReport = { fileName, found: [], broken: [], otherCount: 0, duplicateCount: 0, anySymbol: false };
  const seen = new Set<string>();
  for (const { source, symbols } of pages) {
    for (const sym of symbols) {
      report.anySymbol = true;
      const { text, charset } = decodeQrBytesDetailed(sym.bytes, sym.eci);
      if (!looksLikeUpn(text)) {
        report.otherCount++;
        continue;
      }
      if (seen.has(text)) {
        report.duplicateCount++;
        continue;
      }
      seen.add(text);
      const parsed = parseUpn(text);
      if (!parsed.ok) {
        report.broken.push({ source, message: parsed.message });
        continue;
      }
      report.found.push({
        source,
        text,
        charset,
        eci: sym.eci,
        fields: parsed.fields,
        lines: parsed.lines,
        parseWarnings: parsed.warnings,
        conversion: upnToPayment(parsed.fields),
      });
    }
  }
  return report;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** File-level notices for the UI, in a fixed order. */
export function reportNotices(r: FileReport): string[] {
  const out: string[] = [];
  if (r.error) return [r.error];
  if (!r.anySymbol) {
    out.push(
      `No QR code was found in ${r.fileName}. Try a sharper screenshot or a higher-resolution scan.`,
    );
    return out;
  }
  if (r.found.length === 0 && r.broken.length === 0) {
    out.push(`No UPN payment code was found in ${r.fileName}.`);
  }
  for (const b of r.broken) out.push(`${sourceLabel(b.source)}: ${b.message}`);
  if (r.otherCount > 0) {
    out.push(`${r.otherCount} other QR ${plural(r.otherCount, "code was", "codes were")} ignored.`);
  }
  if (r.duplicateCount > 0) {
    out.push(`${r.duplicateCount} ${plural(r.duplicateCount, "duplicate", "duplicates")} skipped.`);
  }
  return out;
}

export function sourceLabel(s: Source): string {
  return s.page ? `${s.fileName}, page ${s.page}` : s.fileName;
}
