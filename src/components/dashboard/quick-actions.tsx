import type { ReactNode } from "react";

import Link from "next/link";

type QuickActionItem = {
  label: string;
  path: string;
  href: string;
  icon: ReactNode;
};

type QuickActionsProps = {
  items: QuickActionItem[];
};

function ActionCard({ label, path, href, icon }: QuickActionItem) {
  return (
    <Link
      href={href}
      className="motion-card flex flex-col items-end gap-3 rounded-[16px] border border-border bg-surface-elevated p-5 hover:border-accent hover:bg-[#FEFCE8] dark:hover:bg-accent/10"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-[color:var(--accent-contrast)]">
        {icon}
      </div>
      <span className="text-right text-sm font-semibold text-text-primary">{label}</span>
      <span className="text-xs text-text-muted" dir="ltr">
        {path}
      </span>
    </Link>
  );
}

export function QuickActions({ items }: QuickActionsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <ActionCard key={item.href} {...item} />
      ))}
    </div>
  );
}
