import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

const DISMISS_KEY = "nessy_install_prompt_dismissed_at";
const DISMISS_DAYS = 30;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    if (Number.isNaN(dismissedAt)) return false;
    return Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function setDismissed() {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  // Exclude other iOS browsers (Chrome/Firefox/Edge on iOS all use the Safari engine but
  // identify themselves in the UA too — only Safari itself can show the native share sheet).
  const isOtherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIos && !isOtherBrowser;
}

/**
 * Prompts the visitor to add the app to their home screen. iOS has no install API — Safari only
 * surfaces it via the manual Share > Add to Home Screen flow, so we show instructions instead of
 * a button. Android/desktop Chrome fire `beforeinstallprompt`, which we capture and trigger from
 * a real "Install App" button (the event's own .prompt() must run from a user gesture).
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissedState] = useState(false);

  useEffect(() => {
    if (isStandalone() || isDismissed()) return;

    if (isIosSafari()) {
      setShowIosHint(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    setDismissed();
    setDismissedState(true);
    setShowIosHint(false);
    setDeferredPrompt(null);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  if (dismissed || (!showIosHint && !deferredPrompt)) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 bg-surface border-t border-border px-4 py-3.5 flex items-center gap-3"
      style={{ paddingBottom: "calc(0.875rem + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="w-9 h-9 rounded-full shrink-0 bg-gold-bg border border-[#C49A6C40] flex items-center justify-center">
        {showIosHint ? <Share size={16} color="#C49A6C" /> : <Download size={16} color="#C49A6C" />}
      </div>
      <p className="flex-1 text-[13px] text-text-soft leading-[1.4]">
        {showIosHint
          ? <>Add <strong className="text-text">Nessy Hairlon</strong> to your home screen: tap the Share button, then "Add to Home Screen".</>
          : <>Install <strong className="text-text">Nessy Hairlon</strong> for quicker access to booking.</>}
      </p>
      {!showIosHint && (
        <button
          onClick={handleInstall}
          className="shrink-0 bg-gold text-theme-black border-none rounded-md py-2 px-3.5 text-xs font-bold cursor-pointer"
        >Install App</button>
      )}
      <button
        onClick={dismiss} aria-label="Dismiss"
        className="shrink-0 text-text-muted bg-transparent border-none cursor-pointer p-1"
      ><X size={16} /></button>
    </div>
  );
}
