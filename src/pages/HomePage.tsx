import { HeroSection } from "../components/home/HeroSection";
import { TrustBar } from "../components/home/TrustBar";
import { WhyNessy } from "../components/home/WhyNessy";
import { StylesCarousel } from "../components/home/StylesCarousel";
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
      <StylesCarousel navigate={navigate} />
      <HowItWorks />
      <Testimonials navigate={navigate} />
      <CTASection navigate={navigate} />
    </>
  );
}
