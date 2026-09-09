import { Scissors, Upload, ChevronLeft } from "lucide-react";
import { services } from "../../constants/services";
import { useTheme } from "../../context/ThemeContext";
import { FadeIn } from "../ui/FadeIn";
import { ServiceCard } from "./ServiceCard";

interface StepServicesProps {
  selectedServices: string[];
  onToggleService: (name: string) => void;
  uploadMode: boolean;
  setUploadMode: (mode: boolean) => void;
  onBack: () => void;
  onContinue: () => void;
}

const allSvc = services.flatMap(s => s.items);

export function StepServices({ selectedServices, onToggleService, uploadMode, setUploadMode, onBack, onContinue }: StepServicesProps) {
  const { t } = useTheme();

  return (
    <FadeIn>
      <div>
        <div style={{ display: "flex", gap: 8, marginBottom: 28 }}>
          {[
            { label: "Choose from menu", icon: Scissors, active: !uploadMode },
            { label: "Upload a style photo", icon: Upload, active: uploadMode },
          ].map(({ label, icon: Icon, active }) => (
            <button key={label} onClick={() => setUploadMode(label.includes("Upload"))} style={{
              flex: 1, padding: "14px", borderRadius: 10, cursor: "pointer",
              border: active ? `2px solid ${t.gold}` : `1px solid ${t.border}`,
              background: active ? t.goldBg : t.surface,
              fontWeight: active ? 700 : 500, fontSize: 13, color: t.text,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              transition: "all 0.2s",
            }}>
              <Icon size={16} color={active ? t.gold : t.textMuted} /> {label}
            </button>
          ))}
        </div>

        {!uploadMode ? (
          <div style={{ display: "grid", gap: 8, marginBottom: 32 }}>
            {allSvc.map(s => (
              <ServiceCard key={s.name} service={s} selected={selectedServices.includes(s.name)} onToggle={() => onToggleService(s.name)} />
            ))}
          </div>
        ) : (
          <div style={{
            border: `2px dashed ${t.gold}40`, borderRadius: 16,
            padding: 48, textAlign: "center", marginBottom: 32,
            background: t.goldBg,
          }}>
            <Upload size={40} color={t.gold} strokeWidth={1.5} />
            <p style={{ fontWeight: 700, fontSize: 16, marginTop: 12, marginBottom: 6 }}>Upload your desired style</p>
            <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 20 }}>Nessy will review and send a custom quote within 24 hours</p>
            <button style={{
              background: t.surface, border: `1px solid ${t.gold}`, color: t.text,
              padding: "10px 24px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}>Choose Photo</button>
          </div>
        )}

        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onBack} style={{
            flex: 1, background: t.surface, color: t.text, border: `1px solid ${t.border}`,
            padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer", borderRadius: 6,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}><ChevronLeft size={16} /> Back</button>
          <button onClick={onContinue} disabled={selectedServices.length === 0 && !uploadMode} style={{
            flex: 2, background: (selectedServices.length > 0 || uploadMode) ? t.gold : t.border,
            color: (selectedServices.length > 0 || uploadMode) ? "#0A0A0A" : t.textMuted,
            border: "none", padding: "12px", fontSize: 14, fontWeight: 700,
            cursor: (selectedServices.length > 0 || uploadMode) ? "pointer" : "default", borderRadius: 6,
          }}>Review Booking</button>
        </div>
      </div>
    </FadeIn>
  );
}
