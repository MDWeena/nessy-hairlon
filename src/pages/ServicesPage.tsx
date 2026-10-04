import { useEffect, useState } from "react";
import { Clock, Image } from "lucide-react";
import { useServices } from "../hooks/useServices";
import { useTheme } from "../context/ThemeContext";
import type { NavigateFn, ServiceItem } from "../types";
import { FadeIn } from "../components/ui/FadeIn";
import { GoldButton } from "../components/ui/GoldButton";
import { LoadingNotice } from "../components/ui/LoadingNotice";
import { ErrorNotice } from "../components/ui/ErrorNotice";
import { StyleDetailModal } from "../components/ui/StyleDetailModal";

interface ServicesPageProps {
  navigate: NavigateFn;
  onBookService: (serviceName: string) => void;
}

export function ServicesPage({ navigate, onBookService }: ServicesPageProps) {
  const { t, isDark } = useTheme();
  const { services, loading, error } = useServices();
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);

  useEffect(() => {
    if (activeTab === null && services.length > 0) setActiveTab(services[0].cat);
  }, [activeTab, services]);

  const handleBook = () => {
    if (!selectedService) return;
    setSelectedService(null);
    onBookService(selectedService.name);
  };

  return (
    <section className="pt-12 px-6 pb-[72px] max-w-[800px] mx-auto">
      <FadeIn>
        <p className="text-gold text-xs font-semibold tracking-[3px] mb-3">OUR SERVICES</p>
        <h2 className="font-cursive text-5xl font-bold mb-2">What we offer</h2>
        <p className="text-[15px] text-text-soft mb-9 max-w-[500px] leading-[1.6]">
          Fixed-price treatments listed below. For braiding, locs, and custom styles — send a picture and get a personalised quote.
        </p>
      </FadeIn>

      {error && <ErrorNotice message={error} />}
      {loading && <LoadingNotice label="Loading services…" />}

      {!loading && (
        <>
      {/* Tabs */}
      <div className="flex gap-1 mb-8 bg-bg-alt rounded-lg p-1 w-fit">
        {services.map(s => (
          <button
            key={s.cat} onClick={() => setActiveTab(s.cat)}
            className={`py-2.5 px-6 rounded-md border-none cursor-pointer text-[13px] [transition:all_0.3s_ease] ${
              activeTab === s.cat ? "bg-gold text-theme-black font-bold" : "bg-transparent text-text-soft font-medium"
            }`}
          >{s.cat}</button>
        ))}
      </div>

      {/* Service cards */}
      <div className="grid gap-3">
        {services.find(s => s.cat === activeTab)?.items.map((s, i) => (
          <FadeIn key={s.name} delay={0.05 * (i + 1)}>
            <div
              className="hover-lift flex justify-between items-center py-5 px-6 bg-surface rounded-xl border border-border cursor-pointer flex-wrap gap-y-3"
              onClick={() => setSelectedService(s)}
            >
              <div className="flex items-start gap-4 min-w-0">
                {s.imageUrl ? (
                  <img src={s.imageUrl} alt="" className="w-12 h-12 rounded-[10px] object-cover shrink-0 border border-border" />
                ) : (
                  <div className="w-10 h-10 rounded-[10px] bg-gold-bg shrink-0 flex items-center justify-center">
                    <s.icon size={18} color={t.gold} strokeWidth={1.5} />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-bold text-[15px] mb-[3px] truncate">{s.name}</div>
                  <div className="text-[13px] text-text-muted">{s.desc}</div>
                  <div className="flex items-center gap-1 mt-1.5 text-xs text-gold">
                    <Clock size={12} /> {s.duration}
                  </div>
                </div>
              </div>
              <div className="text-right ml-4 shrink-0">
                {s.price ? (
                  <span className="text-lg font-bold text-text">{s.price}</span>
                ) : (
                  <div className="text-right">
                    <span className="text-sm font-bold text-text block mb-1">{s.priceRange || ""}</span>
                    <span
                      className="text-[11px] text-gold bg-gold-bg py-[3px] px-2.5 rounded-xl font-semibold"
                      style={{ border: `1px solid ${t.gold}30` }}
                    >Final price on request</span>
                  </div>
                )}
              </div>
            </div>
          </FadeIn>
        ))}
      </div>

      {/* Custom style CTA */}
      <FadeIn delay={0.3}>
        <div className={`rounded-2xl p-9 text-center mt-10 ${isDark ? "bg-[#1A1510]" : "bg-theme-black"}`}>
          <Image size={32} color={t.gold} strokeWidth={1.5} className="mb-3" />
          <h3 className="font-cursive text-4xl text-white mb-2">
            Have a specific style in mind?
          </h3>
          <p className="text-sm text-[#999] max-w-[380px] mx-auto mt-0 mb-6">
            Upload a picture during booking and get a personalised quote within 24 hours.
          </p>
          <GoldButton
            onClick={() => navigate("book")}
            className="bg-gold text-theme-black border-none py-3 px-8 text-sm font-bold cursor-pointer rounded-md"
          >Start Booking</GoldButton>
        </div>
      </FadeIn>
        </>
      )}

      <StyleDetailModal
        open={!!selectedService}
        onClose={() => setSelectedService(null)}
        imageUrl={selectedService?.imageUrl ?? null}
        title={selectedService?.name ?? ""}
        description={selectedService?.desc}
        duration={selectedService?.duration}
        price={selectedService ? (selectedService.price || selectedService.priceRange || null) : null}
        priceNote={selectedService && !selectedService.price ? "Final price on request" : null}
        ctaLabel="Book This Service"
        onBook={handleBook}
      />
    </section>
  );
}
