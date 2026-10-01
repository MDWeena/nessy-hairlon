import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, X } from "lucide-react";
import { LOGO_ICON } from "../assets/logos";
import { useTheme } from "../context/ThemeContext";
import { supabase } from "../lib/supabase";
import { GoldButton } from "../components/ui/GoldButton";
import { ThemeToggle } from "../components/ui/ThemeToggle";

interface ResetPasswordPageProps {
  onGoToAdmin: () => void;
}

const MIN_PASSWORD_LENGTH = 8;

export function ResetPasswordPage({ onGoToAdmin }: ResetPasswordPageProps) {
  const { t, isDark } = useTheme();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Supabase parses the recovery token out of the URL hash on client init and fires
  // PASSWORD_RECOVERY once it's done — only show the form once that's confirmed, so
  // updateUser() below has a real recovery session to act on.
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleSubmit = async () => {
    setError("");
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) setError(updateError.message);
    else setSuccess(true);
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

        {/* Card */}
        <div style={{
          background: t.surface, borderRadius: 16, padding: 32,
          border: `1px solid ${t.border}`,
          boxShadow: isDark ? "0 8px 32px rgba(0,0,0,0.3)" : "0 8px 32px rgba(26,18,7,0.08)",
        }}>
          {success ? (
            <>
              <div style={{ textAlign: "center", marginBottom: 8 }}>
                <CheckCircle2 size={40} color={t.gold} style={{ marginBottom: 12 }} />
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: t.text }}>Password updated successfully!</h2>
                <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 24 }}>You can now sign in to the admin panel.</p>
              </div>
              <GoldButton onClick={onGoToAdmin} style={{
                width: "100%", background: t.gold, color: "#0A0A0A", border: "none",
                padding: "14px", fontSize: 15, fontWeight: 700, cursor: "pointer", borderRadius: 10,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                Go to Admin <ArrowRight size={16} />
              </GoldButton>
            </>
          ) : !ready ? (
            <p style={{ fontSize: 13, color: t.textMuted, textAlign: "center", padding: "20px 0" }}>
              Verifying your reset link…
            </p>
          ) : (
            <>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: t.text }}>Set new password</h2>
              <p style={{ fontSize: 13, color: t.textMuted, marginBottom: 28 }}>Choose a new password for your admin account</p>

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
                <label style={{ display: "block", fontSize: 12, color: t.textMuted, marginBottom: 6, fontWeight: 500 }}>New password</label>
                <input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
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
                <label style={{ display: "block", fontSize: 12, color: t.textMuted, marginBottom: 6, fontWeight: 500 }}>Confirm password</label>
                <input
                  type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
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
                {loading ? "Updating..." : "Update Password"}
                {!loading && <ArrowRight size={16} />}
              </GoldButton>
            </>
          )}
        </div>

        {/* Theme toggle */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
          <ThemeToggle variant="nav" spaced={false} />
        </div>
      </div>
    </div>
  );
}
