import { describe, expect, it } from "vitest";
import { isValidIban, normalizeIban } from "../../src/core/iban";
import { isValidRf, normalizeReference } from "../../src/core/rf";
import { breakCheckDigits, makeIban, makeRf } from "../fixtures/check-digits";

describe("test 7: IBAN validation", () => {
  // Test IBANs computed with mod-97 (BigInt helper), not copied from documents.
  const valid = [
    makeIban("SI", "051008010486080"),
    makeIban("SI", "020360253863406"),
    makeIban("DE", "370400440532013000"),
    makeIban("AT", "1904300234573201"),
    makeIban("FR", "20041010050500013M02606"),
    makeIban("MT", "MALT011000012345MTLCAST001S"), // 31 chars, letters in BBAN
  ];
  it.each(valid)("%s is valid", (iban) => expect(isValidIban(iban)).toBe(true));
  it.each(valid)("%s with wrong check digits is invalid", (iban) =>
    expect(isValidIban(breakCheckDigits(iban))).toBe(false),
  );
  it("rejects a swapped digit, bad structure and wrong length", () => {
    const iban = makeIban("SI", "051008010486080");
    const swapped = iban.slice(0, 10) + iban[11] + iban[10] + iban.slice(12);
    expect(swapped).not.toBe(iban);
    expect(isValidIban(swapped)).toBe(false);
    expect(isValidIban("")).toBe(false);
    expect(isValidIban("SI5605100801048608!")).toBe(false);
    expect(isValidIban("1156051008010486080")).toBe(false);
    expect(isValidIban("SI56" + "1".repeat(31))).toBe(false); // 35 characters
  });
  it("normalizes spaces and case", () => {
    const iban = makeIban("SI", "051008010486080");
    const messy = " " + iban.toLowerCase().replace(/(.{4})/g, "$1 ");
    expect(isValidIban(normalizeIban(messy))).toBe(true);
  });
  it("cross-checks the spec's example IBAN against the independent helper", () => {
    expect(makeIban("SI", "051008010486080")).toBe("SI56051008010486080");
  });
});

describe("test 7: RF creditor reference validation", () => {
  const valid = [makeRf("539007547034"), makeRf("1"), makeRf("ABC123"), makeRf("A".repeat(21))];
  it.each(valid)("%s is valid", (rf) => expect(isValidRf(rf)).toBe(true));
  it.each(valid)("%s with wrong check digits is invalid", (rf) =>
    expect(isValidRf(breakCheckDigits(rf))).toBe(false),
  );
  it("cross-checks the EPC069-12 example reference", () => {
    expect(makeRf("539007547034")).toBe("RF18539007547034");
  });
  it("rejects bad structure", () => {
    expect(isValidRf("")).toBe(false);
    expect(isValidRf("RF18")).toBe(false);
    expect(isValidRf("SI18539007547034")).toBe(false);
    expect(isValidRf("RF1A539007547034")).toBe(false);
    expect(isValidRf(makeRf("A".repeat(21)) + "A")).toBe(false); // too long
  });
  it("normalizes spaces and case", () => {
    expect(isValidRf(normalizeReference("rf18 5390 0754 7034"))).toBe(true);
  });
});
