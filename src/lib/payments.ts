export interface MaterialItemLike {
  quantity: number;
  unitCost: number;
}

export function sumMaterials(items: MaterialItemLike[]): number {
  return items.reduce((s, i) => s + i.quantity * i.unitCost, 0);
}

export interface DepositCalcInput {
  quotedPrice: number | null;
  attachmentPreference: "client_provides" | "nessy_buys" | null;
  attachmentItems: MaterialItemLike[];
  accessoryItems: MaterialItemLike[];
  hairServiceCost: number | null;
}

/** Deposit = full materials cost + 50% of the hair service when Nessy buys attachments; otherwise the standard percentage of the quoted price. */
export function calculateDepositAmount(booking: DepositCalcInput, depositPercentage: number | null): number | null {
  if (booking.quotedPrice == null) return null;
  if (booking.attachmentPreference === "nessy_buys" && booking.hairServiceCost != null) {
    const materialsCost = sumMaterials(booking.attachmentItems) + sumMaterials(booking.accessoryItems);
    return Math.round(materialsCost + booking.hairServiceCost * 0.5);
  }
  if (depositPercentage != null) {
    return Math.round((booking.quotedPrice * depositPercentage) / 100);
  }
  return null;
}

/**
 * The remaining amount owed (before it's paid) or collected (once it is) — same
 * figure either way, just read before/after balance_paid_at is set. If a deposit
 * was never actually confirmed, nothing has been recorded as received yet, so the
 * full quoted price is still outstanding/counted as the balance.
 */
export function calculateBalanceAmount(
  booking: DepositCalcInput & { depositConfirmedAt: string | null },
  depositPercentage: number | null,
): number | null {
  if (booking.quotedPrice == null) return null;
  if (booking.depositConfirmedAt == null) return booking.quotedPrice;
  const deposit = calculateDepositAmount(booking, depositPercentage);
  if (deposit == null) return null;
  return booking.quotedPrice - deposit;
}
