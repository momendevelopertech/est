"use client";

import { useEffect, useState, useTransition } from "react";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";

import type { ThemeMode } from "@/lib/auth/types";
import type { Messages } from "@/lib/i18n";
import { themeModes } from "@/lib/theme";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  initialTheme: ThemeMode;
  messages: Messages;
};

export function ThemeToggle({ initialTheme, messages }: ThemeToggleProps) {
  const router = useRouter();
  const { setTheme, theme } = useTheme();
  const [selectedTheme, setSelectedTheme] = useState<ThemeMode>(initialTheme);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (theme === "light" || theme === "dark" || theme === "system") {
      setSelectedTheme(theme);
      return;
    }

    setSelectedTheme(initialTheme);
  }, [initialTheme, theme]);

  function getThemeLabel(themeMode: ThemeMode) {
    switch (themeMode) {
      case "light":
        return messages.theme.light;
      case "dark":
        return messages.theme.dark;
      default:
        return messages.theme.system;
    }
  }

  function handleThemeChange(nextTheme: ThemeMode) {
    if (nextTheme === selectedTheme) {
      return;
    }

    const previousTheme = selectedTheme;

    setSelectedTheme(nextTheme);
    setTheme(nextTheme);

    startTransition(() => {
      void (async () => {
        const response = await fetch("/api/preferences/theme", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            theme: nextTheme
          })
        });

        if (!response.ok) {
          setSelectedTheme(previousTheme);
          setTheme(previousTheme);
          return;
        }

        router.refresh();
      })();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-text-secondary">
        {messages.theme.label}
      </span>

      <div
        className="inline-flex flex-wrap items-center gap-1 rounded-2xl border border-border bg-surface-elevated p-1 shadow-sm"
        role="group"
        aria-label={messages.theme.label}
      >
        {themeModes.map((themeMode) => {
          const isActive = selectedTheme === themeMode;

          return (
            <button
              key={themeMode}
              type="button"
              onClick={() => handleThemeChange(themeMode)}
              disabled={isPending}
              aria-pressed={isActive}
              className={cn(
                "motion-button inline-flex min-w-16 items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em]",
                isActive
                  ? "bg-accent text-white shadow-panel"
                  : "text-text-secondary hover:bg-surface hover:text-text-primary"
              )}
            >
              {getThemeLabel(themeMode)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
