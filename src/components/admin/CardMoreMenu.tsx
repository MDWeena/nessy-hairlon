import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

interface CardMoreMenuProps {
  label: string;
  items: { key: string; label: string; onSelect: () => void }[];
}

const MENU_WIDTH = 240;

/**
 * The "⋯ More" menu on an admin booking card. Positioned `fixed` against its button rather than
 * absolutely inside the card, because the bookings list clips its overflow (rounded corners) —
 * a dropdown on the last card would otherwise be cut off. Opens upward when there's no room
 * below, follows its button while the page scrolls, and closes on an outside tap, Escape, or
 * once the button has scrolled off screen.
 */
export function CardMoreMenu({ label, items }: CardMoreMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  /** Places the menu under its button (or above, if there's no room below). Returns false once
   * the button has scrolled out of view, so the menu can close instead of floating detached. */
  const place = useCallback((): boolean => {
    if (!buttonRef.current || !menuRef.current) return true;
    const b = buttonRef.current.getBoundingClientRect();
    if (b.bottom < 0 || b.top > window.innerHeight) return false;
    const h = menuRef.current.offsetHeight;
    const width = Math.min(MENU_WIDTH, window.innerWidth - 16);
    const below = b.bottom + 4 + h <= window.innerHeight - 8;
    setPos({
      top: below ? b.bottom + 4 : Math.max(8, b.top - 4 - h),
      left: Math.min(Math.max(8, b.right - width), window.innerWidth - width - 8),
    });
    return true;
  }, []);

  useLayoutEffect(() => { if (open) place(); }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    // Scrolling (including a smooth scroll still settling) moves the menu with its button.
    const follow = () => { if (!place()) close(); };
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !buttonRef.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { close(); buttonRef.current?.focus(); } };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", follow);
    window.addEventListener("scroll", follow, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", follow);
      window.removeEventListener("scroll", follow, true);
    };
  }, [open, place]);

  if (items.length === 0) return null;
  return (
    <>
      <button
        ref={buttonRef} type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open}
        onClick={() => { setPos(null); setOpen(v => !v); }}
        className="tap-target-sm shrink-0 bg-transparent border border-border rounded-md p-1 md:w-8 md:h-8 flex items-center justify-center cursor-pointer text-text-soft"
      ><MoreHorizontal size={16} /></button>
      {open && (
        <div
          ref={menuRef} role="menu" aria-label={label}
          style={{ position: "fixed", top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: Math.min(MENU_WIDTH, window.innerWidth - 16) }}
          className="z-[250] bg-surface border border-border rounded-lg shadow-[0_12px_32px_rgba(0,0,0,0.25)] py-1"
        >
          {items.map(item => (
            <button
              key={item.key} role="menuitem" type="button"
              onClick={() => { setOpen(false); item.onSelect(); }}
              className="w-full text-left bg-transparent border-none py-2.5 px-3.5 min-h-11 md:min-h-0 text-[13px] text-text cursor-pointer hover:bg-bg-alt"
            >{item.label}</button>
          ))}
        </div>
      )}
    </>
  );
}
