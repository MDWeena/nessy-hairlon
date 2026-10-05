import { useRef, useState } from "react";
import { Scissors, Upload, ChevronLeft, X, Package } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { uploadToCloudinary } from "../../lib/cloudinary";
import type { AttachmentPreference, ServiceItem } from "../../types";
import { FadeIn } from "../ui/FadeIn";
import { ErrorNotice } from "../ui/ErrorNotice";
import { GoldSpinner } from "../ui/GoldSpinner";
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
        <div className="flex gap-2 mb-7">
          {[
            { label: "Choose from menu", icon: Scissors, active: !uploadMode },
            { label: "Upload a style photo", icon: Upload, active: uploadMode },
          ].map(({ label, icon: Icon, active }) => (
            <button
              key={label} onClick={() => setUploadMode(label.includes("Upload"))}
              className={`flex-1 p-3.5 rounded-[10px] cursor-pointer text-[13px] text-text flex items-center justify-center gap-2 [transition:all_0.2s] border ${
                active ? "border-2 border-gold bg-gold-bg font-bold" : "border-border bg-surface font-medium"
              }`}
            >
              <Icon size={16} color={active ? t.gold : t.textMuted} /> {label}
            </button>
          ))}
        </div>

        {!uploadMode ? (
          allServices.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-8 mb-8">
              No services available right now — try uploading a style photo instead.
            </p>
          ) : (
          <div className="grid gap-2 mb-8">
            {allServices.map(s => (
              <ServiceCard key={s.name} service={s} selected={selectedServices.includes(s.name)} onToggle={() => onToggleService(s.name)} />
            ))}
          </div>
          )
        ) : (
          <div className="mb-8">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

            {uploadError && <ErrorNotice message={uploadError} />}

            {customStyleUrl ? (
              <div className="border border-border rounded-2xl p-5 bg-gold-bg flex items-center gap-4">
                <img
                  src={customStyleUrl} alt="Uploaded style"
                  className="w-[88px] h-[88px] rounded-[10px] object-cover shrink-0 border border-[#C49A6C40]"
                />
                <div className="flex-1">
                  <p className="font-bold text-sm mb-1 text-text">Photo uploaded</p>
                  <p className="text-xs text-text-muted mb-2.5">Nessy will review and send a custom quote within 24 hours</p>
                  <button
                    onClick={onPhotoRemoved}
                    className="bg-transparent border border-[#EF444440] rounded-md py-[5px] px-3 text-xs text-[#EF4444] cursor-pointer flex items-center gap-1"
                  ><X size={12} /> Remove</button>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-[#C49A6C40] rounded-2xl p-12 text-center bg-gold-bg">
                <Upload size={40} color={t.gold} strokeWidth={1.5} />
                <p className="font-bold text-base mt-3 mb-1.5">Upload your desired style</p>
                <p className="text-[13px] text-text-muted mb-5">Nessy will review and send a custom quote within 24 hours</p>
                <button
                  onClick={triggerFilePicker} disabled={uploading}
                  className={`bg-surface border border-gold text-text py-2.5 px-6 rounded-lg text-sm font-semibold inline-flex items-center gap-2 ${uploading ? "cursor-wait" : "cursor-pointer"}`}
                >
                  {uploading && <GoldSpinner size={14} />}
                  {uploading ? "Uploading..." : "Choose Photo"}
                </button>
              </div>
            )}

            <div className="mt-5">
              <label className="block text-xs text-text-muted mb-1.5 font-medium">
                Describe the style you'd like (optional)
              </label>
              <textarea
                value={customStyleDescription} onChange={(e) => onDescriptionChange(e.target.value)}
                placeholder="e.g. Medium knotless braids, shoulder length, honey blonde tips…"
                rows={3}
                className="w-full py-2.5 px-3 rounded-lg border border-border bg-bg-alt text-[13px] text-text outline-none box-border [font-family:inherit] resize-y"
              />
            </div>
          </div>
        )}

        {/* Hair Attachments & Accessories */}
        {(selectedServices.length > 0 || !!customStyleUrl) && (
          <div className="bg-surface rounded-xl p-5 border border-border mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Package size={16} color={t.gold} />
              <span className="text-sm font-bold text-text">Hair Attachments / Accessories</span>
            </div>
            <p className="text-xs text-text-muted mb-3.5 leading-[1.5]">
              Will you need hair attachments or accessories for this style?
            </p>
            <div className="grid gap-2">
              {([
                { value: "client_provides" as const, label: "I'll bring my own", desc: "You'll provide your own hair attachments/accessories" },
                { value: "nessy_buys" as const, label: "Nessy will purchase for me", desc: "Cost of materials will be added to your quote" },
              ]).map(({ value, label, desc }) => (
                <button
                  key={value} onClick={() => onAttachmentPreferenceChange(attachmentPreference === value ? null : value)}
                  className={`flex items-start gap-3 py-3 px-3.5 rounded-[10px] cursor-pointer text-left [transition:all_0.2s] border ${
                    attachmentPreference === value ? "border-2 border-gold bg-gold-bg" : "border-border bg-transparent"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full shrink-0 mt-px flex items-center justify-center border-2 ${
                      attachmentPreference === value ? "border-gold bg-gold" : "border-border bg-transparent"
                    }`}
                  >
                    {attachmentPreference === value && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-text">{label}</div>
                    <div className="text-[11px] text-text-muted mt-0.5">{desc}</div>
                  </div>
                </button>
              ))}
            </div>
            {attachmentPreference === "nessy_buys" && (
              <div className="mt-3 py-2.5 px-3.5 rounded-lg bg-gold-bg border border-[#C49A6C20] text-xs text-text-soft leading-[1.5]">
                💡 Your deposit will cover the full cost of materials plus 50% of the styling fee.
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 bg-surface text-text border border-border py-3 text-sm font-semibold cursor-pointer rounded-md flex items-center justify-center gap-1.5"
          ><ChevronLeft size={16} /> Back</button>
          <button
            onClick={onContinue} disabled={!canContinue}
            className={`flex-[2] border-none py-3 text-sm font-bold rounded-md ${
              canContinue ? "bg-gold text-theme-black cursor-pointer" : "bg-border text-text-muted cursor-default"
            }`}
          >Review Booking</button>
        </div>
      </div>
    </FadeIn>
  );
}
