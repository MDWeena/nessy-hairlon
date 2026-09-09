import { useState } from "react";
import { Sparkles } from "lucide-react";
import { services } from "../../constants/services";
import { useTheme } from "../../context/ThemeContext";
import { GoldButton } from "../ui/GoldButton";

export function ServicesManager() {
  const { t } = useTheme();
  const [editingService, setEditingService] = useState<string | null>(null);

  return (
    <>
      {services.map(cat => (
        <div key={cat.cat} style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>{cat.cat}</h3>
            <button style={{
              background: t.goldBg, color: t.gold, border: `1px solid ${t.gold}30`,
              padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
            }}><Sparkles size={12} /> Add Service</button>
          </div>
          <div style={{ background: t.surface, borderRadius: 12, border: `1px solid ${t.border}`, overflow: "hidden" }}>
            {cat.items.map((s, i) => {
              const isEditing = editingService === s.name;
              return (
                <div key={s.name} style={{
                  padding: "16px 20px",
                  borderBottom: i < cat.items.length - 1 ? `1px solid ${t.border}` : "none",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: t.textMuted }}>{s.desc}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                      <div style={{ textAlign: "right" }}>
                        {s.price ? (
                          <span style={{ fontSize: 14, fontWeight: 700 }}>{s.price}</span>
                        ) : (
                          <>
                            <span style={{ fontSize: 13, fontWeight: 700, display: "block" }}>{s.priceRange}</span>
                            <span style={{ fontSize: 11, color: t.textMuted }}>price range</span>
                          </>
                        )}
                      </div>
                      <button onClick={() => setEditingService(isEditing ? null : s.name)} style={{
                        background: isEditing ? t.goldBg : "none", border: `1px solid ${isEditing ? t.gold : t.border}`, borderRadius: 6,
                        padding: "5px 10px", fontSize: 12, color: isEditing ? t.gold : t.textSoft, cursor: "pointer", fontWeight: isEditing ? 600 : 400,
                      }}>{isEditing ? "Cancel" : "Edit"}</button>
                    </div>
                  </div>

                  {isEditing && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${t.border}`, display: "grid", gap: 12 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                          <label style={{ display: "block", fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Service Name</label>
                          <input defaultValue={s.name} style={{
                            width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
                            background: t.bgAlt, fontSize: 13, color: t.text, outline: "none", boxSizing: "border-box",
                          }} />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Duration</label>
                          <input defaultValue={s.duration} style={{
                            width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
                            background: t.bgAlt, fontSize: 13, color: t.text, outline: "none", boxSizing: "border-box",
                          }} />
                        </div>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Description</label>
                        <input defaultValue={s.desc} style={{
                          width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
                          background: t.bgAlt, fontSize: 13, color: t.text, outline: "none", boxSizing: "border-box",
                        }} />
                      </div>
                      {s.price ? (
                        <div>
                          <label style={{ display: "block", fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Fixed Price</label>
                          <input defaultValue={s.price} style={{
                            width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
                            background: t.bgAlt, fontSize: 13, color: t.text, outline: "none", boxSizing: "border-box",
                          }} />
                        </div>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Min Price (₦)</label>
                            <input defaultValue={s.priceRange ? s.priceRange.split("–")[0].replace(/[^\d]/g, "") : ""} placeholder="e.g. 15000" style={{
                              width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
                              background: t.bgAlt, fontSize: 13, color: t.text, outline: "none", boxSizing: "border-box",
                            }} />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Max Price (₦)</label>
                            <input defaultValue={s.priceRange ? s.priceRange.split("–")[1].replace(/[^\d]/g, "") : ""} placeholder="e.g. 45000" style={{
                              width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
                              background: t.bgAlt, fontSize: 13, color: t.text, outline: "none", boxSizing: "border-box",
                            }} />
                          </div>
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        <GoldButton onClick={() => setEditingService(null)} style={{
                          background: t.gold, color: "#0A0A0A", border: "none",
                          padding: "8px 20px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer",
                        }}>Save</GoldButton>
                        <button style={{
                          background: "none", border: `1px solid #EF444440`, borderRadius: 6,
                          padding: "8px 16px", fontSize: 12, color: "#EF4444", cursor: "pointer",
                        }}>Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
