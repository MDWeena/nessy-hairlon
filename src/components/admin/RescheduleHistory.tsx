import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { formatSlot } from "../../lib/reschedule";
import type { Database } from "../../types/database";

type RescheduleRow = Database["public"]["Tables"]["booking_reschedules"]["Row"];

/** Past moves for one booking, newest first, from booking_reschedules (admin-readable only).
 * `refreshKey` lets the parent force a reload right after a new reschedule. */
export function RescheduleHistory({ bookingId, refreshKey = 0 }: { bookingId: string; refreshKey?: number }) {
  const [rows, setRows] = useState<RescheduleRow[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.from("booking_reschedules").select("*").eq("booking_id", bookingId).order("created_at", { ascending: false })
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError) { setError(true); return; }
        setRows(data ?? []);
      });
    return () => { cancelled = true; };
  }, [bookingId, refreshKey]);

  if (error) return <p className="text-[11px] text-text-muted m-0">Couldn't load reschedule history.</p>;
  if (!rows) return <p className="text-[11px] text-text-muted m-0">Loading history…</p>;
  if (rows.length === 0) return <p className="text-[11px] text-text-muted m-0">Never rescheduled.</p>;

  return (
    <ul className="list-none m-0 p-0 grid gap-1.5">
      {rows.map(r => (
        <li key={r.id} className="text-[11px] text-text-soft leading-[1.5]">
          <span className="text-text-muted">{new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>{" "}
          <span className={`font-semibold ${r.rescheduled_by === "admin" ? "text-gold" : "text-text"}`}>
            {r.rescheduled_by === "admin" ? "You" : "Client"}
          </span>{" "}
          moved {formatSlot(r.old_date, r.old_start_time)} → <strong className="text-text">{formatSlot(r.new_date, r.new_start_time)}</strong>
          {r.reason && <span className="italic"> — "{r.reason}"</span>}
        </li>
      ))}
    </ul>
  );
}
