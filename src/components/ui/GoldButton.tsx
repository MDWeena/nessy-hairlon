import type { ButtonHTMLAttributes } from "react";

type GoldButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function GoldButton({ className, ...rest }: GoldButtonProps) {
  return <button className={className ? `cta-gold ${className}` : "cta-gold"} {...rest} />;
}
