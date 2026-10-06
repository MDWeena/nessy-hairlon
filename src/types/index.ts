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
  | "deposit_paid"
  | "confirmed"
  | "completed"
  | "cancelled";

export type AttachmentPreference = "client_provides" | "nessy_buys";

export interface MaterialItem {
  type: string;
  quantity: number;
  unitCost: number;
}

export interface Order {
  id: string;
  client: string;
  clientEmail: string | null;
  clientPhone: string;
  service: string;
  date: string;
  time: string;
  status: OrderStatus;
  price: string | null;
  quotedPrice: number | null;
  customStyleUrl: string | null;
  customStyleDescription: string | null;
  styleReferenceUrls: string[];
  paymentProofUrl: string | null;
  attachmentPreference: AttachmentPreference | null;
  attachmentItems: MaterialItem[];
  accessoryItems: MaterialItem[];
  hairServiceCost: number | null;
  depositConfirmedAt: string | null;
  balancePaidAt: string | null;
  balanceReminderSentAt: string | null;
}

/** "this_week_confirmed" is dashboard-only (Revenue card drill-down) — never shown as a visible filter tab. */
export type OrderFilter = "all" | OrderStatus | "this_week_confirmed";

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

export type NavigateFn = (page: string, param?: string) => void;
