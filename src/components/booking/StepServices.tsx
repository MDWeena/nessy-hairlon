import { useRef, useState } from "react";
import { Scissors, Upload, ChevronLeft, Loader2, X, Package } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { uploadToCloudinary } from "../../lib/cloudinary";
import type { AttachmentPreference, ServiceItem } from "../../types";
import { FadeIn } from "../ui/FadeIn";
import { ErrorNotice } from "../ui/ErrorNotice";
import { ServiceCard } from "./ServiceCard";

interface StepServicesProps {
  allServices: ServiceItem[];
  selectedServices: string[];
  onToggleService: (name: string) => void;
  uploadMode: boolean;
  setUploadMode: (mode: boolean) => void;
  customStyleUrl: string | null;
  onPhotoUploaded: (url: string) => void;
  onPhotoRemoved: () => void;
  customStyleDescription: string;
  onDescriptionChange: (text: string) => void;
  attachmentPreference: AttachmentPreference | null;
  onAttachmentPreferenceChange: (pref: AttachmentPreference | null) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function StepServices({
  allServices, selectedServices, onToggleService, uploadMode, setUploadMode,
  customStyleUrl, onPhotoUploaded, onPhotoRemoved, customStyleDescription, onDescriptionChange,
  attachmentPreference, onAttachmentPreferenceChange, onBack, onContinue,
}: StepServicesProps) {
  const { t } = useTheme();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const triggerFilePicker = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const url = await uploadToCloudinary(file);
      onPhotoUploaded(url);
    } catch {
      setUploadError("Upload failed, please try again");
    } finally {
      setUploading(false);
    }
  };

  const canContinue = selectedServices.length > 0 || !!customStyleUrl;

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
            {allServices.map(s => (
              <ServiceCard key={s.name} service={s} selected={selectedServices.includes(s.name)} onToggle={() => onToggleService(s.name)} />
            ))}
          </div>
        ) : (
          <div style={{ marginBottom: 32 }}>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />

            {uploadError && <ErrorNotice message={uploadError} />}

            {customStyleUrl ? (
              <div style={{
                border: `1px solid ${t.border}`, borderRadius: 16, padding: 20,
                background: t.goldBg, display: "flex", alignItems: "center", gap: 16,
              }}>
                <img src={customStyleUrl} alt="Uploaded style" style={{
                  width: 88, height: 88, borderRadius: 10, objectFit: "cover", border: `1px solid ${t.gold}40`, flexShrink: 0,
                }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: t.text }}>Photo uploaded</p>
                  <p style={{ fontSize: 12, color: t.textMuted, marginBottom: 10 }}>Nessy will review and send a custom quote within 24 hours</p>
                  <button onClick={onPhotoRemoved} style={{
                    background: "none", border: `1px solid #EF444440`, borderRadius: 6,
                    padding: "5px 12px", fontSize: 12, color: "#EF4444", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 4,
                  }}><X size={12} /> Remove</button>
                </div>
              </div>
            ) : (
              <div style={{
                border: `2px dashed ${t.gold}40`, borderRadius: 16,
                padding: 48, textAlign: "center",
                background: t.goldBg,
              }}>
                <Upload size={40} color={t.gold} strokeWidth={1.5} />
                <p style={{ fontWeight: 700, fontSize: 16, marginTop: 12, marginBottom: 6 }}>Upload your desired style</p>
                <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 20 }}>Nessy will review and send a custom quote within 24 hours</p>
                <button onClick={triggerFilePicker} disabled={uploading} style={{
                  background: t.surface, border: `1px solid ${t.gold}`, color: t.text,
                  padding: "10px 24px", borderRadius: 8, fontSize: 14, fontWeight: 600,
                  cursor: uploading ? "wait" : "pointer",
                  display: "inline-flex", alignItems: "center", gap: 8,
                }}>
                  {uploading && <Loader2 size={14} style={{ animation: "loaderSpin 1s linear infinite" }} />}
                  {uploading ? "Uploading..." : "Choose Photo"}
                </button>
              </div>
            )}

            <div style={{ marginTop: 20 }}>
              <label style={{ display: "block", fontSize: 12, color: t.textMuted, marginBottom: 6, fontWeight: 500 }}>
                Describe the style you'd like (optional)
              </label>
              <textarea
                value={customStyleDescription} onChange={(e) => onDescriptionChange(e.target.value)}
                placeholder="e.g. Medium knotless braids, shoulder length, honey blonde tips…"
                rows={3}
                style={{
                  width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
                  background: t.bgAlt, fontSize: 13, color: t.text, outline: "none", boxSizing: "border-box",
                  fontFamily: "inherit", resize: "vertical",
                }}
              />
            </div>
          </div>
        )}

        {/* Hair Attachments & Accessories */}
        {(selectedServices.length > 0 || !!customStyleUrl) && (
          <div style={{
            background: t.surface, borderRadius: 12, padding: 20,
            border: `1px solid ${t.border}`, marginBottom: 20,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Package size={16} color={t.gold} />
              <span style={{ fontSize: 14, fontWeight: 700, color: t.text }}>Hair Attachments / Accessories</span>
            </div>
            <p style={{ fontSize: 12, color: t.textMuted, marginBottom: 14, lineHeight: 1.5 }}>
              Will you need hair attachments or accessories for this style?
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              {([
                { value: "client_provides" as const, label: "I'll bring my own", desc: "You'll provide your own hair attachments/accessories" },
                { value: "nessy_buys" as const, label: "Nessy will purchase for me", desc: "Cost of materials will be added to your quote" },
              ]).map(({ value, label, desc }) => (
                <button key={value} onClick={() => onAttachmentPreferenceChange(attachmentPreference === value ? null : value)} style={{
                  display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 14px",
                  borderRadius: 10, cursor: "pointer", textAlign: "left",
                  border: attachmentPreference === value ? `2px solid ${t.gold}` : `1px solid ${t.border}`,
                  background: attachmentPreference === value ? t.goldBg : "transparent",
                  transition: "all 0.2s",
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                    border: attachmentPreference === value ? `2px solid ${t.gold}` : `2px solid ${t.border}`,
                    background: attachmentPreference === value ? t.gold : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {attachmentPreference === value && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{label}</div>
                    <div style={{ fontSize: 11, color: t.textMuted, marginTop: 2 }}>{desc}</div>
                  </div>
                </button>
              ))}
            </div>
            {attachmentPreference === "nessy_buys" && (
              <div style={{
                marginTop: 12, padding: "10px 14px", borderRadius: 8,
                background: t.goldBg, border: `1px solid ${t.gold}20`,
                fontSize: 12, color: t.textSoft, lineHeight: 1.5,
              }}>
                💡 Your deposit will cover the full cost of materials plus 50% of the styling fee.
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onBack} style={{
            flex: 1, background: t.surface, color: t.text, border: `1px solid ${t.border}`,
            padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer", borderRadius: 6,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}><ChevronLeft size={16} /> Back</button>
          <button onClick={onContinue} disabled={!canContinue} style={{
            flex: 2, background: canContinue ? t.gold : t.border,
            color: canContinue ? "#0A0A0A" : t.textMuted,
            border: "none", padding: "12px", fontSize: 14, fontWeight: 700,
            cursor: canContinue ? "pointer" : "default", borderRadius: 6,
          }}>Review Booking</button>
        </div>
      </div>
    </FadeIn>
  );
}
