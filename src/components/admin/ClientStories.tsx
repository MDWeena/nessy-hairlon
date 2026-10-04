import { useState } from "react";
import { Star, X, Sparkles, Eye, Settings, BadgeCheck, Check } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { useTestimonials } from "../../hooks/useTestimonials";
import { GoldButton } from "../ui/GoldButton";
import { LoadingNotice } from "../ui/LoadingNotice";
import { ErrorNotice } from "../ui/ErrorNotice";
import { GoldSpinner } from "../ui/GoldSpinner";

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

      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-text-soft max-w-[400px]">
          Manage the testimonials shown on the homepage. Add reviews from WhatsApp, Instagram, or anywhere else.
        </p>
        <GoldButton
          onClick={() => { setAdding(!adding); setEditing(null); }}
          className={`py-2 px-5 rounded-md text-[13px] font-bold cursor-pointer flex items-center gap-1.5 shrink-0 ${
            adding ? "bg-transparent text-gold border border-gold" : "bg-gold text-theme-black border-none"
          }`}
        >
          {adding ? <><X size={14} /> Cancel</> : <><Sparkles size={14} /> Add Story</>}
        </GoldButton>
      </div>

      {/* Add new story form */}
      {adding && (
        <div className="bg-surface rounded-xl p-6 border border-[#C49A6C40] mb-5 shadow-[0_0_0_3px_#C49A6C1A]">
          <h4 className="text-sm font-bold mb-4 flex items-center gap-2">
            <Star size={16} color={t.gold} /> New Testimonial
          </h4>
          <div className="grid gap-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-text-muted mb-1">Client Name</label>
                <input
                  value={newStory.name} onChange={(e) => setNewStory({ ...newStory, name: e.target.value })}
                  placeholder="e.g. Amara O."
                  className="w-full py-2.5 px-3 rounded-lg border border-border bg-bg-alt text-[13px] text-text outline-none box-border"
                />
              </div>
              <div>
                <label className="block text-[11px] text-text-muted mb-1">Rating</label>
                <div className="flex gap-1 py-2 px-0">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setNewStory({ ...newStory, stars: n })} className="bg-transparent border-none cursor-pointer p-0">
                      <Star size={20} fill={n <= newStory.stars ? t.gold : "transparent"} color={n <= newStory.stars ? t.gold : t.border} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-text-muted mb-1">Their Words</label>
              <textarea
                value={newStory.text} onChange={(e) => setNewStory({ ...newStory, text: e.target.value })}
                placeholder="Paste or type the client's review here..."
                rows={3}
                className="w-full py-2.5 px-3 rounded-lg border border-border bg-bg-alt text-[13px] text-text outline-none box-border [font-family:inherit] resize-y"
              />
            </div>
            <GoldButton
              onClick={addStory} disabled={saving}
              className={`bg-gold text-theme-black border-none py-2.5 px-6 rounded-md text-[13px] font-bold w-fit ${saving ? "cursor-wait" : "cursor-pointer"}`}
            >{saving ? "Adding…" : "Add to Homepage"}</GoldButton>
          </div>
        </div>
      )}

      {/* Existing stories — pending client-submitted reviews float to the top */}
      <div className="grid gap-3">
        {[...testimonials].sort((a, b) => Number(b.verified && !b.visible) - Number(a.verified && !a.visible)).map(story => {
          const isEditing = editing === story.id;
          const isPending = story.verified && !story.visible;
          return (
            <div
              key={story.id}
              className={`bg-surface rounded-xl py-[18px] px-5 border [transition:opacity_0.3s] ${
                isPending ? "border-gold shadow-[0_0_0_3px_#C49A6C1A]" : "border-border"
              } ${story.visible || isPending ? "opacity-100" : "opacity-50"}`}
            >
              {isPending && (
                <div className="text-[11px] font-bold text-gold bg-gold-bg py-[3px] px-2.5 rounded-xl inline-block mb-3 border border-[#C49A6C30]">
                  New — Approve?
                </div>
              )}
              <div className="flex justify-between items-start flex-wrap gap-y-3">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2.5 mb-2">
                    {/* Avatar initial */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold text-gold shrink-0 bg-[linear-gradient(135deg,#C49A6C30,#C49A6C10)]"
                    >{story.name[0]}</div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold">{story.name}</span>
                        {story.verified && (
                          <span className="text-[10px] font-bold text-gold flex items-center gap-0.5">
                            <BadgeCheck size={11} /> Verified client
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex gap-0.5">
                          {Array(story.stars).fill(0).map((_, j) => <Star key={j} size={11} fill={t.gold} color={t.gold} />)}
                          {Array(5 - story.stars).fill(0).map((_, j) => <Star key={j} size={11} color={t.border} />)}
                        </div>
                        <span className="text-[11px] text-text-muted">{story.reviewDate}</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[13px] text-text-soft leading-[1.6] italic">
                    "{story.text}"
                  </p>
                </div>

                {!isPending && (
                  <div className="flex gap-1.5 shrink-0 ml-4">
                    <button
                      onClick={() => handleToggleVisibility(story.id)} title={story.visible ? "Hide from site" : "Show on site"}
                      className={`rounded-md py-[5px] px-2 cursor-pointer flex border ${
                        story.visible ? "bg-gold-bg border-[#C49A6C30]" : "bg-bg-alt border-border"
                      }`}
                    >
                      <Eye size={14} color={story.visible ? t.gold : t.textMuted} />
                    </button>
                    <button
                      onClick={() => isEditing ? setEditing(null) : startEdit(story.id, story.name, story.text, story.stars)}
                      className="bg-transparent border border-border rounded-md py-[5px] px-2 cursor-pointer flex"
                    >
                      <Settings size={14} color={t.textMuted} />
                    </button>
                    <button
                      onClick={() => handleDelete(story.id)}
                      className="bg-transparent border border-[#EF444430] rounded-md py-[5px] px-2 cursor-pointer flex"
                    >
                      <X size={14} color="#EF4444" />
                    </button>
                  </div>
                )}
              </div>

              {isPending && (
                <div className="flex gap-2 mt-3.5">
                  <GoldButton
                    onClick={() => handleApprove(story.id)}
                    className="bg-gold text-theme-black border-none py-[7px] px-4 rounded-md text-xs font-bold cursor-pointer flex items-center gap-1.5"
                  ><Check size={13} /> Approve</GoldButton>
                  <button
                    onClick={() => handleReject(story.id)}
                    className="bg-transparent border border-[#EF444440] rounded-md py-[7px] px-4 text-xs text-[#EF4444] cursor-pointer font-semibold"
                  >Reject</button>
                </div>
              )}

              {/* Edit form */}
              {isEditing && (
                <div className="mt-4 pt-4 border-t border-border grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-text-muted mb-1">Client Name</label>
                      <input
                        value={editDraft.name} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                        className="w-full py-2 px-3 rounded-lg border border-border bg-bg-alt text-[13px] text-text outline-none box-border"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-text-muted mb-1">Rating</label>
                      <div className="flex gap-1 py-1.5 px-0">
                        {[1, 2, 3, 4, 5].map(n => (
                          <button key={n} onClick={() => setEditDraft({ ...editDraft, stars: n })} className="bg-transparent border-none cursor-pointer p-0">
                            <Star size={18} fill={n <= editDraft.stars ? t.gold : "transparent"} color={n <= editDraft.stars ? t.gold : t.border} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-text-muted mb-1">Their Words</label>
                    <textarea
                      value={editDraft.text} onChange={(e) => setEditDraft({ ...editDraft, text: e.target.value })} rows={3}
                      className="w-full py-2 px-3 rounded-lg border border-border bg-bg-alt text-[13px] text-text outline-none box-border [font-family:inherit] resize-y"
                    />
                  </div>
                  <GoldButton
                    onClick={() => saveEdit(story.id)} disabled={saving}
                    className={`bg-gold text-theme-black border-none py-2 px-5 rounded-md text-xs font-bold w-fit flex items-center gap-1.5 ${saving ? "cursor-wait" : "cursor-pointer"}`}
                  >{saving && <GoldSpinner size={12} color="#0A0A0A" />} {saving ? "Saving…" : "Save Changes"}</GoldButton>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {testimonials.length === 0 && (
        <div className="text-center p-12 bg-surface rounded-xl border border-border">
          <Star size={32} color={t.gold} strokeWidth={1} />
          <p className="text-[15px] font-semibold mt-3">No stories yet</p>
          <p className="text-[13px] text-text-muted mt-1">Add your first client testimonial to show on the homepage.</p>
        </div>
      )}
    </>
  );
}
