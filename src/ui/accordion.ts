// Accordion rules (spec section 9): one expanded card at a time; first unpaid by default;
// ticking "Paid" moves on to the next unpaid card.

export interface AccordionItem {
  id: number;
  paid: boolean;
}

export function firstUnpaid(items: AccordionItem[]): number | null {
  return items.find((c) => !c.paid)?.id ?? null;
}

/** After `paidId` was ticked: the next unpaid card after it, else the first unpaid before it, else none. */
export function nextUnpaidAfter(items: AccordionItem[], paidId: number): number | null {
  const i = items.findIndex((c) => c.id === paidId);
  const after = items.slice(i + 1).find((c) => !c.paid);
  return after?.id ?? firstUnpaid(items);
}

/** Keep the current choice if it still exists; otherwise fall back to the first unpaid card. */
export function ensureExpanded(items: AccordionItem[], current: number | null): number | null {
  if (current !== null && items.some((c) => c.id === current)) return current;
  return firstUnpaid(items);
}
