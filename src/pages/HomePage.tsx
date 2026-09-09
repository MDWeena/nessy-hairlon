import { HeroSection } from "../components/home/HeroSection";
import { TrustBar } from "../components/home/TrustBar";
import { WhyNessy } from "../components/home/WhyNessy";
import { HowItWorks } from "../components/home/HowItWorks";
import { Testimonials } from "../components/home/Testimonials";
import { CTASection } from "../components/home/CTASection";
import type { NavigateFn } from "../types";

interface HomePageProps {
  navigate: NavigateFn;
}

export function HomePage({ navigate }: HomePageProps) {
  return (
    <>
      <HeroSection navigate={navigate} />
      <TrustBar />
      <WhyNessy />
      <HowItWorks />
      <Testimonials />
      <CTASection navigate={navigate} />
    </>
  );
}
