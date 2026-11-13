import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";

/** Full Content Security Policy for the built app (spec section 10: connect-src 'self'). */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self'",
  "connect-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join("; ");

function cspMeta(): Plugin {
  return {
    name: "csp-meta",
    apply: "build",
    transformIndexHtml: () => [
      { tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: CSP }, injectTo: "head-prepend" },
    ],
  };
}

export default defineConfig({
  // Relative base so the built dist/ works from any static server path.
  base: "./",
  plugins: [react(), cspMeta()],
  build: { chunkSizeWarningLimit: 2000 }, // pdfjs + zxing are large by nature; everything is local
  server: {
    // The dev server needs React Refresh's inline script, so only the network rule is enforced in dev.
    headers: { "Content-Security-Policy": "connect-src 'self'" },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
