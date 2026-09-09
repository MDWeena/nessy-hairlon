import { useTheme } from "../../context/ThemeContext";
import { FadeIn } from "../ui/FadeIn";

const STEPS = [
  { n: "01", title: "Pick a date", desc: "Browse the weekly calendar for open slots." },
  { n: "02", title: "Choose your look", desc: "Select from our menu or upload a style photo." },
  { n: "03", title: "Get your quote", desc: "Fixed services show pricing instantly. Custom styles get a quote within 24 hours." },
  { n: "04", title: "Confirm & pay deposit", desc: "Transfer your deposit and you're all set." },
];

export function HowItWorks() {
  const { t } = useTheme();
  return (
    <section style={{ background: t.bgAlt, padding: "72px 24px" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <FadeIn>
          <p style={{ color: t.gold, fontSize: 12, fontWeight: 600, letterSpacing: 3, marginBottom: 12 }}>HOW IT WORKS</p>
          <h2 style={{ fontFamily: "'Tangerine', cursive", fontSize: 48, fontWeight: 700, marginBottom: 48 }}>
            Four steps to your appointment
          </h2>
        </FadeIn>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 28 }}>
          {STEPS.map((step, i) => (
            <FadeIn key={step.n} delay={0.1 * (i + 1)}>
              <div style={{ position: "relative" }}>
                <span style={{
                  fontFamily: "'Tangerine', cursive", fontSize: 56, fontWeight: 700,
                  color: t.gold, opacity: 0.3, lineHeight: 1,
                }}>{step.n}</span>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: -8, marginBottom: 6 }}>{step.title}</h3>
                <p style={{ fontSize: 13, color: t.textSoft, lineHeight: 1.6 }}>{step.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
