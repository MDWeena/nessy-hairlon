import { useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, Mail, X } from "lucide-react";
import { LOGO_ICON } from "../assets/logos";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../hooks/useAuth";
import { GoldButton } from "../components/ui/GoldButton";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { LoadingNotice } from "../components/ui/LoadingNotice";
import { GoldSpinner } from "../components/ui/GoldSpinner";

interface AdminLoginProps {
  onBack: () => void;
}

const RATE_LIMIT_KEY = "nessy_admin_login_attempts";
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;

interface AttemptRecord {
  count: number;
  lockedUntil: number | null;
}

function readAttempts(): AttemptRecord {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY);
    if (!raw) return { count: 0, lockedUntil: null };
    return JSON.parse(raw) as AttemptRecord;
  } catch {
    return { count: 0, lockedUntil: null };
  }
}

function writeAttempts(record: AttemptRecord) {
  try { localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(record)); } catch { /* ignore */ }
}

function clearAttempts() {
  try { localStorage.removeItem(RATE_LIMIT_KEY); } catch { /* ignore */ }
}

export function AdminLogin({ onBack }: AdminLoginProps) {
  const { t, isDark } = useTheme();
  const { signIn, signOut, resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(() => {
    const rec = readAttempts();
    return rec.lockedUntil && rec.lockedUntil > Date.now() ? rec.lockedUntil : null;
  });

  const [mode, setMode] = useState<"login" | "reset">("login");
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // Clear any stale/half-broken session so a fresh login always starts clean.
  useEffect(() => {
    signOut();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Let the lockout expire on its own while the user sits on the page.
  useEffect(() => {
    if (!lockedUntil) return;
    const remaining = lockedUntil - Date.now();
    if (remaining <= 0) { setLockedUntil(null); return; }
    const timer = setTimeout(() => setLockedUntil(null), remaining);
    return () => clearTimeout(timer);
  }, [lockedUntil]);

  const isLocked = lockedUntil !== null && lockedUntil > Date.now();

  const handleSubmit = async () => {
    setError("");
    const rec = readAttempts();
    if (rec.lockedUntil && rec.lockedUntil > Date.now()) {
      setLockedUntil(rec.lockedUntil);
      return;
    }
    if (!email || !password) { setError("Please fill in all fields"); return; }
    setLoading(true);
    const { error: signInError } = await signIn(email, password);
    if (signInError) {
      const nextCount = rec.count + 1;
      if (nextCount >= MAX_ATTEMPTS) {
        const lockUntil = Date.now() + LOCKOUT_MS;
        writeAttempts({ count: 0, lockedUntil: lockUntil });
        setLockedUntil(lockUntil);
      } else {
        writeAttempts({ count: nextCount, lockedUntil: null });
        setError("Invalid email or password");
      }
    } else {
      clearAttempts();
    }
    setLoading(false);
  };

  const openResetMode = () => {
    setError("");
    setResetEmail(email);
    setResetSent(false);
    setMode("reset");
  };

  const backToLogin = () => {
    setMode("login");
    setResetSent(false);
  };

  const handleResetSubmit = async () => {
    if (!resetEmail) return;
    setResetLoading(true);
    await resetPassword(resetEmail);
    setResetLoading(false);
    // Always show the same message, regardless of whether the email matched an
    // account — surfacing a different result would let someone enumerate admin emails.
    setResetSent(true);
  };

  return (
    <div className="font-sans min-h-screen flex items-center justify-center bg-bg relative overflow-hidden">
      <link href="https://fonts.googleapis.com/css2?family=Tangerine:wght@400;700&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet" />

      {/* Logo watermark background */}
      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-contain bg-no-repeat bg-center pointer-events-none ${
          isDark ? "opacity-[0.04]" : "opacity-[0.06]"
        }`}
        style={{ backgroundImage: `url(${LOGO_ICON})` }}
      />

      {/* Background decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-[#C49A6C10] pointer-events-none" />

      <div className="w-full max-w-[400px] p-6 relative z-[2]">
        {/* Logo */}
        <div className="text-center mb-10">
          <img src={LOGO_ICON} alt="Nessy Hairlon" className="w-16 h-16 rounded-full block mx-auto mb-4" />
          <div className="font-cursive text-[36px] font-bold text-text">
            Nessy <span className="text-gold">Hairlon</span>
          </div>
          <p className="text-[13px] text-text-muted mt-1">Admin Portal</p>
        </div>

        {/* Login / reset card */}
        <div
          className={`bg-surface rounded-2xl p-8 border border-border ${
            isDark ? "shadow-[0_8px_32px_rgba(0,0,0,0.3)]" : "shadow-[0_8px_32px_rgba(26,18,7,0.08)]"
          }`}
        >
          {mode === "login" ? (
            loading ? (
              <LoadingNotice label="Signing in…" />
            ) : (
            <>
              <h2 className="text-lg font-bold mb-1 text-text">Welcome back</h2>
              <p className="text-[13px] text-text-muted mb-7">Sign in to manage your bookings</p>

              {(isLocked || error) && (
                <div className="bg-[#FEE2E2] border border-[#FCA5A5] rounded-lg py-2.5 px-3.5 mb-4 text-[13px] text-[#DC2626] flex items-center gap-2">
                  <X size={14} /> {isLocked ? "Too many attempts. Try again in 5 minutes." : error}
                </div>
              )}

              <div className="mb-4">
                <label className="block text-xs text-text-muted mb-1.5 font-medium">Email</label>
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full py-3 px-3.5 rounded-[10px] border border-border focus:border-gold bg-bg-alt text-sm text-text outline-none box-border [transition:border-color_0.2s]"
                />
              </div>

              <div className="mb-3">
                <label className="block text-xs text-text-muted mb-1.5 font-medium">Password</label>
                <input
                  type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  className="w-full py-3 px-3.5 rounded-[10px] border border-border focus:border-gold bg-bg-alt text-sm text-text outline-none box-border [transition:border-color_0.2s]"
                />
              </div>

              <div className="text-right mb-6">
                <button
                  onClick={openResetMode}
                  className="bg-transparent border-none cursor-pointer text-text-muted hover:text-gold text-xs p-0 underline [transition:color_0.2s]"
                >Forgot password?</button>
              </div>

              <GoldButton
                onClick={handleSubmit} disabled={isLocked}
                className={`w-full bg-gold text-theme-black border-none p-3.5 text-[15px] font-bold rounded-[10px] flex items-center justify-center gap-2 ${
                  isLocked ? "cursor-wait opacity-70" : "cursor-pointer opacity-100"
                }`}
              >
                Sign In <ArrowRight size={16} />
              </GoldButton>
            </>
            )
          ) : (
            <>
              <h2 className="text-lg font-bold mb-1 text-text">Reset your password</h2>
              <p className="text-[13px] text-text-muted mb-7">
                Enter your email and we'll send you a link to reset it.
              </p>

              {resetSent ? (
                <div className="bg-gold-bg border border-[#C49A6C30] rounded-lg py-3.5 px-4 mb-5 text-[13px] text-text-soft flex items-start gap-2.5 leading-[1.5]">
                  <Mail size={16} color={t.gold} className="shrink-0 mt-px" />
                  <span>If an account exists with that email, you'll receive a password reset link shortly. Check your inbox.</span>
                </div>
              ) : (
                <div className="mb-6">
                  <label className="block text-xs text-text-muted mb-1.5 font-medium">Email</label>
                  <input
                    type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="Enter your email"
                    onKeyDown={(e) => e.key === "Enter" && handleResetSubmit()}
                    className="w-full py-3 px-3.5 rounded-[10px] border border-border focus:border-gold bg-bg-alt text-sm text-text outline-none box-border [transition:border-color_0.2s]"
                  />
                </div>
              )}

              {!resetSent && (
                <GoldButton
                  onClick={handleResetSubmit} disabled={resetLoading || !resetEmail}
                  className={`w-full bg-gold text-theme-black border-none p-3.5 text-[15px] font-bold rounded-[10px] flex items-center justify-center gap-2 ${
                    resetLoading || !resetEmail ? "cursor-wait opacity-70" : "cursor-pointer opacity-100"
                  }`}
                >
                  {resetLoading && <GoldSpinner size={16} color="#0A0A0A" />}
                  {resetLoading ? "Sending..." : "Send Reset Link"}
                  {!resetLoading && <ArrowRight size={16} />}
                </GoldButton>
              )}

              <button
                onClick={backToLogin}
                className="block mx-auto mt-5 bg-transparent border-none cursor-pointer text-text-muted hover:text-gold text-[13px] [transition:color_0.2s]"
              >Back to login</button>
            </>
          )}
        </div>

        {/* Back to site */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 mx-auto mt-6 bg-transparent border-none cursor-pointer text-text-muted hover:text-gold text-[13px] [transition:color_0.2s]"
        >
          <ChevronLeft size={14} /> Back to website
        </button>

        {/* Theme toggle */}
        <div className="flex justify-center mt-5">
          <ThemeToggle variant="nav" spaced={false} />
        </div>
      </div>
    </div>
  );
}
