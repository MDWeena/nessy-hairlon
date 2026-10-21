import type { ReactNode } from "react";
import { Phone, Camera, MapPin, Search, ArrowUpRight, type LucideIcon } from "lucide-react";
import { LOGO_ICON } from "../../assets/logos";
import { useTheme } from "../../context/ThemeContext";
import { useSettings } from "../../hooks/useSettings";
import { buildWhatsAppUrl } from "../../lib/whatsapp";
import { LOCATION_TEXT, MAPS_LINK_ARIA_LABEL, MAPS_LINK_TEXT, mapsUrlFrom } from "../../lib/location";
import type { NavigateFn } from "../../types";
import { GoldButton } from "../ui/GoldButton";
import { WeenaCredit } from "./WeenaCredit";

interface FooterProps {
  navigate: NavigateFn;
  onManageClick: () => void;
}

const PHONE_TEXT = "0816 127 1343";
const INSTAGRAM_TEXT = "@nessy_hairlon";

/** "@nessy_hairlon" / "nessy_hairlon" → the profile URL; null if missing or not a valid handle. */
function instagramUrlFrom(handle: string | null | undefined): string | null {
  const h = (handle ?? "").trim().replace(/^@/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(h) ? `https://www.instagram.com/${h}/` : null;
}

interface ContactRowProps {
  icon: LucideIcon;
  gold: string;
  /** null → plain, non-interactive text (no arrow) — never a dead link. */
  href: string | null;
  ariaLabel: string;
  testId: string;
  children: ReactNode;
}

/**
 * One "Get in touch" row. Every linked row looks the same: gold text, leading icon, a small
 * trailing arrow that nudges up-right on hover/focus (no movement with reduced motion — just the
 * brightness change), 44px tall on phones, and a visible focus ring for keyboard users.
 */
function ContactRow({ icon: Icon, gold, href, ariaLabel, testId, children }: ContactRowProps) {
  const icon = <Icon size={14} color={gold} aria-hidden="true" className="shrink-0" />;
  if (!href) {
    return (
      <p data-testid={`${testId}-text`} className="flex items-center gap-2 m-0 min-h-11 md:min-h-7 text-[#888] text-[13px]">
        {icon} {children}
      </p>
    );
  }
  return (
    <a
      href={href} target="_blank" rel="noopener noreferrer" aria-label={ariaLabel} data-testid={testId}
      className="group flex items-center gap-2 w-fit min-h-11 md:min-h-7 text-gold text-[13px] font-semibold no-underline whitespace-nowrap rounded-sm [transition:filter_150ms_ease] hover:brightness-125 focus-visible:brightness-125 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
    >
      {icon} {children}
      <ArrowUpRight
        size={14} aria-hidden="true"
        className="shrink-0 transition-transform duration-150 ease-out motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5 motion-safe:group-focus-visible:translate-x-0.5 motion-safe:group-focus-visible:-translate-y-0.5"
      />
    </a>
  );
}

export function Footer({ navigate, onManageClick }: FooterProps) {
  const { t, isDark } = useTheme();
  const { settings } = useSettings();
  // Each row links only when its setting is present; otherwise it's plain text with no arrow.
  const whatsappHref = settings.phone?.trim() ? buildWhatsAppUrl(settings.phone, "Hi Nessy, I'd like to book an appointment") : null;
  const instagramHref = instagramUrlFrom(settings.instagram);
  // null when no usable map link is set — then the location is plain text, never a dead link.
  const mapsHref = mapsUrlFrom(settings.location_url);

  return (
    <footer className={`${isDark ? "bg-[#0A0806] text-[#999]" : "bg-[#1E1914] text-[#aaa]"} pt-14 px-6 pb-8`}>
      <div className="max-w-[900px] mx-auto grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <img src={LOGO_ICON} alt="" className="w-12 h-12 rounded-full" />
            <span className="font-cursive text-[40px] text-white">Nessy <span className="text-gold">Hairlon</span></span>
          </div>
          <p className="text-[13px] text-[#777] leading-[1.6] mb-4">Natural hair specialist. Braiding, locs, treatments & styling done with care and intention.</p>
          <GoldButton
            onClick={() => navigate("track")}
            className="bg-gold text-theme-black border-none py-2.5 px-5 rounded-md text-[13px] font-bold cursor-pointer flex items-center gap-2 w-fit"
          ><Search size={14} /> Track My Booking</GoldButton>
        </div>
        <div>
          <h4 className="text-[#ccc] text-[13px] font-bold mb-4 tracking-[0.5px]">Quick links</h4>
          {["Home", "Services", "Book Now"].map(l => (
            <button
              key={l} onClick={() => navigate(l === "Book Now" ? "book" : l.toLowerCase())}
              className="block bg-transparent border-none text-[#888] cursor-pointer text-[13px] py-1 px-0 mb-1 [transition:color_0.2s]"
            >{l}</button>
          ))}
        </div>
        <div>
          <h4 className="text-[#ccc] text-[13px] font-bold mb-4 tracking-[0.5px]">Get in touch</h4>
          <div className="flex flex-col gap-1 md:gap-1.5">
            <ContactRow icon={Phone} gold={t.gold} href={whatsappHref} ariaLabel="Chat with Nessy on WhatsApp" testId="footer-whatsapp-link">
              {PHONE_TEXT}
            </ContactRow>
            <ContactRow icon={Camera} gold={t.gold} href={instagramHref} ariaLabel="Open @nessy_hairlon on Instagram" testId="footer-instagram-link">
              {INSTAGRAM_TEXT}
            </ContactRow>
            <ContactRow icon={MapPin} gold={t.gold} href={mapsHref} ariaLabel={MAPS_LINK_ARIA_LABEL} testId="footer-maps-link">
              {mapsHref ? MAPS_LINK_TEXT : LOCATION_TEXT}
            </ContactRow>
          </div>
        </div>
      </div>
      <div className="border-t border-[#1E1E1E] pt-5 mt-10">
        {/* Top layer — Built by Weena + hidden Manage */}
        <div className="flex justify-between items-center mb-3 py-0 px-1">
          <WeenaCredit />
          <button
            onClick={onManageClick}
            className="bg-transparent border-none cursor-default text-[#2A2A2A] text-[11px] py-1 px-2 rounded [transition:all_0.3s] tracking-[0.5px] hover:text-gold hover:bg-[rgba(196,154,108,0.1)]"
          >
            Manage
          </button>
        </div>
        {/* Bottom layer — copyright centered */}
        <div className="text-center text-[11px] text-[#444] pt-3 border-t border-[#1A1A1A]">
          © 2026 Nessy Hairlon. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
