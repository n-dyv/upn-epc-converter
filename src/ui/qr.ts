// EPC QR generation (spec 5.1): byte mode, UTF-8 bytes, error correction M, version ≤ 13.
// Pure (no DOM), so tests can decode exactly what the app draws.

import QRCode from "qrcode";

export interface QrMatrix {
  size: number;
  version: number;
  isDark(row: number, col: number): boolean;
}

export const EPC_MAX_VERSION = 13;
export const QUIET_ZONE = 4;

export function epcQrMatrix(payload: string): QrMatrix {
  const bytes = new TextEncoder().encode(payload);
  const qr = QRCode.create([{ data: bytes, mode: "byte" }], { errorCorrectionLevel: "M" });
  if (qr.version > EPC_MAX_VERSION) throw new Error(`EPC QR version ${qr.version} exceeds ${EPC_MAX_VERSION}`);
  const { size } = qr.modules;
  return { size, version: qr.version, isDark: (r, c) => qr.modules.get(r, c) === 1 };
}

/** Black-on-white RGBA pixels with a quiet zone, `scale` pixels per module. */
export function matrixToRgba(m: QrMatrix, scale: number, quiet = QUIET_ZONE) {
  const width = (m.size + 2 * quiet) * scale;
  const data = new Uint8ClampedArray(width * width * 4).fill(255);
  for (let r = 0; r < m.size; r++) {
    for (let c = 0; c < m.size; c++) {
      if (!m.isDark(r, c)) continue;
      for (let dy = 0; dy < scale; dy++) {
        let i = (((r + quiet) * scale + dy) * width + (c + quiet) * scale) * 4;
        for (let dx = 0; dx < scale; dx++, i += 4) data[i] = data[i + 1] = data[i + 2] = 0;
      }
    }
  }
  return { data, width, height: width };
}
