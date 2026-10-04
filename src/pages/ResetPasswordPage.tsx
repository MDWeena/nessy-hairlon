import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, X } from "lucide-react";
import { LOGO_ICON } from "../assets/logos";
import { useTheme } from "../context/ThemeContext";
import { supabase } from "../lib/supabase";
import { GoldButton } from "../components/ui/GoldButton";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { LoadingNotice } from "../components/ui/LoadingNotice";
import { GoldSpinner } from "../components/ui/GoldSpinner";

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
    <div className={`font-sans min-h-screen flex items-center justify-center relative overflow-hidden ${isDark ? "bg-[#0E0B08]" : "bg-[#FFFCF8]"}`}>
      <link href="https://fonts.googleapis.com/css2?family=Tangerine:wght@400;700&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet" />

      {/* Logo watermark background */}
      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-contain bg-no-repeat bg-center pointer-events-none ${isDark ? "opacity-[0.04]" : "opacity-[0.06]"}`}
        style={{ backgroundImage: `url(${LOGO_ICON})` }}
      />

      {/* Background decoration */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ border: `1px solid ${t.gold}10` }}
      />

      <div className="w-full max-w-[400px] p-6 relative z-[2]">
        {/* Logo */}
        <div className="text-center mb-10">
          <img src={LOGO_ICON} alt="Nessy Hairlon" className="w-16 h-16 rounded-full block mx-auto mt-0 mb-4" />
          <div className="font-cursive text-4xl font-bold text-text">
            Nessy <span className="text-gold">Hairlon</span>
          </div>
          <p className="text-[13px] text-text-muted mt-1">Admin Portal</p>
        </div>

        {/* Card */}
        <div className={`bg-surface rounded-2xl p-8 border border-border ${isDark ? "shadow-[0_8px_32px_rgba(0,0,0,0.3)]" : "shadow-[0_8px_32px_rgba(26,18,7,0.08)]"}`}>
          {success ? (
            <>
              <div className="text-center mb-2">
                <CheckCircle2 size={40} color={t.gold} className="mb-3" />
                <h2 className="text-lg font-bold mb-1 text-text">Password updated successfully!</h2>
                <p className="text-[13px] text-text-muted mb-6">You can now sign in to the admin panel.</p>
              </div>
              <GoldButton
                onClick={onGoToAdmin}
                className="w-full bg-gold text-theme-black border-none p-3.5 text-[15px] font-bold cursor-pointer rounded-[10px] flex items-center justify-center gap-2"
              >
                Go to Admin <ArrowRight size={16} />
              </GoldButton>
            </>
          ) : !ready ? (
            <LoadingNotice label="Verifying your reset link…" />
          ) : (
            <>
              <h2 className="text-lg font-bold mb-1 text-text">Set new password</h2>
              <p className="text-[13px] text-text-muted mb-7">Choose a new password for your admin account</p>

              {error && (
                <div className="bg-[#FEE2E2] border border-[#FCA5A5] rounded-lg py-2.5 px-3.5 mb-4 text-[13px] text-[#DC2626] flex items-center gap-2">
                  <X size={14} /> {error}
                </div>
              )}

              <div className="mb-4">
                <label className="block text-xs text-text-muted mb-1.5 font-medium">New password</label>
                <input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full py-3 px-3.5 rounded-[10px] border border-border bg-bg-alt text-sm text-text outline-none box-border [transition:border-color_0.2s] focus:border-gold"
                />
              </div>

              <div className="mb-6">
                <label className="block text-xs text-text-muted mb-1.5 font-medium">Confirm password</label>
                <input
                  type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  className="w-full py-3 px-3.5 rounded-[10px] border border-border bg-bg-alt text-sm text-text outline-none box-border [transition:border-color_0.2s] focus:border-gold"
                />
              </div>

              <GoldButton
                onClick={handleSubmit} disabled={loading}
                className={`w-full bg-gold text-theme-black border-none p-3.5 text-[15px] font-bold rounded-[10px] flex items-center justify-center gap-2 ${loading ? "cursor-wait opacity-70" : "cursor-pointer opacity-100"}`}
              >
                {loading && <GoldSpinner size={16} color="#0A0A0A" />}
                {loading ? "Updating..." : "Update Password"}
                {!loading && <ArrowRight size={16} />}
              </GoldButton>
            </>
          )}
        </div>

        {/* Theme toggle */}
        <div className="flex justify-center mt-5">
          <ThemeToggle variant="nav" spaced={false} />
        </div>
      </div>
    </div>
  );
}
