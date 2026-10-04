import { Phone, Camera, MapPin } from "lucide-react";
import { LOGO_ICON } from "../../assets/logos";
import { useTheme } from "../../context/ThemeContext";
import { useSettings } from "../../hooks/useSettings";
import { buildWhatsAppUrl } from "../../lib/whatsapp";
import type { NavigateFn } from "../../types";
import { WeenaCredit } from "./WeenaCredit";

interface FooterProps {
  navigate: NavigateFn;
  onManageClick: () => void;
}

const FALLBACK_LOCATION_URL = "https://www.google.com/maps/search/?api=1&query=Lagos,Nigeria";

const footerLinkClass = "flex items-center gap-2 mb-2.5 text-[#888] text-[13px] no-underline [transition:color_0.2s] w-fit hover:text-gold";

export function Footer({ navigate, onManageClick }: FooterProps) {
  const { t, isDark } = useTheme();
  const { settings } = useSettings();
  const whatsappHref = buildWhatsAppUrl(settings.phone, "Hi Nessy, I'd like to book an appointment");
  const locationHref = settings.location_url || FALLBACK_LOCATION_URL;

  return (
    <footer className={`${isDark ? "bg-[#0A0806] text-[#999]" : "bg-[#1E1914] text-[#aaa]"} pt-14 px-6 pb-8`}>
      <div className="max-w-[900px] mx-auto grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <img src={LOGO_ICON} alt="" className="w-12 h-12 rounded-full" />
            <span className="font-cursive text-[40px] text-white">Nessy <span className="text-gold">Hairlon</span></span>
          </div>
          <p className="text-[13px] text-[#777] leading-[1.6]">Natural hair specialist. Braiding, locs, treatments & styling done with care and intention.</p>
        </div>
        <div>
          <h4 className="text-[#ccc] text-[13px] font-bold mb-4 tracking-[0.5px]">Quick links</h4>
          {["Home", "Services", "Book Now", "Track Booking"].map(l => (
            <button
              key={l} onClick={() => navigate(l === "Book Now" ? "book" : l === "Track Booking" ? "track" : l.toLowerCase())}
              className="block bg-transparent border-none text-[#888] cursor-pointer text-[13px] py-1 px-0 mb-1 [transition:color_0.2s]"
            >{l}</button>
          ))}
        </div>
        <div>
          <h4 className="text-[#ccc] text-[13px] font-bold mb-4 tracking-[0.5px]">Get in touch</h4>
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className={footerLinkClass}>
            <Phone size={14} color={t.gold} /> 0816 127 1343
          </a>
          <a href="https://www.instagram.com/nessy_hairlon/" target="_blank" rel="noopener noreferrer" className={footerLinkClass}>
            <Camera size={14} color={t.gold} /> @nessy_hairlon
          </a>
          <a href={locationHref} target="_blank" rel="noopener noreferrer" className={`${footerLinkClass} mb-0`}>
            <MapPin size={14} color={t.gold} /> Lagos, Nigeria
          </a>
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
