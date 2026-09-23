import { useState } from "react";
import { Search, History, ChevronRight, RotateCcw } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { lookupBookings } from "../../hooks/useBookingLookup";
import type { TrackedBooking } from "../../hooks/useBookingLookup";
import { FadeIn } from "../ui/FadeIn";
import { GoldButton } from "../ui/GoldButton";
import { ErrorNotice } from "../ui/ErrorNotice";
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
      <div style={{ background: t.surface, borderRadius: 16, padding: 28, border: `1px solid ${t.border}`, marginBottom: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
          <History size={18} color={t.gold} strokeWidth={1.5} /> Booked with us before?
        </h3>
        <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 18 }}>
          Enter your phone number to find your past appointments, or skip and book something new.
        </p>

        {!searched ? (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input
                value={phone} onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="080..."
                style={{
                  flex: 1, padding: "12px 14px", borderRadius: 10, border: `1px solid ${t.border}`,
                  background: t.bgAlt, fontSize: 14, color: t.text, outline: "none", boxSizing: "border-box",
                }}
              />
              <GoldButton onClick={handleSearch} disabled={loading} style={{
                background: t.gold, color: "#0A0A0A", border: "none",
                padding: "0 20px", borderRadius: 10, fontSize: 14, fontWeight: 700,
                cursor: loading ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 8,
              }}>
                <Search size={16} /> {loading ? "Searching…" : "Find me"}
              </GoldButton>
            </div>
            {error && <ErrorNotice message={error} />}
            <button onClick={onContinueFresh} style={{
              background: "none", border: "none", cursor: "pointer", color: t.textMuted,
              fontSize: 13, padding: 0, display: "flex", alignItems: "center", gap: 4,
            }}>Skip, book something new <ChevronRight size={14} /></button>
          </>
        ) : results.length === 0 ? (
          <>
            <p style={{ fontSize: 14, color: t.textSoft, marginBottom: 16 }}>
              No previous bookings found. Let's get you started!
            </p>
            <GoldButton onClick={onContinueFresh} style={{
              background: t.gold, color: "#0A0A0A", border: "none",
              padding: "12px 24px", borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}>Continue</GoldButton>
          </>
        ) : (
          <>
            <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
              {results.map(b => (
                <div key={b.reference} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "14px 16px", borderRadius: 10, border: `1px solid ${t.border}`, background: t.bgAlt,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {b.serviceNames.length > 0 ? b.serviceNames.join(", ") : "Custom style"}
                    </div>
                    <div style={{ fontSize: 12, color: t.textMuted, marginTop: 2 }}>{b.date}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, marginLeft: 12 }}>
                    <StatusBadge status={b.status} />
                    {b.status === "completed" && b.serviceNames.length > 0 && (
                      <button onClick={() => onBookAgain(b.serviceNames)} style={{
                        background: t.goldBg, border: `1px solid ${t.gold}30`, color: t.gold,
                        padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                        cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                      }}><RotateCcw size={12} /> Book again</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={onContinueFresh} style={{
              background: "none", border: "none", cursor: "pointer", color: t.textMuted,
              fontSize: 13, padding: 0, display: "flex", alignItems: "center", gap: 4,
            }}>Book something new instead <ChevronRight size={14} /></button>
          </>
        )}
      </div>
    </FadeIn>
  );
}
