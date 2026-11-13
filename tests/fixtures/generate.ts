// Fixture generator (spec section 11, tests 8–10): real version-15 UPN QR symbols with ISO 8859-2
// bytes, a two-page PDF with three slips, and composite images. Runs in Node.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { prepareZXingModule, writeBarcode } from "zxing-wasm/full";
import { encodeLatin2 } from "../../src/core/charset";
import { buildUpnText, type UpnInput } from "./upn-builder";
import { makeIban, makeRf } from "./check-digits";

const require = createRequire(import.meta.url);
let writerReady = false;
function ensureWriter() {
  if (writerReady) return;
  const buf = readFileSync(require.resolve("zxing-wasm/full/zxing_full.wasm"));
  prepareZXingModule({ overrides: { wasmBinary: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) } });
  writerReady = true;
}

export interface Matrix {
  size: number;
  version: number;
  isDark(r: number, c: number): boolean;
}

/** Three fictional bills with Slovenian characters. */
export const BILLS: { id: string; eci: boolean; input: UpnInput }[] = [
  {
    id: "A-reference-example",
    eci: true,
    input: { recipientIban: makeIban("SI", "051008010486080") },
  },
  {
    id: "B-rf-no-eci",
    eci: false,
    input: {
      payerName: "Žiga Čeh",
      payerStreet: "Gorkega ulica 12",
      payerCity: "2000 Maribor",
      amount: "00000004237",
      purposeCode: "OTHR",
      purpose: "Odvoz odpadkov oktober 2026",
      paymentDeadline: "30.11.2026",
      recipientIban: makeIban("SI", "029220012345678"),
      recipientReference: makeRf("2026100471"),
      recipientName: "Komunala Škofja Loka d.o.o.",
      recipientStreet: "Kidričeva cesta 43a",
      recipientCity: "4220 Škofja Loka",
    },
  },
  {
    id: "C-zero-amount-si99",
    eci: true,
    input: {
      payerName: "Mojca Šušteršič",
      payerStreet: "Trg svobode 3",
      payerCity: "3000 Celje",
      amount: "00000000000",
      purposeCode: "GIFT",
      purpose: "Članarina 2026",
      recipientIban: makeIban("SI", "061000000123456"),
      recipientReference: "SI99",
      recipientName: "Društvo prijateljev Žabnice",
      recipientStreet: "Čopova ulica 5",
      recipientCity: "1000 Ljubljana",
    },
  },
];

export const billText = (i: number) => buildUpnText(BILLS[i]!.input);

/** UPN symbol: version 15, EC level M, ISO 8859-2 bytes, with ECI 000004 (zxing/zint) or without (node-qrcode). */
export async function upnMatrix(text: string, withEci: boolean): Promise<Matrix> {
  const bytes = encodeLatin2(text);
  if (withEci) {
    ensureWriter();
    const w = await writeBarcode(bytes, { format: "QRCode", options: "eci=4,version=15,ecLevel=M" });
    if (w.error) throw new Error(w.error);
    const { width, data } = w.symbol;
    if (width !== 77) throw new Error(`expected version 15 (77 modules), got ${width}`);
    return { size: width, version: 15, isDark: (r, c) => data[r * width + c] === 0 };
  }
  const qr = QRCode.create([{ data: bytes, mode: "byte" }], { version: 15, errorCorrectionLevel: "M" });
  return { size: qr.modules.size, version: qr.version, isDark: (r, c) => qr.modules.get(r, c) === 1 };
}

export function textMatrix(text: string): Matrix {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  return { size: qr.modules.size, version: qr.version, isDark: (r, c) => qr.modules.get(r, c) === 1 };
}

/** Matrix → PNG with 4-module quiet zone. */
export async function matrixPng(m: Matrix, scale: number): Promise<Buffer> {
  const q = 4;
  const side = (m.size + 2 * q) * scale;
  const canvas = createCanvas(side, side);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, side, side);
  ctx.fillStyle = "#000";
  for (let r = 0; r < m.size; r++)
    for (let c = 0; c < m.size; c++) if (m.isDark(r, c)) ctx.fillRect((c + q) * scale, (r + q) * scale, scale, scale);
  return canvas.encode("png");
}

const MM = 72 / 25.4;
const QR_MM = 40;

/** Draw a UPN-like slip outline with ASCII labels; returns where the QR goes (PDF coordinates, bottom-left). */
function drawSlip(page: import("pdf-lib").PDFPage, font: import("pdf-lib").PDFFont, topY: number, label: string) {
  const x = 10 * MM;
  const h = 99 * MM;
  const w = 190 * MM;
  page.drawRectangle({ x, y: topY - h, width: w, height: h, borderColor: rgb(0.8, 0.3, 0.1), borderWidth: 1 });
  page.drawText("UPN - univerzalni placilni nalog", { x: x + 5 * MM, y: topY - 8 * MM, size: 10, font });
  page.drawText(label, { x: x + 60 * MM, y: topY - 30 * MM, size: 9, font, color: rgb(0.3, 0.3, 0.3) });
  return { qrX: x + 8 * MM, qrY: topY - 15 * MM - QR_MM * MM };
}

/** Draw a QR as vector rectangles (horizontal runs merged), with the quiet zone left white. */
function drawVectorQr(page: import("pdf-lib").PDFPage, m: Matrix, x: number, y: number, sizePt: number) {
  const mod = sizePt / (m.size + 8);
  for (let r = 0; r < m.size; r++) {
    let c = 0;
    while (c < m.size) {
      if (!m.isDark(r, c)) { c++; continue; }
      const start = c;
      while (c < m.size && m.isDark(r, c)) c++;
      page.drawRectangle({
        x: x + (start + 4) * mod,
        y: y + sizePt - (r + 5) * mod,
        width: (c - start) * mod,
        height: mod,
        color: rgb(0, 0, 0),
      });
    }
  }
}

/** Test 8: three UPN slips on two A4 pages (page 1: two raster images, page 2: one vector-drawn code). */
export async function buildMultiPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const A4: [number, number] = [595.28, 841.89];

  const p1 = doc.addPage(A4);
  p1.drawText("Invoice 2026/1043 - two payment slips", { x: 40, y: 800, size: 14, font });
  for (const [i, top] of [[0, 780], [1, 380]] as const) {
    const bill = BILLS[i]!;
    const { qrX, qrY } = drawSlip(p1, font, top, bill.id);
    const png = await doc.embedPng(await matrixPng(await upnMatrix(billText(i), bill.eci), 6));
    p1.drawImage(png, { x: qrX, y: qrY, width: QR_MM * MM, height: QR_MM * MM });
  }

  const p2 = doc.addPage(A4);
  const { qrX, qrY } = drawSlip(p2, font, 780, BILLS[2]!.id);
  drawVectorQr(p2, await upnMatrix(billText(2), BILLS[2]!.eci), qrX, qrY, QR_MM * MM);
  return doc.save();
}

/** Test 10: one UPN code and one unrelated QR code side by side on a white image. */
export async function buildMixedPng(): Promise<Buffer> {
  const upn = await loadImage(await matrixPng(await upnMatrix(billText(0), true), 5));
  const other = await loadImage(await matrixPng(textMatrix("https://example.com/loyalty-card/12345"), 8));
  const canvas = createCanvas(upn.width + other.width + 120, Math.max(upn.height, other.height) + 80);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(other, 40, 40); // unrelated code on the left
  ctx.drawImage(upn, other.width + 80, 40);
  return canvas.encode("png");
}

/** A screenshot-like bill: grey UI chrome, text, the UPN code smoothly scaled to ~2.6 px per module. */
export async function buildScreenshot(format: "png" | "jpeg" = "png"): Promise<Buffer> {
  const canvas = createCanvas(1440, 900);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#e8e8e8";
  ctx.fillRect(0, 0, 1440, 900);
  ctx.fillStyle = "#fff";
  ctx.fillRect(220, 40, 1000, 840);
  ctx.fillStyle = "#222";
  ctx.font = "20px sans-serif";
  ctx.fillText("Komunala Škofja Loka d.o.o. — Račun 2026/10", 260, 100);
  ctx.font = "14px sans-serif";
  for (let i = 0; i < 12; i++) ctx.fillText(`Postavka ${i + 1} ............................ ${(i * 3.17).toFixed(2)} EUR`, 260, 150 + i * 24);
  const qr = await loadImage(await matrixPng(await upnMatrix(billText(1), BILLS[1]!.eci), 6));
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(qr, 280, 520, 220, 220); // 85 modules incl. quiet zone → ~2.6 px/module
  return format === "png" ? canvas.encode("png") : canvas.encode("jpeg", 85);
}
