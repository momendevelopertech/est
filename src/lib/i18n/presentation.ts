import type { Locale } from "@/lib/i18n";

export type LocalizedNameRecord = {
  name: string;
  nameEn?: string | null;
};

export function getLocalizedName(entity: LocalizedNameRecord, locale: Locale) {
  if (locale === "ar") {
    return entity.name;
  }

  return entity.nameEn?.trim() || entity.name;
}

export function getAlternateLocalizedName(entity: LocalizedNameRecord, locale: Locale) {
  const alternate = locale === "ar" ? entity.nameEn?.trim() : entity.name.trim();
  const primary = getLocalizedName(entity, locale).trim();

  if (!alternate || alternate === primary) {
    return null;
  }

  return alternate;
}
