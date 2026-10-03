import { useState } from "react";
import { Settings as SettingsIcon, DollarSign, Clock, Info, CalendarRange } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { useSettings } from "../../hooks/useSettings";
import type { SettingsMap } from "../../hooks/useSettings";
import { useScheduleRules } from "../../hooks/useAvailability";
import type { ScheduleRule } from "../../hooks/useAvailability";
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
  const { t } = useTheme();
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
    <div style={{
      background: t.bgAlt, borderRadius: 10, padding: 18,
      border: `1px solid ${t.border}`, marginBottom: 12,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isEditing ? 14 : 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{title}</span>
        <button onClick={() => isEditing ? setIsEditing(false) : startEdit()} style={{
          background: isEditing ? t.goldBg : "none", border: `1px solid ${isEditing ? t.gold : t.border}`,
          borderRadius: 6, padding: "4px 12px", fontSize: 11, fontWeight: 600,
          cursor: "pointer", color: isEditing ? t.gold : t.textMuted,
        }}>{isEditing ? "Cancel" : "Edit"}</button>
      </div>
      {actionError && <ErrorNotice message={actionError} />}
      {isEditing ? (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: t.textMuted }}>Max bookings per day</span>
            <select value={maxSlots} onChange={(e) => setMaxSlots(Number(e.target.value))} style={{
              padding: "6px 10px", borderRadius: 8, border: `1px solid ${t.border}`,
              background: t.surface, fontSize: 13, color: t.text, outline: "none",
            }}>
              {MAX_SLOTS_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: t.textMuted }}>Min gap between bookings (hours)</span>
            <select value={gapHours} onChange={(e) => setGapHours(Number(e.target.value))} style={{
              padding: "6px 10px", borderRadius: 8, border: `1px solid ${t.border}`,
              background: t.surface, fontSize: 13, color: t.text, outline: "none",
            }}>
              {GAP_HOURS_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <GoldButton onClick={save} disabled={saving} style={{
            background: t.gold, color: "#0A0A0A", border: "none",
            padding: "8px 20px", borderRadius: 6, fontSize: 12, fontWeight: 700,
            cursor: saving ? "wait" : "pointer", width: "fit-content",
            display: "flex", alignItems: "center", gap: 6,
          }}>{saving && <GoldSpinner size={12} color="#0A0A0A" />} {saving ? "Saving…" : "Save"}</GoldButton>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 20, marginTop: 10 }}>
          <div>
            <span style={{ fontSize: 11, color: t.textMuted, display: "block" }}>Max per day</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{rule ? rule.maxSlotsPerDay : "—"}</span>
          </div>
          <div>
            <span style={{ fontSize: 11, color: t.textMuted, display: "block" }}>Min gap</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{rule ? `${rule.minGapHours} hrs` : "—"}</span>
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
    <div style={{
      background: t.surface, borderRadius: 12, padding: 24,
      border: `1px solid ${t.border}`, marginBottom: 20,
    }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, marginBottom: 20, paddingBottom: 12, borderBottom: `1px solid ${t.border}` }}>
        <CalendarRange size={16} color={t.gold} /> Booking Rules
      </h3>
      <p style={{ fontSize: 12, color: t.textMuted, marginBottom: 16 }}>
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
    <div style={{ maxWidth: 600 }}>
      {error && <ErrorNotice message={error} />}
      {actionError && <ErrorNotice message={actionError} />}
      {SECTIONS.map(section => {
        const isEditing = editing === section.key;
        return (
          <div key={section.key} style={{
            background: t.surface, borderRadius: 12, padding: 24,
            border: `1px solid ${t.border}`, marginBottom: 20,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 12, borderBottom: `1px solid ${t.border}` }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                <section.icon size={16} color={t.gold} /> {section.title}
              </h3>
              <button onClick={() => isEditing ? setEditing(null) : startEdit(section)} style={{
                background: isEditing ? t.goldBg : "none", border: `1px solid ${isEditing ? t.gold : t.border}`,
                borderRadius: 6, padding: "5px 14px", fontSize: 12, fontWeight: 600,
                cursor: "pointer", color: isEditing ? t.gold : t.textMuted,
                transition: "all 0.2s",
              }}>{isEditing ? "Cancel" : "Edit"}</button>
            </div>
            {section.fields.map(f => (
              <div key={f.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                <span style={{ fontSize: 13, color: t.textMuted }}>{f.label}</span>
                {isEditing ? (
                  f.kind !== "text" ? (
                    <select value={draft[f.label] ?? ""} onChange={(e) => setDraft({ ...draft, [f.label]: e.target.value })} style={{
                      padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
                      background: t.bgAlt, fontSize: 13, color: t.text, outline: "none",
                      minWidth: 160, maxWidth: "100%",
                    }}>
                      {SELECT_OPTIONS[f.kind].map(o => {
                        const rawValue = o.replace(/[%]|\s(minutes|hours)$/, "");
                        return <option key={o} value={rawValue}>{o}</option>;
                      })}
                    </select>
                  ) : (
                    <input value={draft[f.label] ?? ""} onChange={(e) => setDraft({ ...draft, [f.label]: e.target.value })} style={{
                      padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
                      background: t.bgAlt, fontSize: 13, color: t.text, outline: "none",
                      textAlign: "right", width: 180, maxWidth: "100%", boxSizing: "border-box",
                    }} />
                  )
                ) : (
                  <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{displayValue(f.kind, settings[f.settingKey])}</span>
                )}
              </div>
            ))}
            {isEditing && (
              <GoldButton onClick={() => save(section)} disabled={saving} style={{
                background: t.gold, color: "#0A0A0A", border: "none",
                padding: "10px 24px", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: saving ? "wait" : "pointer", marginTop: 8,
                display: "flex", alignItems: "center", gap: 6, width: "fit-content",
              }}>{saving && <GoldSpinner size={12} color="#0A0A0A" />} {saving ? "Saving…" : "Save Changes"}</GoldButton>
            )}
            {section.key === "schedule" && (
              <div style={{
                display: "flex", alignItems: "flex-start", gap: 8, marginTop: 16, paddingTop: 16,
                borderTop: `1px solid ${t.border}`, fontSize: 12, color: t.textMuted,
              }}>
                <Info size={14} color={t.gold} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>Booking reminders are sent daily at 6:00 AM.</span>
              </div>
            )}
          </div>
        );
      })}
      <BookingRulesSection />
    </div>
  );
}
