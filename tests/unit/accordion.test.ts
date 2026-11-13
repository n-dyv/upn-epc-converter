import { describe, expect, it } from "vitest";
import { ensureExpanded, firstUnpaid, nextUnpaidAfter } from "../../src/ui/accordion";

const items = (...paid: boolean[]) => paid.map((p, i) => ({ id: i + 1, paid: p }));

describe("accordion", () => {
  it("expands the first unpaid card by default", () => {
    expect(firstUnpaid(items(false, false))).toBe(1);
    expect(firstUnpaid(items(true, false))).toBe(2);
    expect(firstUnpaid(items(true, true))).toBeNull();
    expect(ensureExpanded(items(true, false, false), null)).toBe(2);
  });
  it("keeps a valid current choice when new cards arrive", () => {
    expect(ensureExpanded(items(false, false, false), 3)).toBe(3);
    expect(ensureExpanded(items(false), 7)).toBe(1);
  });
  it("ticking Paid moves to the next unpaid card, wrapping to earlier ones, else none", () => {
    expect(nextUnpaidAfter(items(true, false, false), 1)).toBe(2);
    expect(nextUnpaidAfter(items(false, true, true, false), 2)).toBe(4);
    expect(nextUnpaidAfter(items(false, true, true), 3)).toBe(1);
    expect(nextUnpaidAfter(items(true, true), 2)).toBeNull();
  });
});
