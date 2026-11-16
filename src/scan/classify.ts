// Classify decoded symbols of one file (spec 7.5). Pure.

import { decodeQrBytesDetailed } from "../core/charset";
import { upnToPayment } from "../core/convert";
import { looksLikeUpn, parseUpn } from "../core/upn";
import { en, type Messages } from "../i18n/en";
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
        report.broken.push({ source, error: parsed.error, fieldCount: parsed.fieldCount });
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

/** File-level notices for the UI, in a fixed order, in the language of `m` (English by default). */
export function reportNotices(r: FileReport, m: Messages = en): string[] {
  if (r.error) return [m.fileError(r.error)];
  if (!r.anySymbol) return [m.noQrFound(r.fileName)];
  const out: string[] = [];
  if (r.found.length === 0 && r.broken.length === 0) out.push(m.noUpnFound(r.fileName));
  for (const b of r.broken) out.push(`${m.sourceLabel(b.source)}: ${m.brokenUpn(b.error, b.fieldCount)}`);
  if (r.otherCount > 0) out.push(m.otherIgnored(r.otherCount));
  if (r.duplicateCount > 0) out.push(m.duplicatesSkipped(r.duplicateCount));
  return out;
}

export function sourceLabel(s: Source, m: Messages = en): string {
  return m.sourceLabel(s);
}
