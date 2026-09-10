import { useState } from "react";
import { Settings as SettingsIcon, DollarSign, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { useSettings } from "../../hooks/useSettings";
import type { SettingsMap } from "../../hooks/useSettings";
import { GoldButton } from "../ui/GoldButton";
import { LoadingNotice } from "../ui/LoadingNotice";
import { ErrorNotice } from "../ui/ErrorNotice";

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
              <div key={f.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <span style={{ fontSize: 13, color: t.textMuted }}>{f.label}</span>
                {isEditing ? (
                  f.kind !== "text" ? (
                    <select value={draft[f.label] ?? ""} onChange={(e) => setDraft({ ...draft, [f.label]: e.target.value })} style={{
                      padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
                      background: t.bgAlt, fontSize: 13, color: t.text, outline: "none",
                      minWidth: 160,
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
                      textAlign: "right", width: 180,
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
              }}>{saving ? "Saving…" : "Save Changes"}</GoldButton>
            )}
          </div>
        );
      })}
    </div>
  );
}
