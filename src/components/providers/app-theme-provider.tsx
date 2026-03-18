"use client";

import type { ReactNode } from "react";

import { ThemeProvider } from "next-themes";

import type { ThemeMode } from "@/lib/auth/types";
import { themeCookieName } from "@/lib/theme";

type AppThemeProviderProps = {
  children: ReactNode;
  defaultTheme: ThemeMode;
};

export function AppThemeProvider({
  children,
  defaultTheme
}: AppThemeProviderProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme={defaultTheme}
      enableSystem
      storageKey={themeCookieName}
    >
      {children}
    </ThemeProvider>
  );
}
