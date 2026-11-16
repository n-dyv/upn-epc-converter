import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Payment } from "../core/payment";
import { browserEnv } from "../scan/browser";
import { reportNotices } from "../scan/classify";
import { scanFile, type InputFile } from "../scan/pipeline";
import type { FileReport, Progress } from "../scan/types";
import { applyLang, CATALOGS, initialLang, LANGS, storeLang, type Lang } from "../i18n";
import { ensureExpanded, nextUnpaidAfter } from "./accordion";
import { AlertIcon, InfoIcon, LockIcon, LogoMark, MoonIcon, SunIcon, TrashIcon, UploadIcon } from "./icons";
import { applyTheme, readStoredTheme, storeTheme, systemTheme, type Theme } from "./theme";
import { PaymentCard, type CardState } from "./PaymentCard";

/** A file that produced notices. The report is kept (not the text) so notices follow a language switch. */
interface FileNotice {
  id: number;
  report: FileReport;
}

const ACCEPT = ".pdf,application/pdf,image/png,image/jpeg,image/webp";

export function App() {
  const env = useMemo(() => browserEnv(), []);
  const [cards, setCards] = useState<CardState[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [notices, setNotices] = useState<FileNotice[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [queued, setQueued] = useState(0);
  const [dragging, setDragging] = useState(false);
  const nextId = useRef(1);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const generation = useRef(0); // bumped by "Clear all" so in-flight results are dropped
  const fileInput = useRef<HTMLInputElement>(null);

  // Interface language: a stored choice wins; otherwise the browser language (see src/i18n).
  const [lang, setLang] = useState<Lang>(initialLang);
  const m = CATALOGS[lang];
  useEffect(() => applyLang(lang), [lang]);
  const chooseLang = (next: Lang) => {
    setLang(next);
    storeLang(next);
  };
  // Pasted images are named when they arrive; read the current catalog through a ref so the
  // paste listener does not need re-registering on every language switch.
  const messagesRef = useRef(m);
  messagesRef.current = m;

  const enqueue = useCallback(
    (files: InputFile[]) => {
      if (files.length === 0) return;
      const gen = generation.current;
      setQueued((q) => q + files.length);
      for (const file of files) {
        queue.current = queue.current.then(async () => {
          if (gen !== generation.current) return;
          setProgress({ fileName: file.name });
          const report = await scanFile(file, env, (p) => gen === generation.current && setProgress(p));
          setQueued((q) => Math.max(0, q - 1));
          if (gen !== generation.current) return;
          const newCards: CardState[] = report.found.map((found) => ({
            id: nextId.current++,
            found,
            payment: found.conversion.payment,
            paid: false,
          }));
          if (newCards.length) setCards((prev) => [...prev, ...newCards]);
          if (reportNotices(report).length) setNotices((n) => [...n, { id: nextId.current++, report }]);
        });
      }
      queue.current = queue.current.then(() => {
        if (gen === generation.current) setProgress(null);
      });
    },
    [env],
  );

  const fromFileList = (list: FileList | File[], pasted = false): InputFile[] =>
    Array.from(list).map((f, i) => ({
      name: pasted ? messagesRef.current.pastedImage(list.length > 1 ? i + 1 : undefined) : f.name,
      type: f.type,
      data: f,
    }));

  // Light/dark: a stored choice wins; otherwise follow the system (and keep the icon in sync with it).
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme() ?? systemTheme());
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (!readStoredTheme()) setTheme(mq.matches ? "dark" : "light");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    storeTheme(next);
  };

  // When new cards arrive, make sure one is expanded (the current one, else the first unpaid).
  const cardCount = useRef(0);
  useEffect(() => {
    if (cards.length > cardCount.current) setExpanded((cur) => ensureExpanded(cards, cur));
    cardCount.current = cards.length;
  }, [cards]);

  // Paste anywhere: only image data is handled; text paste into form fields keeps working.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (files.length === 0) return;
      e.preventDefault();
      enqueue(fromFileList(files, true));
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [enqueue]);

  // Drag and drop anywhere on the window.
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragging(true);
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      enqueue(fromFileList(e.dataTransfer!.files));
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [enqueue]);

  const updatePayment = (id: number, payment: Payment) =>
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, payment } : c)));

  const setPaid = (id: number, paid: boolean) => {
    const updated = cards.map((c) => (c.id === id ? { ...c, paid } : c));
    setCards(updated);
    if (paid && expanded === id) setExpanded(nextUnpaidAfter(updated, id));
  };

  const clearAll = () => {
    generation.current++;
    setCards([]);
    setNotices([]);
    setExpanded(null);
    setProgress(null);
    setQueued(0);
  };

  const busy = progress !== null;

  return (
    <div className="app">
      <header className="app-head">
        <div className="brand">
          <LogoMark />
          <div>
            <h1>UPN → EPC QR</h1>
            <p>{m.tagline}</p>
          </div>
        </div>
        <div className="head-actions">
          <p className="privacy"><LockIcon size={15} /> {m.privacy}</p>
          <div className="lang-switch" role="group" aria-label={m.language} data-testid="lang-switch">
            {LANGS.map((l) => (
              <button
                key={l}
                type="button"
                lang={CATALOGS[l].htmlLang}
                aria-pressed={lang === l}
                title={l === "sl" ? "Slovenščina" : "English"}
                onClick={() => chooseLang(l)}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? m.toLight : m.toDark}
            title={theme === "dark" ? m.toLight : m.toDark}
            data-testid="theme-toggle"
          >
            {theme === "dark" ? <SunIcon size={18} /> : <MoonIcon size={18} />}
          </button>
        </div>
      </header>

      <section className={`dropzone${dragging ? " dragging" : ""}${cards.length ? " compact" : ""}`} data-testid="dropzone">
        <span className="drop-icon" aria-hidden="true"><UploadIcon size={cards.length ? 22 : 28} /></span>
        <div className="drop-text">
          <p className="drop-title">
            <span className="when-pointer">{m.dropHere}</span>
            <span className="when-touch">{m.addBill}</span>
          </p>
          <p className="drop-sub">{m.dropFormats}</p>
        </div>
        <button type="button" className="primary" onClick={() => fileInput.current?.click()}>
          {m.chooseFiles}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          data-testid="file-input"
          onChange={(e) => {
            if (e.target.files) enqueue(fromFileList(e.target.files));
            e.target.value = "";
          }}
        />
        <p className="hint">{m.pasteHint} (<kbd>Ctrl</kbd>/<kbd>Cmd</kbd>+<kbd>V</kbd>)</p>
        {busy && (
          <p className="progress" role="status" data-testid="progress">
            <span className="spinner" aria-hidden="true" />
            {m.progress(progress.fileName, progress.page, progress.pageCount, queued - 1)}
          </p>
        )}
      </section>

      {dragging && (
        <div className="drag-overlay">
          <div><UploadIcon size={40} /><p>{m.dropOverlay}</p></div>
        </div>
      )}

      {cards.length === 0 && !busy && (
        <ol className="steps">
          <li>
            <b>{m.stepAdd}</b>
            <span>
              <span className="when-pointer">{m.stepAddPointer}</span>
              <span className="when-touch">{m.stepAddTouch}</span>
            </span>
          </li>
          <li><b>{m.stepCheck}</b><span>{m.stepCheckText}</span></li>
          <li><b>{m.stepScan}</b><span>{m.stepScanText}</span></li>
        </ol>
      )}

      {notices.length > 0 && (
        <section className="notices" data-testid="notices">
          {notices.map((n) => (
            <div key={n.id} className="notice">
              <InfoIcon size={18} />
              <div>
                {reportNotices(n.report, m).map((text, i) => (
                  <p key={i}>{text}</p>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {cards.length > 0 && (
        <h2 className="cards-title">
          {m.payments} <span>{m.paymentsCount(cards.filter((c) => !c.paid).length, cards.length)}</span>
        </h2>
      )}

      <section className="cards">
        {cards.map((card) => (
          <PaymentCard
            key={card.id}
            card={card}
            expanded={expanded === card.id}
            onToggle={() => setExpanded((cur) => (cur === card.id ? null : card.id))}
            onChange={(p) => updatePayment(card.id, p)}
            onPaid={(paid) => setPaid(card.id, paid)}
            m={m}
          />
        ))}
      </section>

      <footer className="app-foot">
        <p><AlertIcon size={16} /> {m.footerWarning}</p>
        <button type="button" className="ghost" onClick={clearAll} disabled={cards.length === 0 && notices.length === 0}>
          <TrashIcon size={16} /> {m.clearAll}
        </button>
      </footer>
    </div>
  );
}
