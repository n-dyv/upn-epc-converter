// One input file (PDF or image) → FileReport. Environment pieces are injected (see browser.ts, tests).

import { classify } from "./classify";
import { PdfError, scanPdf, type PdfEnv } from "./pdf";
import type { FileReport, PixelImage, Progress, ReadSymbols } from "./types";

export interface ScanEnv {
  readSymbols: ReadSymbols;
  /** Decode an encoded image (PNG, JPEG, WebP) to pixels. */
  loadImage(data: Blob): Promise<PixelImage>;
  pdf: PdfEnv;
}

export interface InputFile {
  name: string;
  type: string;
  data: Blob;
}

export type FileKind = "pdf" | "image" | "unsupported";

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

/** Detect the file kind from its magic bytes, falling back to the MIME type and extension. */
export async function detectKind(file: InputFile): Promise<FileKind> {
  const head = new Uint8Array(await file.data.slice(0, 12).arrayBuffer());
  const ascii = String.fromCharCode(...head);
  if (ascii.startsWith("%PDF")) return "pdf";
  if (head[0] === 0x89 && ascii.slice(1, 4) === "PNG") return "image";
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image";
  if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") return "image";
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) return "pdf";
  if (IMAGE_TYPES.has(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name)) return "image";
  return "unsupported";
}

function failed(fileName: string, error: string): FileReport {
  return { fileName, found: [], broken: [], otherCount: 0, duplicateCount: 0, anySymbol: false, error };
}

export async function scanFile(
  file: InputFile,
  env: ScanEnv,
  onProgress?: (p: Progress) => void,
): Promise<FileReport> {
  const kind = await detectKind(file);
  try {
    if (kind === "pdf") {
      const bytes = new Uint8Array(await file.data.arrayBuffer());
      const pages = await scanPdf(bytes, file.name, env.pdf, env.readSymbols, onProgress);
      return classify(file.name, pages);
    }
    if (kind === "image") {
      onProgress?.({ fileName: file.name });
      let image: PixelImage;
      try {
        image = await env.loadImage(file.data);
      } catch {
        return failed(file.name, `${file.name} could not be opened as an image.`);
      }
      const symbols = await env.readSymbols(image);
      return classify(file.name, [{ source: { fileName: file.name }, symbols }]);
    }
    return failed(file.name, `${file.name} is not a supported file. Use a PDF, PNG, JPEG or WebP file.`);
  } catch (e) {
    if (e instanceof PdfError) return failed(file.name, e.message);
    return failed(file.name, `${file.name} could not be processed (${(e as Error)?.message ?? String(e)}).`);
  }
}
