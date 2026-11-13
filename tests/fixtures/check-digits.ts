// Independent ISO 7064 MOD 97-10 check-digit computation with BigInt, so tests do not trust src/core/mod97.

function numeric(s: string): bigint {
  return BigInt([...s].map((c) => parseInt(c, 36)).join(""));
}

/** IBAN with correct check digits for country + BBAN. */
export function makeIban(country: string, bban: string): string {
  const check = 98n - (numeric(bban + country + "00") % 97n);
  return country + String(check).padStart(2, "0") + bban;
}

/** ISO 11649 RF reference with correct check digits for the given body. */
export function makeRf(body: string): string {
  const check = 98n - (numeric(body + "RF00") % 97n);
  return "RF" + String(check).padStart(2, "0") + body;
}

/** Same code with check digits changed so that it is guaranteed to fail. */
export function breakCheckDigits(code: string): string {
  const cd = Number(code.slice(2, 4));
  return code.slice(0, 2) + String((cd + 1) % 100).padStart(2, "0") + code.slice(4);
}
