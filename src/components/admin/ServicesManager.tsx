import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useServices } from "../../hooks/useServices";
import type { ServiceInput } from "../../hooks/useServices";
import { useTheme } from "../../context/ThemeContext";
import { GoldButton } from "../ui/GoldButton";
import { LoadingNotice } from "../ui/LoadingNotice";
import { ErrorNotice } from "../ui/ErrorNotice";

interface ServiceDraft {
  name: string;
  duration: string;
  description: string;
  price: string;
  minPrice: string;
  maxPrice: string;
}

const EMPTY_DRAFT: ServiceDraft = { name: "", duration: "", description: "", price: "", minPrice: "", maxPrice: "" };

export function ServicesManager() {
  const { t } = useTheme();
  const { services, loading, error, addService, updateService, deleteService } = useServices();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingCategory, setAddingCategory] = useState<string | null>(null);
  const [draft, setDraft] = useState<ServiceDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const startEdit = (id: string, hasFixedPrice: boolean, current: ServiceDraft) => {
    setActionError(null);
    setAddingCategory(null);
    setEditingId(id);
    setDraft({ ...current, price: hasFixedPrice ? current.price : "", minPrice: hasFixedPrice ? "" : current.minPrice, maxPrice: hasFixedPrice ? "" : current.maxPrice });
  };

  const startAdd = (category: string) => {
    setActionError(null);
    setEditingId(null);
    setAddingCategory(category);
    setDraft(EMPTY_DRAFT);
  };

  const cancel = () => {
    setEditingId(null);
    setAddingCategory(null);
    setActionError(null);
  };

  const saveEdit = async (id: string, hasFixedPrice: boolean) => {
    setSaving(true);
    setActionError(null);
    try {
      const input: Partial<ServiceInput> = {
        name: draft.name, duration: draft.duration, description: draft.description,
      };
      if (hasFixedPrice) {
        input.price = draft.price;
        input.priceRangeMin = null;
        input.priceRangeMax = null;
      } else {
        input.price = null;
        input.priceRangeMin = draft.minPrice ? parseInt(draft.minPrice, 10) : null;
        input.priceRangeMax = draft.maxPrice ? parseInt(draft.maxPrice, 10) : null;
      }
      await updateService(id, input);
      setEditingId(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to save service");
    } finally {
      setSaving(false);
    }
  };

  const saveNew = async (category: string) => {
    setSaving(true);
    setActionError(null);
    const isFixedPrice = category === "Treatments";
    try {
      await addService({
        category,
        name: draft.name,
        duration: draft.duration,
        description: draft.description,
        price: isFixedPrice ? draft.price : null,
        priceRangeMin: isFixedPrice ? null : (draft.minPrice ? parseInt(draft.minPrice, 10) : null),
        priceRangeMax: isFixedPrice ? null : (draft.maxPrice ? parseInt(draft.maxPrice, 10) : null),
        iconName: isFixedPrice ? "Heart" : "Sparkles",
      });
      setAddingCategory(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to add service");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this service?")) return;
    setActionError(null);
    try {
      await deleteService(id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete service");
    }
  };

  if (loading) return <LoadingNotice label="Loading services…" />;

  return (
    <>
      {error && <ErrorNotice message={error} />}
      {actionError && <ErrorNotice message={actionError} />}
      {services.map(cat => {
        const isAddingHere = addingCategory === cat.cat;
        return (
          <div key={cat.cat} style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>{cat.cat}</h3>
              <button onClick={() => startAdd(cat.cat)} style={{
                background: t.goldBg, color: t.gold, border: `1px solid ${t.gold}30`,
                padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
              }}><Sparkles size={12} /> Add Service</button>
            </div>
            <div style={{ background: t.surface, borderRadius: 12, border: `1px solid ${t.border}`, overflow: "hidden" }}>
              {cat.items.map((s, i) => {
                const isEditing = editingId === s.id;
                const hasFixedPrice = !!s.price;
                return (
                  <div key={s.id} style={{
                    padding: "16px 20px",
                    borderBottom: (i < cat.items.length - 1 || isAddingHere) ? `1px solid ${t.border}` : "none",
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
                        <button onClick={() => isEditing ? cancel() : startEdit(s.id, hasFixedPrice, {
                          name: s.name, duration: s.duration, description: s.desc,
                          price: s.price ?? "",
                          minPrice: s.priceRange ? s.priceRange.split("–")[0].replace(/[^\d]/g, "") : "",
                          maxPrice: s.priceRange ? s.priceRange.split("–")[1].replace(/[^\d]/g, "") : "",
                        })} style={{
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
                            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={{
                              width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
                              background: t.bgAlt, fontSize: 13, color: t.text, outline: "none", boxSizing: "border-box",
                            }} />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Duration</label>
                            <input value={draft.duration} onChange={(e) => setDraft({ ...draft, duration: e.target.value })} style={{
                              width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
                              background: t.bgAlt, fontSize: 13, color: t.text, outline: "none", boxSizing: "border-box",
                            }} />
                          </div>
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Description</label>
                          <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} style={{
                            width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
                            background: t.bgAlt, fontSize: 13, color: t.text, outline: "none", boxSizing: "border-box",
                          }} />
                        </div>
                        {hasFixedPrice ? (
                          <div>
                            <label style={{ display: "block", fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Fixed Price</label>
                            <input value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} style={{
                              width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
                              background: t.bgAlt, fontSize: 13, color: t.text, outline: "none", boxSizing: "border-box",
                            }} />
                          </div>
                        ) : (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <div>
                              <label style={{ display: "block", fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Min Price (₦)</label>
                              <input value={draft.minPrice} onChange={(e) => setDraft({ ...draft, minPrice: e.target.value })} placeholder="e.g. 15000" style={{
                                width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
                                background: t.bgAlt, fontSize: 13, color: t.text, outline: "none", boxSizing: "border-box",
                              }} />
                            </div>
                            <div>
                              <label style={{ display: "block", fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Max Price (₦)</label>
                              <input value={draft.maxPrice} onChange={(e) => setDraft({ ...draft, maxPrice: e.target.value })} placeholder="e.g. 45000" style={{
                                width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
                                background: t.bgAlt, fontSize: 13, color: t.text, outline: "none", boxSizing: "border-box",
                              }} />
                            </div>
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                          <GoldButton onClick={() => saveEdit(s.id, hasFixedPrice)} disabled={saving} style={{
                            background: t.gold, color: "#0A0A0A", border: "none",
                            padding: "8px 20px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: saving ? "wait" : "pointer",
                          }}>{saving ? "Saving…" : "Save"}</GoldButton>
                          <button onClick={() => remove(s.id)} style={{
                            background: "none", border: `1px solid #EF444440`, borderRadius: 6,
                            padding: "8px 16px", fontSize: 12, color: "#EF4444", cursor: "pointer",
                          }}>Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {isAddingHere && (
                <div style={{ padding: "16px 20px" }}>
                  <div style={{ display: "grid", gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Service Name</label>
                        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={{
                          width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
                          background: t.bgAlt, fontSize: 13, color: t.text, outline: "none", boxSizing: "border-box",
                        }} />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Duration</label>
                        <input value={draft.duration} onChange={(e) => setDraft({ ...draft, duration: e.target.value })} placeholder="e.g. 1 hr" style={{
                          width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
                          background: t.bgAlt, fontSize: 13, color: t.text, outline: "none", boxSizing: "border-box",
                        }} />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Description</label>
                      <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} style={{
                        width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
                        background: t.bgAlt, fontSize: 13, color: t.text, outline: "none", boxSizing: "border-box",
                      }} />
                    </div>
                    {cat.cat === "Treatments" ? (
                      <div>
                        <label style={{ display: "block", fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Fixed Price</label>
                        <input value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} placeholder="e.g. ₦8,000" style={{
                          width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
                          background: t.bgAlt, fontSize: 13, color: t.text, outline: "none", boxSizing: "border-box",
                        }} />
                      </div>
                    ) : (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                          <label style={{ display: "block", fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Min Price (₦)</label>
                          <input value={draft.minPrice} onChange={(e) => setDraft({ ...draft, minPrice: e.target.value })} placeholder="e.g. 15000" style={{
                            width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
                            background: t.bgAlt, fontSize: 13, color: t.text, outline: "none", boxSizing: "border-box",
                          }} />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Max Price (₦)</label>
                          <input value={draft.maxPrice} onChange={(e) => setDraft({ ...draft, maxPrice: e.target.value })} placeholder="e.g. 45000" style={{
                            width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
                            background: t.bgAlt, fontSize: 13, color: t.text, outline: "none", boxSizing: "border-box",
                          }} />
                        </div>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      <GoldButton onClick={() => saveNew(cat.cat)} disabled={saving} style={{
                        background: t.gold, color: "#0A0A0A", border: "none",
                        padding: "8px 20px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: saving ? "wait" : "pointer",
                      }}>{saving ? "Saving…" : "Add"}</GoldButton>
                      <button onClick={cancel} style={{
                        background: "none", border: `1px solid ${t.border}`, borderRadius: 6,
                        padding: "8px 16px", fontSize: 12, color: t.textSoft, cursor: "pointer",
                      }}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
