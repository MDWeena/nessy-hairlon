import { useRef, useState } from "react";
import { Upload, ChevronLeft, ChevronDown, X, Package, Link2 } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { uploadToCloudinary } from "../../lib/cloudinary";
import { isValidHttpUrl } from "../../lib/validation";
import type { AttachmentPreference, ServiceCategory } from "../../types";
import { FadeIn } from "../ui/FadeIn";
import { ErrorNotice } from "../ui/ErrorNotice";
import { GoldSpinner } from "../ui/GoldSpinner";
import { ServiceCard } from "./ServiceCard";

const MAX_STYLE_REFERENCE_URLS = 5;

interface StepServicesProps {
  serviceCategories: ServiceCategory[];
  selectedServices: string[];
  onToggleService: (name: string) => void;
  customStyleUrl: string | null;
  onPhotoUploaded: (url: string) => void;
  onPhotoRemoved: () => void;
  customStyleDescription: string;
  onDescriptionChange: (text: string) => void;
  styleReferenceUrls: string[];
  onAddStyleReferenceUrl: (url: string) => void;
  onRemoveStyleReferenceUrl: (url: string) => void;
  attachmentPreference: AttachmentPreference | null;
  onAttachmentPreferenceChange: (pref: AttachmentPreference | null) => void;
  onBack: () => void;
  onContinue: () => void;
}

export function StepServices({
  serviceCategories, selectedServices, onToggleService,
  customStyleUrl, onPhotoUploaded, onPhotoRemoved, customStyleDescription, onDescriptionChange,
  styleReferenceUrls, onAddStyleReferenceUrl, onRemoveStyleReferenceUrl,
  attachmentPreference, onAttachmentPreferenceChange, onBack, onContinue,
}: StepServicesProps) {
  const { t } = useTheme();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [referenceOpen, setReferenceOpen] = useState(true);
  const hasAnyServices = serviceCategories.some(c => c.items.length > 0);

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

  const handleAddLink = () => {
    const url = linkInput.trim();
    if (!url) return;
    if (styleReferenceUrls.length >= MAX_STYLE_REFERENCE_URLS) {
      setLinkError(`You can add up to ${MAX_STYLE_REFERENCE_URLS} links`);
      return;
    }
    if (!isValidHttpUrl(url)) {
      setLinkError("Please enter a valid link starting with http:// or https://");
      return;
    }
    if (styleReferenceUrls.includes(url)) {
      setLinkError("That link has already been added");
      return;
    }
    setLinkError(null);
    onAddStyleReferenceUrl(url);
    setLinkInput("");
  };

  const canContinue = selectedServices.length > 0 || !!customStyleUrl || styleReferenceUrls.length > 0;

  return (
    <FadeIn>
      <div>
        {!hasAnyServices ? (
          <p className="text-sm text-text-muted text-center py-8 mb-8">
            No services available right now — add a reference photo or link below instead.
          </p>
        ) : (
          <div className="mb-6">
            {serviceCategories.map(cat => cat.items.length > 0 && (
              <div key={cat.cat} className="mb-5 last:mb-0">
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="text-sm font-bold text-text">{cat.cat}</h3>
                  <span className="text-xs text-text-muted">Select all that apply</span>
                </div>
                <div className="grid gap-2">
                  {cat.items.map(s => (
                    <ServiceCard key={s.name} service={s} selected={selectedServices.includes(s.name)} onToggle={() => onToggleService(s.name)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mb-8 border border-border rounded-[10px] overflow-hidden">
          <button
            type="button" onClick={() => setReferenceOpen(v => !v)}
            className="w-full flex items-center justify-between py-3.5 px-4 bg-surface cursor-pointer"
          >
            <span className="flex items-center gap-2 text-left">
              <Upload size={16} color={t.gold} />
              <span>
                <span className="block font-bold text-sm text-text">Have a reference photo or link?</span>
                <span className="block text-xs text-text-muted mt-0.5">Upload photos or paste links from Pinterest, Instagram, TikTok, etc.</span>
              </span>
            </span>
            <ChevronDown size={18} className={`shrink-0 ml-2 [transition:transform_0.2s] ${referenceOpen ? "rotate-180" : ""}`} color={t.textMuted} />
          </button>

          <div className={`grid [transition:grid-template-rows_0.3s_ease] ${referenceOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
            <div className="overflow-hidden min-h-0">
              <div className="p-4 pt-1 border-t border-border">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

                {uploadError && <ErrorNotice message={uploadError} />}

                {customStyleUrl ? (
                  <div className="border border-border rounded-2xl p-5 bg-gold-bg flex items-center gap-4 mt-3">
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
                  <div className="border-2 border-dashed border-[#C49A6C40] rounded-2xl p-8 text-center bg-gold-bg mt-3">
                    <Upload size={32} color={t.gold} strokeWidth={1.5} className="mx-auto" />
                    <p className="font-bold text-sm mt-2.5 mb-1">Upload your desired style</p>
                    <p className="text-xs text-text-muted mb-4">Nessy will review and send a custom quote within 24 hours</p>
                    <button
                      onClick={triggerFilePicker} disabled={uploading}
                      className={`bg-surface border border-gold text-text py-2.5 px-6 rounded-lg text-sm font-semibold inline-flex items-center gap-2 ${uploading ? "cursor-wait" : "cursor-pointer"}`}
                    >
                      {uploading && <GoldSpinner size={14} />}
                      {uploading ? "Uploading..." : "Choose Photo"}
                    </button>
                  </div>
                )}

                <div className="mt-4">
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

                <div className="mt-4">
                  <label className="block text-xs text-text-muted mb-1.5 font-medium">
                    Add a link (optional) — {styleReferenceUrls.length}/{MAX_STYLE_REFERENCE_URLS}
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={linkInput}
                      onChange={(e) => { setLinkInput(e.target.value); setLinkError(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddLink(); } }}
                      placeholder="https://pinterest.com/pin/…"
                      disabled={styleReferenceUrls.length >= MAX_STYLE_REFERENCE_URLS}
                      className="flex-1 py-2.5 px-3 rounded-lg border border-border bg-bg-alt text-[13px] text-text outline-none box-border disabled:opacity-60"
                    />
                    <button
                      type="button" onClick={handleAddLink}
                      disabled={!linkInput.trim() || styleReferenceUrls.length >= MAX_STYLE_REFERENCE_URLS}
                      className="shrink-0 bg-surface border border-gold text-text py-2.5 px-4 rounded-lg text-sm font-semibold cursor-pointer disabled:cursor-default disabled:opacity-50 flex items-center gap-1.5"
                    ><Link2 size={14} /> Add Link</button>
                  </div>
                  {linkError && <p className="text-xs text-[#EF4444] mt-1.5">{linkError}</p>}

                  {styleReferenceUrls.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {styleReferenceUrls.map(url => (
                        <span
                          key={url}
                          className="inline-flex items-center gap-1.5 bg-gold-bg border border-[#C49A6C30] rounded-xl py-1 px-2.5 text-xs text-text-soft max-w-full"
                        >
                          <span className="overflow-hidden text-ellipsis whitespace-nowrap max-w-[200px]">{url}</span>
                          <button
                            type="button" onClick={() => onRemoveStyleReferenceUrl(url)} aria-label="Remove link"
                            className="shrink-0 text-text-muted cursor-pointer bg-transparent border-none p-0 flex items-center"
                          ><X size={12} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hair Attachments & Accessories */}
        {(selectedServices.length > 0 || !!customStyleUrl || styleReferenceUrls.length > 0) && (
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
