"use client";

import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type HeroBadge = {
  label: string;
  variant?: "default" | "accent" | "success" | "warning";
};

type PageHeroProps = {
  badges?: HeroBadge[];
  title: string;
  description?: string;
  body?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
  className?: string;
};

export function PageHero({
  badges = [],
  title,
  description,
  body,
  actions,
  aside,
  className
}: PageHeroProps) {
  return (
    <Card className={cn("border-transparent px-5 py-5 sm:px-6 sm:py-6", className)}>
      <CardHeader className="space-y-4">
        {badges.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {badges.map((badge) => (
              <Badge key={`${badge.label}-${badge.variant ?? "default"}`} variant={badge.variant}>
                {badge.label}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,18rem)] lg:items-start">
          <div className="space-y-2">
            <CardTitle className="text-2xl sm:text-3xl">{title}</CardTitle>
            {description ? <CardDescription className="max-w-3xl">{description}</CardDescription> : null}
          </div>

          {aside ? (
            <div className="rounded-[22px] border border-border bg-surface-elevated px-4 py-4">
              {aside}
            </div>
          ) : null}
        </div>
      </CardHeader>

      {body || actions ? (
        <CardContent className="mt-4 space-y-4">
          {body ? <div className="text-sm leading-7 text-text-secondary">{body}</div> : null}
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
