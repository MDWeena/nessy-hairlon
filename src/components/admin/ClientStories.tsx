import { useState } from "react";
import { Star, X, Sparkles, Eye, Settings } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import type { Story } from "../../types";
import { GoldButton } from "../ui/GoldButton";

const INITIAL_STORIES: Story[] = [
  { id: 1, name: "Amara O.", text: "I drove 3 hours to get my locs done. Worth every minute. She understands natural hair like no one else.", stars: 5, visible: true },
  { id: 2, name: "Chidinma E.", text: "My braids lasted 8 weeks and my scalp felt amazing the entire time. The treatments are top tier.", stars: 5, visible: true },
  { id: 3, name: "Bola A.", text: "Finally found someone who treats natural hair with the care it deserves. I won't go anywhere else.", stars: 5, visible: true },
];

export function ClientStories() {
  const { t } = useTheme();
  const [stories, setStories] = useState<Story[]>(INITIAL_STORIES);
  const [editing, setEditing] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [newStory, setNewStory] = useState({ name: "", text: "", stars: 5 });

  const toggleVisibility = (id: number) => {
    setStories(prev => prev.map(s => s.id === id ? { ...s, visible: !s.visible } : s));
  };

  const deleteStory = (id: number) => {
    setStories(prev => prev.filter(s => s.id !== id));
  };

  const addStory = () => {
    if (!newStory.name || !newStory.text) return;
    setStories(prev => [...prev, { ...newStory, id: Date.now(), visible: true }]);
    setNewStory({ name: "", text: "", stars: 5 });
    setAdding(false);
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <p style={{ fontSize: 14, color: t.textSoft, maxWidth: 400 }}>
          Manage the testimonials shown on the homepage. Add reviews from WhatsApp, Instagram, or anywhere else.
        </p>
        <GoldButton onClick={() => setAdding(!adding)} style={{
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
            <GoldButton onClick={addStory} style={{
              background: t.gold, color: "#0A0A0A", border: "none",
              padding: "10px 24px", borderRadius: 6, fontSize: 13, fontWeight: 700,
              cursor: "pointer", width: "fit-content",
            }}>Add to Homepage</GoldButton>
          </div>
        </div>
      )}

      {/* Existing stories */}
      <div style={{ display: "grid", gap: 12 }}>
        {stories.map(story => {
          const isEditing = editing === story.id;
          return (
            <div key={story.id} style={{
              background: t.surface, borderRadius: 12, padding: "18px 20px",
              border: `1px solid ${t.border}`,
              opacity: story.visible ? 1 : 0.5, transition: "opacity 0.3s",
            }}>
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
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{story.name}</span>
                      <div style={{ display: "flex", gap: 2, marginTop: 2 }}>
                        {Array(story.stars).fill(0).map((_, j) => <Star key={j} size={11} fill={t.gold} color={t.gold} />)}
                        {Array(5 - story.stars).fill(0).map((_, j) => <Star key={j} size={11} color={t.border} />)}
                      </div>
                    </div>
                  </div>
                  <p style={{ fontSize: 13, color: t.textSoft, lineHeight: 1.6, fontStyle: "italic" }}>
                    "{story.text}"
                  </p>
                </div>

                <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: 16 }}>
                  <button onClick={() => toggleVisibility(story.id)} title={story.visible ? "Hide from site" : "Show on site"} style={{
                    background: story.visible ? t.goldBg : t.bgAlt,
                    border: `1px solid ${story.visible ? t.gold + "30" : t.border}`,
                    borderRadius: 6, padding: "5px 8px", cursor: "pointer", display: "flex",
                  }}>
                    <Eye size={14} color={story.visible ? t.gold : t.textMuted} />
                  </button>
                  <button onClick={() => setEditing(isEditing ? null : story.id)} style={{
                    background: "none", border: `1px solid ${t.border}`,
                    borderRadius: 6, padding: "5px 8px", cursor: "pointer", display: "flex",
                  }}>
                    <Settings size={14} color={t.textMuted} />
                  </button>
                  <button onClick={() => deleteStory(story.id)} style={{
                    background: "none", border: "1px solid #EF444430",
                    borderRadius: 6, padding: "5px 8px", cursor: "pointer", display: "flex",
                  }}>
                    <X size={14} color="#EF4444" />
                  </button>
                </div>
              </div>

              {/* Edit form */}
              {isEditing && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${t.border}`, display: "grid", gap: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Client Name</label>
                      <input defaultValue={story.name} style={{
                        width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
                        background: t.bgAlt, fontSize: 13, color: t.text, outline: "none", boxSizing: "border-box",
                      }} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Rating</label>
                      <div style={{ display: "flex", gap: 4, padding: "6px 0" }}>
                        {[1, 2, 3, 4, 5].map(n => (
                          <button key={n} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                            <Star size={18} fill={n <= story.stars ? t.gold : "transparent"} color={n <= story.stars ? t.gold : t.border} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Their Words</label>
                    <textarea defaultValue={story.text} rows={3} style={{
                      width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
                      background: t.bgAlt, fontSize: 13, color: t.text, outline: "none", boxSizing: "border-box",
                      fontFamily: "inherit", resize: "vertical",
                    }} />
                  </div>
                  <GoldButton onClick={() => setEditing(null)} style={{
                    background: t.gold, color: "#0A0A0A", border: "none",
                    padding: "8px 20px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                    cursor: "pointer", width: "fit-content",
                  }}>Save Changes</GoldButton>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {stories.length === 0 && (
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
