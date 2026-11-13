// ISO 7064 MOD 97-10, shared by IBAN (ISO 13616) and RF creditor reference (ISO 11649).

/** Replace letters A–Z with 10–35, leave digits. Input must be [0-9A-Z]. */
function toDigits(s: string): string {
  let out = "";
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    out += c >= 65 && c <= 90 ? String(c - 55) : ch;
  }
  return out;
}

/** Remainder of the alphanumeric string (after letter substitution) modulo 97, in chunks to stay in safe integers. */
export function mod97(alnum: string): number {
  const digits = toDigits(alnum);
  let rem = 0;
  for (let i = 0; i < digits.length; i += 7) {
    rem = Number(String(rem) + digits.slice(i, i + 7)) % 97;
  }
  return rem;
}

/** Check: move the first four characters to the end; the result mod 97 must be 1. */
export function passesMod97(code: string): boolean {
  return mod97(code.slice(4) + code.slice(0, 4)) === 1;
}
