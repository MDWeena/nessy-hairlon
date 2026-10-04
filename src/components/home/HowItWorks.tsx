import { FadeIn } from "../ui/FadeIn";

const STEPS = [
  { n: "01", title: "Pick a date", desc: "Browse the weekly calendar for open slots." },
  { n: "02", title: "Choose your look", desc: "Select from our menu or upload a style photo." },
  { n: "03", title: "Get your quote", desc: "Fixed services show pricing instantly. Custom styles get a quote within 24 hours." },
  { n: "04", title: "Confirm & pay deposit", desc: "Transfer your deposit and you're all set." },
];

export function HowItWorks() {
  return (
    <section className="bg-bg-alt py-[72px] px-6">
      <div className="max-w-[800px] mx-auto">
        <FadeIn>
          <p className="text-gold text-xs font-semibold tracking-[3px] mb-3">HOW IT WORKS</p>
          <h2 className="font-cursive text-5xl font-bold mb-12">
            Four steps to your appointment
          </h2>
        </FadeIn>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-7">
          {STEPS.map((step, i) => (
            <FadeIn key={step.n} delay={0.1 * (i + 1)}>
              <div className="relative">
                <span className="font-cursive text-[56px] font-bold text-gold opacity-30 leading-none">{step.n}</span>
                <h3 className="text-base font-bold -mt-2 mb-1.5">{step.title}</h3>
                <p className="text-[13px] text-text-soft leading-[1.6]">{step.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
