import { useState } from "react";
import { Search, History, ChevronRight, RotateCcw } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { lookupBookings } from "../../hooks/useBookingLookup";
import type { TrackedBooking } from "../../hooks/useBookingLookup";
import { FadeIn } from "../ui/FadeIn";
import { GoldButton } from "../ui/GoldButton";
import { ErrorNotice } from "../ui/ErrorNotice";
import { GoldSpinner } from "../ui/GoldSpinner";
import { StatusBadge } from "../ui/StatusBadge";

interface StepClientHistoryProps {
  onContinueFresh: () => void;
  onBookAgain: (serviceNames: string[]) => void;
}

export function StepClientHistory({ onContinueFresh, onBookAgain }: StepClientHistoryProps) {
  const { t } = useTheme();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<TrackedBooking[]>([]);

  const handleSearch = async () => {
    const trimmed = phone.trim();
    if (!trimmed) { setError("Enter the phone number you booked with"); return; }
    setLoading(true);
    setError(null);
    try {
      const found = await lookupBookings({ phone: trimmed });
      setResults(found);
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <FadeIn>
      <div className="bg-surface rounded-2xl p-7 border border-border mb-5">
        <h3 className="text-base font-bold mb-1.5 flex items-center gap-2">
          <History size={18} color={t.gold} strokeWidth={1.5} /> Booked with us before?
        </h3>
        <p className="text-[13px] text-text-muted mb-[18px]">
          Enter your phone number to find your past appointments, or skip and book something new.
        </p>

        {!searched ? (
          <>
            <div className="flex gap-2 mb-3">
              <input
                value={phone} onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="080..."
                className="flex-1 py-3 px-3.5 rounded-[10px] border border-border bg-bg-alt text-sm text-text outline-none box-border"
              />
              <GoldButton
                onClick={handleSearch} disabled={loading}
                className={`bg-gold text-theme-black border-none py-0 px-5 rounded-[10px] text-sm font-bold flex items-center gap-2 ${loading ? "cursor-wait" : "cursor-pointer"}`}
              >
                {loading ? <GoldSpinner size={16} color="#0A0A0A" /> : <Search size={16} />} {loading ? "Searching…" : "Find me"}
              </GoldButton>
            </div>
            {error && <ErrorNotice message={error} />}
            <button onClick={onContinueFresh} className="bg-transparent border-none cursor-pointer text-text-muted text-[13px] p-0 flex items-center gap-1">
              Skip, book something new <ChevronRight size={14} />
            </button>
          </>
        ) : results.length === 0 ? (
          <>
            <p className="text-sm text-text-soft mb-4">
              No previous bookings found. Let's get you started!
            </p>
            <GoldButton onClick={onContinueFresh} className="bg-gold text-theme-black border-none py-3 px-6 rounded-md text-sm font-bold cursor-pointer">
              Continue
            </GoldButton>
          </>
        ) : (
          <>
            <div className="grid gap-2.5 mb-4">
              {results.map(b => (
                <div key={b.reference} className="flex justify-between items-center py-3.5 px-4 rounded-[10px] border border-border bg-bg-alt">
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold">
                      {b.serviceNames.length > 0 ? b.serviceNames.join(", ") : "Custom style"}
                    </div>
                    <div className="text-xs text-text-muted mt-0.5">{b.date}</div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0 ml-3">
                    <StatusBadge status={b.status} />
                    {b.status === "completed" && b.serviceNames.length > 0 && (
                      <button
                        onClick={() => onBookAgain(b.serviceNames)}
                        className="bg-gold-bg text-gold py-1.5 px-3 rounded-md text-xs font-bold cursor-pointer flex items-center gap-1"
                        style={{ border: `1px solid ${t.gold}30` }}
                      ><RotateCcw size={12} /> Book again</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={onContinueFresh} className="bg-transparent border-none cursor-pointer text-text-muted text-[13px] p-0 flex items-center gap-1">
              Book something new instead <ChevronRight size={14} />
            </button>
          </>
        )}
      </div>
    </FadeIn>
  );
}
