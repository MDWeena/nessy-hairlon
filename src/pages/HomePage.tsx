import { HeroSection } from "../components/home/HeroSection";
import { TrustBar } from "../components/home/TrustBar";
import { WhyNessy } from "../components/home/WhyNessy";
import { StylesCarousel } from "../components/home/StylesCarousel";
import { HowItWorks } from "../components/home/HowItWorks";
import { Testimonials } from "../components/home/Testimonials";
import { CTASection } from "../components/home/CTASection";
import { PullToRefresh } from "../components/ui/PullToRefresh";
import type { NavigateFn } from "../types";

interface HomePageProps {
  navigate: NavigateFn;
}

export function HomePage({ navigate }: HomePageProps) {
  // Home has no single data hook of its own — it's composed of several independently-fetching
  // sections (testimonials, styles carousel, etc.) — so a full reload is the one refresh that's
  // guaranteed to actually refresh everything here, same as a native app's pull-to-refresh
  // often does for a composed landing screen.
  return (
    <PullToRefresh onRefresh={() => window.location.reload()}>
      <HeroSection navigate={navigate} />
      <TrustBar />
      <WhyNessy />
      <StylesCarousel navigate={navigate} />
      <HowItWorks />
      <Testimonials navigate={navigate} />
      <CTASection navigate={navigate} />
    </PullToRefresh>
  );
}
