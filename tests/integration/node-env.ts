// Node wiring of the scan pipeline for tests: same src/scan code, with @napi-rs/canvas and pdfjs legacy build.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { configureZxing, readSymbols } from "../../src/scan/zxing";
import type { ScanEnv } from "../../src/scan/pipeline";
import type { PixelImage } from "../../src/scan/types";

const require = createRequire(import.meta.url);

function arrayBufferOf(path: string): ArrayBuffer {
  const b = readFileSync(path);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

configureZxing({ wasmBinary: arrayBufferOf(require.resolve("zxing-wasm/reader/zxing_reader.wasm")) });
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")).href;
const pdfjsRoot = dirname(require.resolve("pdfjs-dist/package.json"));

export const nodeEnv: ScanEnv = {
  readSymbols,
  async loadImage(blob) {
    const img = await loadImage(Buffer.from(await blob.arrayBuffer()));
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, img.width, img.height);
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, img.width, img.height) as unknown as PixelImage;
  },
  pdf: {
    pdfjs,
    createCanvas: (w, h) => createCanvas(w, h),
    documentParams: {
      wasmUrl: join(pdfjsRoot, "wasm") + "/",
      iccUrl: join(pdfjsRoot, "iccs") + "/",
      verbosity: 0,
    },
  },
};

export function fileOf(name: string, data: Uint8Array | Buffer, type = ""): { name: string; type: string; data: Blob } {
  return { name, type, data: new Blob([new Uint8Array(data)]) };
}
