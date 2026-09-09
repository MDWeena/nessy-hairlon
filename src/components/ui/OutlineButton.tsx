import type { ButtonHTMLAttributes } from "react";

type OutlineButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function OutlineButton({ className, ...rest }: OutlineButtonProps) {
  return <button className={className ? `cta-outline ${className}` : "cta-outline"} {...rest} />;
}
