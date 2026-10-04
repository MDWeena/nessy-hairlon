import { useCallback, useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { supabase } from "../../lib/supabase";
import { toISODateString, addDays } from "../../lib/date";
import { useAvailability, formatHourLabel, hourFromLabel } from "../../hooks/useAvailability";
import type { AvailabilityDay, AvailabilitySlot } from "../../hooks/useAvailability";
import { LoadingNotice } from "../ui/LoadingNotice";
import { ErrorNotice } from "../ui/ErrorNotice";

const HOUR_OPTIONS = Array.from({ length: 22 - 6 + 1 }, (_, i) => i + 6); // 6 AM .. 10 PM
const DAYS_AHEAD = 14;

/** All four states are static colors (the "booked" state's theme tokens map onto existing Tailwind classes), so the whole slot button is expressible as classes — no inline style needed. */
function slotStateClasses(slot: AvailabilitySlot): string {
  if (slot.isBlockedByGap) return "bg-[#E5E7EB40] border-[#D1D5DB] text-[#6B7280]";
  if (slot.isBlocked) return "bg-[#FEE2E220] border-[#FCA5A5] text-[#DC2626]";
  if (slot.isBooked) return "bg-gold-bg border-gold text-gold";
  return "bg-[#D1FAE520] border-[#D1FAE5] text-[#065F46]";
}

export function Availability() {
  const { t } = useTheme();
  const { days, loading, error, blockDay, unblockDay, blockSlot, unblockSlot, openDay, closeDay } = useAvailability(DAYS_AHEAD);
  const [weekOffset, setWeekOffset] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [openingDayKey, setOpeningDayKey] = useState<string | null>(null);
  const [openStartHour, setOpenStartHour] = useState(9);
  const [openEndHour, setOpenEndHour] = useState(17);
  // "date-hour" -> client name. Admin-only (authenticated session has full SELECT on
  // bookings), kept separate from useAvailability so that hook stays anon-safe/shared
  // with the public booking flow, which must never see client PII.
  const [clientNamesByHour, setClientNamesByHour] = useState<Map<string, string>>(new Map());

  const fetchClientNames = useCallback(async () => {
    const today = new Date();
    const rangeStart = toISODateString(today);
    const rangeEnd = toISODateString(addDays(today, DAYS_AHEAD - 1));
    const { data } = await supabase.from("bookings").select("client_name, booking_date, booking_time, status")
      .gte("booking_date", rangeStart).lte("booking_date", rangeEnd).neq("status", "cancelled");
    const map = new Map<string, string>();
    for (const row of data ?? []) {
      const hour = hourFromLabel(row.booking_time);
      if (hour !== null) map.set(`${row.booking_date}-${hour}`, row.client_name);
    }
    setClientNamesByHour(map);
  }, []);

  useEffect(() => {
    fetchClientNames();
  }, [fetchClientNames]);

  const visibleDays = days.slice(weekOffset * 7, weekOffset * 7 + 7);

  const toggleDay = async (day: AvailabilityDay) => {
    setActionError(null);
    try {
      if (day.isDayBlocked) await unblockDay(day.date); else await blockDay(day.date);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update day");
    }
  };

  const toggleSlot = async (day: AvailabilityDay, slot: AvailabilitySlot) => {
    if (slot.isBooked) return;
    setActionError(null);
    try {
      if (slot.isBlocked) await unblockSlot(day.date, slot.hour); else await blockSlot(day.date, slot.hour);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update slot");
    }
  };

  const startOpening = (dayKey: string) => {
    setActionError(null);
    setOpeningDayKey(dayKey);
    setOpenStartHour(9);
    setOpenEndHour(17);
  };

  const confirmOpenDay = async (dayKey: string) => {
    if (openEndHour <= openStartHour) {
      setActionError("End hour must be after start hour");
      return;
    }
    setActionError(null);
    try {
      await openDay(dayKey, openStartHour, openEndHour);
      setOpeningDayKey(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to open day");
    }
  };

  const handleClosePermanently = async (dayKey: string) => {
    if (!window.confirm(`Permanently close ${dayKey}s? This changes your default weekly schedule — you can reopen it any time.`)) return;
    setActionError(null);
    try {
      await closeDay(dayKey);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to close day");
    }
  };

  if (loading) return <LoadingNotice label="Loading availability…" />;

  return (
    <>
      {error && <ErrorNotice message={error} />}
      {actionError && <ErrorNotice message={actionError} />}

      <div
        className="bg-gold-bg rounded-[10px] py-3.5 px-5 mb-6 flex items-center gap-2.5 text-[13px] text-text-soft"
        style={{ border: `1px solid ${t.gold}30` }}
      >
        <Shield size={16} color={t.gold} />
        <span>Your default schedule runs automatically. Only block days or slots when you're unavailable.</span>
      </div>

      {/* Week toggle */}
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-base font-bold">
          {weekOffset === 0 ? "This week" : "Next week"}
        </h3>
        <div className="flex gap-1.5">
          <button
            onClick={() => setWeekOffset(0)}
            className={`py-1.5 px-4 rounded-md cursor-pointer text-xs border ${
              weekOffset === 0 ? "border-gold bg-gold-bg font-bold text-gold" : "border-border bg-transparent font-normal text-text-muted"
            }`}
          >This week</button>
          <button
            onClick={() => setWeekOffset(1)}
            className={`py-1.5 px-4 rounded-md cursor-pointer text-xs border ${
              weekOffset === 1 ? "border-gold bg-gold-bg font-bold text-gold" : "border-border bg-transparent font-normal text-text-muted"
            }`}
          >Next week</button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-[11px] text-text-muted flex-wrap">
        {[
          { color: "#D1FAE5", label: "Available" },
          { color: t.gold, label: "Booked" },
          { color: "#FEE2E2", label: "Blocked" },
          { color: "#E5E7EB", label: "Buffer (too close to another booking)" },
          { color: t.bgAlt, label: "Closed" },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-[3px]" style={{ background: l.color }} /> {l.label}
          </div>
        ))}
      </div>

      {/* Day columns — horizontally scrollable as a contained unit on narrow screens,
          since 7 equal columns can't stay legible below ~700px without one. */}
      <div className="overflow-x-auto -mx-1 px-1" style={{ WebkitOverflowScrolling: "touch" }}>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${visibleDays.length}, minmax(110px, 1fr))`, minWidth: visibleDays.length * 116 }}
      >
        {visibleDays.map((day) => {
          const isDefaultClosed = !day.isOpen;
          const dayOff = day.isDayBlocked || isDefaultClosed;
          const isOpeningThisDay = openingDayKey === day.dayKey;
          const dateStr = toISODateString(day.date);

          return (
            <div key={day.dateLabel} className={`[transition:opacity_0.3s] ${dayOff && !isOpeningThisDay ? "opacity-[0.45]" : "opacity-100"}`}>
              {/* Day header */}
              <div className={`text-center py-2.5 px-1 rounded-lg border border-border mb-1.5 ${dayOff ? "bg-bg-alt" : "bg-surface"}`}>
                <div className="text-xs font-bold text-text">{day.dayKey}</div>
                <div className="text-[11px] text-text-muted">{day.dateLabel}</div>

                {day.isOpen && !dayOff && (
                  <div
                    className={`mt-1 text-[9px] font-bold py-0.5 px-1.5 rounded-lg inline-block ${
                      day.isFull ? "bg-[#FEE2E2] text-[#DC2626]" : "bg-gold-bg text-gold"
                    }`}
                  >
                    {day.isFull ? `Full (${day.bookingCount}/${day.maxSlotsPerDay})` : `${day.bookingCount} of ${day.maxSlotsPerDay} booked`}
                  </div>
                )}

                {day.isOpen ? (
                  <>
                    <button
                      onClick={() => toggleDay(day)}
                      className={`block mx-auto mt-1.5 text-[10px] py-0.5 px-2 rounded cursor-pointer font-semibold border ${
                        day.isDayBlocked ? "border-[#EF4444] bg-[#FEE2E2] text-[#DC2626]" : "border-border bg-transparent text-text-muted"
                      }`}
                    >{day.isDayBlocked ? "Blocked" : "Block day"}</button>
                    <button
                      onClick={() => handleClosePermanently(day.dayKey)}
                      className="block mx-auto mt-1 bg-transparent border-none text-[9px] text-text-muted cursor-pointer underline p-0"
                    >Close permanently</button>
                  </>
                ) : isOpeningThisDay ? (
                  <div className="mt-1.5 flex flex-col gap-1">
                    <select
                      value={openStartHour} onChange={(e) => setOpenStartHour(Number(e.target.value))}
                      className="text-[10px] py-0.5 px-1 rounded border border-border bg-bg-alt text-text"
                    >
                      {HOUR_OPTIONS.map(h => <option key={h} value={h}>{formatHourLabel(h)}</option>)}
                    </select>
                    <select
                      value={openEndHour} onChange={(e) => setOpenEndHour(Number(e.target.value))}
                      className="text-[10px] py-0.5 px-1 rounded border border-border bg-bg-alt text-text"
                    >
                      {HOUR_OPTIONS.map(h => <option key={h} value={h}>{formatHourLabel(h)}</option>)}
                    </select>
                    <div className="flex gap-1">
                      <button
                        onClick={() => confirmOpenDay(day.dayKey)}
                        className="flex-1 text-[10px] py-0.5 px-1 rounded border-none bg-gold text-theme-black cursor-pointer font-bold"
                      >Confirm</button>
                      <button
                        onClick={() => setOpeningDayKey(null)}
                        className="flex-1 text-[10px] py-0.5 px-1 rounded border border-border bg-transparent text-text-muted cursor-pointer"
                      >Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => startOpening(day.dayKey)}
                    className="mt-1.5 text-[10px] py-0.5 px-2 rounded border border-[#10B981] bg-[#D1FAE5] text-[#065F46] cursor-pointer font-semibold"
                  >Open day</button>
                )}
              </div>

              {/* Time slots */}
              {day.isOpen && !day.isDayBlocked ? (
                <div className="grid gap-[3px]">
                  {day.slots.map(slot => {
                    const clientName = clientNamesByHour.get(`${dateStr}-${slot.hour}`);

                    return (
                      <button
                        key={slot.hour} onClick={() => toggleSlot(day, slot)}
                        disabled={slot.isBooked || slot.isBlockedByGap}
                        title={slot.isBlockedByGap ? "Too close to another booking" : clientName}
                        className={`py-1.5 px-0.5 rounded text-[10px] font-medium border leading-[1.3] [transition:all_0.2s] ${slotStateClasses(slot)} ${
                          slot.isBooked || slot.isBlockedByGap ? "cursor-default" : "cursor-pointer"
                        } ${slot.isBlocked ? "line-through" : "no-underline"}`}
                      >
                        {slot.label}
                        {slot.isBooked && (
                          <span className="block text-[9px] font-bold truncate">
                            {clientName ?? "Booked"}
                          </span>
                        )}
                        {slot.isBlockedByGap && <span className="block text-[9px]">buffer</span>}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-5 px-1 text-[11px] text-text-muted bg-bg-alt rounded-md">
                  {isDefaultClosed ? "Closed" : "Day off"}
                </div>
              )}
            </div>
          );
        })}
      </div>
      </div>
    </>
  );
}
