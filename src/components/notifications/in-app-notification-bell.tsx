"use client";

import Link from "next/link";
import { type CSSProperties, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

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

const PANEL_EDGE_GAP = 16;
const PANEL_OFFSET = 12;
const PANEL_MAX_WIDTH = 416;
const PANEL_MAX_HEIGHT = 440;

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
  const panelId = useId();
  const [hasMounted, setHasMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);

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

  const updatePanelStyle = useCallback(() => {
    if (!triggerRef.current || typeof window === "undefined") {
      return;
    }

    const rect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = Math.min(PANEL_MAX_WIDTH, viewportWidth - PANEL_EDGE_GAP * 2);
    const maxHeight = Math.min(
      PANEL_MAX_HEIGHT,
      viewportHeight - PANEL_EDGE_GAP * 2
    );
    const triggerCenter = rect.left + rect.width / 2;
    const shouldOpenToInlineEnd = triggerCenter > viewportWidth / 2;
    const left = shouldOpenToInlineEnd
      ? Math.max(PANEL_EDGE_GAP, rect.right - width)
      : Math.min(
          Math.max(PANEL_EDGE_GAP, rect.left),
          viewportWidth - width - PANEL_EDGE_GAP
        );
    const preferredTop = rect.bottom + PANEL_OFFSET;
    const top = Math.max(
      PANEL_EDGE_GAP,
      Math.min(preferredTop, viewportHeight - maxHeight - PANEL_EDGE_GAP)
    );

    setPanelStyle({
      left,
      top,
      width,
      maxHeight
    });
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications, locale]);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setPanelStyle(null);
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (
        panelRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }

      setIsOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    updatePanelStyle();

    function handleViewportChange() {
      updatePanelStyle();
    }

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [isOpen, updatePanelStyle]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
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

  const notificationPanel =
    hasMounted && isOpen && panelStyle
      ? createPortal(
          <div
            id={panelId}
            ref={panelRef}
            role="dialog"
            aria-modal="false"
            className="panel fixed z-[80] flex overflow-hidden rounded-3xl border border-border p-4 shadow-panel"
            style={panelStyle}
          >
            <div className="flex min-h-0 w-full flex-col">
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

              <div className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pe-1">
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
                                onClick={() =>
                                  void markNotificationAsRead(notification.id)
                                }
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

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
                <p className="text-xs text-text-secondary">
                  {messages.notifications.bell.unreadCountLabel}: {unreadCount}
                </p>
                <Link
                  className="shrink-0 text-xs font-medium text-accent hover:text-accent-hover"
                  href="/notifications"
                  onClick={() => setIsOpen(false)}
                >
                  {messages.notifications.bell.openAll}
                </Link>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          aria-label={messages.notifications.bell.aria}
          aria-controls={panelId}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          className={cn(
            "motion-button relative inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-surface-elevated text-text-primary shadow-[var(--shadow-soft)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-strong)]",
            isOpen ? "border-[color:var(--border-strong)] bg-[color:var(--surface-strong)] text-accent" : ""
          )}
          onClick={() =>
            setIsOpen((current) => {
              const next = !current;

              if (next) {
                void loadNotifications();
              }

              return next;
            })
          }
        >
          <BellIcon />
          {hasUnread ? (
            <span className="absolute -end-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[10px] font-semibold text-white">
              {unreadBadge}
            </span>
          ) : null}
        </button>
      </div>
      {notificationPanel}
    </>
  );
}
