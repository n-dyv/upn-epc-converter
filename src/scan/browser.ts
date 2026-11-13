// Browser wiring for the scan pipeline: local .wasm for zxing, local pdfjs worker and decoder assets.

import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import zxingWasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";
import { prepareZXingModule } from "zxing-wasm/reader";
import { readSymbols } from "./zxing";
import type { ScanEnv } from "./pipeline";
import type { PixelImage } from "./types";

/** Absolute same-origin URL of a public/ asset (pdfjs resolves relative URLs against its worker script). */
const publicUrl = (path: string) => new URL(import.meta.env.BASE_URL + path, document.baseURI).href;

let warm: Promise<unknown> | undefined;

/**
 * Load the zxing .wasm and start the pdfjs worker now, during page load, from the local bundle.
 * Afterwards a typical scan makes no network request. Safe to call more than once.
 */
export function warmUp(): Promise<unknown> {
  if (!warm) {
    GlobalWorkerOptions.workerPort = new Worker(pdfWorkerUrl, { type: "module" });
    warm = prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? zxingWasmUrl : prefix + path),
      },
      fireImmediately: true,
    });
  }
  return warm;
}

async function loadImage(blob: Blob): Promise<PixelImage> {
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas 2D is not available");
    ctx.fillStyle = "#fff"; // transparent screenshots → white background
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  } finally {
    bitmap.close();
  }
}

export function browserEnv(): ScanEnv {
  warmUp();
  return {
    readSymbols: async (img) => {
      await warm;
      return readSymbols(img);
    },
    loadImage,
    pdf: {
      pdfjs: { getDocument },
      createCanvas: (w, h) => {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        return c;
      },
      documentParams: {
        // Same-origin decoder assets (JBIG2 / JPEG 2000 / colour management), copied to public/pdfjs/.
        wasmUrl: publicUrl("pdfjs/wasm/"),
        iccUrl: publicUrl("pdfjs/iccs/"),
      },
    },
  };
}
