import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import { warmUp } from "./scan/browser";
import { applyTheme, readStoredTheme } from "./ui/theme";
import { applyLang, initialLang } from "./i18n";
import "./ui/styles.css";

// Apply a remembered light/dark choice before the first render (no stored choice = follow the system).
applyTheme(readStoredTheme());
// Same for the language (no stored choice = the browser language): sets <html lang> and the title.
applyLang(initialLang());

// Load the decoder .wasm and the PDF worker during page load, from the local bundle.
void warmUp();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
