import { useEffect, useRef, useState } from "react";
import { useInView } from "../../hooks/useInView";
import {
  DEVELOPER_NAME,
  DEVELOPER_COMPANY,
  DEVELOPER_WHATSAPP_URL,
  DEVELOPER_EMAIL_URL,
} from "../../lib/developer-credit";

/* ── inline SVG icons ── */

function WhatsAppIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className="[transition:transform_0.2s]"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function EnvelopeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="[transition:transform_0.2s]"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function XMarkIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

/* ── component ── */

export function WeenaCredit() {
  const [open, setOpen] = useState(false);
  const { ref: pillRef, inView } = useInView<HTMLButtonElement>(0.6);
  const [pulsed, setPulsed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Pulse once when pill scrolls into view
  useEffect(() => {
    if (inView) setPulsed(true);
  }, [inView]);

  // Outside-click & Escape to close
  useEffect(() => {
    if (!open) return;

    function handlePointerDown(e: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block">
      {/* ── pill button ── */}
      <button
        ref={pillRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`text-xs whitespace-nowrap text-gold bg-transparent border border-[rgba(196,154,108,0.5)] py-[5px] px-2.5 rounded [transition:border-color_0.2s] cursor-pointer hover:border-gold ${!open && pulsed ? "credit-pill-pulse-once" : ""}`}
        style={{ fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace" }}
      >
        {"<built_by weena />"}
      </button>

      {/* ── popup card ── */}
      {open && (
        <div
          role="dialog"
          aria-label={`Built by ${DEVELOPER_NAME}`}
          className="credit-card-enter absolute left-0 w-64 origin-bottom-left rounded-xl bg-[#1E1914] overflow-hidden z-50"
          style={{ bottom: "calc(100% + 12px)", boxShadow: "0 16px 48px rgba(0, 0, 0, 0.5)" }}
        >
          {/* animated gold border line */}
          <svg
            width="100%"
            height="3"
            viewBox="0 0 100 3"
            preserveAspectRatio="none"
            aria-hidden="true"
            className="block"
          >
            <line
              className="credit-card-border-path"
              x1="0"
              y1="1.5"
              x2="100"
              y2="1.5"
              stroke="#C49A6C"
              strokeWidth="3"
              pathLength={1}
            />
          </svg>

          <div className="p-4">
            {/* header row */}
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-[10px] font-bold tracking-[2.5px] text-[#888] mt-0 mb-1 uppercase">
                  BUILT BY
                </p>
                <p className="text-base font-black text-white m-0 leading-[1.2]">
                  {DEVELOPER_NAME}
                </p>
                <p className="text-xs text-[#888] mt-0.5 mb-0">
                  {DEVELOPER_COMPANY}
                </p>
              </div>

              {/* close button */}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="bg-transparent border-none cursor-pointer text-[rgba(136,136,136,0.6)] p-1 -mt-1 -mr-1 [transition:color_0.2s] shrink-0 hover:text-white"
              >
                <XMarkIcon size={16} />
              </button>
            </div>

            {/* CTA buttons */}
            <div className="flex flex-col gap-2">
              {/* WhatsApp */}
              <a
                href={DEVELOPER_WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-[#22c55e] text-white font-semibold text-sm py-2.5 px-0 rounded-lg no-underline [transition:background_0.2s] hover:bg-[#16a34a]"
              >
                <WhatsAppIcon size={16} />
                WhatsApp me
              </a>

              {/* Email */}
              <a
                href={DEVELOPER_EMAIL_URL}
                className="flex items-center justify-center gap-2 bg-transparent border border-[rgba(255,255,255,0.15)] text-white font-semibold text-sm py-2.5 px-0 rounded-lg no-underline [transition:background_0.2s] hover:bg-[rgba(255,255,255,0.05)]"
              >
                <EnvelopeIcon size={16} />
                Send an email
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
