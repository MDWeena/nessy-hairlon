import { scheduleDefaults } from "../constants/scheduleDefaults";
import type { BookingDay } from "../types";

function getBookingDays(): BookingDay[] {
  const dayKeys = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const base = new Date(2026, 8, 8);
  const result: BookingDay[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(base); d.setDate(base.getDate() + i);
    const key = dayKeys[d.getDay()];
    const sched = scheduleDefaults[key];
    if (!sched.open) continue;
    const slots: string[] = [];
    for (let h = sched.start; h < sched.end; h++) {
      slots.push(`${h > 12 ? h - 12 : h}:00 ${h >= 12 ? "PM" : "AM"}`);
    }
    result.push({
      key, label: `${key}, ${monthNames[d.getMonth()]} ${d.getDate()}`,
      slots, slotCount: slots.length,
    });
  }
  return result;
}

export function useBookingDays(): BookingDay[] {
  return getBookingDays();
}
