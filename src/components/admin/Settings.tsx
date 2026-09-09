import { useState } from "react";
import { Settings as SettingsIcon, DollarSign, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { GoldButton } from "../ui/GoldButton";

interface SettingsField {
  label: string;
  value: string;
  type?: "select";
  options?: string[];
}

interface SettingsSection {
  key: string;
  title: string;
  icon: LucideIcon;
  fields: SettingsField[];
}

const SECTIONS: SettingsSection[] = [
  { key: "business", title: "Business Info", icon: SettingsIcon, fields: [
    { label: "Business Name", value: "Nessy Hairlon" },
    { label: "Phone", value: "0816 127 1343" },
    { label: "Instagram", value: "@nessy_hairlon" },
  ]},
  { key: "payment", title: "Payment Details", icon: DollarSign, fields: [
    { label: "Bank", value: "GTBank" },
    { label: "Account Number", value: "012 345 6789" },
    { label: "Account Name", value: "Nessy Hairlon" },
    { label: "Deposit Percentage", value: "50%", type: "select", options: ["25%", "30%", "40%", "50%", "60%", "75%", "100%"] },
  ]},
  { key: "schedule", title: "Schedule Defaults", icon: Clock, fields: [
    { label: "Default Slot Duration", value: "60 minutes", type: "select", options: ["30 minutes", "45 minutes", "60 minutes", "90 minutes", "120 minutes"] },
    { label: "Min Booking Notice", value: "24 hours", type: "select", options: ["6 hours", "12 hours", "24 hours", "48 hours", "72 hours"] },
    { label: "Available Days", value: "Mon - Sat", type: "select", options: ["Mon - Fri", "Mon - Sat", "Mon - Sun", "Tue - Sat"] },
  ]},
];

export function Settings() {
  const { t } = useTheme();
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div style={{ maxWidth: 600 }}>
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
              <button onClick={() => setEditing(isEditing ? null : section.key)} style={{
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
                  f.type === "select" ? (
                    <select defaultValue={f.value} style={{
                      padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
                      background: t.bgAlt, fontSize: 13, color: t.text, outline: "none",
                      minWidth: 160,
                    }}>
                      {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input defaultValue={f.value} style={{
                      padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.border}`,
                      background: t.bgAlt, fontSize: 13, color: t.text, outline: "none",
                      textAlign: "right", width: 180,
                    }} />
                  )
                ) : (
                  <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{f.value}</span>
                )}
              </div>
            ))}
            {isEditing && (
              <GoldButton onClick={() => setEditing(null)} style={{
                background: t.gold, color: "#0A0A0A", border: "none",
                padding: "10px 24px", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 8,
              }}>Save Changes</GoldButton>
            )}
          </div>
        );
      })}

      {/* Schedule defaults are configured here; live availability is managed in the Availability tab */}
    </div>
  );
}
