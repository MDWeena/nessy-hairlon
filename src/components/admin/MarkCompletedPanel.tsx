import { useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { GoldSpinner } from "../ui/GoldSpinner";

interface MarkCompletedPanelProps {
  clientName: string;
  hasEmail: boolean;
  /** Balance marked paid (or nothing owed); otherwise a warning shows before confirming. */
  balancePaid: boolean;
  busy: boolean;
  onConfirm: (sendThankYou: boolean) => void;
  onCancel: () => void;
}

/** In-page confirmation for "Mark Completed" (no browser confirm()). */
export function MarkCompletedPanel({ clientName, hasEmail, balancePaid, busy, onConfirm, onCancel }: MarkCompletedPanelProps) {
  const [sendThankYou, setSendThankYou] = useState(true);

  return (
    <div data-testid="mark-completed-panel" className="mt-3 pt-3 border-t border-border grid gap-3">
      <p className="text-[13px] font-semibold m-0">Mark {clientName}'s appointment as completed?</p>
      {!balancePaid && (
        <p role="alert" className="m-0 flex items-start gap-2 text-xs text-[#B45309] bg-[#F59E0B15] border border-[#F59E0B40] rounded-md py-2 px-2.5">
          <AlertTriangle size={14} className="shrink-0 mt-px" /> Balance not marked as paid. Mark completed anyway?
        </p>
      )}
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
          onClick={() => onConfirm(hasEmail && sendThankYou)} disabled={busy}
          className={`flex-1 basis-[120px] min-h-11 md:flex-none md:basis-auto md:min-h-0 bg-gold text-theme-black border-none py-1.5 px-3.5 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 ${busy ? "cursor-wait" : "cursor-pointer"}`}
        >
          {busy ? <GoldSpinner size={12} color="#0A0A0A" /> : <CheckCircle2 size={13} />}
          {busy ? "Saving…" : "Mark Completed"}
        </button>
      </div>
    </div>
  );
}
