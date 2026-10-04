import { useState } from "react";
import { Scissors, ArrowRight, Upload } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useGallery } from "../hooks/useGallery";
import type { GalleryEntry } from "../hooks/useGallery";
import { useServices } from "../hooks/useServices";
import type { ServiceItem } from "../types";
import type { NavigateFn } from "../types";
import { FadeIn } from "../components/ui/FadeIn";
import { GoldButton } from "../components/ui/GoldButton";
import { LoadingNotice } from "../components/ui/LoadingNotice";
import { ErrorNotice } from "../components/ui/ErrorNotice";
import { StyleDetailModal } from "../components/ui/StyleDetailModal";

interface GalleryPageProps {
  navigate: NavigateFn;
  onBookService: (serviceName: string) => void;
}

/** Gallery styles are protective-style categories, not literal service names — matched by keyword. */
function findMatchingService(styleName: string, allServices: ServiceItem[]): ServiceItem | undefined {
  const lower = styleName.toLowerCase();
  if (lower.includes("loc")) return allServices.find(s => s.name === "Locs");
  if (lower.includes("braid") || lower.includes("cornrow") || lower.includes("twist")) {
    return allServices.find(s => s.name === "Braiding");
  }
  return undefined;
}

export function GalleryPage({ navigate, onBookService }: GalleryPageProps) {
  const { t, isDark } = useTheme();
  const { entries, loading, error } = useGallery();
  const { services } = useServices();
  const [selectedEntry, setSelectedEntry] = useState<GalleryEntry | null>(null);

  const allServices = services.flatMap(c => c.items);
  const matchedService = selectedEntry ? findMatchingService(selectedEntry.styleName, allServices) : undefined;

  const handleBook = () => {
    setSelectedEntry(null);
    if (matchedService) onBookService(matchedService.name);
    else navigate("book");
  };

  return (
    <section className="pt-12 px-6 pb-[72px] max-w-[900px] mx-auto">
      <FadeIn>
        <p className="text-gold text-xs font-semibold tracking-[3px] mb-3">GALLERY</p>
        <h2 className="font-cursive text-5xl font-bold mb-2">Styles of the week</h2>
        <p className="text-[15px] text-text-soft mb-10 max-w-[500px] leading-[1.6]">
          Seven looks for seven days. Browse the week's featured styles and book the one that speaks to you.
        </p>
      </FadeIn>

      {error && <ErrorNotice message={error} />}
      {loading && <LoadingNotice label="Loading gallery…" />}

      {!loading && (
        <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
        {entries.map((entry, i) => (
          <FadeIn key={entry.dayOfWeek} delay={0.06 * (i + 1)}>
            <div
              className="hover-lift bg-surface rounded-2xl overflow-hidden border border-border cursor-pointer"
              onClick={() => setSelectedEntry(entry)}
            >
              {/* Image area — shows the uploaded style photo, or a placeholder */}
              <div
                className="h-[200px] flex items-center justify-center relative overflow-hidden"
                style={{
                  background: entry.imageUrl
                    ? `url(${entry.imageUrl}) center/cover no-repeat`
                    : `linear-gradient(135deg, ${t.gold}20, ${t.gold}08)`,
                }}
              >
                {!entry.imageUrl && (
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${t.gold}30, ${t.gold}15)` }}
                  >
                    <Scissors size={28} color={t.gold} strokeWidth={1} />
                  </div>
                )}
                {/* Day badge */}
                <div
                  className={`absolute top-3 left-3 backdrop-blur rounded-[20px] py-1 px-3.5 text-[11px] font-semibold text-gold ${
                    isDark ? "bg-[rgba(0,0,0,0.6)]" : "bg-[rgba(255,255,255,0.85)]"
                  }`}
                  style={{ border: `1px solid ${t.gold}30` }}
                >{entry.dayOfWeek}</div>
              </div>
              <div className="py-4 px-5">
                <h3 className="text-base font-bold mb-1">{entry.styleName}</h3>
                <p className="text-[13px] text-text-muted mb-3">Featured style for {entry.dayOfWeek}</p>
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedEntry(entry); }}
                  className="bg-transparent border-none cursor-pointer text-gold text-[13px] font-semibold p-0 flex items-center gap-1"
                >
                  Book this style <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </FadeIn>
        ))}
      </div>

      {/* CTA */}
      <FadeIn delay={0.5}>
        <div className="text-center mt-12">
          <p className="text-[15px] text-text-soft mb-5">Don't see your style? Upload a picture and get a custom quote.</p>
          <GoldButton
            onClick={() => navigate("book")}
            className="bg-gold text-theme-black border-none py-3.5 px-9 text-sm font-bold cursor-pointer rounded-md inline-flex items-center gap-2"
          >Book with Custom Style <Upload size={16} /></GoldButton>
        </div>
      </FadeIn>
        </>
      )}

      <StyleDetailModal
        open={!!selectedEntry}
        onClose={() => setSelectedEntry(null)}
        imageUrl={selectedEntry?.imageUrl ?? null}
        title={selectedEntry?.styleName ?? ""}
        subtitle={selectedEntry ? `Featured style for ${selectedEntry.dayOfWeek}` : undefined}
        description={selectedEntry?.description}
        price={matchedService ? (matchedService.price || matchedService.priceRange || null) : null}
        priceNote={matchedService && !matchedService.price ? "Final price on request" : null}
        ctaLabel="Book This Style"
        onBook={handleBook}
      />
    </section>
  );
}
