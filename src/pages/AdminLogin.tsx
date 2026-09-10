import { useState } from "react";
import { ArrowRight, ChevronLeft, X } from "lucide-react";
import { LOGO_ICON } from "../assets/logos";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../hooks/useAuth";
import { GoldButton } from "../components/ui/GoldButton";
import { ThemeToggle } from "../components/ui/ThemeToggle";

interface AdminLoginProps {
  onBack: () => void;
}

export function AdminLogin({ onBack }: AdminLoginProps) {
  const { t, isDark } = useTheme();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!email || !password) { setError("Please fill in all fields"); return; }
    setLoading(true);
    const { error: signInError } = await signIn(email, password);
    if (signInError) setError("Invalid email or password");
    setLoading(false);
  };

  return (
    <div style={{
      fontFamily: "'DM Sans', system-ui, sans-serif",
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: isDark ? "#0E0B08" : "#FFFCF8",
      position: "relative", overflow: "hidden",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Tangerine:wght@400;700&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet" />

      {/* Logo watermark background */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: 500, height: 500,
        backgroundImage: `url(${LOGO_ICON})`,
        backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center",
        opacity: isDark ? 0.04 : 0.06,
        pointerEvents: "none",
      }} />

      {/* Background decoration */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)", width: 500, height: 500,
        borderRadius: "50%", border: `1px solid ${t.gold}10`,
        pointerEvents: "none",
      }} />

      <div style={{ width: "100%", maxWidth: 400, padding: 24, position: "relative", zIndex: 2 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <img src={LOGO_ICON} alt="Nessy Hairlon" style={{ width: 64, height: 64, borderRadius: "50%", marginBottom: 16, display: "block", margin: "0 auto 16px" }} />
          <div style={{ fontFamily: "'Tangerine', cursive", fontSize: 36, fontWeight: 700, color: t.text }}>
            Nessy <span style={{ color: t.gold }}>Hairlon</span>
          </div>
          <p style={{ fontSize: 13, color: t.textMuted, marginTop: 4 }}>Admin Portal</p>
        </div>

        {/* Login card */}
        <div style={{
          background: t.surface, borderRadius: 16, padding: 32,
          border: `1px solid ${t.border}`,
          boxShadow: isDark ? "0 8px 32px rgba(0,0,0,0.3)" : "0 8px 32px rgba(26,18,7,0.08)",
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: t.text }}>Welcome back</h2>
          <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 28 }}>Sign in to manage your bookings</p>

          {error && (
            <div style={{
              background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 8,
              padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#DC2626",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <X size={14} /> {error}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, color: t.textMuted, marginBottom: 6, fontWeight: 500 }}>Email</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="nessy@hairlon.com"
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 10,
                border: `1px solid ${t.border}`, background: t.bgAlt,
                fontSize: 14, color: t.text, outline: "none", boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.target.style.borderColor = t.gold)}
              onBlur={(e) => (e.target.style.borderColor = t.border)}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 12, color: t.textMuted, marginBottom: 6, fontWeight: 500 }}>Password</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 10,
                border: `1px solid ${t.border}`, background: t.bgAlt,
                fontSize: 14, color: t.text, outline: "none", boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.target.style.borderColor = t.gold)}
              onBlur={(e) => (e.target.style.borderColor = t.border)}
            />
          </div>

          <GoldButton onClick={handleSubmit} disabled={loading} style={{
            width: "100%", background: t.gold, color: "#0A0A0A", border: "none",
            padding: "14px", fontSize: 15, fontWeight: 700,
            cursor: loading ? "wait" : "pointer", borderRadius: 10,
            opacity: loading ? 0.7 : 1,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            {loading ? "Signing in..." : "Sign In"}
            {!loading && <ArrowRight size={16} />}
          </GoldButton>

          <p style={{ fontSize: 11, color: t.textMuted, textAlign: "center", marginTop: 20 }}>
            Admin access is managed via Supabase Auth.
          </p>
        </div>

        {/* Back to site */}
        <button onClick={onBack} style={{
          display: "flex", alignItems: "center", gap: 6, margin: "24px auto 0",
          background: "none", border: "none", cursor: "pointer",
          color: t.textMuted, fontSize: 13,
          transition: "color 0.2s",
        }}
          onMouseEnter={(e) => (e.currentTarget.style.color = t.gold)}
          onMouseLeave={(e) => (e.currentTarget.style.color = t.textMuted)}
        >
          <ChevronLeft size={14} /> Back to website
        </button>

        {/* Theme toggle */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
          <ThemeToggle variant="nav" spaced={false} />
        </div>
      </div>
    </div>
  );
}
