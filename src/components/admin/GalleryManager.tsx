import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { useGallery } from "../../hooks/useGallery";
import { LoadingNotice } from "../ui/LoadingNotice";
import { ErrorNotice } from "../ui/ErrorNotice";

export function GalleryManager() {
  const { t } = useTheme();
  const { entries, loading, error, updateStyleName, uploadImageForDay } = useGallery();
  const [actionError, setActionError] = useState<string | null>(null);
  const [uploadingDay, setUploadingDay] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingDayRef = useRef<string | null>(null);

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

  if (loading) return <LoadingNotice label="Loading gallery…" />;

  return (
    <>
      {error && <ErrorNotice message={error} />}
      {actionError && <ErrorNotice message={actionError} />}

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />

      <p style={{ fontSize: 14, color: t.textSoft, marginBottom: 24, maxWidth: 480 }}>
        Update the "Styles of the Week" gallery. Each day features one look — upload a photo and name the style. Images are saved to Cloudinary.
      </p>

      <div style={{ display: "grid", gap: 12 }}>
        {entries.map((s) => {
          const hasImage = !!s.imageUrl;
          const isUploading = uploadingDay === s.dayOfWeek;
          return (
            <div key={s.dayOfWeek} style={{
              display: "flex", alignItems: "center", gap: 16,
              background: t.surface, borderRadius: 12, padding: "14px 20px",
              border: `1px solid ${t.border}`,
            }}>
              {/* Day label */}
              <span style={{
                fontSize: 11, fontWeight: 700, color: t.gold, minWidth: 70,
                padding: "4px 10px", background: t.goldBg, borderRadius: 6, textAlign: "center",
                border: `1px solid ${t.gold}20`,
              }}>{s.dayOfWeek.slice(0, 3)}</span>

              {/* Image thumbnail placeholder */}
              <div style={{
                width: 48, height: 48, borderRadius: 8, flexShrink: 0,
                background: hasImage ? `linear-gradient(135deg, ${t.gold}30, ${t.gold}15)` : t.bgAlt,
                backgroundImage: hasImage ? `url(${s.imageUrl})` : undefined,
                backgroundSize: "cover", backgroundPosition: "center",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: `1px solid ${hasImage ? t.gold + "30" : t.border}`,
              }}>
                {!hasImage && <Upload size={16} color={t.textMuted} />}
              </div>

              {/* Style name */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{s.styleName}</div>
                <div style={{ fontSize: 12, color: hasImage ? t.gold : t.textMuted }}>
                  {isUploading ? "Uploading…" : hasImage ? "Image uploaded" : "No image yet"}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => triggerUpload(s.dayOfWeek)} disabled={isUploading} style={{
                  background: t.goldBg, border: `1px solid ${t.gold}30`, borderRadius: 6,
                  padding: "6px 12px", fontSize: 12, fontWeight: 600,
                  cursor: isUploading ? "wait" : "pointer", color: t.gold,
                }}>{hasImage ? "Replace" : "Upload"}</button>
                <button onClick={() => editName(s.dayOfWeek, s.styleName)} style={{
                  background: "none", border: `1px solid ${t.border}`, borderRadius: 6,
                  padding: "6px 12px", fontSize: 12, cursor: "pointer", color: t.textSoft,
                }}>Edit Name</button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
