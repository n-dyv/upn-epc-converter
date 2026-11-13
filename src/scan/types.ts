import type { QrCharset } from "../core/charset";
import type { Conversion } from "../core/convert";
import type { Issue } from "../core/issues";
import type { UpnFields } from "../core/upn";

/** RGBA pixels, compatible with the DOM ImageData and with @napi-rs/canvas ImageData. */
export interface PixelImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** One decoded QR symbol, before classification. */
export interface QrSymbol {
  /** Raw payload bytes (no ECI header, no character conversion). */
  bytes: Uint8Array;
  /** Declared ECI value, if any. */
  eci?: number;
  /** Top edge and left edge in pixels (minimum over the four corners) and height, for document ordering. */
  top: number;
  left: number;
  height: number;
}

export type ReadSymbols = (image: PixelImage) => Promise<QrSymbol[]>;

export interface Source {
  fileName: string;
  /** 1-based page number for PDFs. */
  page?: number;
}

/** A UPN code found and parsed successfully. */
export interface FoundUpn {
  source: Source;
  /** Decoded UPN text exactly as read from the symbol. */
  text: string;
  /** Character set used to decode the bytes. */
  charset: QrCharset;
  eci?: number;
  fields: UpnFields;
  /** Trimmed field values 1–20, for the technical details. */
  lines: string[];
  /** Parser warnings (control sum). */
  parseWarnings: Issue[];
  conversion: Conversion;
}

/** A symbol that starts with UPNQR but could not be parsed. */
export interface BrokenUpn {
  source: Source;
  message: string;
}

export interface FileReport {
  fileName: string;
  found: FoundUpn[];
  broken: BrokenUpn[];
  otherCount: number;
  duplicateCount: number;
  /** Whether any QR symbol at all was found. */
  anySymbol: boolean;
  /** Fatal problem with the file itself (unsupported type, corrupt, password, too many pages). */
  error?: string;
}

export interface Progress {
  fileName: string;
  page?: number;
  pageCount?: number;
}
