// Copy the pdfjs decoder assets (wasm decoders, ICC profiles) into public/ so they are served locally.
import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const pdfjsRoot = dirname(require.resolve("pdfjs-dist/package.json"));
const target = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "pdfjs");

mkdirSync(target, { recursive: true });
for (const dir of ["wasm", "iccs"]) {
  cpSync(join(pdfjsRoot, dir), join(target, dir), { recursive: true });
}
console.log(`pdfjs assets copied to ${target}`);
