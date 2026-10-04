import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { useGallery } from "../../hooks/useGallery";
import { LoadingNotice } from "../ui/LoadingNotice";
import { ErrorNotice } from "../ui/ErrorNotice";
import { GoldSpinner } from "../ui/GoldSpinner";

export function GalleryManager() {
  const { t } = useTheme();
  const { entries, loading, error, updateStyleName, uploadImageForDay, updateDescription } = useGallery();
  const [actionError, setActionError] = useState<string | null>(null);
  const [uploadingDay, setUploadingDay] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingDayRef = useRef<string | null>(null);
  const [descDrafts, setDescDrafts] = useState<Record<string, string>>({});
  const [savingDescDay, setSavingDescDay] = useState<string | null>(null);

  const triggerUpload = (dayOfWeek: string) => {
    setActionError(null);
    pendingDayRef.current = dayOfWeek;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const dayOfWeek = pendingDayRef.current;
    e.target.value = "";
    if (!file || !dayOfWeek) return;
    setUploadingDay(dayOfWeek);
    setActionError(null);
    try {
      await uploadImageForDay(dayOfWeek, file);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setUploadingDay(null);
    }
  };

  const editName = async (dayOfWeek: string, currentName: string) => {
    const next = window.prompt(`Style name for ${dayOfWeek}`, currentName);
    if (next === null || !next.trim() || next === currentName) return;
    setActionError(null);
    try {
      await updateStyleName(dayOfWeek, next.trim());
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update style name");
    }
  };

  const saveDescription = async (dayOfWeek: string, currentDescription: string | null) => {
    const draft = (descDrafts[dayOfWeek] ?? currentDescription ?? "").trim();
    setActionError(null);
    setSavingDescDay(dayOfWeek);
    try {
      await updateDescription(dayOfWeek, draft);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update description");
    } finally {
      setSavingDescDay(null);
    }
  };

  if (loading) return <LoadingNotice label="Loading gallery…" />;

  return (
    <>
      {error && <ErrorNotice message={error} />}
      {actionError && <ErrorNotice message={actionError} />}

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      <p className="text-sm text-text-soft mb-6 max-w-[480px]">
        Update the "Styles of the Week" gallery. Each day features one look — upload a photo and name the style. Images are saved to Cloudinary.
      </p>

      <div className="grid gap-3">
        {entries.map((s) => {
          const hasImage = !!s.imageUrl;
          const isUploading = uploadingDay === s.dayOfWeek;
          return (
            <div key={s.dayOfWeek} className="flex items-center gap-4 bg-surface rounded-xl py-3.5 px-5 border border-border flex-wrap gap-y-3">
              {/* Day label */}
              <span
                className="text-[11px] font-bold text-gold min-w-[70px] py-1 px-2.5 bg-gold-bg rounded-md text-center"
                style={{ border: `1px solid ${t.gold}20` }}
              >{s.dayOfWeek.slice(0, 3)}</span>

              {/* Image thumbnail placeholder */}
              <div
                className="w-12 h-12 rounded-lg shrink-0 bg-cover bg-center flex items-center justify-center"
                style={{
                  background: hasImage ? `linear-gradient(135deg, ${t.gold}30, ${t.gold}15)` : t.bgAlt,
                  backgroundImage: hasImage ? `url(${s.imageUrl})` : undefined,
                  backgroundSize: "cover", backgroundPosition: "center",
                  border: `1px solid ${hasImage ? t.gold + "30" : t.border}`,
                }}
              >
                {!hasImage && <Upload size={16} color={t.textMuted} />}
              </div>

              {/* Style name */}
              <div className="flex-1 min-w-[120px]">
                <div className="text-sm font-semibold">{s.styleName}</div>
                <div className={`text-xs flex items-center gap-1.5 ${hasImage ? "text-gold" : "text-text-muted"}`}>
                  {isUploading && <GoldSpinner size={11} />}
                  {isUploading ? "Uploading…" : hasImage ? "Image uploaded" : "No image yet"}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => triggerUpload(s.dayOfWeek)} disabled={isUploading}
                  className={`bg-gold-bg rounded-md py-1.5 px-3 text-xs font-semibold text-gold ${isUploading ? "cursor-wait" : "cursor-pointer"}`}
                  style={{ border: `1px solid ${t.gold}30` }}
                >{hasImage ? "Replace" : "Upload"}</button>
                <button
                  onClick={() => editName(s.dayOfWeek, s.styleName)}
                  className="bg-transparent border border-border rounded-md py-1.5 px-3 text-xs cursor-pointer text-text-soft"
                >Edit Name</button>
              </div>

              {/* Description */}
              <div className="basis-full flex gap-2 items-start">
                <textarea
                  value={descDrafts[s.dayOfWeek] ?? s.description ?? ""}
                  onChange={(e) => setDescDrafts({ ...descDrafts, [s.dayOfWeek]: e.target.value })}
                  placeholder="Brief description shown in the style detail popup…"
                  rows={2}
                  className="flex-1 py-2 px-3 rounded-lg border border-border bg-bg-alt text-[13px] text-text outline-none [font-family:inherit] resize-y box-border"
                />
                <button
                  onClick={() => saveDescription(s.dayOfWeek, s.description)}
                  disabled={savingDescDay === s.dayOfWeek}
                  className={`bg-gold-bg rounded-md py-2 px-3.5 text-xs font-semibold text-gold shrink-0 flex items-center gap-1.5 ${savingDescDay === s.dayOfWeek ? "cursor-wait" : "cursor-pointer"}`}
                  style={{ border: `1px solid ${t.gold}30` }}
                >{savingDescDay === s.dayOfWeek && <GoldSpinner size={12} />} {savingDescDay === s.dayOfWeek ? "Saving…" : "Save"}</button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
