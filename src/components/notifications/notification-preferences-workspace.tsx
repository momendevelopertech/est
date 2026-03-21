"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionLink } from "@/components/ui/action-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { PageHero } from "@/components/ui/page-hero";
import type { Locale, Messages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type NotificationPreferencesRecord = {
  id: string;
  userId: string;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
  preferredLanguage: "en" | "ar" | null;
  createdAt: string;
  updatedAt: string;
};

type NotificationPreferencesResponse = {
  ok: boolean;
  data?: NotificationPreferencesRecord;
  error?: string;
  message?: string;
};

type ChannelPreferenceKey =
  | "emailEnabled"
  | "whatsappEnabled"
  | "smsEnabled"
  | "inAppEnabled";

const channelKeys: ChannelPreferenceKey[] = [
  "emailEnabled",
  "whatsappEnabled",
  "smsEnabled",
  "inAppEnabled"
];

function parsePreferences(value: unknown): NotificationPreferencesRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const preferredLanguage =
    record.preferredLanguage === "ar" || record.preferredLanguage === "en"
      ? record.preferredLanguage
      : null;

  if (typeof record.id !== "string" || typeof record.userId !== "string") {
    return null;
  }

  for (const key of channelKeys) {
    if (typeof record[key] !== "boolean") {
      return null;
    }
  }

  return {
    id: record.id,
    userId: record.userId,
    emailEnabled: record.emailEnabled as boolean,
    whatsappEnabled: record.whatsappEnabled as boolean,
    smsEnabled: record.smsEnabled as boolean,
    inAppEnabled: record.inAppEnabled as boolean,
    preferredLanguage,
    createdAt:
      typeof record.createdAt === "string"
        ? record.createdAt
        : new Date().toISOString(),
    updatedAt:
      typeof record.updatedAt === "string"
        ? record.updatedAt
        : new Date().toISOString()
  };
}

async function fetchPreferences() {
  const response = await fetch("/api/notifications/preferences", {
    method: "GET",
    credentials: "same-origin",
    headers: {
      Accept: "application/json"
    }
  });
  const payload = (await response.json()) as NotificationPreferencesResponse;

  if (!response.ok || !payload.ok) {
    throw new Error(payload.message ?? payload.error ?? "preferences_load_failed");
  }

  const parsed = parsePreferences(payload.data);

  if (!parsed) {
    throw new Error("preferences_payload_invalid");
  }

  return parsed;
}

function normalizeErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return fallback;
  }

  return fallback;
}

export function NotificationPreferencesWorkspace({
  locale,
  messages
}: {
  locale: Locale;
  messages: Messages;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [preferences, setPreferences] =
    useState<NotificationPreferencesRecord | null>(null);

  const loadPreferences = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchPreferences();
      setPreferences(data);
    } catch (loadError) {
      console.error(loadError);
      setPreferences(null);
      setError(messages.notificationPreferences.errors.loadFailed);
    } finally {
      setIsLoading(false);
    }
  }, [messages.notificationPreferences.errors.loadFailed]);

  useEffect(() => {
    void loadPreferences();
  }, [loadPreferences]);

  const allChannelsDisabled =
    preferences !== null &&
    !preferences.emailEnabled &&
    !preferences.whatsappEnabled &&
    !preferences.smsEnabled &&
    !preferences.inAppEnabled;

  const channels = useMemo(
    () => [
      {
        key: "emailEnabled" as const,
        title: messages.notificationPreferences.channels.email.label,
        description: messages.notificationPreferences.channels.email.description
      },
      {
        key: "whatsappEnabled" as const,
        title: messages.notificationPreferences.channels.whatsapp.label,
        description: messages.notificationPreferences.channels.whatsapp.description
      },
      {
        key: "smsEnabled" as const,
        title: messages.notificationPreferences.channels.sms.label,
        description: messages.notificationPreferences.channels.sms.description
      },
      {
        key: "inAppEnabled" as const,
        title: messages.notificationPreferences.channels.inApp.label,
        description: messages.notificationPreferences.channels.inApp.description
      }
    ],
    [messages.notificationPreferences.channels]
  );

  const updatePreferences = useCallback(
    async (
      payload: Partial<
        Pick<
          NotificationPreferencesRecord,
          | "emailEnabled"
          | "whatsappEnabled"
          | "smsEnabled"
          | "inAppEnabled"
          | "preferredLanguage"
        >
      >,
      key: string
    ) => {
      if (!preferences) {
        return;
      }

      const previous = preferences;
      const optimistic = {
        ...previous,
        ...payload
      };

      setPreferences(optimistic);
      setError(null);
      setSuccess(null);
      setIsSaving(true);
      setSavingKey(key);

      try {
        const response = await fetch("/api/notifications/preferences", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify(payload)
        });
        const body = (await response.json()) as NotificationPreferencesResponse;

        if (!response.ok || !body.ok) {
          throw new Error(body.message ?? body.error ?? "preferences_update_failed");
        }

        const parsed = parsePreferences(body.data);

        if (!parsed) {
          throw new Error("preferences_payload_invalid");
        }

        setPreferences(parsed);
        setSuccess(messages.notificationPreferences.status.updated);
      } catch (updateError) {
        console.error(updateError);
        setPreferences(previous);
        setError(
          normalizeErrorMessage(
            updateError,
            messages.notificationPreferences.errors.updateFailed
          )
        );
      } finally {
        setIsSaving(false);
        setSavingKey(null);
      }
    },
    [
      messages.notificationPreferences.errors.updateFailed,
      messages.notificationPreferences.status.updated,
      preferences
    ]
  );

  return (
    <div className="space-y-6">
      <PageHero
        badges={[
          { label: messages.common.protected, variant: "accent" },
          { label: messages.nav.notifications }
        ]}
        title={messages.notificationPreferences.title}
        description={messages.notificationPreferences.subtitle}
        aside={
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
              {messages.notificationPreferences.actions.open}
            </p>
            <p className="mt-2 text-lg font-semibold tracking-[-0.02em] text-text-primary">
              {isSaving
                ? messages.notificationPreferences.status.saving
                : messages.notificationPreferences.status.updated}
            </p>
          </>
        }
        actions={
          <>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void loadPreferences()}
              disabled={isLoading || isSaving}
            >
              {messages.notificationPreferences.actions.refresh}
            </Button>
            <ActionLink href="/notifications">
              {messages.notificationPreferences.actions.openInbox}
            </ActionLink>
            {isSaving ? (
              <Badge variant="warning">
                {messages.notificationPreferences.status.saving}
              </Badge>
            ) : null}
          </>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-3xl border border-border bg-surface-elevated"
            />
          ))}
        </div>
      ) : null}

      {!isLoading && error ? (
        <div className="rounded-3xl border border-danger/40 bg-surface-elevated px-4 py-4 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {!isLoading && success ? (
        <div className="rounded-3xl border border-success/40 bg-surface-elevated px-4 py-4 text-sm text-success">
          {success}
        </div>
      ) : null}

      {!isLoading && preferences ? (
        <>
          {allChannelsDisabled ? (
            <div className="rounded-3xl border border-warning/40 bg-surface-elevated px-4 py-4 text-sm text-warning">
              {messages.notificationPreferences.status.allDisabled}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            {channels.map((channel) => {
              const enabled = preferences[channel.key];
              const pending = savingKey === channel.key;

              return (
                <Card key={channel.key} className="panel border-transparent">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-xl">{channel.title}</CardTitle>
                      <Badge
                        variant={enabled ? "accent" : "default"}
                        className={cn(
                          enabled ? "" : "bg-surface-elevated text-text-secondary"
                        )}
                      >
                        {enabled
                          ? messages.notificationPreferences.labels.enabled
                          : messages.notificationPreferences.labels.disabled}
                      </Badge>
                    </div>
                    <CardDescription>{channel.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-end">
                    <Button
                      size="sm"
                      variant={enabled ? "primary" : "secondary"}
                      disabled={isSaving}
                      onClick={() =>
                        void updatePreferences(
                          {
                            [channel.key]: !enabled
                          },
                          channel.key
                        )
                      }
                    >
                      {pending
                        ? messages.notificationPreferences.status.saving
                        : enabled
                          ? messages.notificationPreferences.actions.disable
                          : messages.notificationPreferences.actions.enable}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="panel border-transparent">
            <CardHeader>
              <CardTitle className="text-xl">
                {messages.notificationPreferences.language.label}
              </CardTitle>
              <CardDescription>
                {messages.notificationPreferences.language.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <select
                className="h-11 w-full rounded-2xl border border-border bg-surface-elevated px-4 text-sm text-text-primary outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent sm:max-w-sm"
                value={preferences.preferredLanguage ?? ""}
                disabled={isSaving}
                onChange={(event) => {
                  const value = event.target.value;
                  void updatePreferences(
                    {
                      preferredLanguage:
                        value === "en" || value === "ar" ? value : null
                    },
                    "preferredLanguage"
                  );
                }}
              >
                <option value="">
                  {messages.notificationPreferences.language.inherit}
                </option>
                <option value="en">
                  {messages.notificationPreferences.language.english}
                </option>
                <option value="ar">
                  {messages.notificationPreferences.language.arabic}
                </option>
              </select>
              <p className="text-sm text-text-secondary">
                {locale === "ar"
                  ? messages.notificationPreferences.language.currentAr
                  : messages.notificationPreferences.language.currentEn}
              </p>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
