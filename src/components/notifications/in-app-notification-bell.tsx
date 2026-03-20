"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Locale, Messages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type NotificationItem = {
  id: string;
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
  createdAt: string;
};

type InAppNotificationsResponse = {
  ok: boolean;
  data?: {
    data: NotificationItem[];
    unreadCount: number;
  };
};

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 4.5a4.5 4.5 0 0 0-4.5 4.5v2.17c0 .98-.35 1.93-.98 2.67L5 15.5h14l-1.52-1.66a3.97 3.97 0 0 1-.98-2.67V9A4.5 4.5 0 0 0 12 4.5Zm0 15a2.25 2.25 0 0 0 2.12-1.5h-4.24A2.25 2.25 0 0 0 12 19.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function getLocalizedText(
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
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export function InAppNotificationBell({
  locale,
  messages
}: {
  locale: Locale;
  messages: Messages;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        "/api/notifications/in-app?page=1&pageSize=8",
        {
          method: "GET",
          credentials: "same-origin",
          headers: {
            Accept: "application/json"
          }
        }
      );
      const payload = (await response.json()) as InAppNotificationsResponse;

      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error("in_app_notifications_load_failed");
      }

      setNotifications(payload.data.data);
      setUnreadCount(payload.data.unreadCount);
    } catch (loadError) {
      console.error(loadError);
      setError(messages.notifications.errors.loadFailed);
    } finally {
      setIsLoading(false);
    }
  }, [messages.notifications.errors.loadFailed]);

  async function markNotificationAsRead(notificationId: string) {
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
        throw new Error("in_app_notification_mark_read_failed");
      }

      setNotifications((current) =>
        current.map((item) =>
          item.id === notificationId
            ? {
                ...item,
                readAt: new Date().toISOString()
              }
            : item
        )
      );
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (markError) {
      console.error(markError);
      setError(messages.notifications.errors.readFailed);
    }
  }

  async function markAllNotificationsAsRead() {
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
        throw new Error("in_app_notification_mark_all_read_failed");
      }

      const readAt = new Date().toISOString();
      setNotifications((current) =>
        current.map((item) => ({
          ...item,
          readAt: item.readAt ?? readAt
        }))
      );
      setUnreadCount(0);
    } catch (markError) {
      console.error(markError);
      setError(messages.notifications.errors.readAllFailed);
    }
  }

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications, locale]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (
        panelRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }

      setIsOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isOpen]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadNotifications();
    }, 60000);

    return () => window.clearInterval(interval);
  }, [loadNotifications, locale]);

  const hasUnread = unreadCount > 0;
  const unreadBadge = useMemo(
    () => (unreadCount > 99 ? "99+" : String(unreadCount)),
    [unreadCount]
  );

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={messages.notifications.bell.aria}
        className="motion-button relative inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-surface-elevated text-text-primary hover:bg-surface"
        onClick={() => setIsOpen((current) => !current)}
      >
        <BellIcon />
        {hasUnread ? (
          <span className="absolute -end-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[10px] font-semibold text-white">
            {unreadBadge}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          ref={panelRef}
          className={cn(
            "panel absolute z-30 mt-3 w-[min(26rem,calc(100vw-2rem))] rounded-3xl border border-border p-4 shadow-panel",
            locale === "ar" ? "left-0" : "right-0"
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-text-primary">
                {messages.notifications.bell.title}
              </p>
              <p className="text-xs text-text-secondary">
                {messages.notifications.bell.subtitle}
              </p>
            </div>
            {hasUnread ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-xs"
                onClick={() => void markAllNotificationsAsRead()}
              >
                {messages.notifications.actions.markAllRead}
              </Button>
            ) : null}
          </div>

          <div className="mt-4 space-y-2">
            {isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((item) => (
                  <div
                    key={item}
                    className="h-16 animate-pulse rounded-2xl border border-border bg-surface-elevated"
                  />
                ))}
              </div>
            ) : null}

            {!isLoading && error ? (
              <p className="rounded-2xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
                {error}
              </p>
            ) : null}

            {!isLoading && !error && notifications.length === 0 ? (
              <p className="rounded-2xl border border-border bg-surface-elevated px-3 py-3 text-sm text-text-secondary">
                {messages.notifications.empty}
              </p>
            ) : null}

            {!isLoading && !error
              ? notifications.map((notification) => {
                  const isUnread = notification.readAt === null;

                  return (
                    <article
                      key={notification.id}
                      className={cn(
                        "rounded-2xl border border-border bg-surface-elevated px-3 py-3",
                        isUnread ? "ring-1 ring-accent/40" : ""
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Badge className="normal-case tracking-[0.08em]">
                          {notification.type}
                        </Badge>
                        <p className="text-[11px] text-text-secondary">
                          {formatDate(locale, notification.createdAt)}
                        </p>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-text-primary">
                        {getLocalizedText(locale, notification.title)}
                      </p>
                      <p className="mt-1 text-xs leading-6 text-text-secondary">
                        {getLocalizedText(locale, notification.body)}
                      </p>
                      {isUnread ? (
                        <div className="mt-2 flex justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => void markNotificationAsRead(notification.id)}
                          >
                            {messages.notifications.actions.markRead}
                          </Button>
                        </div>
                      ) : null}
                    </article>
                  );
                })
              : null}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
            <p className="text-xs text-text-secondary">
              {messages.notifications.bell.unreadCountLabel}: {unreadCount}
            </p>
            <Link
              className="text-xs font-medium text-accent hover:text-accent-hover"
              href="/notifications"
              onClick={() => setIsOpen(false)}
            >
              {messages.notifications.bell.openAll}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
