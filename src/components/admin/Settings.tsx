import { useRef, useState } from "react";
import { Settings as SettingsIcon, DollarSign, Clock, Info, CalendarRange, UserRound, Upload } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { useSettings } from "../../hooks/useSettings";
import type { SettingsMap } from "../../hooks/useSettings";
import { useScheduleRules } from "../../hooks/useAvailability";
import type { ScheduleRule } from "../../hooks/useAvailability";
import { DEFAULT_ABOUT_TEXT_1, DEFAULT_ABOUT_TEXT_2 } from "../../pages/AboutPage";
import { GoldButton } from "../ui/GoldButton";
import { LoadingNotice } from "../ui/LoadingNotice";
import { ErrorNotice } from "../ui/ErrorNotice";
import { GoldSpinner } from "../ui/GoldSpinner";

type FieldKind = "text" | "percent" | "minutes" | "hours";

interface FieldDef {
  label: string;
  settingKey: keyof SettingsMap;
  kind: FieldKind;
}

interface SectionDef {
  key: string;
  title: string;
  icon: LucideIcon;
  fields: FieldDef[];
}

const SECTIONS: SectionDef[] = [
  { key: "business", title: "Business Info", icon: SettingsIcon, fields: [
    { label: "Business Name", settingKey: "business_name", kind: "text" },
    { label: "Phone", settingKey: "phone", kind: "text" },
    { label: "Instagram", settingKey: "instagram", kind: "text" },
    { label: "Location URL", settingKey: "location_url", kind: "text" },
  ]},
  { key: "payment", title: "Payment Details", icon: DollarSign, fields: [
    { label: "Bank", settingKey: "bank_name", kind: "text" },
    { label: "Account Number", settingKey: "account_number", kind: "text" },
    { label: "Account Name", settingKey: "account_name", kind: "text" },
    { label: "Deposit Percentage", settingKey: "deposit_percentage", kind: "percent" },
  ]},
  { key: "schedule", title: "Schedule Defaults", icon: Clock, fields: [
    { label: "Default Slot Duration", settingKey: "slot_duration_minutes", kind: "minutes" },
    { label: "Min Booking Notice", settingKey: "min_booking_notice_hours", kind: "hours" },
  ]},
];

const SELECT_OPTIONS: Record<Exclude<FieldKind, "text">, string[]> = {
  percent: ["25%", "30%", "40%", "50%", "60%", "75%", "100%"],
  minutes: ["30 minutes", "45 minutes", "60 minutes", "90 minutes", "120 minutes"],
  hours: ["6 hours", "12 hours", "24 hours", "48 hours", "72 hours"],
};

function displayValue(kind: FieldKind, raw: string | number | undefined): string {
  if (raw === undefined || raw === "") return "—";
  if (kind === "text") return String(raw);
  if (kind === "percent") return `${raw}%`;
  if (kind === "minutes") return `${raw} minutes`;
  return `${raw} hours`;
}

function parseValue(kind: FieldKind, display: string): string | number {
  if (kind === "text") return display;
  return parseInt(display, 10);
}

const MAX_SLOTS_OPTIONS = [1, 2, 3, 4, 5, 6];
const GAP_HOURS_OPTIONS = [1, 2, 3, 4, 5, 6];

interface BookingRuleCardProps {
  title: string;
  rule: ScheduleRule | null;
  onSave: (rule: ScheduleRule) => Promise<void>;
}

function BookingRuleCard({ title, rule, onSave }: BookingRuleCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [maxSlots, setMaxSlots] = useState(rule?.maxSlotsPerDay ?? 3);
  const [gapHours, setGapHours] = useState(rule?.minGapHours ?? 3);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const startEdit = () => {
    setActionError(null);
    setMaxSlots(rule?.maxSlotsPerDay ?? 3);
    setGapHours(rule?.minGapHours ?? 3);
    setIsEditing(true);
  };

  const save = async () => {
    setSaving(true);
    setActionError(null);
    try {
      await onSave({ maxSlotsPerDay: maxSlots, minGapHours: gapHours });
      setIsEditing(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-bg-alt rounded-[10px] p-[18px] border border-border mb-3">
      <div className={`flex justify-between items-center ${isEditing ? "mb-3.5" : "mb-0"}`}>
        <span className="text-[13px] font-bold">{title}</span>
        <button
          onClick={() => isEditing ? setIsEditing(false) : startEdit()}
          className={`rounded-md py-1 px-3 text-[11px] font-semibold cursor-pointer border ${
            isEditing ? "bg-gold-bg border-gold text-gold" : "bg-transparent border-border text-text-muted"
          }`}
        >{isEditing ? "Cancel" : "Edit"}</button>
      </div>
      {actionError && <ErrorNotice message={actionError} />}
      {isEditing ? (
        <div className="grid gap-3">
          <div className="flex justify-between items-center">
            <span className="text-xs text-text-muted">Max bookings per day</span>
            <select
              value={maxSlots} onChange={(e) => setMaxSlots(Number(e.target.value))}
              className="py-1.5 px-2.5 rounded-lg border border-border bg-surface text-[13px] text-text outline-none"
            >
              {MAX_SLOTS_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-text-muted">Min gap between bookings (hours)</span>
            <select
              value={gapHours} onChange={(e) => setGapHours(Number(e.target.value))}
              className="py-1.5 px-2.5 rounded-lg border border-border bg-surface text-[13px] text-text outline-none"
            >
              {GAP_HOURS_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <GoldButton
            onClick={save} disabled={saving}
            className={`bg-gold text-theme-black border-none py-2 px-5 rounded-md text-xs font-bold w-fit flex items-center gap-1.5 ${saving ? "cursor-wait" : "cursor-pointer"}`}
          >{saving && <GoldSpinner size={12} color="#0A0A0A" />} {saving ? "Saving…" : "Save"}</GoldButton>
        </div>
      ) : (
        <div className="flex gap-5 mt-2.5">
          <div>
            <span className="text-[11px] text-text-muted block">Max per day</span>
            <span className="text-sm font-semibold">{rule ? rule.maxSlotsPerDay : "—"}</span>
          </div>
          <div>
            <span className="text-[11px] text-text-muted block">Min gap</span>
            <span className="text-sm font-semibold">{rule ? `${rule.minGapHours} hrs` : "—"}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function BookingRulesSection() {
  const { t } = useTheme();
  const { weekday, sunday, loading, error, updateWeekday, updateSunday } = useScheduleRules();

  return (
    <div className="bg-surface rounded-xl p-6 border border-border mb-5">
      <h3 className="text-[15px] font-bold flex items-center gap-2 mb-5 pb-3 border-b border-border">
        <CalendarRange size={16} color={t.gold} /> Booking Rules
      </h3>
      <p className="text-xs text-text-muted mb-4">
        Caps how many appointments can land on one day, and how far apart they're spaced. Sunday is set separately since hours are shorter.
      </p>
      {error && <ErrorNotice message={error} />}
      {loading ? (
        <LoadingNotice label="Loading booking rules…" />
      ) : (
        <>
          <BookingRuleCard title="Monday – Saturday" rule={weekday} onSave={updateWeekday} />
          <BookingRuleCard title="Sunday" rule={sunday} onSave={updateSunday} />
        </>
      )}
    </div>
  );
}

function AboutPageSection() {
  const { t } = useTheme();
  const { settings, updateSetting, uploadAboutPhoto } = useSettings();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [draftText1, setDraftText1] = useState<string | null>(null);
  const [draftText2, setDraftText2] = useState<string | null>(null);
  const [savingText, setSavingText] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const photoUrl = settings.about_photo_url;
  const showPhoto = !!photoUrl && !photoFailed;
  const text1 = draftText1 ?? settings.about_text_1 ?? DEFAULT_ABOUT_TEXT_1;
  const text2 = draftText2 ?? settings.about_text_2 ?? DEFAULT_ABOUT_TEXT_2;

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setActionError(null);
    try {
      await uploadAboutPhoto(file);
      setPhotoFailed(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const saveText = async () => {
    setSavingText(true);
    setActionError(null);
    try {
      await updateSetting("about_text_1", text1);
      await updateSetting("about_text_2", text2);
      setDraftText1(null);
      setDraftText2(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to save About page text");
    } finally {
      setSavingText(false);
    }
  };

  return (
    <div className="bg-surface rounded-xl p-6 border border-border mb-5">
      <h3 className="text-[15px] font-bold flex items-center gap-2 mb-5 pb-3 border-b border-border">
        <UserRound size={16} color={t.gold} /> About Page
      </h3>

      {actionError && <ErrorNotice message={actionError} />}

      {/* Photo */}
      <div className="flex items-center gap-4 mb-5">
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
        {showPhoto ? (
          <img
            src={photoUrl} alt="" onError={() => setPhotoFailed(true)}
            className="w-16 h-16 rounded-full object-cover border border-[#C49A6C40] shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-full shrink-0 bg-[linear-gradient(135deg,#C49A6C30,#C49A6C10)] border border-[#C49A6C40] flex items-center justify-center">
            <span className="font-cursive text-3xl font-bold text-gold">N</span>
          </div>
        )}
        <div>
          <p className="text-xs text-text-muted mb-2">Shown on the public "Meet Nessy" page.</p>
          <button
            onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className={`bg-gold-bg border border-[#C49A6C30] rounded-md py-1.5 px-3.5 text-xs font-semibold text-gold flex items-center gap-1.5 ${uploading ? "cursor-wait" : "cursor-pointer"}`}
          >{uploading ? <GoldSpinner size={12} /> : <Upload size={12} />} {uploading ? "Uploading…" : photoUrl ? "Replace Photo" : "Upload Photo"}</button>
        </div>
      </div>

      {/* Bio text */}
      <div className="grid gap-3 mb-3">
        <div>
          <label className="block text-[11px] text-text-muted mb-1 font-semibold">Bio — Part 1</label>
          <textarea
            value={text1} onChange={(e) => setDraftText1(e.target.value)}
            rows={4}
            className="w-full py-2 px-3 rounded-lg border border-border bg-bg-alt text-[13px] text-text outline-none [font-family:inherit] resize-y box-border"
          />
        </div>
        <div>
          <label className="block text-[11px] text-text-muted mb-1 font-semibold">Bio — Part 2</label>
          <textarea
            value={text2} onChange={(e) => setDraftText2(e.target.value)}
            rows={4}
            className="w-full py-2 px-3 rounded-lg border border-border bg-bg-alt text-[13px] text-text outline-none [font-family:inherit] resize-y box-border"
          />
        </div>
      </div>
      <GoldButton
        onClick={saveText} disabled={savingText}
        className={`bg-gold text-theme-black border-none py-2 px-5 rounded-md text-xs font-bold w-fit flex items-center gap-1.5 ${savingText ? "cursor-wait" : "cursor-pointer"}`}
      >{savingText && <GoldSpinner size={12} color="#0A0A0A" />} {savingText ? "Saving…" : "Save"}</GoldButton>
    </div>
  );
}

export function Settings() {
  const { t } = useTheme();
  const { settings, loading, error, updateSetting } = useSettings();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const startEdit = (section: SectionDef) => {
    setActionError(null);
    const initial: Record<string, string> = {};
    for (const f of section.fields) {
      initial[f.label] = displayValue(f.kind, settings[f.settingKey]).replace(/[%]|\s(minutes|hours)$/, "");
    }
    setDraft(initial);
    setEditing(section.key);
  };

  const save = async (section: SectionDef) => {
    setSaving(true);
    setActionError(null);
    try {
      for (const f of section.fields) {
        const rawDraft = draft[f.label] ?? "";
        const value = f.kind === "text" ? rawDraft : parseValue(f.kind, rawDraft);
        await updateSetting(f.settingKey, value);
      }
      setEditing(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingNotice label="Loading settings…" />;

  return (
    <div className="max-w-[600px]">
      {error && <ErrorNotice message={error} />}
      {actionError && <ErrorNotice message={actionError} />}
      {SECTIONS.map(section => {
        const isEditing = editing === section.key;
        return (
          <div key={section.key} className="bg-surface rounded-xl p-6 border border-border mb-5">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-border">
              <h3 className="text-[15px] font-bold flex items-center gap-2">
                <section.icon size={16} color={t.gold} /> {section.title}
              </h3>
              <button
                onClick={() => isEditing ? setEditing(null) : startEdit(section)}
                className={`rounded-md py-[5px] px-3.5 text-xs font-semibold cursor-pointer border [transition:all_0.2s] ${
                  isEditing ? "bg-gold-bg border-gold text-gold" : "bg-transparent border-border text-text-muted"
                }`}
              >{isEditing ? "Cancel" : "Edit"}</button>
            </div>
            {section.fields.map(f => {
              const display = displayValue(f.kind, settings[f.settingKey]);
              const isUrl = /^https?:\/\//i.test(display);
              return (
                <div key={f.label} className="flex justify-between items-center mb-3.5 flex-wrap gap-2">
                  <span className="text-[13px] text-text-muted shrink-0">{f.label}</span>
                  {isEditing ? (
                    f.kind !== "text" ? (
                      <select
                        value={draft[f.label] ?? ""} onChange={(e) => setDraft({ ...draft, [f.label]: e.target.value })}
                        className="py-2 px-3 rounded-lg border border-border bg-bg-alt text-[13px] text-text outline-none min-w-[160px] max-w-full"
                      >
                        {SELECT_OPTIONS[f.kind].map(o => {
                          const rawValue = o.replace(/[%]|\s(minutes|hours)$/, "");
                          return <option key={o} value={rawValue}>{o}</option>;
                        })}
                      </select>
                    ) : (
                      <input
                        value={draft[f.label] ?? ""} onChange={(e) => setDraft({ ...draft, [f.label]: e.target.value })}
                        className="py-2 px-3 rounded-lg border border-border bg-bg-alt text-[13px] text-text outline-none text-right w-[180px] max-w-full box-border"
                      />
                    )
                  ) : isUrl ? (
                    // Truncated + tappable rather than wrapped — a long Maps URL stays on one
                    // line and usable instead of breaking across the card.
                    <a
                      href={display} target="_blank" rel="noopener noreferrer"
                      className="text-sm font-semibold text-gold truncate min-w-0 flex-1 text-right hover:underline"
                    >{display}</a>
                  ) : (
                    // General fallback for any other long value — wraps within the card
                    // instead of overflowing it.
                    <span className="text-sm font-semibold text-text break-words min-w-0 flex-1 text-right">{display}</span>
                  )}
                </div>
              );
            })}
            {isEditing && (
              <GoldButton
                onClick={() => save(section)} disabled={saving}
                className={`bg-gold text-theme-black border-none py-2.5 px-6 rounded-md text-[13px] font-bold mt-2 flex items-center gap-1.5 w-fit ${saving ? "cursor-wait" : "cursor-pointer"}`}
              >{saving && <GoldSpinner size={12} color="#0A0A0A" />} {saving ? "Saving…" : "Save Changes"}</GoldButton>
            )}
            {section.key === "schedule" && (
              <div className="flex items-start gap-2 mt-4 pt-4 border-t border-border text-xs text-text-muted">
                <Info size={14} color={t.gold} className="shrink-0 mt-px" />
                <span>Booking reminders are sent daily at 6:00 AM.</span>
              </div>
            )}
          </div>
        );
      })}
      <BookingRulesSection />
      <AboutPageSection />
    </div>
  );
}
