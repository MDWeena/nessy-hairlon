import { useSettings } from "../../hooks/useSettings";

const FALLBACK_WHATSAPP_NUMBER = "2348161271343";
const MESSAGE = "Hi Nessy, I'd like to book an appointment";

/** Converts a locally-formatted Nigerian number (e.g. "0816 127 1343") into the digits-only, country-code-prefixed form wa.me expects. */
function toWhatsAppNumber(raw: string | undefined): string {
  if (!raw) return FALLBACK_WHATSAPP_NUMBER;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return FALLBACK_WHATSAPP_NUMBER;
  if (digits.startsWith("234")) return digits;
  if (digits.startsWith("0")) return `234${digits.slice(1)}`;
  return digits;
}

export function WhatsAppButton() {
  const { settings } = useSettings();
  const number = toWhatsAppNumber(settings.phone);
  const href = `https://wa.me/${number}?text=${encodeURIComponent(MESSAGE)}`;

  return (
    <>
      <style>{`
        .wa-float-btn {
          position: fixed;
          bottom: calc(24px + env(safe-area-inset-bottom, 0px));
          right: 24px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: #25D366;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 16px rgba(37,211,102,0.4);
          z-index: 50;
          border: none;
          cursor: pointer;
          text-decoration: none;
          animation: waPulse 1.8s ease-out 3;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .wa-float-btn:hover { transform: scale(1.06); box-shadow: 0 6px 22px rgba(37,211,102,0.5); }
        .wa-float-btn:active { transform: scale(0.96); }
        @keyframes waPulse {
          0%, 100% { box-shadow: 0 4px 16px rgba(37,211,102,0.4), 0 0 0 0 rgba(37,211,102,0.5); }
          50% { box-shadow: 0 4px 16px rgba(37,211,102,0.4), 0 0 0 12px rgba(37,211,102,0); }
        }
        @media (max-width: 640px) {
          .wa-float-btn { width: 48px; height: 48px; bottom: calc(16px + env(safe-area-inset-bottom, 0px)); right: 16px; }
        }
      `}</style>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="wa-float-btn"
        aria-label="Chat with us on WhatsApp"
      >
        <svg viewBox="0 0 24 24" width="60%" height="60%" fill="#fff" aria-hidden="true">
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0012.04 2zm5.87 14.11c-.25.7-1.45 1.34-2 1.43-.51.08-1.16.11-1.87-.12-.43-.14-.98-.32-1.69-.62-2.97-1.28-4.91-4.27-5.06-4.47-.15-.2-1.21-1.61-1.21-3.07 0-1.46.77-2.18 1.04-2.48.27-.3.59-.37.79-.37.2 0 .4 0 .57.01.18.01.43-.07.67.51.25.6.85 2.07.92 2.22.08.15.13.33.02.53-.1.2-.15.32-.3.49-.15.17-.31.39-.45.52-.15.14-.31.3-.13.6.17.3.77 1.27 1.65 2.06 1.14 1.01 2.1 1.33 2.4 1.48.3.15.47.13.65-.08.18-.2.75-.87.95-1.17.2-.3.4-.24.67-.14.27.1 1.72.81 2.01.96.29.15.48.22.55.35.07.13.07.75-.18 1.45z" />
        </svg>
      </a>
    </>
  );
}
