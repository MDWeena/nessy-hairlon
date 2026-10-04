import { ArrowRight } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import type { NavigateFn } from "../../types";
import { FadeIn } from "../ui/FadeIn";
import { GoldButton } from "../ui/GoldButton";

interface CTASectionProps {
  navigate: NavigateFn;
}

export function CTASection({ navigate }: CTASectionProps) {
  const { isDark } = useTheme();
  return (
    <FadeIn>
      <section
        className="relative py-[72px] px-6 text-center overflow-hidden"
        style={{
          background: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none'%3E%3Cg fill='%23C49A6C' fill-opacity='0.04'%3E%3Cpath d='M20 0L40 20L20 40L0 20z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E"), linear-gradient(135deg, ${isDark ? "#1A1207" : "#2A1A0E"}, ${isDark ? "#0A0806" : "#0A0A0A"})`,
        }}
      >
        <h2 className="font-cursive text-[52px] font-bold text-white mb-4">
          Ready to book?
        </h2>
        <p className="text-[15px] text-[#999] max-w-[400px] mx-auto mt-0 mb-8">
          Pick a date, choose your service, and let Nessy take care of the rest.
        </p>
        <GoldButton
          onClick={() => navigate("book")}
          className="bg-gold text-theme-black border-none py-3.5 px-10 text-[15px] font-bold cursor-pointer rounded-md inline-flex items-center gap-2"
        >
          Book an Appointment <ArrowRight size={16} />
        </GoldButton>
      </section>
    </FadeIn>
  );
}
