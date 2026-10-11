import { useRef } from "react";
import type { ButtonHTMLAttributes, MouseEvent } from "react";

type GoldButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

/** The app's primary CTA — gold fill, dark text. Besides the brand styling, it spawns a dark
 * ripple from the exact tap point on click (see rippleExpand in global.css), the inverse of
 * what a dark-filled button would get — this app doesn't have one, every primary action uses
 * this same gold-filled style. */
export function GoldButton({ className, onClick, ...rest }: GoldButtonProps) {
  const ref = useRef<HTMLButtonElement | null>(null);

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    const btn = ref.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.6;
      const ripple = document.createElement("span");
      ripple.style.cssText = `
        position:absolute; border-radius:9999px; pointer-events:none;
        width:${size}px; height:${size}px;
        left:${e.clientX - rect.left - size / 2}px; top:${e.clientY - rect.top - size / 2}px;
        background: rgba(10,10,10,0.25);
        animation: rippleExpand 0.5s ease-out;
      `;
      btn.appendChild(ripple);
      ripple.addEventListener("animationend", () => ripple.remove());
    }
    onClick?.(e);
  };

  return (
    <button
      ref={ref}
      className={`cta-gold relative overflow-hidden ${className ?? ""}`}
      onClick={handleClick}
      {...rest}
    />
  );
}
