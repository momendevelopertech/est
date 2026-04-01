import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border border-transparent bg-accent text-[color:var(--accent-contrast)] shadow-[0_14px_32px_-18px_rgba(245,230,66,0.78)] hover:bg-accent-hover hover:shadow-[0_18px_36px_-18px_rgba(245,230,66,0.84)]",
  secondary:
    "border border-border bg-surface-elevated text-text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.52)] hover:border-text-primary hover:bg-[color:var(--surface-strong)]",
  ghost:
    "border border-transparent bg-transparent text-text-secondary hover:bg-[color:var(--accent-soft)] hover:text-text-primary",
  danger:
    "border border-transparent bg-danger text-white shadow-[0_18px_36px_-24px_rgba(239,68,68,0.62)] hover:opacity-95"
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm leading-none",
  md: "h-11 px-4.5 text-sm leading-none",
  lg: "h-12 px-5 text-base leading-none"
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  className,
  type = "button",
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "motion-button inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-center font-semibold tracking-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    />
  );
}
