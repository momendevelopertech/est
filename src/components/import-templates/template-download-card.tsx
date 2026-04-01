"use client";

import { ActionLink } from "@/components/ui/action-link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type TemplateDownloadCardProps = {
  locale: "ar" | "en";
  templateKey: "proctors" | "locations";
  title: string;
  description: string;
  templateLabel: string;
  sampleLabel: string;
  openAllLabel: string;
  className?: string;
};

const anchorClassName =
  "motion-button inline-flex h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-2xl border border-border bg-surface-elevated px-4.5 text-sm font-semibold tracking-[-0.01em] text-text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] transition-colors hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function TemplateDownloadCard({
  locale,
  templateKey,
  title,
  description,
  templateLabel,
  sampleLabel,
  openAllLabel,
  className
}: TemplateDownloadCardProps) {
  const templateHref = `/api/import/templates/${templateKey}/download?locale=${locale}&withSample=false`;
  const sampleHref = `/api/import/templates/${templateKey}/download?locale=${locale}&withSample=true`;

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <div className="flex flex-wrap gap-2">
          <Badge variant="accent">CSV</Badge>
          <Badge>{title}</Badge>
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <a href={templateHref} className={anchorClassName}>
          {templateLabel}
        </a>
        <a href={sampleHref} className={anchorClassName}>
          {sampleLabel}
        </a>
        <ActionLink href="/settings/import-templates">{openAllLabel}</ActionLink>
      </CardContent>
    </Card>
  );
}
