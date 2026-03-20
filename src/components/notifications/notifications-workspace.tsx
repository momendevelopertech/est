"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import type { Locale, Messages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type NotificationRecord = {
  id: string;
  userId: string;
  type: string;
  title: {
    en: string;
    ar: string;
  };
  body: {
    en: string;
    ar: string;
  };
  readAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

type NotificationsListResponse = {
  ok: boolean;
  data?: {
    data: NotificationRecord[];
    total: number;
    unreadCount: number;
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      pageCount: number;
      hasPreviousPage: boolean;
      hasNextPage: boolean;
    };
  };
};

function localizedText(
  locale: Locale,
  value: {
    en: string;
    ar: string;
  }
) {
  return locale === "ar" ? value.ar : value.en;
}

function formatDate(locale: Locale, value: string) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function NotificationsWorkspace({
  locale,
  messages
}: {
  locale: Locale;
  messages: Messages;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [records, setRecords] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pagination, setPagination] =
    useState<NonNullable<NotificationsListResponse["data"]>["pagination"] | null>(
      null
    );

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        unreadOnly: unreadOnly ? "true" : "false"
      });

      const response = await fetch(`/api/notifications/in-app?${params.toString()}`, {
        method: "GET",
        credentials: "same-origin",
        headers: {
          Accept: "application/json"
        }
      });
      const payload = (await response.json()) as NotificationsListResponse;

      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error("notifications_list_failed");
      }

      setRecords(payload.data.data);
      setUnreadCount(payload.data.unreadCount);
      setPagination(payload.data.pagination);
    } catch (loadError) {
      console.error(loadError);
      setError(messages.notifications.errors.loadFailed);
      setRecords([]);
      setUnreadCount(0);
      setPagination(null);
    } finally {
      setIsLoading(false);
    }
  }, [messages.notifications.errors.loadFailed, page, pageSize, unreadOnly]);

  async function markNotificationAsRead(notificationId: string) {
    setIsMutating(true);

    try {
      const response = await fetch("/api/notifications/in-app/read", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          notificationId
        })
      });

      if (!response.ok) {
        throw new Error("notification_mark_read_failed");
      }

      setRecords((current) =>
        current.map((record) =>
          record.id === notificationId
            ? {
                ...record,
                readAt: new Date().toISOString()
              }
            : record
        )
      );
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (mutationError) {
      console.error(mutationError);
      setError(messages.notifications.errors.readFailed);
    } finally {
      setIsMutating(false);
    }
  }

  async function markAllAsRead() {
    setIsMutating(true);

    try {
      const response = await fetch("/api/notifications/in-app/read-all", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        throw new Error("notification_mark_all_read_failed");
      }

      const readAt = new Date().toISOString();
      setRecords((current) =>
        current.map((record) => ({
          ...record,
          readAt: record.readAt ?? readAt
        }))
      );
      setUnreadCount(0);
    } catch (mutationError) {
      console.error(mutationError);
      setError(messages.notifications.errors.readAllFailed);
    } finally {
      setIsMutating(false);
    }
  }

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications, locale]);

  const stats = useMemo(
    () => [
      {
        key: "total",
        label: messages.notifications.stats.total,
        value: pagination?.total ?? 0
      },
      {
        key: "unread",
        label: messages.notifications.stats.unread,
        value: unreadCount
      },
      {
        key: "page",
        label: messages.notifications.stats.page,
        value: pagination?.page ?? 1
      }
    ],
    [messages.notifications.stats, pagination?.page, pagination?.total, unreadCount]
  );

  return (
    <div className="space-y-6">
      <Card className="panel relative overflow-hidden border-transparent px-6 py-6 sm:px-8">
        <div className="pointer-events-none absolute inset-0 opacity-80">
          <div className="absolute -top-20 right-0 h-56 w-56 rounded-full bg-accent/20 blur-3xl" />
          <div className="absolute -bottom-24 left-0 h-64 w-64 rounded-full bg-warning/20 blur-3xl" />
        </div>
        <CardHeader className="relative">
          <div className="flex flex-wrap gap-2">
            <Badge variant="accent">{messages.common.protected}</Badge>
            <Badge>{messages.nav.notifications}</Badge>
          </div>
          <CardTitle className="text-3xl">{messages.notifications.page.title}</CardTitle>
          <CardDescription className="max-w-3xl text-base">
            {messages.notifications.page.subtitle}
          </CardDescription>
        </CardHeader>
        <CardContent className="relative flex flex-wrap gap-3">
          <Button
            size="sm"
            variant={unreadOnly ? "primary" : "secondary"}
            onClick={() => {
              setPage(1);
              setUnreadOnly((current) => !current);
            }}
          >
            {unreadOnly
              ? messages.notifications.actions.showAll
              : messages.notifications.actions.showUnreadOnly}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void loadNotifications()}
            disabled={isLoading}
          >
            {messages.notifications.actions.refresh}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void markAllAsRead()}
            disabled={isMutating || unreadCount === 0}
          >
            {messages.notifications.actions.markAllRead}
          </Button>
          <Link
            href="/settings/notifications"
            className="motion-button inline-flex h-9 items-center justify-center rounded-2xl bg-surface-elevated px-3 text-sm font-medium text-text-primary ring-1 ring-border transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {messages.notificationPreferences.actions.open}
          </Link>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((item) => (
          <Card key={item.key} className="panel border-transparent">
            <CardHeader>
              <CardDescription>{item.label}</CardDescription>
              <CardTitle className="text-3xl">
                {new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US").format(
                  item.value
                )}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

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
        <Card>
          <CardHeader>
            <CardTitle>{messages.notifications.errors.loadTitle}</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {!isLoading && !error && records.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{messages.notifications.emptyTitle}</CardTitle>
            <CardDescription>{messages.notifications.empty}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {!isLoading && !error && records.length > 0 ? (
        <div className="space-y-3">
          {records.map((record) => {
            const isUnread = record.readAt === null;

            return (
              <article
                key={record.id}
                className={cn(
                  "panel rounded-3xl border border-border px-4 py-4",
                  isUnread ? "ring-1 ring-accent/40" : ""
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Badge className="normal-case tracking-[0.08em]">
                      {record.type}
                    </Badge>
                    {isUnread ? (
                      <Badge variant="warning">
                        {messages.notifications.labels.unread}
                      </Badge>
                    ) : (
                      <Badge>{messages.notifications.labels.read}</Badge>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary">
                    {formatDate(locale, record.createdAt)}
                  </p>
                </div>
                <p className="mt-3 text-base font-semibold text-text-primary">
                  {localizedText(locale, record.title)}
                </p>
                <p className="mt-1 text-sm leading-7 text-text-secondary">
                  {localizedText(locale, record.body)}
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-text-secondary">
                    {isUnread
                      ? messages.notifications.labels.notReadYet
                      : `${messages.notifications.labels.readAt}: ${formatDate(
                          locale,
                          record.readAt ?? record.createdAt
                        )}`}
                  </p>
                  {isUnread ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isMutating}
                      onClick={() => void markNotificationAsRead(record.id)}
                    >
                      {messages.notifications.actions.markRead}
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {pagination ? (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-text-secondary">
              {messages.notifications.pagination.summary
                .replace("{page}", String(pagination.page))
                .replace("{pageCount}", String(pagination.pageCount))}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={!pagination.hasPreviousPage || isLoading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                {messages.notifications.pagination.previous}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={!pagination.hasNextPage || isLoading}
                onClick={() => setPage((current) => current + 1)}
              >
                {messages.notifications.pagination.next}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
