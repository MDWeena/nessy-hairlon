import { useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { GoldSpinner } from "../ui/GoldSpinner";
import { ProductCostField } from "./ProductCostField";

interface MarkCompletedPanelProps {
  clientName: string;
  hasEmail: boolean;
  /** Balance marked paid (or nothing owed); otherwise a warning shows before confirming. */
  balancePaid: boolean;
  busy: boolean;
  /** Current product cost (null = not entered) and the category's typical cost, for the field. */
  productCost?: number | null;
  typicalProductCost?: number | null;
  category?: string | null;
  /**
   * Set for a past booking that was never confirmed ("quoted" / "deposit_paid"): offers "Client paid
   * in full on the day" (ticked by default) and passes the choice as onConfirm's third argument.
   */
  unconfirmed?: { status: "quoted" | "deposit_paid"; fullPrice: number | null };
  onConfirm: (sendThankYou: boolean, productCost: number | null, paidInFull?: boolean) => void;
  onCancel: () => void;
}

/** In-page confirmation for "Mark Completed" (no browser confirm()). */
export function MarkCompletedPanel({
  clientName, hasEmail, balancePaid, busy, productCost = null, typicalProductCost = null, category = null, unconfirmed, onConfirm, onCancel,
}: MarkCompletedPanelProps) {
  const [sendThankYou, setSendThankYou] = useState(true);
  const [paidInFull, setPaidInFull] = useState(true);
  const price = unconfirmed?.fullPrice ?? null;
  const naira = (n: number) => `₦${n.toLocaleString()}`;
  // Adjust to what was actually used; prefilled from the quote, else the category's typical cost.
  const [cost, setCost] = useState<number | null>(productCost ?? typicalProductCost);

  return (
    <div data-testid="mark-completed-panel" className="mt-3 pt-3 border-t border-border grid gap-3">
      <p className="text-[13px] font-semibold m-0">Mark {clientName}'s appointment as completed?</p>
      {unconfirmed && (
        <div className="grid gap-1.5">
          <label className="flex items-center gap-2.5 text-xs text-text cursor-pointer min-h-11 md:min-h-0">
            <input
              type="checkbox" checked={paidInFull && price != null} disabled={price == null} onChange={(e) => setPaidInFull(e.target.checked)}
              className="w-4 h-4 accent-[#C49A6C] shrink-0"
            />
            <span>Client paid in full on the day{price != null ? ` (${naira(price)})` : ""}</span>
          </label>
          <p data-testid="paid-in-full-hint" className="m-0 text-[11px] text-text-muted">
            {price == null
              ? "No price set yet, so no payment can be recorded — set a price first, or complete it with nothing paid."
              : paidInFull
                ? `Records ${naira(price)} as received today in Finances and completes the booking — no deposit step needed.`
                : `Completes the booking with ${naira(price)} still owed. You can mark the balance paid later.`}
          </p>
          {unconfirmed.status === "deposit_paid" && paidInFull && (
            <p className="m-0 text-[11px] text-[#B45309]">The client said they paid a deposit earlier. If they did, use ⋯ → Verify deposit payment first, so it isn't counted twice.</p>
          )}
        </div>
      )}
      {!unconfirmed && !balancePaid && (
        <p role="alert" className="m-0 flex items-start gap-2 text-xs text-[#B45309] bg-[#F59E0B15] border border-[#F59E0B40] rounded-md py-2 px-2.5">
          <AlertTriangle size={14} className="shrink-0 mt-px" /> Balance not marked as paid. Mark completed anyway?
        </p>
      )}
      <ProductCostField value={cost} onChange={setCost} typical={typicalProductCost} category={category} label="Products used" />
      {hasEmail ? (
        <label className="flex items-center gap-2.5 text-xs text-text-soft cursor-pointer min-h-11 md:min-h-0">
          <input
            type="checkbox" checked={sendThankYou} onChange={(e) => setSendThankYou(e.target.checked)}
            className="w-4 h-4 accent-[#C49A6C] shrink-0"
          />
          Send thank-you email (with a link to leave a review)
        </label>
      ) : (
        <p className="m-0 text-xs text-text-muted">No email on file, so no thank-you email will be sent.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onCancel} disabled={busy}
          className="flex-1 basis-[120px] min-h-11 md:flex-none md:basis-auto md:min-h-0 bg-transparent border border-border rounded-md py-1.5 px-3 text-xs text-text-soft cursor-pointer"
        >Cancel</button>
        <button
          onClick={() => unconfirmed
            ? onConfirm(hasEmail && sendThankYou, cost, paidInFull && price != null)
            : onConfirm(hasEmail && sendThankYou, cost)} disabled={busy}
          className={`flex-1 basis-[120px] min-h-11 md:flex-none md:basis-auto md:min-h-0 bg-gold text-theme-black border-none py-1.5 px-3.5 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 ${busy ? "cursor-wait" : "cursor-pointer"}`}
        >
          {busy ? <GoldSpinner size={12} color="#0A0A0A" /> : <CheckCircle2 size={13} />}
          {busy ? "Saving…" : "Mark Completed"}
        </button>
      </div>
    </div>
  );
}
