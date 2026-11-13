import { describe, expect, it } from "vitest";
import { decodeQrBytes, encodeLatin2, readEciDesignator } from "../../src/core/charset";

// Hand-written ISO 8859-2 bytes, independent of encodeLatin2.
const SUBICEVA_LATIN2 = Uint8Array.of(0xa9, 0x75, 0x62, 0x69, 0xe8, 0x65, 0x76, 0x61, 0x20, 0x32); // Šubičeva 2
const LOSKI_LATIN2 = Uint8Array.of(0x4c, 0x6f, 0xb9, 0x6b, 0x69, 0x20, 0x50, 0x6f, 0x74, 0x6f, 0x6b); // Loški Potok
const utf8 = (s: string) => new TextEncoder().encode(s);

describe("test 6: character decoding", () => {
  it.each([
    [SUBICEVA_LATIN2, "Šubičeva 2"],
    [LOSKI_LATIN2, "Loški Potok"],
  ])("ISO 8859-2 bytes decode correctly with ECI 4 and without ECI", (bytes, text) => {
    expect(decodeQrBytes(bytes, 4)).toBe(text);
    expect(decodeQrBytes(bytes)).toBe(text);
    expect(decodeQrBytes(bytes, 899)).toBe(text); // "binary" ECI → heuristic
    expect(decodeQrBytes(bytes, 3)).toBe(text); // ECIs other than 4/26 → heuristic
  });

  it.each(["Šubičeva 2", "Loški Potok"])("%s as UTF-8 without ECI decodes correctly", (text) => {
    expect(decodeQrBytes(utf8(text))).toBe(text);
    expect(decodeQrBytes(utf8(text), 26)).toBe(text);
  });

  it("pure ASCII decodes the same either way", () => {
    expect(decodeQrBytes(utf8("UPNQR\nabc"))).toBe("UPNQR\nabc");
  });

  it("a whole multi-line UPN-style text round-trips through ISO 8859-2", () => {
    const text = "UPNQR\n\nŠubičeva 2\n3698 Loški Potok\nŽiga Čeh\n";
    expect(decodeQrBytes(encodeLatin2(text), 4)).toBe(text);
    expect(decodeQrBytes(encodeLatin2(text))).toBe(text);
    expect(encodeLatin2("Šubičeva 2")).toEqual(SUBICEVA_LATIN2);
  });

  it("encodeLatin2 refuses characters outside ISO 8859-2", () => {
    expect(() => encodeLatin2("€")).toThrow();
  });
});

describe("ECI designator from zxing-wasm bytesECI", () => {
  const ascii = (s: string) => Uint8Array.from([...s].map((c) => c.charCodeAt(0)));
  it("reads the six-digit designator after the symbology identifier", () => {
    expect(readEciDesignator(ascii("]Q2\\000004UPNQR\n"))).toBe(4);
    expect(readEciDesignator(ascii("]Q2\\000026BCD"))).toBe(26);
    expect(readEciDesignator(ascii("]Q2\\000899UPNQR"))).toBe(899);
  });
  it("returns undefined when no designator is present", () => {
    expect(readEciDesignator(ascii("]Q1UPNQR\n"))).toBeUndefined();
    expect(readEciDesignator(ascii("UPNQR\n"))).toBeUndefined();
    expect(readEciDesignator(new Uint8Array())).toBeUndefined();
  });
});
