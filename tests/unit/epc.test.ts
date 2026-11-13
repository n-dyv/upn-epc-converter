import { describe, expect, it } from "vitest";
import { buildEpc, type EpcResult } from "../../src/core/epc";
import { upnToPayment } from "../../src/core/convert";
import { parseUpn } from "../../src/core/upn";
import type { Payment } from "../../src/core/payment";
import { buildUpnText, type UpnInput } from "../fixtures/upn-builder";
import { breakCheckDigits, makeIban, makeRf } from "../fixtures/check-digits";

const IBAN = makeIban("SI", "051008010486080");

function convert(input: UpnInput = {}) {
  const r = parseUpn(buildUpnText({ recipientIban: IBAN, ...input }));
  if (!r.ok) throw new Error(r.error);
  return upnToPayment(r.fields);
}
function epcOk(res: EpcResult) {
  if (!res.ok) throw new Error(`errors: ${res.errors.map((e) => e.code).join(", ")}`);
  return res;
}
const fromUpn = (input: UpnInput = {}) => epcOk(buildEpc(convert(input).payment));
const codes = (ws: { code: string }[]) => ws.map((w) => w.code);

describe("reference example → expected EPC payload", () => {
  it("matches spec section 11", () => {
    const res = fromUpn();
    expect(res.payload).toBe(
      [
        "BCD", "002", "1", "SCT", "", "Novo podjetje d.o.o.", IBAN, "EUR81.05", "COST", "",
        "SI0598765432100",
      ].join("\n"),
    );
    expect(codes(res.warnings)).toEqual(["purpose-dropped", "si-reference-in-text"]);
  });

  it("copies read-only details", () => {
    expect(convert().details).toEqual({
      payerName: "Janez Novak",
      recipientAddress: "Lepa cesta 15, 3698 Loški Potok",
      dueDate: "",
      payerReference: "",
    });
  });
});

describe("test 3: amount", () => {
  const line8 = (amount: string) => fromUpn({ amount }).lines[7] ?? "";
  it.each([
    ["00000008105", "EUR81.05"],
    ["00000000050", "EUR0.50"],
    ["99999999999", "EUR999999999.99"],
    ["00000126874", "EUR1268.74"],
    ["00000000001", "EUR0.01"],
    ["00000010000", "EUR100.00"],
  ])("%s → %s", (upn, epc) => expect(line8(upn)).toBe(epc));

  it.each(["00000000000", ""])("%j → line 8 empty and amount-omitted", (upn) => {
    const res = fromUpn({ amount: upn });
    expect(res.lines[7] ?? "").toBe("");
    expect(res.payload.split("\n")[7]).toBe("");
    expect(codes(res.warnings)).toContain("amount-omitted");
  });

  it("non-numeric field 9 → amount-invalid, fixable in the form", () => {
    const c = convert({ amount: "0000008A105" });
    const res = buildEpc(c.payment);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors).toEqual([expect.objectContaining({ code: "amount-invalid", field: "amount" })]);
    expect(epcOk(buildEpc({ ...c.payment, amount: "81,05" })).lines[7]).toBe("EUR81.05");
  });

  it("edited amounts: range and formats", () => {
    const p = convert().payment;
    const err = (amount: string) => {
      const r = buildEpc({ ...p, amount });
      return r.ok ? null : r.errors.map((e) => e.code);
    };
    expect(err("999999999.99")).toBeNull();
    expect(err("1000000000")).toEqual(["amount-out-of-range"]);
    expect(err("1000000000000000000000")).toEqual(["amount-out-of-range"]);
    expect(err("12.345")).toEqual(["amount-invalid"]);
    expect(err("-5")).toEqual(["amount-invalid"]);
    expect(err("1e3")).toEqual(["amount-invalid"]);
    expect(epcOk(buildEpc({ ...p, amount: " 1 268.7 " })).lines[7]).toBe("EUR1268.70");
    expect(epcOk(buildEpc({ ...p, amount: "007" })).lines[7]).toBe("EUR7.00");
  });
});

describe("test 4: reference and remittance", () => {
  it("SI reference → free text 'ref' only, purpose dropped, si-reference-in-text", () => {
    const res = fromUpn({ recipientReference: "SI12 345-678" });
    expect(res.lines[9]).toBe("");
    expect(res.lines[10]).toBe("SI12345-678");
    expect(res.payload).not.toContain("Payment of obligations");
    expect(codes(res.warnings)).toEqual(["purpose-dropped", "si-reference-in-text"]);
    expect(res.warnings[0]).toMatchObject({ field: "text" });
  });

  it("valid RF → line 10, empty line 11, purpose-dropped", () => {
    const rf = makeRf("539007547034");
    const c = convert({ recipientReference: rf });
    expect(c.payment.mode).toBe("structured");
    const res = epcOk(buildEpc(c.payment));
    expect(res.lines[9]).toBe(rf);
    expect(res.lines).toHaveLength(10); // line 11 empty → removed as trailing
    expect(codes(res.warnings)).toEqual(["purpose-dropped"]);
  });

  it("valid RF without purpose → no purpose-dropped", () => {
    const res = fromUpn({ recipientReference: makeRf("1234"), purpose: "" });
    expect(res.warnings).toEqual([]);
  });

  it("valid RF switched to free-text mode → 'ref' only in line 11", () => {
    const rf = makeRf("539007547034");
    const c = convert({ recipientReference: rf });
    const res = epcOk(buildEpc({ ...c.payment, mode: "text" }));
    expect(res.lines[9]).toBe("");
    expect(res.lines[10]).toBe(rf);
    expect(codes(res.warnings)).toEqual(["purpose-dropped"]);
  });

  it("invalid RF → free text 'ref' only + rf-invalid", () => {
    const bad = breakCheckDigits(makeRf("539007547034"));
    const c = convert({ recipientReference: bad });
    expect(c.payment.mode).toBe("text");
    const res = epcOk(buildEpc(c.payment));
    expect(res.lines[9]).toBe("");
    expect(res.lines[10]).toBe(bad);
    expect(codes(res.warnings)).toEqual(["purpose-dropped", "rf-invalid"]);
    // even if the form forces structured mode, an invalid RF never goes into line 10
    expect(epcOk(buildEpc({ ...c.payment, mode: "structured" })).lines[9]).toBe("");
  });

  it.each(["SI99", "", "si 99"])("reference %j → purpose only", (ref) => {
    const res = fromUpn({ recipientReference: ref });
    expect(res.lines[10]).toBe("Payment of obligations 10/2016");
    expect(codes(res.warnings)).not.toContain("si-reference-in-text");
  });

  it("SI99 with a remainder is an SI reference", () => {
    expect(fromUpn({ recipientReference: "SI9912" }).lines[10]).toBe("SI9912");
  });

  it("SI reference with empty purpose → reference only, no purpose-dropped", () => {
    const res = fromUpn({ recipientReference: "SI0598765432100", purpose: "" });
    expect(res.lines[10]).toBe("SI0598765432100");
    expect(codes(res.warnings)).toEqual(["si-reference-in-text"]);
  });

  it("free text (no reference) cut to 140 characters with text-truncated", () => {
    const res = fromUpn({ recipientReference: "", purpose: "x".repeat(200) });
    expect(res.lines[10]).toBe("x".repeat(140));
    expect(codes(res.warnings)).toContain("text-truncated");
  });

  it("140 characters of 2-byte text can still exceed 331 bytes → payload-too-long", () => {
    const res = buildEpc(convert({ recipientReference: "", purpose: "ž".repeat(200) }).payment);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.map((e) => e.code)).toEqual(["payload-too-long"]);
  });
});

describe("other mapping rules and errors", () => {
  it("name cut to 70 characters, Slovenian characters kept in UTF-8", () => {
    const res = fromUpn({ recipientName: "Čebelarstvo Šušteršič ".repeat(5) });
    expect([...(res.lines[5] ?? "")]).toHaveLength(70);
    expect(res.lines[5]?.startsWith("Čebelarstvo Šušteršič")).toBe(true);
    expect(codes(res.warnings)).toContain("text-truncated");
  });

  it("purpose code must be four letters A–Z", () => {
    expect(fromUpn({ purposeCode: "OTHR" }).lines[8]).toBe("OTHR");
    const res = fromUpn({ purposeCode: "CO1T" });
    expect(res.lines[8]).toBe("");
    expect(codes(res.warnings)).toContain("purpose-code-invalid");
    expect(codes(fromUpn({ purposeCode: "" }).warnings)).not.toContain("purpose-code-invalid");
  });

  it("IBAN: spaces removed and uppercased; missing/invalid are errors", () => {
    const spaced = IBAN.toLowerCase().replace(/(.{4})/g, "$1 ");
    expect(fromUpn({ recipientIban: spaced }).lines[6]).toBe(IBAN);
    const p = convert().payment;
    const errs = (q: Partial<Payment>) => {
      const r = buildEpc({ ...p, ...q });
      return r.ok ? [] : r.errors.map((e) => e.code);
    };
    expect(errs({ iban: "" })).toEqual(["iban-missing"]);
    expect(errs({ iban: breakCheckDigits(IBAN) })).toEqual(["iban-invalid"]);
    expect(errs({ name: "  " })).toEqual(["name-missing"]);
    expect(errs({ name: "", iban: "", amount: "x" })).toEqual(["name-missing", "iban-missing", "amount-invalid"]);
  });

  it("withdrawal or deposit marked → warning", () => {
    expect(codes(convert({ deposit: "X" }).warnings)).toEqual(["withdrawal-or-deposit"]);
    expect(codes(convert({ withdrawal: "X" }).warnings)).toEqual(["withdrawal-or-deposit"]);
    expect(convert().warnings).toEqual([]);
  });

  it("payload over 331 bytes → payload-too-long", () => {
    const p = convert().payment;
    // 70 + 140 chars of 2-byte characters = 420 bytes of text alone
    const res = buildEpc({ ...p, name: "č".repeat(70), text: "š".repeat(140), reference: "" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.errors.map((e) => e.code)).toEqual(["payload-too-long"]);
  });

  it("line breaks typed into a field never create extra EPC lines", () => {
    const p = convert().payment;
    const res = epcOk(buildEpc({ ...p, text: "line one\nline two", reference: "" }));
    expect(res.payload.split("\n")).toHaveLength(11);
    expect(res.lines[10]).toBe("line one line two");
  });
});

describe("test 5: no trailing empty lines or LF", () => {
  const variants: UpnInput[] = [
    {},
    { amount: "00000000000" },
    { purposeCode: "" },
    { recipientReference: "", purpose: "" },
    { recipientReference: "", purpose: "", purposeCode: "", amount: "" },
    { recipientReference: makeRf("1234"), purpose: "dropped" },
    { recipientReference: "SI99", purpose: "" },
  ];
  it.each(variants.map((v, i) => [i, v] as const))("variant %i", (_i, v) => {
    const { payload, lines } = fromUpn(v);
    expect(payload.endsWith("\n")).toBe(false);
    expect(payload.split("\n").at(-1)).not.toBe("");
    expect(lines.at(-1)).not.toBe("");
    expect(payload).toBe(lines.join("\n"));
  });

  it("minimal payment ends at the IBAN line", () => {
    const { payload } = fromUpn({ recipientReference: "", purpose: "", purposeCode: "", amount: "" });
    expect(payload).toBe(["BCD", "002", "1", "SCT", "", "Novo podjetje d.o.o.", IBAN].join("\n"));
  });
});
