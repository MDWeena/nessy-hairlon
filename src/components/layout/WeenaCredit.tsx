import { useState } from "react";
import type { MouseEvent } from "react";

export function WeenaCredit() {
  const [showPopup, setShowPopup] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setShowPopup(!showPopup)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 11, color: "#666", padding: "4px 0",
          display: "flex", alignItems: "center", gap: 6,
          transition: "color 0.2s",
        }}
        onMouseEnter={(e: MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.color = "#C49A6C")}
        onMouseLeave={(e: MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.color = "#666")}
      >
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, borderRadius: "50%", background: "linear-gradient(135deg, #C49A6C, #A67B4F)", fontSize: 9, color: "#fff", fontWeight: 700, flexShrink: 0 }}>W</span>
        Built by <span style={{ color: "#C49A6C", fontWeight: 600 }}>Weena</span>
      </button>
      {showPopup && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: 0,
          background: "#1E1914", border: "1px solid #333", borderRadius: 12,
          padding: "16px 20px", minWidth: 220, zIndex: 10,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          animation: "slideUp 0.2s ease",
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Winner Akpologun</div>
          <div style={{ fontSize: 11, color: "#C49A6C", marginBottom: 12 }}>Software Engineer</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <a href="mailto:weena@example.com" style={{ fontSize: 12, color: "#999", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ opacity: 0.6 }}>@</span> weena@example.com
            </a>
            <a href="https://github.com/weena" target="_blank" rel="noopener" style={{ fontSize: 12, color: "#999", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ opacity: 0.6 }}>&lt;/&gt;</span> github.com/weena
            </a>
          </div>
          <div style={{ position: "absolute", bottom: -6, left: 20, width: 12, height: 12, background: "#1E1914", border: "1px solid #333", borderTop: "none", borderLeft: "none", transform: "rotate(45deg)" }} />
        </div>
      )}
    </div>
  );
}
