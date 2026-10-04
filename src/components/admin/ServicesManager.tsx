import { useRef, useState } from "react";
import { Sparkles, Upload, X } from "lucide-react";
import { useServices } from "../../hooks/useServices";
import type { ServiceInput } from "../../hooks/useServices";
import { useTheme } from "../../context/ThemeContext";
import { GoldButton } from "../ui/GoldButton";
import { LoadingNotice } from "../ui/LoadingNotice";
import { ErrorNotice } from "../ui/ErrorNotice";
import { GoldSpinner } from "../ui/GoldSpinner";

interface ServiceDraft {
  name: string;
  duration: string;
  description: string;
  price: string;
  minPrice: string;
  maxPrice: string;
  imageUrl: string | null;
}

const EMPTY_DRAFT: ServiceDraft = { name: "", duration: "", description: "", price: "", minPrice: "", maxPrice: "", imageUrl: null };

const FIELD_INPUT = "w-full py-2 px-3 rounded-lg border border-border bg-bg-alt text-[13px] text-text outline-none box-border";
const FIELD_LABEL = "block text-[11px] text-text-muted mb-1";

interface ServiceImageFieldProps {
  imageUrl: string | null;
  uploading: boolean;
  onChoose: () => void;
  onRemove: () => void;
}

function ServiceImageField({ imageUrl, uploading, onChoose, onRemove }: ServiceImageFieldProps) {
  const { t } = useTheme();
  return (
    <div>
      <label className={FIELD_LABEL}>Photo</label>
      <div className="flex items-center gap-3">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover border border-border" />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-bg-alt border border-dashed border-border flex items-center justify-center">
            <Upload size={16} color={t.textMuted} />
          </div>
        )}
        <div className="flex gap-2">
          <button
            type="button" onClick={onChoose} disabled={uploading}
            className={`bg-gold-bg border border-[#C49A6C30] rounded-md py-1.5 px-3 text-xs font-semibold text-gold flex items-center gap-1.5 ${uploading ? "cursor-wait" : "cursor-pointer"}`}
          >{uploading && <GoldSpinner size={12} />} {uploading ? "Uploading…" : imageUrl ? "Change" : "Upload"}</button>
          {imageUrl && (
            <button
              type="button" onClick={onRemove}
              className="bg-transparent border border-[#EF444440] rounded-md py-1.5 px-2.5 text-xs text-[#EF4444] cursor-pointer flex items-center gap-1"
            ><X size={12} /> Remove</button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ServicesManager() {
  const { services, loading, error, addService, updateService, deleteService, uploadServiceImage } = useServices();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingCategory, setAddingCategory] = useState<string | null>(null);
  const [draft, setDraft] = useState<ServiceDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const startEdit = (id: string, hasFixedPrice: boolean, current: ServiceDraft) => {
    setActionError(null);
    setAddingCategory(null);
    setEditingId(id);
    setDraft({ ...current, price: hasFixedPrice ? current.price : "", minPrice: hasFixedPrice ? "" : current.minPrice, maxPrice: hasFixedPrice ? "" : current.maxPrice });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingImage(true);
    setActionError(null);
    try {
      const url = await uploadServiceImage(file);
      setDraft(d => ({ ...d, imageUrl: url }));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
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
        name: draft.name, duration: draft.duration, description: draft.description, imageUrl: draft.imageUrl,
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
        imageUrl: draft.imageUrl,
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
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
      {error && <ErrorNotice message={error} />}
      {actionError && <ErrorNotice message={actionError} />}
      {services.map(cat => {
        const isAddingHere = addingCategory === cat.cat;
        return (
          <div key={cat.cat} className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold">{cat.cat}</h3>
              <button
                onClick={() => startAdd(cat.cat)}
                className="bg-gold-bg text-gold border border-[#C49A6C30] py-1.5 px-3.5 rounded-md text-xs font-semibold cursor-pointer flex items-center gap-1"
              ><Sparkles size={12} /> Add Service</button>
            </div>
            <div className="bg-surface rounded-xl border border-border overflow-hidden">
              {cat.items.map((s, i) => {
                const isEditing = editingId === s.id;
                const hasFixedPrice = !!s.price;
                return (
                  <div
                    key={s.id}
                    className={`py-4 px-5 ${(i < cat.items.length - 1 || isAddingHere) ? "border-b border-border" : "border-b-0"}`}
                  >
                    <div className="flex justify-between items-center flex-wrap gap-y-2.5">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold overflow-hidden text-ellipsis whitespace-nowrap">{s.name}</div>
                        <div className="text-xs text-text-muted">{s.desc}</div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          {s.price ? (
                            <span className="text-sm font-bold">{s.price}</span>
                          ) : (
                            <>
                              <span className="text-[13px] font-bold block">{s.priceRange}</span>
                              <span className="text-[11px] text-text-muted">price range</span>
                            </>
                          )}
                        </div>
                        <button
                          onClick={() => isEditing ? cancel() : startEdit(s.id, hasFixedPrice, {
                            name: s.name, duration: s.duration, description: s.desc,
                            price: s.price ?? "",
                            minPrice: s.priceRange ? s.priceRange.split("–")[0].replace(/[^\d]/g, "") : "",
                            maxPrice: s.priceRange ? s.priceRange.split("–")[1].replace(/[^\d]/g, "") : "",
                            imageUrl: s.imageUrl,
                          })}
                          className={`rounded-md py-[5px] px-2.5 text-xs cursor-pointer border ${
                            isEditing ? "bg-gold-bg border-gold text-gold font-semibold" : "bg-transparent border-border text-text-soft font-normal"
                          }`}
                        >{isEditing ? "Cancel" : "Edit"}</button>
                      </div>
                    </div>

                    {isEditing && (
                      <div className="mt-4 pt-4 border-t border-border grid gap-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={FIELD_LABEL}>Service Name</label>
                            <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={FIELD_INPUT} />
                          </div>
                          <div>
                            <label className={FIELD_LABEL}>Duration</label>
                            <input value={draft.duration} onChange={(e) => setDraft({ ...draft, duration: e.target.value })} className={FIELD_INPUT} />
                          </div>
                        </div>
                        <div>
                          <label className={FIELD_LABEL}>Description</label>
                          <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className={FIELD_INPUT} />
                        </div>
                        <ServiceImageField
                          imageUrl={draft.imageUrl} uploading={uploadingImage}
                          onChoose={() => fileInputRef.current?.click()}
                          onRemove={() => setDraft(d => ({ ...d, imageUrl: null }))}
                        />
                        {hasFixedPrice ? (
                          <div>
                            <label className={FIELD_LABEL}>Fixed Price</label>
                            <input value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} className={FIELD_INPUT} />
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className={FIELD_LABEL}>Min Price (₦)</label>
                              <input value={draft.minPrice} onChange={(e) => setDraft({ ...draft, minPrice: e.target.value })} placeholder="e.g. 15000" className={FIELD_INPUT} />
                            </div>
                            <div>
                              <label className={FIELD_LABEL}>Max Price (₦)</label>
                              <input value={draft.maxPrice} onChange={(e) => setDraft({ ...draft, maxPrice: e.target.value })} placeholder="e.g. 45000" className={FIELD_INPUT} />
                            </div>
                          </div>
                        )}
                        <div className="flex gap-2 mt-1">
                          <GoldButton
                            onClick={() => saveEdit(s.id, hasFixedPrice)} disabled={saving}
                            className={`bg-gold text-theme-black border-none py-2 px-5 rounded-md text-xs font-bold flex items-center gap-1.5 ${saving ? "cursor-wait" : "cursor-pointer"}`}
                          >{saving && <GoldSpinner size={12} color="#0A0A0A" />} {saving ? "Saving…" : "Save"}</GoldButton>
                          <button
                            onClick={() => remove(s.id)}
                            className="bg-transparent border border-[#EF444440] rounded-md py-2 px-4 text-xs text-[#EF4444] cursor-pointer"
                          >Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {isAddingHere && (
                <div className="py-4 px-5">
                  <div className="grid gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={FIELD_LABEL}>Service Name</label>
                        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={FIELD_INPUT} />
                      </div>
                      <div>
                        <label className={FIELD_LABEL}>Duration</label>
                        <input value={draft.duration} onChange={(e) => setDraft({ ...draft, duration: e.target.value })} placeholder="e.g. 1 hr" className={FIELD_INPUT} />
                      </div>
                    </div>
                    <div>
                      <label className={FIELD_LABEL}>Description</label>
                      <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className={FIELD_INPUT} />
                    </div>
                    <ServiceImageField
                      imageUrl={draft.imageUrl} uploading={uploadingImage}
                      onChoose={() => fileInputRef.current?.click()}
                      onRemove={() => setDraft(d => ({ ...d, imageUrl: null }))}
                    />
                    {cat.cat === "Treatments" ? (
                      <div>
                        <label className={FIELD_LABEL}>Fixed Price</label>
                        <input value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} placeholder="e.g. ₦8,000" className={FIELD_INPUT} />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={FIELD_LABEL}>Min Price (₦)</label>
                          <input value={draft.minPrice} onChange={(e) => setDraft({ ...draft, minPrice: e.target.value })} placeholder="e.g. 15000" className={FIELD_INPUT} />
                        </div>
                        <div>
                          <label className={FIELD_LABEL}>Max Price (₦)</label>
                          <input value={draft.maxPrice} onChange={(e) => setDraft({ ...draft, maxPrice: e.target.value })} placeholder="e.g. 45000" className={FIELD_INPUT} />
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2 mt-1">
                      <GoldButton
                        onClick={() => saveNew(cat.cat)} disabled={saving}
                        className={`bg-gold text-theme-black border-none py-2 px-5 rounded-md text-xs font-bold flex items-center gap-1.5 ${saving ? "cursor-wait" : "cursor-pointer"}`}
                      >{saving && <GoldSpinner size={12} color="#0A0A0A" />} {saving ? "Saving…" : "Add"}</GoldButton>
                      <button
                        onClick={cancel}
                        className="bg-transparent border border-border rounded-md py-2 px-4 text-xs text-text-soft cursor-pointer"
                      >Cancel</button>
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
