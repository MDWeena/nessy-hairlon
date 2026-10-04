import { Award, Users, Heart, ArrowRight } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import type { NavigateFn } from "../types";
import { FadeIn } from "../components/ui/FadeIn";
import { GoldButton } from "../components/ui/GoldButton";

interface AboutPageProps {
  navigate: NavigateFn;
}

const STATS = [
  { icon: Award, value: "6+", label: "Years of experience" },
  { icon: Users, value: "1,000+", label: "Clients served" },
  { icon: Heart, value: "100%", label: "Natural hair focused" },
];

export function AboutPage({ navigate }: AboutPageProps) {
  const { t, isDark } = useTheme();

  return (
    <section className="pt-12 px-6 pb-[72px] max-w-[800px] mx-auto">
      <FadeIn>
        <p className="text-gold text-xs font-semibold tracking-[3px] mb-3">MEET NESSY</p>
        <h2 className="font-cursive text-5xl font-bold mb-9">
          The hands behind the craft
        </h2>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="flex flex-col sm:flex-row gap-8 items-center sm:items-start mb-10">
          {/* TODO: Replace with Nessy's photo */}
          <div className="w-[200px] h-[200px] sm:w-[220px] sm:h-[220px] rounded-full shrink-0 bg-[linear-gradient(135deg,#C49A6C30,#C49A6C10)] border border-[#C49A6C40] flex items-center justify-center mx-auto">
            <span className="font-cursive text-[96px] font-bold text-gold">N</span>
          </div>

          <div className="min-w-0 text-center sm:text-left">
            <h3 className="text-2xl font-bold mb-1">Nessy</h3>
            <p className="text-sm text-gold font-semibold tracking-[0.5px] mb-4">Natural Hair Specialist</p>
            <p className="text-[15px] text-text-soft leading-[1.8]">
              Hair has always been more than a service to me — it's a form of care. I started braiding for friends and family years ago, and that love for natural hair grew into a full-time craft. Every head that sits in my chair gets the same thing: patience, gentle hands, and techniques chosen for your hair's unique texture — never one-size-fits-all.
            </p>
            <p className="text-[15px] text-text-soft leading-[1.8] mt-4">
              Whether you're protecting your edges with a fresh set of braids, nursing your locs back to health, or just need a style that'll hold up for weeks, I treat your hair like it's my own. People travel across the city for this chair, and I don't take that for granted.
            </p>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.2}>
        <div className="grid grid-cols-3 gap-4 mb-10">
          {STATS.map(s => (
            <div key={s.label} className="text-center bg-surface rounded-xl p-5 border border-border">
              <s.icon size={20} color={t.gold} strokeWidth={1.5} className="mx-auto mb-2" />
              <div className="text-xl font-bold">{s.value}</div>
              <div className="text-[11px] text-text-muted mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </FadeIn>

      <FadeIn delay={0.3}>
        <div className={`rounded-2xl p-9 text-center ${isDark ? "bg-[#1A1510]" : "bg-theme-black"}`}>
          <h3 className="font-cursive text-4xl text-white mb-2">Ready to get your hair done?</h3>
          <p className="text-sm text-[#999] max-w-[380px] mx-auto mt-0 mb-6">
            Book an appointment and let's talk about the style you have in mind.
          </p>
          <GoldButton
            onClick={() => navigate("book")}
            className="bg-gold text-theme-black border-none py-3 px-8 text-sm font-bold cursor-pointer rounded-md inline-flex items-center gap-2"
          >Book an Appointment <ArrowRight size={16} /></GoldButton>
        </div>
      </FadeIn>
    </section>
  );
}
