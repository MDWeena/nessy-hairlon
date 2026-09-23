import { useState } from "react";
import { Star, X, Sparkles, Eye, Settings, BadgeCheck, Check } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { useTestimonials } from "../../hooks/useTestimonials";
import { GoldButton } from "../ui/GoldButton";
import { LoadingNotice } from "../ui/LoadingNotice";
import { ErrorNotice } from "../ui/ErrorNotice";

export function ClientStories() {
  const { t } = useTheme();
  const { testimonials, loading, error, addTestimonial, updateTestimonial, toggleVisibility, deleteTestimonial } = useTestimonials();
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ name: "", text: "", stars: 5 });
  const [adding, setAdding] = useState(false);
  const [newStory, setNewStory] = useState({ name: "", text: "", stars: 5 });
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const startEdit = (id: string, name: string, text: string, stars: number) => {
    setActionError(null);
    setAdding(false);
    setEditing(id);
    setEditDraft({ name, text, stars });
  };

  const saveEdit = async (id: string) => {
    setSaving(true);
    setActionError(null);
    try {
      await updateTestimonial(id, { name: editDraft.name, text: editDraft.text, stars: editDraft.stars });
      setEditing(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to save story");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVisibility = async (id: string) => {
    setActionError(null);
    try {
      await toggleVisibility(id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update visibility");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this testimonial?")) return;
    setActionError(null);
    try {
      await deleteTestimonial(id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete story");
    }
  };

  const handleApprove = async (id: string) => {
    setActionError(null);
    try {
      await toggleVisibility(id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to approve review");
    }
  };

  const handleReject = async (id: string) => {
    if (!window.confirm("Reject and delete this review?")) return;
    setActionError(null);
    try {
      await deleteTestimonial(id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to reject review");
    }
  };

  const addStory = async () => {
    if (!newStory.name || !newStory.text) return;
    setSaving(true);
    setActionError(null);
    try {
      await addTestimonial(newStory);
      setNewStory({ name: "", text: "", stars: 5 });
      setAdding(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to add story");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingNotice label="Loading client stories…" />;

  return (
    <>
      {error && <ErrorNotice message={error} />}
      {actionError && <ErrorNotice message={actionError} />}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <p style={{ fontSize: 14, color: t.textSoft, maxWidth: 400 }}>
          Manage the testimonials shown on the homepage. Add reviews from WhatsApp, Instagram, or anywhere else.
        </p>
        <GoldButton onClick={() => { setAdding(!adding); setEditing(null); }} style={{
          background: adding ? "transparent" : t.gold, color: adding ? t.gold : "#0A0A0A",
          border: adding ? `1px solid ${t.gold}` : "none",
          padding: "8px 20px", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
        }}>
          {adding ? <><X size={14} /> Cancel</> : <><Sparkles size={14} /> Add Story</>}
        </GoldButton>
      </div>

      {/* Add new story form */}
      {adding && (
        <div style={{
          background: t.surface, borderRadius: 12, padding: 24,
          border: `1px solid ${t.gold}40`, marginBottom: 20,
          boxShadow: `0 0 0 3px ${t.gold}10`,
        }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <Star size={16} color={t.gold} /> New Testimonial
          </h4>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Client Name</label>
                <input value={newStory.name} onChange={(e) => setNewStory({ ...newStory, name: e.target.value })}
                  placeholder="e.g. Amara O." style={{
                    width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
                    background: t.bgAlt, fontSize: 13, color: t.text, outline: "none", boxSizing: "border-box",
                  }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Rating</label>
                <div style={{ display: "flex", gap: 4, padding: "8px 0" }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setNewStory({ ...newStory, stars: n })} style={{
                      background: "none", border: "none", cursor: "pointer", padding: 0,
                    }}>
                      <Star size={20} fill={n <= newStory.stars ? t.gold : "transparent"} color={n <= newStory.stars ? t.gold : t.border} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Their Words</label>
              <textarea value={newStory.text} onChange={(e) => setNewStory({ ...newStory, text: e.target.value })}
                placeholder="Paste or type the client's review here..."
                rows={3} style={{
                  width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
                  background: t.bgAlt, fontSize: 13, color: t.text, outline: "none", boxSizing: "border-box",
                  fontFamily: "inherit", resize: "vertical",
                }} />
            </div>
            <GoldButton onClick={addStory} disabled={saving} style={{
              background: t.gold, color: "#0A0A0A", border: "none",
              padding: "10px 24px", borderRadius: 6, fontSize: 13, fontWeight: 700,
              cursor: saving ? "wait" : "pointer", width: "fit-content",
            }}>{saving ? "Adding…" : "Add to Homepage"}</GoldButton>
          </div>
        </div>
      )}

      {/* Existing stories — pending client-submitted reviews float to the top */}
      <div style={{ display: "grid", gap: 12 }}>
        {[...testimonials].sort((a, b) => Number(b.verified && !b.visible) - Number(a.verified && !a.visible)).map(story => {
          const isEditing = editing === story.id;
          const isPending = story.verified && !story.visible;
          return (
            <div key={story.id} style={{
              background: t.surface, borderRadius: 12, padding: "18px 20px",
              border: isPending ? `1px solid ${t.gold}` : `1px solid ${t.border}`,
              boxShadow: isPending ? `0 0 0 3px ${t.gold}10` : undefined,
              opacity: story.visible || isPending ? 1 : 0.5, transition: "opacity 0.3s",
            }}>
              {isPending && (
                <div style={{
                  fontSize: 11, fontWeight: 700, color: t.gold, background: t.goldBg,
                  padding: "3px 10px", borderRadius: 12, display: "inline-block", marginBottom: 12,
                  border: `1px solid ${t.gold}30`,
                }}>New — Approve?</div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    {/* Avatar initial */}
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%",
                      background: `linear-gradient(135deg, ${t.gold}30, ${t.gold}10)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 700, color: t.gold, flexShrink: 0,
                    }}>{story.name[0]}</div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{story.name}</span>
                        {story.verified && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, color: t.gold, display: "flex", alignItems: "center", gap: 2,
                          }}><BadgeCheck size={11} /> Verified client</span>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                        <div style={{ display: "flex", gap: 2 }}>
                          {Array(story.stars).fill(0).map((_, j) => <Star key={j} size={11} fill={t.gold} color={t.gold} />)}
                          {Array(5 - story.stars).fill(0).map((_, j) => <Star key={j} size={11} color={t.border} />)}
                        </div>
                        <span style={{ fontSize: 11, color: t.textMuted }}>{story.reviewDate}</span>
                      </div>
                    </div>
                  </div>
                  <p style={{ fontSize: 13, color: t.textSoft, lineHeight: 1.6, fontStyle: "italic" }}>
                    "{story.text}"
                  </p>
                </div>

                {!isPending && (
                  <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: 16 }}>
                    <button onClick={() => handleToggleVisibility(story.id)} title={story.visible ? "Hide from site" : "Show on site"} style={{
                      background: story.visible ? t.goldBg : t.bgAlt,
                      border: `1px solid ${story.visible ? t.gold + "30" : t.border}`,
                      borderRadius: 6, padding: "5px 8px", cursor: "pointer", display: "flex",
                    }}>
                      <Eye size={14} color={story.visible ? t.gold : t.textMuted} />
                    </button>
                    <button onClick={() => isEditing ? setEditing(null) : startEdit(story.id, story.name, story.text, story.stars)} style={{
                      background: "none", border: `1px solid ${t.border}`,
                      borderRadius: 6, padding: "5px 8px", cursor: "pointer", display: "flex",
                    }}>
                      <Settings size={14} color={t.textMuted} />
                    </button>
                    <button onClick={() => handleDelete(story.id)} style={{
                      background: "none", border: "1px solid #EF444430",
                      borderRadius: 6, padding: "5px 8px", cursor: "pointer", display: "flex",
                    }}>
                      <X size={14} color="#EF4444" />
                    </button>
                  </div>
                )}
              </div>

              {isPending && (
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <GoldButton onClick={() => handleApprove(story.id)} style={{
                    background: t.gold, color: "#0A0A0A", border: "none",
                    padding: "7px 16px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6,
                  }}><Check size={13} /> Approve</GoldButton>
                  <button onClick={() => handleReject(story.id)} style={{
                    background: "none", border: "1px solid #EF444440", borderRadius: 6,
                    padding: "7px 16px", fontSize: 12, color: "#EF4444", cursor: "pointer", fontWeight: 600,
                  }}>Reject</button>
                </div>
              )}

              {/* Edit form */}
              {isEditing && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${t.border}`, display: "grid", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Client Name</label>
                      <input value={editDraft.name} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} style={{
                        width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
                        background: t.bgAlt, fontSize: 13, color: t.text, outline: "none", boxSizing: "border-box",
                      }} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Rating</label>
                      <div style={{ display: "flex", gap: 4, padding: "6px 0" }}>
                        {[1, 2, 3, 4, 5].map(n => (
                          <button key={n} onClick={() => setEditDraft({ ...editDraft, stars: n })} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                            <Star size={18} fill={n <= editDraft.stars ? t.gold : "transparent"} color={n <= editDraft.stars ? t.gold : t.border} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Their Words</label>
                    <textarea value={editDraft.text} onChange={(e) => setEditDraft({ ...editDraft, text: e.target.value })} rows={3} style={{
                      width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
                      background: t.bgAlt, fontSize: 13, color: t.text, outline: "none", boxSizing: "border-box",
                      fontFamily: "inherit", resize: "vertical",
                    }} />
                  </div>
                  <GoldButton onClick={() => saveEdit(story.id)} disabled={saving} style={{
                    background: t.gold, color: "#0A0A0A", border: "none",
                    padding: "8px 20px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                    cursor: saving ? "wait" : "pointer", width: "fit-content",
                  }}>{saving ? "Saving…" : "Save Changes"}</GoldButton>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {testimonials.length === 0 && (
        <div style={{
          textAlign: "center", padding: 48, background: t.surface,
          borderRadius: 12, border: `1px solid ${t.border}`,
        }}>
          <Star size={32} color={t.gold} strokeWidth={1} />
          <p style={{ fontSize: 15, fontWeight: 600, marginTop: 12 }}>No stories yet</p>
          <p style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>Add your first client testimonial to show on the homepage.</p>
        </div>
      )}
    </>
  );
}
