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
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center",
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
        className="h-full w-full object-contain dark:hidden"
      />
      <Image
        src="/logo-dark.svg"
        alt=""
        aria-hidden
        width={459}
        height={320}
        className="hidden h-full w-full object-contain dark:block"
      />
    </span>
  );
}
