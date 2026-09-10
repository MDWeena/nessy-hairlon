import { Sparkles, Heart } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = { Sparkles, Heart };

/** Resolves a lucide icon name (as stored in the services.icon_name column) to its component, falling back to Sparkles. */
export function resolveIcon(name: string): LucideIcon {
  return ICONS[name] ?? Sparkles;
}
