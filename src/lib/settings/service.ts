import "server-only";

import { cache } from "react";

import { db } from "@/lib/db";
import { isThemeMode } from "@/lib/theme";

import type { ThemeMode } from "@/lib/auth/types";

export const getSystemDefaultTheme = cache(async (): Promise<ThemeMode> => {
  const setting = await db.setting.findUnique({
    where: {
      key: "system.default_theme"
    },
    select: {
      value: true
    }
  });

  if (typeof setting?.value === "string") {
    const normalizedValue = setting.value.toLowerCase();

    if (isThemeMode(normalizedValue)) {
      return normalizedValue;
    }
  }

  return "system";
});
