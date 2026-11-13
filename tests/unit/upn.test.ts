import { describe, expect, it } from "vitest";
import { parseUpn, looksLikeUpn, type UpnFields } from "../../src/core/upn";
import { buildUpnText, controlSumOf, upnFieldList, REFERENCE_EXAMPLE } from "../fixtures/upn-builder";

function parseOk(text: string) {
  const r = parseUpn(text);
  if (!r.ok) throw new Error(`parse failed: ${r.error}`);
  return r;
}
const codes = (ws: { code: string }[]) => ws.map((w) => w.code);

describe("test 1: reference example", () => {
  it("puts every field in the right slot", () => {
    const r = parseOk(buildUpnText());
    const expected: UpnFields = {
      leadingStyle: "UPNQR",
      ...REFERENCE_EXAMPLE,
      controlSum: controlSumOf(upnFieldList({})),
    };
    expect(r.fields).toEqual(expected);
    expect(r.warnings).toEqual([]);
    expect(r.lines).toHaveLength(20);
  });

  it("the fixture's control sum is computed, and matches the hand count", () => {
    // 6+1+1+1+1+12+11+15+12+1+1+5+31+1+20+16+21+14+17 = 187
    expect(controlSumOf(upnFieldList({}))).toBe("187");
  });

  it("rejects payloads that are not UPN", () => {
    expect(parseUpn("BCD\n002\n1\nSCT")).toMatchObject({ ok: false, error: "not-upn" });
    expect(parseUpn("UPNQR\nA\nB\n")).toMatchObject({ ok: false, error: "too-few-fields" });
    expect(looksLikeUpn(buildUpnText())).toBe(true);
    expect(looksLikeUpn(buildUpnText({}, { crlf: true }))).toBe(true);
    expect(looksLikeUpn("UPNQRX\n")).toBe(false);
    expect(looksLikeUpn("https://example.com")).toBe(false);
  });
});

describe("test 2: lenient parsing", () => {
  it("accepts CRLF", () => {
    const r = parseOk(buildUpnText({}, { crlf: true }));
    expect(r.fields.recipientCity).toBe("3698 Loški Potok");
    expect(r.fields.payerName).toBe("Janez Novak");
    expect(r.warnings).toEqual([]);
  });

  it("accepts a missing reserve and ignores a present one and extra lines", () => {
    expect(parseOk(buildUpnText({}, { reserve: "" })).warnings).toEqual([]);
    const r = parseOk(buildUpnText({}, { reserve: "     \nextra line\nmore" }));
    expect(r.warnings).toEqual([]);
    expect(r.fields.controlSum).toBe("187");
  });

  it("missing field 20 → checksum-missing", () => {
    const r = parseOk(buildUpnText({}, { omitControlSum: true }));
    expect(codes(r.warnings)).toEqual(["checksum-missing"]);
    expect(r.fields.recipientCity).toBe("3698 Loški Potok");
  });

  it("missing field 20 and no final LF (19 fields) still parses", () => {
    const text = upnFieldList({}).join("\n");
    const r = parseOk(text);
    expect(codes(r.warnings)).toEqual(["checksum-missing"]);
    expect(r.fields.recipientCity).toBe("3698 Loški Potok");
  });

  it("wrong control sum → checksum-mismatch, still parsed", () => {
    const r = parseOk(buildUpnText({}, { controlSumOverride: "183" }));
    expect(codes(r.warnings)).toEqual(["checksum-mismatch"]);
    expect(r.fields.amount).toBe("00000008105");
    expect(codes(parseOk(buildUpnText({}, { controlSumOverride: "x12" })).warnings)).toEqual(["checksum-mismatch"]);
  });

  it("trims fields and never rejects over-long fields", () => {
    const long = "A".repeat(200);
    const r = parseOk(buildUpnText({ recipientName: `  ${long}  `, purpose: " text " }));
    expect(r.fields.recipientName).toBe(long);
    expect(r.fields.purpose).toBe("text");
    expect(r.warnings).toEqual([]); // control sum counts the raw field as written
  });
});
