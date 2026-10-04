import { ArrowRight } from "lucide-react";
import { HERO_BG, LOGO_WHITE_TEXT } from "../../assets/logos";
import { useTheme } from "../../context/ThemeContext";
import type { NavigateFn } from "../../types";
import { GoldButton } from "../ui/GoldButton";
import { OutlineButton } from "../ui/OutlineButton";

interface HeroSectionProps {
  navigate: NavigateFn;
}

export function HeroSection({ navigate }: HeroSectionProps) {
  const { t, isDark } = useTheme();

  return (
    <section
      className="relative min-h-[520px] flex items-center justify-center text-center overflow-hidden"
      style={{ background: `url(${HERO_BG}) center/cover no-repeat` }}
    >
      {/* Dark overlay over the background image */}
      <div
        className="absolute inset-0 z-[1]"
        style={{
          background: isDark
            ? "linear-gradient(135deg, rgba(10,10,6,0.92) 0%, rgba(42,26,14,0.85) 100%)"
            : "linear-gradient(135deg, rgba(10,10,6,0.88) 0%, rgba(42,26,14,0.78) 100%)",
        }}
      />
      {/* Animated gold circle decoration */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full [animation:pulse_4s_ease-in-out_infinite] z-[2]"
        style={{ border: `1px solid ${t.gold}20` }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] h-[380px] rounded-full [animation:pulse_4s_ease-in-out_infinite_0.5s] z-[2]"
        style={{ border: `1px solid ${t.gold}15` }}
      />

      <style>{`
        .gold-line { height: 2px; background: linear-gradient(90deg, transparent, ${t.gold}, transparent); animation: shimmer 3s ease infinite; background-size: 200px 100%; }
      `}</style>

      <div className={`relative z-[3] ${isDark ? "pt-[120px]" : "pt-20"} px-6 pb-20 max-w-[640px] [animation:slideUp_0.8s_ease_forwards]`}>
        {/* Logo mark */}
        <img
          src={LOGO_WHITE_TEXT} alt="Nessy Hairlon"
          className="w-[220px] mx-auto mb-3 block [filter:drop-shadow(0_0_30px_rgba(196,154,108,0.3))]"
        />

        <p className="text-gold text-xs tracking-[4px] font-medium mb-5">
          NATURAL HAIR SPECIALIST
        </p>

        <h1 className="font-cursive text-[clamp(36px,6vw,52px)] font-bold text-white leading-none mb-3 opacity-0 h-0">
          Nessy Hairlon
        </h1>

        <div className="gold-line w-[120px] mx-auto mb-6" />

        <p className="text-base text-[#bbb] leading-[1.7] max-w-[440px] mx-auto mb-9">
          Braiding, locs, treatments & styling by someone who understands your hair from root to tip. People travel for this.
        </p>

        <div className="flex gap-3 justify-center flex-wrap">
          <GoldButton
            onClick={() => navigate("book")}
            className="bg-gold text-theme-black border-none py-3.5 px-9 text-sm font-bold cursor-pointer rounded-md flex items-center gap-2"
          >
            Book an Appointment <ArrowRight size={16} />
          </GoldButton>
          <OutlineButton
            onClick={() => navigate("services")}
            className="bg-transparent text-[#ccc] border border-[#555] py-3.5 px-7 text-sm font-medium cursor-pointer rounded-md"
          >
            View Services
          </OutlineButton>
        </div>
      </div>
    </section>
  );
}
