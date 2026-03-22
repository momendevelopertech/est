"use client";

import { useEffect, useState, useTransition } from "react";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";

import { IconButton } from "@/components/ui/icon-button";
import { MonitorIcon, MoonIcon, SunIcon } from "@/components/ui/icons";
import type { ThemeMode } from "@/lib/auth/types";
import type { Messages } from "@/lib/i18n";
import { themeModes } from "@/lib/theme";

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

  function getNextTheme(currentTheme: ThemeMode): ThemeMode {
    const index = themeModes.indexOf(currentTheme);
    return themeModes[(index + 1) % themeModes.length];
  }

  function getThemeIcon(themeMode: ThemeMode) {
    switch (themeMode) {
      case "light":
        return <SunIcon />;
      case "dark":
        return <MoonIcon />;
      default:
        return <MonitorIcon />;
    }
  }

  return (
    <IconButton
      type="button"
      variant="secondary"
      size="sm"
      icon={getThemeIcon(selectedTheme)}
      label={`${messages.theme.label}: ${getThemeLabel(selectedTheme)}`}
      onClick={() => handleThemeChange(getNextTheme(selectedTheme))}
      disabled={isPending}
    />
  );
}
