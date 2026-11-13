// Character decoding of raw QR bytes (spec section 7.2).

const ECI_ISO_8859_2 = 4;
const ECI_UTF_8 = 26;

const latin2 = new TextDecoder("iso-8859-2");
const utf8Strict = new TextDecoder("utf-8", { fatal: true });

/**
 * Read the ECI value from a symbol's transmitted data in the AIM ECI protocol (ISO/IEC 15424),
 * as zxing-wasm exposes it in `bytesECI`: a symbology identifier `]Qn` followed by `\dddddd`.
 * Returns undefined when no designator leads the data.
 */
export function readEciDesignator(bytesEci: Uint8Array): number | undefined {
  const head = String.fromCharCode(...bytesEci.subarray(0, 10));
  const m = /^\][A-Za-z]\d\\(\d{6})/.exec(head);
  return m ? Number(m[1]) : undefined;
}

function hasHighByte(bytes: Uint8Array): boolean {
  for (const b of bytes) if (b >= 0x80) return true;
  return false;
}

/**
 * Decode raw QR payload bytes to text.
 * ECI 4 → ISO 8859-2, ECI 26 → UTF-8. No ECI or any other ECI: strictly valid UTF-8 containing at
 * least one multi-byte sequence → UTF-8, otherwise ISO 8859-2.
 */
export function decodeQrBytes(bytes: Uint8Array, eci?: number): string {
  return decodeQrBytesDetailed(bytes, eci).text;
}

export type QrCharset = "iso-8859-2" | "utf-8";

/** Like {@link decodeQrBytes}, also reporting which character set was used. */
export function decodeQrBytesDetailed(bytes: Uint8Array, eci?: number): { text: string; charset: QrCharset } {
  if (eci === ECI_ISO_8859_2) return { text: latin2.decode(bytes), charset: "iso-8859-2" };
  if (eci === ECI_UTF_8) return { text: new TextDecoder("utf-8").decode(bytes), charset: "utf-8" };
  if (hasHighByte(bytes)) {
    try {
      return { text: utf8Strict.decode(bytes), charset: "utf-8" };
    } catch {
      // not valid UTF-8 → fall through
    }
  }
  return { text: latin2.decode(bytes), charset: "iso-8859-2" };
}

let latin2Table: Map<string, number> | undefined;

/** Encode text as ISO 8859-2 bytes. Throws on characters outside the set. Used by fixtures and tests. */
export function encodeLatin2(text: string): Uint8Array {
  if (!latin2Table) {
    latin2Table = new Map();
    for (let b = 0; b < 256; b++) latin2Table.set(latin2.decode(Uint8Array.of(b)), b);
  }
  const out: number[] = [];
  for (const ch of text) {
    const b = latin2Table.get(ch);
    if (b === undefined) throw new Error(`Character ${JSON.stringify(ch)} is not in ISO 8859-2`);
    out.push(b);
  }
  return Uint8Array.from(out);
}
