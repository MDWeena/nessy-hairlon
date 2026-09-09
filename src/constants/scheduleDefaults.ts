import type { ScheduleDay } from "../types";

export const scheduleDefaults: Record<string, ScheduleDay> = {
  Mon: { open: true, start: 9, end: 17 },
  Tue: { open: true, start: 9, end: 16 },
  Wed: { open: true, start: 9, end: 17 },
  Thu: { open: true, start: 10, end: 16 },
  Fri: { open: true, start: 9, end: 16 },
  Sat: { open: true, start: 10, end: 15 },
  Sun: { open: false, start: 0, end: 0 },
};
