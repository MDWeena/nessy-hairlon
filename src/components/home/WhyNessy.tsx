import { Shield, Heart, Sparkles } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { FadeIn } from "../ui/FadeIn";

const ITEMS = [
  { icon: Shield, title: "Gentle on your hair", desc: "No tension, no breakage. Your edges stay intact." },
  { icon: Heart, title: "Natural hair focused", desc: "Products and techniques chosen for your texture." },
  { icon: Sparkles, title: "Styles that last", desc: "Protective styles that hold up for weeks." },
];

export function WhyNessy() {
  const { t } = useTheme();
  return (
    <section className="py-[72px] px-6 max-w-[800px] mx-auto">
      <FadeIn>
        <p className="text-gold text-xs font-semibold tracking-[3px] mb-3">WHY NESSY</p>
        <h2 className="font-cursive text-5xl font-bold mb-5 leading-[1.1]">
          People travel to her chair for a reason
        </h2>
      </FadeIn>
      <FadeIn delay={0.15}>
        <p className="text-[15px] leading-[1.8] text-text-soft max-w-[560px]">
          Natural hair isn't just a category — it's a craft. Every session starts with understanding your hair's unique texture, porosity, and needs before a single braid goes in. That's why clients come from across the city and beyond.
        </p>
      </FadeIn>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5 mt-10">
        {ITEMS.map((item, i) => (
          <FadeIn key={item.title} delay={0.1 * (i + 1)}>
            <div className="hover-lift bg-surface rounded-xl p-7 border border-border cursor-default">
              <div className="w-11 h-11 rounded-[10px] bg-gold-bg flex items-center justify-center mb-4">
                <item.icon size={20} color={t.gold} strokeWidth={1.5} />
              </div>
              <h3 className="text-base font-bold mb-1.5">{item.title}</h3>
              <p className="text-[13px] text-text-soft leading-[1.6]">{item.desc}</p>
            </div>
          </FadeIn>
        ))}
      </div>
    </section>
  );
}
