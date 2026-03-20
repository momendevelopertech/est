import type { Metadata } from "next";

import { redirect } from "next/navigation";

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
      : searchParams?.error === ERROR_CODES.authServiceUnavailable
        ? messages.auth.serviceUnavailable
        : null;
  const seededAccounts = Object.entries(messages.auth.accounts);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
      <Card className="panel border-transparent px-6 py-6 sm:px-8 sm:py-8">
        <CardHeader>
          <p className="text-xs uppercase tracking-[0.28em] text-text-secondary">
            {messages.auth.eyebrow}
          </p>
          <CardTitle className="text-3xl sm:text-4xl">
            {messages.auth.title}
          </CardTitle>
          <CardDescription className="max-w-2xl text-base">
            {messages.auth.subtitle}
          </CardDescription>
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
            <p className="text-sm font-medium text-text-secondary">
              {messages.common.foundation}
            </p>
            <p className="mt-2 text-lg font-semibold text-text-primary">
              {messages.app.name}
            </p>
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
