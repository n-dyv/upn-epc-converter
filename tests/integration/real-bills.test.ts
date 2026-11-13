// Runs every file in tests/fixtures/real/ (git-ignored, supplied by the product owner) through the pipeline.
// Skipped when the folder is absent or empty. Prints one line per file and fails for files without a UPN code.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildEpc } from "../../src/core/epc";
import { reportNotices, sourceLabel } from "../../src/scan/classify";
import { scanFile } from "../../src/scan/pipeline";
import { fileOf, nodeEnv } from "./node-env";

const dir = join(import.meta.dirname, "..", "fixtures", "real");
const files = existsSync(dir) ? readdirSync(dir).filter((f) => /\.(pdf|png|jpe?g|webp)$/i.test(f)).sort() : [];

describe.skipIf(files.length === 0)("real bills in tests/fixtures/real/", () => {
  it.each(files)("%s", async (name) => {
    const report = await scanFile(fileOf(name, readFileSync(join(dir, name))), nodeEnv);
    const lines = report.found.map((f) => {
      const epc = buildEpc(f.conversion.payment);
      const status = epc.ok
        ? `EPC ok${epc.warnings.length ? ` (warnings: ${epc.warnings.map((w) => w.code).join(", ")})` : ""}`
        : `EPC errors: ${epc.errors.map((e) => e.code).join(", ")}`;
      const pw = f.parseWarnings.map((w) => w.code).join(", ");
      return `  ${sourceLabel(f.source)}: ${f.fields.recipientName} | ${f.fields.amount} | ECI ${f.eci ?? "none"} → ${f.charset} | ${status}${pw ? ` | parse: ${pw}` : ""}`;
    });
    console.log([`${name}: ${report.found.length} UPN code(s)`, ...lines, ...reportNotices(report).map((n) => `  note: ${n}`)].join("\n"));
    expect(report.error).toBeUndefined();
    expect(report.found.length).toBeGreaterThan(0);
  }, 120_000);
});
