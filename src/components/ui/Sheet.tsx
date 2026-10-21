import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

interface SheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A bottom sheet on phones, a centred dialog from md (768px) up. Used for panels that would
 * otherwise open inline and push the cards below them around (e.g. Reschedule on the admin
 * Bookings list). Same scroll-lock + Escape handling as StyleDetailModal: the previous body
 * overflow is restored on close, so the page never stays locked (see 22c50cb).
 */
export function Sheet({ title, onClose, children }: SheetProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[300] bg-black/50 flex items-end md:items-center justify-center md:p-4 [animation:modalOverlayIn_0.2s_ease]"
      onClick={onClose}
    >
      <div
        role="dialog" aria-modal="true" aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface text-text w-full md:max-w-[560px] max-h-[88vh] overflow-y-auto rounded-t-2xl md:rounded-2xl border border-border shadow-[0_-12px_40px_rgba(0,0,0,0.3)] pb-[env(safe-area-inset-bottom)]"
      >
        <div className="sticky top-0 bg-surface flex items-center justify-between gap-3 py-3 px-5 border-b border-border z-10">
          <h3 className="text-sm font-bold m-0 min-w-0 break-words">{title}</h3>
          <button
            onClick={onClose} aria-label="Close"
            className="tap-target-sm shrink-0 bg-transparent border-none cursor-pointer text-text-muted p-1 flex items-center justify-center"
          ><X size={16} /></button>
        </div>
        <div className="py-4 px-5">{children}</div>
      </div>
    </div>
  );
}
