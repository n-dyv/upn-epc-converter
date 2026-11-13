// Write the generated fixtures to tests/fixtures/generated/ (for manual and browser testing).
// Run with: npm run fixtures
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BILLS, billText, buildMixedPng, buildMultiPdf, buildScreenshot, matrixPng, upnMatrix } from "../tests/fixtures/generate";

const out = join(import.meta.dirname, "..", "tests", "fixtures", "generated");
mkdirSync(out, { recursive: true });

writeFileSync(join(out, "multi-3-codes-2-pages.pdf"), await buildMultiPdf());
writeFileSync(join(out, "upn-plus-other-qr.png"), await buildMixedPng());
writeFileSync(join(out, "screenshot-bill.png"), await buildScreenshot("png"));
writeFileSync(join(out, "screenshot-bill.jpg"), await buildScreenshot("jpeg"));
for (const [i, bill] of BILLS.entries()) {
  writeFileSync(join(out, `upn-${bill.id}.png`), await matrixPng(await upnMatrix(billText(i), bill.eci), 6));
}
console.log(`Fixtures written to ${out}`);
