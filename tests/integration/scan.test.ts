import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { buildEpc } from "../../src/core/epc";
import { reportNotices } from "../../src/scan/classify";
import { scanFile } from "../../src/scan/pipeline";
import { readSymbols } from "../../src/scan/zxing";
import type { FileReport, Progress } from "../../src/scan/types";
import { epcQrMatrix, matrixToRgba } from "../../src/ui/qr";
import { BILLS, billText, buildMixedPng, buildMultiPdf, buildScreenshot, matrixPng, textMatrix, upnMatrix } from "../fixtures/generate";
import { fileOf, nodeEnv } from "./node-env";

const codes = (ws: { code: string }[]) => ws.map((w) => w.code);

describe("test 8: multi-code PDF", () => {
  let report: FileReport;
  const progress: Progress[] = [];
  beforeAll(async () => {
    const pdf = await buildMultiPdf();
    report = await scanFile(fileOf("invoice.pdf", pdf, "application/pdf"), nodeEnv, (p) => progress.push(p));
  }, 60_000);

  it("finds all three codes in document order", () => {
    expect(report.error).toBeUndefined();
    expect(report.found).toHaveLength(3);
    expect(report.found.map((f) => f.text)).toEqual([billText(0), billText(1), billText(2)]);
    expect(report.found.map((f) => f.source)).toEqual([
      { fileName: "invoice.pdf", page: 1 },
      { fileName: "invoice.pdf", page: 1 },
      { fileName: "invoice.pdf", page: 2 },
    ]);
    expect(report.otherCount).toBe(0);
    expect(report.duplicateCount).toBe(0);
    expect(reportNotices(report)).toEqual([]);
  });

  it("reports page progress", () => {
    expect(progress).toEqual([
      { fileName: "invoice.pdf", page: 1, pageCount: 2 },
      { fileName: "invoice.pdf", page: 2, pageCount: 2 },
    ]);
  });

  it("decodes ISO 8859-2 bytes, with and without ECI, into correct Slovenian text", () => {
    const [a, b, c] = report.found;
    expect(a!.eci).toBe(4);
    expect(a!.charset).toBe("iso-8859-2");
    expect(a!.fields.recipientCity).toBe("3698 Loški Potok");
    expect(b!.eci).toBeUndefined(); // generated without ECI → heuristic path
    expect(b!.charset).toBe("iso-8859-2");
    expect(b!.fields.recipientName).toBe("Komunala Škofja Loka d.o.o.");
    expect(b!.fields.payerName).toBe("Žiga Čeh");
    expect(c!.fields.recipientName).toBe("Društvo prijateljev Žabnice");
    expect(c!.fields.purpose).toBe("Članarina 2026");
    for (const f of report.found) expect(f.parseWarnings).toEqual([]); // control sums match
  });

  it("converts each code as specified", () => {
    const [a, b, c] = report.found.map((f) => buildEpc(f.conversion.payment));
    expect(a!.ok && a!.lines[10]).toBe("SI0598765432100");
    expect(b!.ok && b!.lines[7]).toBe("EUR42.37");
    expect(b!.ok && b!.lines[9]).toMatch(/^RF\d\d2026100471$/);
    expect(codes(b!.warnings)).toEqual(["purpose-dropped"]);
    expect(c!.ok && c!.lines[7]).toBe("");
    expect(c!.ok && c!.lines[10]).toBe("Članarina 2026");
    expect(codes(c!.warnings)).toEqual(["amount-omitted"]);
  });

  it("generated UPN symbols really are version 15", async () => {
    for (const [i, bill] of BILLS.entries()) expect((await upnMatrix(billText(i), bill.eci)).size).toBe(77);
  });
});

describe("test 9: EPC round trip", () => {
  it("every generated EPC image decodes back to its payload byte for byte", async () => {
    const pdf = await scanFile(fileOf("invoice.pdf", await buildMultiPdf()), nodeEnv);
    const payments = pdf.found.map((f) => f.conversion.payment);
    // extra variants: edited name with Slovenian characters, maximum-length free text, RF switched to text mode
    payments.push({ ...payments[0]!, name: "Čebelarstvo Šušteršič Žiri", text: "x".repeat(140), reference: "" });
    payments.push({ ...payments[1]!, mode: "text" });
    expect(payments).toHaveLength(5);
    for (const p of payments) {
      const epc = buildEpc(p);
      if (!epc.ok) throw new Error(epc.errors.map((e) => e.code).join());
      const matrix = epcQrMatrix(epc.payload);
      expect(matrix.version).toBeLessThanOrEqual(13);
      const symbols = await readSymbols(matrixToRgba(matrix, 4));
      expect(symbols).toHaveLength(1);
      expect(Buffer.from(symbols[0]!.bytes)).toEqual(Buffer.from(new TextEncoder().encode(epc.payload)));
    }
  }, 60_000);
});

describe("test 10: UPN code plus unrelated QR code", () => {
  it("yields one card and '1 other QR code was ignored'", async () => {
    const report = await scanFile(fileOf("mixed.png", await buildMixedPng(), "image/png"), nodeEnv);
    expect(report.found).toHaveLength(1);
    expect(report.found[0]!.text).toBe(billText(0));
    expect(report.otherCount).toBe(1);
    expect(reportNotices(report)).toEqual(["1 other QR code was ignored."]);
  });
});

describe("other pipeline behaviour", () => {
  it.each(["png", "jpeg"] as const)("finds the code in a screenshot-like %s", async (fmt) => {
    const report = await scanFile(fileOf(`shot.${fmt}`, await buildScreenshot(fmt)), nodeEnv);
    expect(report.found.map((f) => f.text)).toEqual([billText(1)]);
  });

  it("duplicates in one file are skipped", async () => {
    const { createCanvas, loadImage } = await import("@napi-rs/canvas");
    const qr = await loadImage(await matrixPng(await upnMatrix(billText(0), true), 5));
    const canvas = createCanvas(qr.width * 2 + 60, qr.height + 40);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(qr, 20, 20);
    ctx.drawImage(qr, qr.width + 40, 20);
    const report = await scanFile(fileOf("dup.png", await canvas.encode("png")), nodeEnv);
    expect(report.found).toHaveLength(1);
    expect(report.duplicateCount).toBe(1);
    expect(reportNotices(report)).toEqual(["1 duplicate skipped."]);
  });

  it("an image without any QR code suggests a sharper image", async () => {
    const { createCanvas } = await import("@napi-rs/canvas");
    const blank = createCanvas(400, 300);
    const ctx = blank.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, 400, 300);
    const report = await scanFile(fileOf("blank.png", await blank.encode("png")), nodeEnv);
    expect(report.anySymbol).toBe(false);
    expect(reportNotices(report)[0]).toMatch(/sharper screenshot or a higher-resolution scan/);
  });

  it("an image with only non-UPN codes says so", async () => {
    const png = await matrixPng(textMatrix("BCD\n002\n1\nSCT\n\nX\nDE89370400440532013000"), 6);
    const report = await scanFile(fileOf("epc.png", png), nodeEnv);
    expect(reportNotices(report)).toEqual([
      "No UPN payment code was found in epc.png.",
      "1 other QR code was ignored.",
    ]);
  });

  it("corrupt PDFs and unsupported files produce messages, not crashes", async () => {
    const corrupt = await scanFile(fileOf("bad.pdf", new TextEncoder().encode("%PDF-1.7\ngarbage")), nodeEnv);
    expect(corrupt.error).toMatch(/not a valid PDF|could not be read/);
    const txt = await scanFile(fileOf("notes.txt", new TextEncoder().encode("hello"), "text/plain"), nodeEnv);
    expect(txt.error).toMatch(/not a supported file/);
    const badImg = await scanFile(fileOf("broken.png", Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 1, 2, 3)), nodeEnv);
    expect(badImg.error).toMatch(/could not be opened as an image/);
  });

  it("password-protected PDFs produce a clear message", async () => {
    // AES-256, user password "secret"; created once with PyMuPDF (pdf-lib cannot encrypt).
    const pdf = readFileSync(new URL("../fixtures/static/password-protected.pdf", import.meta.url));
    const report = await scanFile(fileOf("locked.pdf", pdf), nodeEnv);
    expect(report.error).toBe("This PDF is password-protected. Remove the password and try again.");
  });

  it("refuses PDFs over 50 pages", async () => {
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    for (let i = 0; i < 51; i++) doc.addPage([200, 200]);
    const report = await scanFile(fileOf("long.pdf", await doc.save()), nodeEnv);
    expect(report.error).toBe("This PDF has 51 pages. The limit is 50 pages.");
  });
});
