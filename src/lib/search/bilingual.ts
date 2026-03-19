function normalizeSearchTerm(value?: string | null) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

export function createBilingualSearchFilter(
  search?: string | null,
  additionalFields: readonly string[] = []
) {
  const normalized = normalizeSearchTerm(search);

  if (!normalized) {
    return undefined;
  }

  return {
    OR: ["name", "nameEn", ...additionalFields].map((field) => ({
      [field]: {
        contains: normalized,
        mode: "insensitive" as const
      }
    }))
  };
}

export function matchesBilingualSearch(
  search: string,
  values: Array<string | null | undefined>
) {
  const normalized = normalizeSearchTerm(search)?.toLocaleLowerCase();

  if (!normalized) {
    return true;
  }

  return values.some((value) => value?.toLocaleLowerCase().includes(normalized));
}
