import type { Metadata } from "next";

import { redirect } from "next/navigation";

import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getSession } from "@/lib/auth/session";
import { ERROR_CODES } from "@/lib/errors/codes";
import { getMessages, resolveRequestLocale } from "@/lib/i18n";

type LoginPageProps = {
  searchParams?: {
    error?: string;
  };
};

export const metadata: Metadata = {
  title: "ExamOps Login"
};

const DEFAULT_ADMIN_EMAIL = "admin@examops.local";
const DEFAULT_ADMIN_PASSWORD = "ChangeMe123!";

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getSession();

  if (session) {
    redirect("/dashboard");
  }

  const locale = await resolveRequestLocale();
  const messages = getMessages(locale);
  const authError =
    searchParams?.error === ERROR_CODES.invalidCredentials
      ? messages.auth.error
      : searchParams?.error === ERROR_CODES.authDbUnavailable
        ? messages.auth.dbUnavailable
        : searchParams?.error === ERROR_CODES.authEnvMisconfigured
          ? messages.auth.envMisconfigured
      : searchParams?.error === ERROR_CODES.authServiceUnavailable
        ? messages.auth.serviceUnavailable
        : null;
  const seededAccounts = Object.entries(messages.auth.accounts);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
      <Card className="panel border-transparent px-6 py-6 sm:px-8 sm:py-8">
        <CardHeader className="space-y-6">
          <div className="flex items-center gap-4 rounded-[26px] border border-border bg-surface-elevated px-4 py-4 shadow-[var(--shadow-soft)]">
            <div className="relative flex h-16 w-[5.25rem] shrink-0 items-center justify-center overflow-hidden rounded-[22px] border border-border/80 bg-[linear-gradient(155deg,var(--surface-elevated),var(--surface-strong))]">
              <div className="absolute inset-[1px] rounded-[20px] bg-[radial-gradient(circle_at_top,rgba(199,153,35,0.22),transparent_62%)] dark:bg-[radial-gradient(circle_at_top,rgba(240,203,103,0.22),transparent_62%)]" />
              <BrandLogo className="relative z-10 h-9 w-14" decorative />
            </div>

            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-text-secondary">
                {messages.app.name}
              </p>
              <p className="mt-1 text-sm leading-6 text-text-secondary sm:text-[0.95rem]">
                {messages.app.tagline}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-text-secondary">
              {messages.auth.eyebrow}
            </p>
            <CardTitle className="mt-3 text-3xl sm:text-4xl">
              {messages.auth.title}
            </CardTitle>
            <CardDescription className="mt-3 max-w-2xl text-base">
              {messages.auth.subtitle}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <form action="/api/auth/login" method="post" className="space-y-4">
            <input type="hidden" name="locale" value={locale} />

            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary" htmlFor="email">
                {messages.auth.email}
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={DEFAULT_ADMIN_EMAIL}
                required
              />
            </div>

            <div className="space-y-2">
              <label
                className="text-sm font-medium text-text-primary"
                htmlFor="password"
              >
                {messages.auth.password}
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                autoFocus
                defaultValue={DEFAULT_ADMIN_PASSWORD}
                required
              />
            </div>

            {authError ? (
              <p className="rounded-2xl border border-border bg-surface-elevated px-4 py-3 text-sm text-danger">
                {authError}
              </p>
            ) : null}

            <Button type="submit" className="w-full">
              {messages.auth.submit}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-panel border border-border bg-surface px-6 py-6 shadow-panel sm:px-8 sm:py-8">
        <CardHeader>
          <CardTitle>{messages.auth.credentialsTitle}</CardTitle>
          <CardDescription>{messages.auth.credentialsBody}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-3 rounded-3xl border border-border bg-surface-elevated px-4 py-4">
            {seededAccounts.map(([role, email]) => (
              <div
                key={role}
                className="flex items-center justify-between gap-4 border-b border-border/70 pb-3 last:border-b-0 last:pb-0"
              >
                <span className="text-sm font-medium text-text-primary">
                  {messages.roles[role as keyof typeof messages.roles]}
                </span>
                <span className="text-sm text-text-secondary">{email}</span>
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-border bg-surface-elevated px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="relative flex h-12 w-[4rem] shrink-0 items-center justify-center overflow-hidden rounded-[18px] border border-border/80 bg-[linear-gradient(155deg,var(--surface-elevated),var(--surface-strong))]">
                <div className="absolute inset-[1px] rounded-[16px] bg-[radial-gradient(circle_at_top,rgba(199,153,35,0.18),transparent_62%)] dark:bg-[radial-gradient(circle_at_top,rgba(240,203,103,0.18),transparent_62%)]" />
                <BrandLogo className="relative z-10 h-7 w-10" decorative />
              </div>

              <div className="min-w-0">
                <p className="text-sm font-medium text-text-secondary">
                  {messages.common.foundation}
                </p>
                <p className="mt-1 text-lg font-semibold text-text-primary">
                  {messages.app.name}
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-7 text-text-secondary">
              {messages.app.tagline}
            </p>
          </div>

          <div
            className="rounded-3xl border border-border bg-surface-elevated px-4 py-4 text-right font-arabic"
            dir="rtl"
            lang="ar"
          >
            <p className="text-sm font-medium text-text-secondary">
              {messages.common.arabic}
            </p>
            <p className="mt-2 text-lg font-semibold text-text-primary">
              {messages.auth.arabicPanelBody}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
