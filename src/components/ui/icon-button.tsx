import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Button } from "./button";

type IconButtonProps = ComponentProps<typeof Button> & {
  icon: ReactNode;
  label: string;
};

export function IconButton({
  icon,
  label,
  className,
  size = "sm",
  children,
  ...props
}: IconButtonProps) {
  return (
    <Button
      size={size}
      className={cn(
        "min-h-0 min-w-0 shrink-0 px-0 py-0",
        size === "sm" ? "h-9 w-9 rounded-xl" : size === "md" ? "h-11 w-11 rounded-2xl" : "h-12 w-12 rounded-2xl",
        className
      )}
      aria-label={label}
      title={label}
      {...props}
    >
      <span className="flex items-center justify-center">{icon}</span>
      {children}
    </Button>
  );
}
