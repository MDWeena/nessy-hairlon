import { Compass } from "lucide-react";
import { LOGO_ICON } from "../assets/logos";
import type { NavigateFn } from "../types";
import { GoldButton } from "../components/ui/GoldButton";

interface NotFoundPageProps {
  navigate: NavigateFn;
}

export function NotFoundPage({ navigate }: NotFoundPageProps) {
  return (
    <section className="pt-20 px-6 pb-[72px] max-w-[500px] mx-auto text-center">
      <img src={LOGO_ICON} alt="Nessy Hairlon" className="w-14 h-14 rounded-full mx-auto mb-6" />
      <Compass size={40} color="#C49A6C" className="mx-auto mb-5" strokeWidth={1.5} />
      <h2 className="font-cursive text-5xl font-bold mb-3">Page not found</h2>
      <p className="text-[15px] text-text-soft mb-8 leading-[1.6]">
        That page doesn't exist, or may have moved. Let's get you back on track.
      </p>
      <GoldButton
        onClick={() => navigate("home")}
        className="bg-gold text-theme-black border-none py-3 px-8 text-sm font-bold cursor-pointer rounded-md"
      >Go Home</GoldButton>
    </section>
  );
}
