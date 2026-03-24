import Image from "next/image";

import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  decorative?: boolean;
  label?: string;
};

export function BrandLogo({
  className,
  decorative = false,
  label = siteConfig.name
}: BrandLogoProps) {
  const logoClassName =
    "h-full w-full scale-[1.16] object-contain drop-shadow-[0_10px_22px_rgba(199,153,35,0.22)] transition-transform duration-200 dark:drop-shadow-[0_12px_26px_rgba(240,203,103,0.2)]";

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-visible",
        className
      )}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : label}
      role={decorative ? undefined : "img"}
    >
      <Image
        src="/logo.svg"
        alt=""
        aria-hidden
        width={459}
        height={320}
        className={cn(logoClassName, "dark:hidden")}
      />
      <Image
        src="/logo-dark.svg"
        alt=""
        aria-hidden
        width={459}
        height={320}
        className={cn(logoClassName, "hidden dark:block")}
      />
    </span>
  );
}
