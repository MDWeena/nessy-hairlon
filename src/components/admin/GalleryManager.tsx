import { useState } from "react";
import { Check, Upload } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

interface GalleryStyleSlot {
  day: string;
  name: string;
  hasImage: boolean;
}

const INITIAL_STYLES: GalleryStyleSlot[] = [
  { day: "Monday", name: "Goddess Locs", hasImage: true },
  { day: "Tuesday", name: "Knotless Braids", hasImage: true },
  { day: "Wednesday", name: "Fulani Braids", hasImage: false },
  { day: "Thursday", name: "Passion Twists", hasImage: true },
  { day: "Friday", name: "Feed-in Cornrows", hasImage: true },
  { day: "Saturday", name: "Butterfly Locs", hasImage: false },
  { day: "Sunday", name: "Bohemian Twists", hasImage: true },
];

export function GalleryManager() {
  const { t } = useTheme();
  const [styles] = useState<GalleryStyleSlot[]>(INITIAL_STYLES);

  return (
    <>
      <p style={{ fontSize: 14, color: t.textSoft, marginBottom: 24, maxWidth: 480 }}>
        Update the "Styles of the Week" gallery. Each day features one look — upload a photo and name the style. Images are saved to Cloudinary.
      </p>

      <div style={{ display: "grid", gap: 12 }}>
        {styles.map((s) => (
          <div key={s.day} style={{
            display: "flex", alignItems: "center", gap: 16,
            background: t.surface, borderRadius: 12, padding: "14px 20px",
            border: `1px solid ${t.border}`,
          }}>
            {/* Day label */}
            <span style={{
              fontSize: 11, fontWeight: 700, color: t.gold, minWidth: 70,
              padding: "4px 10px", background: t.goldBg, borderRadius: 6, textAlign: "center",
              border: `1px solid ${t.gold}20`,
            }}>{s.day.slice(0, 3)}</span>

            {/* Image thumbnail placeholder */}
            <div style={{
              width: 48, height: 48, borderRadius: 8, flexShrink: 0,
              background: s.hasImage ? `linear-gradient(135deg, ${t.gold}30, ${t.gold}15)` : t.bgAlt,
              display: "flex", alignItems: "center", justifyContent: "center",
              border: `1px solid ${s.hasImage ? t.gold + "30" : t.border}`,
            }}>
              {s.hasImage ? <Check size={18} color={t.gold} /> : <Upload size={16} color={t.textMuted} />}
            </div>

            {/* Style name */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</div>
              <div style={{ fontSize: 12, color: s.hasImage ? t.gold : t.textMuted }}>
                {s.hasImage ? "Image uploaded" : "No image yet"}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{
                background: t.goldBg, border: `1px solid ${t.gold}30`, borderRadius: 6,
                padding: "6px 12px", fontSize: 12, fontWeight: 600,
                cursor: "pointer", color: t.gold,
              }}>{s.hasImage ? "Replace" : "Upload"}</button>
              <button style={{
                background: "none", border: `1px solid ${t.border}`, borderRadius: 6,
                padding: "6px 12px", fontSize: 12, cursor: "pointer", color: t.textSoft,
              }}>Edit Name</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
