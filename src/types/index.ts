import type { LucideIcon } from "lucide-react";

export interface Theme {
  bg: string;
  bgAlt: string;
  surface: string;
  surfaceHover: string;
  text: string;
  textSoft: string;
  textMuted: string;
  gold: string;
  goldDark: string;
  goldLight: string;
  goldBg: string;
  border: string;
  borderStrong: string;
  black: string;
  white: string;
  navBg: string;
  shadow: string;
  heroOverlay: string;
  cardShadow: string;
}

export type ThemeMode = "light" | "dark" | "system";

export interface ServiceItem {
  id: string;
  name: string;
  price: string | null;
  priceRange?: string;
  desc: string;
  duration: string;
  icon: LucideIcon;
  imageUrl: string | null;
}

export interface ServiceCategory {
  cat: string;
  items: ServiceItem[];
}

export interface BookingDay {
  key: string;
  label: string;
  date: string;
  slots: string[];
  slotCount: number;
}

export type OrderStatus =
  | "pending_review"
  | "quoted"
  | "confirmed"
  | "completed"
  | "cancelled";

export interface Order {
  id: string;
  client: string;
  service: string;
  date: string;
  time: string;
  status: OrderStatus;
  price: string | null;
  customStyleUrl: string | null;
  customStyleDescription: string | null;
}

export type OrderFilter = "all" | OrderStatus;

export interface StatusConfig {
  bg: string;
  text: string;
  label: string;
}

export interface ScheduleDay {
  open: boolean;
  start: number;
  end: number;
}

export interface Story {
  id: string;
  name: string;
  text: string;
  stars: number;
  visible: boolean;
  reviewDate: string;
  verified: boolean;
}

export type NavigateFn = (page: string) => void;
