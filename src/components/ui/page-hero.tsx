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
    <Card className={cn("relative overflow-hidden border-transparent px-6 py-6 sm:px-8", className)}>
      <div className="pointer-events-none absolute inset-0 opacity-85">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
        <div className="absolute -top-20 end-0 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute -bottom-24 start-0 h-64 w-64 rounded-full bg-warning/16 blur-3xl" />
      </div>

      <CardHeader className="relative">
        {badges.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {badges.map((badge) => (
              <Badge key={`${badge.label}-${badge.variant ?? "default"}`} variant={badge.variant}>
                {badge.label}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.8fr)] lg:items-end">
          <div>
            <CardTitle className="text-3xl sm:text-4xl">{title}</CardTitle>
            {description ? (
              <CardDescription className="mt-2 max-w-3xl text-base">
                {description}
              </CardDescription>
            ) : null}
          </div>

          {aside ? <div className="panel-subtle rounded-[24px] px-4 py-4">{aside}</div> : null}
        </div>
      </CardHeader>

      {body || actions ? (
        <CardContent className="relative flex flex-wrap items-start justify-between gap-4">
          {body ? (
            <div className="max-w-3xl text-sm leading-7 text-text-secondary">
              {body}
            </div>
          ) : null}
          {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
