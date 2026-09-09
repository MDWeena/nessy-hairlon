import { useState } from "react";
import { Shield } from "lucide-react";
import { scheduleDefaults } from "../../constants/scheduleDefaults";
import { useTheme } from "../../context/ThemeContext";

interface AvailabilitySlot {
  hour: number;
  label: string;
}

interface AvailabilityDay {
  date: Date;
  dayName: string;
  dateLabel: string;
  fullLabel: string;
  defaultOpen: boolean;
  slots: AvailabilitySlot[];
}

function generateDays(): AvailabilityDay[] {
  const days: AvailabilityDay[] = [];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const base = new Date(2026, 8, 8); // Sep 8, 2026 (Mon)
  for (let i = 0; i < 14; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const key = dayNames[d.getDay()];
    const sched = scheduleDefaults[key];
    const slots: AvailabilitySlot[] = [];
    if (sched.open) {
      for (let h = sched.start; h < sched.end; h++) {
        slots.push({ hour: h, label: `${h > 12 ? h - 12 : h}:00 ${h >= 12 ? "PM" : "AM"}` });
      }
    }
    days.push({
      date: d, dayName: key,
      dateLabel: `${monthNames[d.getMonth()]} ${d.getDate()}`,
      fullLabel: `${key}, ${monthNames[d.getMonth()]} ${d.getDate()}`,
      defaultOpen: sched.open, slots,
    });
  }
  return days;
}

export function Availability() {
  const { t } = useTheme();

  const [days] = useState(generateDays);
  // Blocked days and slots (exceptions to the default)
  const [blockedDays, setBlockedDays] = useState<Set<number>>(new Set());
  const [blockedSlots, setBlockedSlots] = useState<Set<string>>(new Set()); // "dateIdx-hour"
  // Fake booked slots
  const [bookedSlots] = useState<Set<string>>(new Set(["0-9", "0-14", "1-10", "1-11", "3-13", "4-9", "4-10"]));

  const toggleDay = (idx: number) => {
    const next = new Set(blockedDays);
    next.has(idx) ? next.delete(idx) : next.add(idx);
    setBlockedDays(next);
  };
  const toggleSlot = (idx: number, hour: number) => {
    const key = `${idx}-${hour}`;
    if (bookedSlots.has(key)) return; // can't block a booked slot
    const next = new Set(blockedSlots);
    next.has(key) ? next.delete(key) : next.add(key);
    setBlockedSlots(next);
  };

  const [weekOffset, setWeekOffset] = useState(0);
  const visibleDays = days.slice(weekOffset * 7, weekOffset * 7 + 7);

  return (
    <>
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
        {visibleDays.map((day, vIdx) => {
          const idx = weekOffset * 7 + vIdx;
          const isDayBlocked = blockedDays.has(idx);
          const isDefaultClosed = !day.defaultOpen;
          const dayOff = isDayBlocked || isDefaultClosed;

          return (
            <div key={idx} style={{ opacity: dayOff ? 0.45 : 1, transition: "opacity 0.3s" }}>
              {/* Day header */}
              <div style={{
                textAlign: "center", padding: "10px 4px", borderRadius: 8,
                background: dayOff ? t.bgAlt : t.surface, border: `1px solid ${t.border}`,
                marginBottom: 6,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{day.dayName}</div>
                <div style={{ fontSize: 11, color: t.textMuted }}>{day.dateLabel}</div>
                {day.defaultOpen && (
                  <button onClick={() => toggleDay(idx)} style={{
                    marginTop: 6, fontSize: 10, padding: "2px 8px", borderRadius: 4,
                    border: `1px solid ${isDayBlocked ? "#EF4444" : t.border}`,
                    background: isDayBlocked ? "#FEE2E2" : "transparent",
                    color: isDayBlocked ? "#DC2626" : t.textMuted,
                    cursor: "pointer", fontWeight: 600,
                  }}>{isDayBlocked ? "Blocked" : "Block day"}</button>
                )}
              </div>

              {/* Time slots */}
              {day.defaultOpen && !isDayBlocked ? (
                <div style={{ display: "grid", gap: 3 }}>
                  {day.slots.map(slot => {
                    const slotKey = `${idx}-${slot.hour}`;
                    const isBooked = bookedSlots.has(slotKey);
                    const isSlotBlocked = blockedSlots.has(slotKey);
                    let bg = "#D1FAE520"; let borderCol = "#D1FAE5"; let textCol = "#065F46";
                    if (isBooked) { bg = t.goldBg; borderCol = t.gold; textCol = t.gold; }
                    if (isSlotBlocked) { bg = "#FEE2E220"; borderCol = "#FCA5A5"; textCol = "#DC2626"; }

                    return (
                      <button key={slotKey} onClick={() => toggleSlot(idx, slot.hour)}
                        disabled={isBooked}
                        style={{
                          padding: "6px 2px", borderRadius: 4, fontSize: 10, fontWeight: 500,
                          border: `1px solid ${borderCol}`, background: bg, color: textCol,
                          cursor: isBooked ? "default" : "pointer",
                          textDecoration: isSlotBlocked ? "line-through" : "none",
                          transition: "all 0.2s",
                        }}
                      >{slot.label}{isBooked ? " ★" : ""}</button>
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
