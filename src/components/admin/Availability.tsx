import { useState } from "react";
import { Shield } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { useAvailability } from "../../hooks/useAvailability";
import type { AvailabilityDay, AvailabilitySlot } from "../../hooks/useAvailability";
import { LoadingNotice } from "../ui/LoadingNotice";
import { ErrorNotice } from "../ui/ErrorNotice";

export function Availability() {
  const { t } = useTheme();
  const { days, loading, error, blockDay, unblockDay, blockSlot, unblockSlot } = useAvailability(14);
  const [weekOffset, setWeekOffset] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);

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

  if (loading) return <LoadingNotice label="Loading availability…" />;

  return (
    <>
      {error && <ErrorNotice message={error} />}
      {actionError && <ErrorNotice message={actionError} />}

      <div style={{
        background: t.goldBg, border: `1px solid ${t.gold}30`, borderRadius: 10,
        padding: "14px 20px", marginBottom: 24, display: "flex", alignItems: "center", gap: 10,
        fontSize: 13, color: t.textSoft,
      }}>
        <Shield size={16} color={t.gold} />
        <span>Your default schedule runs automatically. Only block days or slots when you're unavailable.</span>
      </div>

      {/* Week toggle */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700 }}>
          {weekOffset === 0 ? "This week" : "Next week"}
        </h3>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setWeekOffset(0)} style={{
            padding: "6px 16px", borderRadius: 6, border: `1px solid ${weekOffset === 0 ? t.gold : t.border}`,
            background: weekOffset === 0 ? t.goldBg : "transparent", cursor: "pointer",
            fontSize: 12, fontWeight: weekOffset === 0 ? 700 : 400, color: weekOffset === 0 ? t.gold : t.textMuted,
          }}>This week</button>
          <button onClick={() => setWeekOffset(1)} style={{
            padding: "6px 16px", borderRadius: 6, border: `1px solid ${weekOffset === 1 ? t.gold : t.border}`,
            background: weekOffset === 1 ? t.goldBg : "transparent", cursor: "pointer",
            fontSize: 12, fontWeight: weekOffset === 1 ? 700 : 400, color: weekOffset === 1 ? t.gold : t.textMuted,
          }}>Next week</button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16, fontSize: 11, color: t.textMuted }}>
        {[
          { color: "#D1FAE5", label: "Available" },
          { color: t.gold, label: "Booked" },
          { color: "#FEE2E2", label: "Blocked" },
          { color: t.bgAlt, label: "Closed" },
        ].map(l => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: l.color }} /> {l.label}
          </div>
        ))}
      </div>

      {/* Day columns */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${visibleDays.length}, 1fr)`, gap: 6 }}>
        {visibleDays.map((day) => {
          const isDefaultClosed = !day.isOpen;
          const dayOff = day.isDayBlocked || isDefaultClosed;

          return (
            <div key={day.dateLabel} style={{ opacity: dayOff ? 0.45 : 1, transition: "opacity 0.3s" }}>
              {/* Day header */}
              <div style={{
                textAlign: "center", padding: "10px 4px", borderRadius: 8,
                background: dayOff ? t.bgAlt : t.surface, border: `1px solid ${t.border}`,
                marginBottom: 6,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{day.dayKey}</div>
                <div style={{ fontSize: 11, color: t.textMuted }}>{day.dateLabel}</div>
                {day.isOpen && (
                  <button onClick={() => toggleDay(day)} style={{
                    marginTop: 6, fontSize: 10, padding: "2px 8px", borderRadius: 4,
                    border: `1px solid ${day.isDayBlocked ? "#EF4444" : t.border}`,
                    background: day.isDayBlocked ? "#FEE2E2" : "transparent",
                    color: day.isDayBlocked ? "#DC2626" : t.textMuted,
                    cursor: "pointer", fontWeight: 600,
                  }}>{day.isDayBlocked ? "Blocked" : "Block day"}</button>
                )}
              </div>

              {/* Time slots */}
              {day.isOpen && !day.isDayBlocked ? (
                <div style={{ display: "grid", gap: 3 }}>
                  {day.slots.map(slot => {
                    let bg = "#D1FAE520"; let borderCol = "#D1FAE5"; let textCol = "#065F46";
                    if (slot.isBooked) { bg = t.goldBg; borderCol = t.gold; textCol = t.gold; }
                    if (slot.isBlocked) { bg = "#FEE2E220"; borderCol = "#FCA5A5"; textCol = "#DC2626"; }

                    return (
                      <button key={slot.hour} onClick={() => toggleSlot(day, slot)}
                        disabled={slot.isBooked}
                        style={{
                          padding: "6px 2px", borderRadius: 4, fontSize: 10, fontWeight: 500,
                          border: `1px solid ${borderCol}`, background: bg, color: textCol,
                          cursor: slot.isBooked ? "default" : "pointer",
                          textDecoration: slot.isBlocked ? "line-through" : "none",
                          transition: "all 0.2s",
                        }}
                      >{slot.label}{slot.isBooked ? " ★" : ""}</button>
                    );
                  })}
                </div>
              ) : (
                <div style={{
                  textAlign: "center", padding: "20px 4px", fontSize: 11,
                  color: t.textMuted, background: t.bgAlt, borderRadius: 6,
                }}>{isDefaultClosed ? "Closed" : "Day off"}</div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
