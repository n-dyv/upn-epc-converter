// PDF pages → pixels → QR symbols (spec 7.3). The pdfjs build and the canvas factory are injected,
// so the same code runs in the browser and in Node tests.

import type * as Pdfjs from "pdfjs-dist";
import type { DocumentInitParameters } from "pdfjs-dist/types/src/display/api";
import type { PageSymbols } from "./classify";
import { en } from "../i18n/en";
import type { FileError, PixelImage, Progress, ReadSymbols } from "./types";

export const MAX_PDF_PAGES = 50;
const DPI_FIRST = 300;
const DPI_RETRY = 450;
const MAX_SIDE_PX = 5000;

interface Ctx2d {
  getImageData(x: number, y: number, w: number, h: number): PixelImage;
}
export interface CanvasLike {
  width: number;
  height: number;
  getContext(type: "2d"): unknown;
}

export interface PdfEnv {
  pdfjs: Pick<typeof Pdfjs, "getDocument">;
  createCanvas(width: number, height: number): CanvasLike;
  /** Extra getDocument parameters: local wasmUrl, standardFontDataUrl, cMapUrl, iccUrl. */
  documentParams?: Partial<DocumentInitParameters>;
}

export class PdfError extends Error {
  constructor(readonly info: FileError) {
    super(en.fileError(info));
  }
}

function describePdfError(e: unknown): FileError {
  const name = (e as { name?: string })?.name;
  if (name === "PasswordException") return { code: "pdf-password" };
  if (name === "InvalidPDFException") return { code: "pdf-invalid" };
  return { code: "pdf-unreadable", detail: (e as Error)?.message ?? String(e) };
}

async function renderPage(page: Pdfjs.PDFPageProxy, dpi: number, env: PdfEnv): Promise<PixelImage> {
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(dpi / 72, MAX_SIDE_PX / Math.max(base.width, base.height));
  const viewport = page.getViewport({ scale });
  const width = Math.floor(viewport.width);
  const height = Math.floor(viewport.height);
  const canvas = env.createCanvas(width, height);
  await page.render({ canvas: canvas as unknown as HTMLCanvasElement, viewport, background: "#ffffff" }).promise;
  const ctx = canvas.getContext("2d") as Ctx2d;
  const image = ctx.getImageData(0, 0, width, height);
  canvas.width = 0; // release the bitmap early
  canvas.height = 0;
  return image;
}

/** Scan every page in order; retry a page with no QR code once at a higher resolution. */
export async function scanPdf(
  data: Uint8Array,
  fileName: string,
  env: PdfEnv,
  readSymbols: ReadSymbols,
  onProgress?: (p: Progress) => void,
): Promise<PageSymbols[]> {
  // pdfjs takes ownership of (detaches) the buffer it is given, so pass a copy.
  const task = env.pdfjs.getDocument({ data: data.slice(), ...env.documentParams });
  try {
    let doc: Pdfjs.PDFDocumentProxy;
    try {
      doc = await task.promise;
    } catch (e) {
      throw new PdfError(describePdfError(e));
    }
    if (doc.numPages > MAX_PDF_PAGES) {
      throw new PdfError({ code: "pdf-too-many-pages", pages: doc.numPages, limit: MAX_PDF_PAGES });
    }
    const out: PageSymbols[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      onProgress?.({ fileName, page: n, pageCount: doc.numPages });
      const page = await doc.getPage(n);
      try {
        let symbols = await readSymbols(await renderPage(page, DPI_FIRST, env));
        if (symbols.length === 0) symbols = await readSymbols(await renderPage(page, DPI_RETRY, env));
        out.push({ source: { fileName, page: n }, symbols });
      } finally {
        page.cleanup();
      }
    }
    return out;
  } catch (e) {
    throw e instanceof PdfError ? e : new PdfError(describePdfError(e));
  } finally {
    await task.destroy();
  }
}
