function isDate(value: unknown): value is Date {
  return value instanceof Date;
}

function hasToJson(value: unknown): value is { toJSON: () => unknown } {
  return typeof value === "object" && value !== null && "toJSON" in value;
}

export function serializeForApi<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (isDate(value)) {
    return value.toISOString() as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeForApi(item)) as T;
  }

  if (hasToJson(value)) {
    const jsonValue = value.toJSON();

    if (jsonValue !== value) {
      return serializeForApi(jsonValue) as T;
    }
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => [
        key,
        serializeForApi(entryValue)
      ])
    ) as T;
  }

  return value;
}
