// zxing-wasm wrapper (spec 7.1). Environment-neutral: the caller configures where the .wasm comes
// from (browser: bundled URL via locateFile; tests: wasmBinary from disk) before the first read.

import { prepareZXingModule, readBarcodes, type ReaderOptions, type ZXingModuleOverrides } from "zxing-wasm/reader";
import { readEciDesignator } from "../core/charset";
import type { PixelImage, QrSymbol } from "./types";

const READER_OPTIONS: ReaderOptions = {
  formats: ["QRCode"],
  tryHarder: true,
  maxNumberOfSymbols: 64,
};

/** Must be called once before {@link readSymbols}; otherwise zxing-wasm would fetch its .wasm from a CDN. */
export function configureZxing(overrides: ZXingModuleOverrides): void {
  prepareZXingModule({ overrides });
}

/** Compare symbols in reading order: rows top to bottom, then left to right within a row. */
export function documentOrder(a: QrSymbol, b: QrSymbol): number {
  const rowTolerance = Math.min(a.height, b.height) / 2;
  if (Math.abs(a.top - b.top) > rowTolerance) return a.top - b.top;
  return a.left - b.left;
}

export async function readSymbols(image: PixelImage): Promise<QrSymbol[]> {
  // zxing-wasm accepts any {data, width, height} object; the cast avoids requiring a DOM ImageData.
  const results = await readBarcodes(image as ImageData, READER_OPTIONS);
  const symbols = results
    .filter((r) => r.isValid)
    .map((r): QrSymbol => {
      const { topLeft, topRight, bottomLeft, bottomRight } = r.position;
      const ys = [topLeft.y, topRight.y, bottomLeft.y, bottomRight.y];
      const xs = [topLeft.x, topRight.x, bottomLeft.x, bottomRight.x];
      return {
        bytes: r.bytes,
        eci: r.hasECI ? readEciDesignator(r.bytesECI) : undefined,
        top: Math.min(...ys),
        left: Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
      };
    });
  return symbols.sort(documentOrder);
}
