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
      style={{ transition: "transform 0.2s" }}
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
      style={{ transition: "transform 0.2s" }}
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
    <div ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
      {/* ── pill button ── */}
      <button
        ref={pillRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={!open && pulsed ? "credit-pill-pulse-once" : ""}
        style={{
          fontFamily: "'SF Mono', 'Fira Code', 'Consolas', monospace",
          fontSize: 12,
          whiteSpace: "nowrap",
          color: "#C49A6C",
          background: "none",
          border: "1px solid rgba(196, 154, 108, 0.5)",
          padding: "5px 10px",
          borderRadius: 4,
          cursor: "pointer",
          transition: "border-color 0.2s",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.borderColor = "#C49A6C")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.borderColor = "rgba(196, 154, 108, 0.5)")
        }
      >
        {"<built_by weena />"}
      </button>

      {/* ── popup card ── */}
      {open && (
        <div
          role="dialog"
          aria-label={`Built by ${DEVELOPER_NAME}`}
          className="credit-card-enter"
          style={{
            position: "absolute",
            bottom: "calc(100% + 12px)",
            left: 0,
            width: 256,
            transformOrigin: "bottom left",
            borderRadius: 12,
            background: "#1E1914",
            boxShadow: "0 16px 48px rgba(0, 0, 0, 0.5)",
            overflow: "hidden",
            zIndex: 50,
          }}
        >
          {/* animated gold border line */}
          <svg
            width="100%"
            height="3"
            viewBox="0 0 100 3"
            preserveAspectRatio="none"
            aria-hidden="true"
            style={{ display: "block" }}
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

          <div style={{ padding: 16 }}>
            {/* header row */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "2.5px",
                    color: "#888",
                    margin: "0 0 4px",
                    textTransform: "uppercase",
                  }}
                >
                  BUILT BY
                </p>
                <p
                  style={{
                    fontSize: 16,
                    fontWeight: 900,
                    color: "#fff",
                    margin: 0,
                    lineHeight: 1.2,
                  }}
                >
                  {DEVELOPER_NAME}
                </p>
                <p
                  style={{
                    fontSize: 12,
                    color: "#888",
                    margin: "2px 0 0",
                  }}
                >
                  {DEVELOPER_COMPANY}
                </p>
              </div>

              {/* close button */}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "rgba(136,136,136,0.6)",
                  padding: 4,
                  marginTop: -4,
                  marginRight: -4,
                  transition: "color 0.2s",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "#fff")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "rgba(136,136,136,0.6)")
                }
              >
                <XMarkIcon size={16} />
              </button>
            </div>

            {/* CTA buttons */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {/* WhatsApp */}
              <a
                href={DEVELOPER_WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  background: "#22c55e",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 14,
                  padding: "10px 0",
                  borderRadius: 8,
                  textDecoration: "none",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#16a34a")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "#22c55e")
                }
              >
                <WhatsAppIcon size={16} />
                WhatsApp me
              </a>

              {/* Email */}
              <a
                href={DEVELOPER_EMAIL_URL}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: 14,
                  padding: "10px 0",
                  borderRadius: 8,
                  textDecoration: "none",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "rgba(255,255,255,0.05)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
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
