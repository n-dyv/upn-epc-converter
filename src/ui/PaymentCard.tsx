import { useMemo, useState, type ReactNode } from "react";
import { buildEpc } from "../core/epc";
import { normalizeIban } from "../core/iban";
import type { Issue, PaymentField } from "../core/issues";
import { displayAmount, parseAmount, type Payment } from "../core/payment";
import { isValidRf, normalizeReference } from "../core/rf";
import { UPN_FIELD_ORDER } from "../core/upn";
import { sourceLabel } from "../scan/classify";
import type { FoundUpn } from "../scan/types";
import { EpcCode, drawMatrix } from "./EpcCode";
import { AlertIcon, CheckIcon, ChevronIcon, CopyIcon, DownloadIcon, FileIcon, InfoIcon, ScanIcon } from "./icons";
import { epcQrMatrix } from "./qr";

export interface CardState {
  id: number;
  found: FoundUpn;
  payment: Payment;
  paid: boolean;
}

interface Props {
  card: CardState;
  expanded: boolean;
  onToggle(): void;
  onChange(payment: Payment): void;
  onPaid(paid: boolean): void;
}

const UPN_FIELD_LABELS = [
  "Leading style", "Payer IBAN", "Deposit", "Withdrawal", "Payer reference", "Payer name", "Payer street",
  "Payer city", "Amount", "Payment date", "Urgent", "Purpose code", "Purpose", "Payment deadline",
  "Recipient IBAN", "Recipient reference", "Recipient name", "Recipient street", "Recipient city", "Control sum",
];

function IssueList({ issues, kind }: { issues: Issue[]; kind: "error" | "warning" }) {
  if (issues.length === 0) return null;
  return (
    <ul className={`issues ${kind}`}>
      {issues.map((i, n) => (
        <li key={n} data-code={i.code}>
          {kind === "error" ? <AlertIcon size={15} /> : <InfoIcon size={15} />}
          <span>{i.message}</span>
        </li>
      ))}
    </ul>
  );
}

function Field(props: {
  label: string;
  field: PaymentField;
  errors: Issue[];
  warnings: Issue[];
  suffix?: string;
  className?: string;
  children: ReactNode;
}) {
  const errs = props.errors.filter((e) => e.field === props.field);
  const warns = props.warnings.filter((w) => w.field === props.field);
  return (
    <div className={`field${errs.length ? " has-error" : ""}${props.className ? ` ${props.className}` : ""}`}>
      <label>
        <span className="field-label">{props.label}</span>
        <span className={`control${props.suffix ? " with-suffix" : ""}`}>
          {props.children}
          {props.suffix && <span className="suffix" aria-hidden="true">{props.suffix}</span>}
        </span>
      </label>
      <IssueList issues={errs} kind="error" />
      <IssueList issues={warns} kind="warning" />
    </div>
  );
}

function slug(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "payment";
}

const groupIban = (iban: string) => normalizeIban(iban).replace(/(.{4})/g, "$1 ").trim();

export function PaymentCard({ card, expanded, onToggle, onChange, onPaid }: Props) {
  const { payment, found, paid } = card;
  const epc = useMemo(() => buildEpc(payment), [payment]);
  const [copied, setCopied] = useState(false);

  const errors = epc.ok ? [] : epc.errors;
  const fieldWarnings = epc.warnings;
  const cardWarnings: Issue[] = [
    ...found.parseWarnings,
    ...found.conversion.warnings,
    ...epc.warnings.filter((w) => !w.field),
  ];

  const amount = parseAmount(payment.amount);
  const amountLabel = amount.kind === "cents" ? displayAmount(amount.cents) : amount.kind === "none" ? "Amount not set" : "Invalid amount";
  const name = payment.name.trim() || "(no recipient name)";
  const initial = (payment.name.trim()[0] ?? "?").toUpperCase();
  const rfAvailable = isValidRf(normalizeReference(payment.reference));
  const effectiveMode = rfAvailable && payment.mode === "structured" ? "structured" : "text";
  const set = <K extends keyof Payment>(k: K, v: Payment[K]) => onChange({ ...payment, [k]: v });
  const d = found.conversion.details;
  const status = paid ? "paid" : epc.ok ? "ready" : "error";

  const downloadPng = () => {
    if (!epc.ok) return;
    const canvas = document.createElement("canvas");
    drawMatrix(canvas, epcQrMatrix(epc.payload), 12);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `epc-qr-${slug(payment.name)}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  };

  const copyText = async () => {
    if (!epc.ok) return;
    await navigator.clipboard.writeText(epc.payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <article className={`card${expanded ? " expanded" : ""}${paid ? " paid" : ""}`} data-testid="payment-card">
      <header className="card-head">
        <button type="button" className="card-toggle" onClick={onToggle} aria-expanded={expanded}>
          <span className="chevron" aria-hidden="true"><ChevronIcon size={16} /></span>
          <span className="avatar" aria-hidden="true">{initial}</span>
          <span className="card-titles">
            <span className="card-title">{name}</span>
            <span className="card-source"><FileIcon size={13} /> {sourceLabel(found.source)}</span>
          </span>
          <span className={`card-amount${amount.kind === "cents" ? "" : " muted"}`}>{amountLabel}</span>
          {status !== "paid" && (
            <span className={`pill ${status}`}>{status === "ready" ? "Ready" : `${errors.length} to fix`}</span>
          )}
        </button>
        <label className="switch">
          <input type="checkbox" checked={paid} onChange={(e) => onPaid(e.target.checked)} />
          <span className="track" aria-hidden="true"><span className="thumb" /></span>
          Paid
        </label>
      </header>

      {expanded && (
        <div className="card-body">
          <div className="card-main">
            <form className="review" onSubmit={(e) => e.preventDefault()}>
              <fieldset className="group">
                <legend>Recipient</legend>
                <Field label="Recipient name" field="name" errors={errors} warnings={fieldWarnings}>
                  <input value={payment.name} onChange={(e) => set("name", e.target.value)} />
                </Field>
                <Field label="IBAN" field="iban" errors={errors} warnings={fieldWarnings} className="mono">
                  <input value={payment.iban} spellCheck={false} onChange={(e) => set("iban", e.target.value)} />
                </Field>
              </fieldset>

              <fieldset className="group">
                <legend>Payment</legend>
                <div className="row">
                  <Field label="Amount" field="amount" errors={errors} warnings={fieldWarnings} suffix="EUR">
                    <input value={payment.amount} inputMode="decimal" placeholder="not set" onChange={(e) => set("amount", e.target.value)} />
                  </Field>
                  <Field label="Purpose code" field="purposeCode" errors={errors} warnings={fieldWarnings} className="mono">
                    <input value={payment.purposeCode} maxLength={4} spellCheck={false} onChange={(e) => set("purposeCode", e.target.value)} />
                  </Field>
                </div>
              </fieldset>

              <fieldset className="group">
                <legend>Reference</legend>
                <div className="segmented" role="radiogroup" aria-label="Remittance">
                  <label className={rfAvailable ? "" : "disabled"} title={rfAvailable ? undefined : "Only a valid RF reference can be sent as a structured reference."}>
                    <input type="radio" name={`mode-${card.id}`} disabled={!rfAvailable} checked={effectiveMode === "structured"} onChange={() => set("mode", "structured")} />
                    <span>Structured reference (RF)</span>
                  </label>
                  <label>
                    <input type="radio" name={`mode-${card.id}`} checked={effectiveMode === "text"} onChange={() => set("mode", "text")} />
                    <span>Free text</span>
                  </label>
                </div>
                <Field label="Reference" field="reference" errors={errors} warnings={fieldWarnings} className="mono">
                  <input value={payment.reference} spellCheck={false} onChange={(e) => set("reference", e.target.value)} />
                </Field>
                <Field label="Free text (purpose)" field="text" errors={errors} warnings={fieldWarnings}>
                  <input value={payment.text} onChange={(e) => set("text", e.target.value)} />
                </Field>
              </fieldset>
            </form>

            <section className="from-bill">
              <h4>Also on the bill <span>(not sent to the bank)</span></h4>
              <dl>
                <dt>Payer</dt><dd>{d.payerName || "—"}</dd>
                <dt>Recipient address</dt><dd>{d.recipientAddress || "—"}</dd>
                <dt>Due date</dt><dd>{d.dueDate || "—"}</dd>
                <dt>Payer reference</dt><dd>{d.payerReference || "—"}</dd>
              </dl>
            </section>
            <IssueList issues={cardWarnings} kind="warning" />
          </div>

          <aside className="card-code">
            {epc.ok ? (
              <>
                <p className="scan-caption"><ScanIcon size={16} /> Scan with your banking app</p>
                <div className="code-frame">
                  <EpcCode payload={epc.payload} label={`EPC QR code for ${name}`} />
                </div>
                <dl className="summary">
                  <dt>To</dt><dd>{epc.lines[5]}</dd>
                  <dt>IBAN</dt><dd className="mono">{groupIban(epc.lines[6] ?? "")}</dd>
                  <dt>Amount</dt><dd>{amount.kind === "cents" ? displayAmount(amount.cents) : <em>enter in your bank app</em>}</dd>
                  <dt>Reference</dt>
                  <dd className="sent-as">
                    {epc.lines[9] ? <code>{epc.lines[9]}</code> : epc.lines[10] ? <code>{epc.lines[10]}</code> : <em>none</em>}
                  </dd>
                </dl>
                <div className="buttons">
                  <button type="button" onClick={downloadPng}><DownloadIcon size={16} /> Download PNG</button>
                  <button type="button" onClick={copyText}>
                    {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />} {copied ? "Copied" : "Copy EPC text"}
                  </button>
                </div>
              </>
            ) : (
              <div className="code-errors" data-testid="code-errors">
                <p><AlertIcon size={18} /> Fix these to get the QR code:</p>
                <IssueList issues={errors} kind="error" />
              </div>
            )}
          </aside>

          <details className="technical">
            <summary>Technical details</summary>
            <div className="tech-cols">
              <div>
                <h4>Decoded UPN ({found.charset}{found.eci !== undefined ? `, ECI ${found.eci}` : ", no ECI"})</h4>
                <ol className="upn-lines">
                  {UPN_FIELD_ORDER.map((_, i) => (
                    <li key={i}><span className="k">{UPN_FIELD_LABELS[i]}</span> <code>{found.lines[i] ?? ""}</code></li>
                  ))}
                </ol>
              </div>
              <div>
                <h4>EPC payload</h4>
                {epc.ok ? <pre className="epc-payload">{epc.payload.split("\n").map((l, i) => `${String(i + 1).padStart(2)}  ${l}`).join("\n")}</pre> : <p>Not available while errors are present.</p>}
              </div>
            </div>
          </details>
        </div>
      )}
    </article>
  );
}
