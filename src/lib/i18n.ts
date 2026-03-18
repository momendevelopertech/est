import "server-only";

import { cookies, headers } from "next/headers";

import ar from "@/locales/ar.json";
import en from "@/locales/en.json";

export const supportedLocales = ["en", "ar"] as const;
export const localeCookieName = "examops_locale";

export type Locale = (typeof supportedLocales)[number];
export type Messages = typeof en;

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "en" || value === "ar";
}

export async function resolveRequestLocale(): Promise<Locale> {
  const cookieLocale = cookies().get(localeCookieName)?.value;

  if (isLocale(cookieLocale)) {
    return cookieLocale;
  }

  const acceptLanguage = headers().get("accept-language")?.toLowerCase();

  if (acceptLanguage?.includes("ar")) {
    return "ar";
  }

  return "en";
}

export function getDirection(locale: Locale) {
  return locale === "ar" ? "rtl" : "ltr";
}

export function getMessages(locale: Locale): Messages {
  return locale === "ar" ? ar : en;
}
