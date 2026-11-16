import { describe, expect, it } from "vitest";
import { CATALOGS, en, sl } from "../../src/i18n";
import { pluralSl } from "../../src/i18n/sl";
import { reportNotices } from "../../src/scan/classify";
import type { FileReport } from "../../src/scan/types";

const report = (over: Partial<FileReport>): FileReport => ({
  fileName: "racun.pdf", found: [], broken: [], otherCount: 0, duplicateCount: 0, anySymbol: true, ...over,
});

describe("message catalogs", () => {
  it("Slovenian has the same keys as English, with no empty strings", () => {
    expect(Object.keys(sl).sort()).toEqual(Object.keys(en).sort());
    expect(Object.keys(sl.issues).sort()).toEqual(Object.keys(en.issues).sort());
    expect(sl.upnFields).toHaveLength(en.upnFields.length);
    for (const c of Object.values(CATALOGS)) {
      for (const v of Object.values(c)) if (typeof v === "string") expect(v).not.toBe("");
      for (const v of Object.values(c.issues)) expect(v).not.toBe("");
    }
  });

  it("formats amounts per language", () => {
    expect(en.formatAmount(126874)).toBe("1,268.74 EUR");
    expect(sl.formatAmount(126874)).toBe("1.268,74 EUR");
    expect(sl.formatAmount(8105)).toBe("81,05 EUR");
    expect(sl.formatAmount(99_999_999_999)).toBe("999.999.999,99 EUR");
  });
});

describe("Slovenian plurals", () => {
  it.each([
    [1, "a"], [2, "b"], [3, "c"], [4, "c"], [5, "d"], [11, "d"], [12, "d"], [0, "d"],
    [101, "a"], [102, "b"], [103, "c"], [111, "d"],
  ] as [number, string][])("%i → %s", (n, form) => {
    expect(pluralSl(n, "a", "b", "c", "d")).toBe(form);
  });

  it("notices use the right form", () => {
    expect(reportNotices(report({ found: [{} as never], otherCount: 1, duplicateCount: 2 }), sl)).toEqual([
      "1 druga koda QR je bila prezrta.",
      "2 podvojeni kodi sta bili preskočeni.",
    ]);
    expect(reportNotices(report({ found: [{} as never], otherCount: 3, duplicateCount: 5 }), sl)).toEqual([
      "3 druge kode QR so bile prezrte.",
      "5 podvojenih kod je bilo preskočenih.",
    ]);
  });
});

describe("notices in both languages", () => {
  it("broken and missing UPN codes", () => {
    const r = report({ broken: [{ source: { fileName: "racun.pdf", page: 2 }, error: "too-few-fields", fieldCount: 7 }] });
    expect(reportNotices(r)).toEqual(["racun.pdf, page 2: This UPN QR code is incomplete (7 of 20 fields)."]);
    expect(reportNotices(r, sl)).toEqual(["racun.pdf, stran 2: Ta koda UPN QR je nepopolna (7 od 20 polj)."]);
    expect(reportNotices(report({ otherCount: 1 }), sl)[0]).toBe("V datoteki racun.pdf ni bilo mogoče najti plačilne kode UPN.");
  });
});
