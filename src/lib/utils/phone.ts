const PHONE_VALIDATION_PATTERN = /^\+?\d{7,20}$/;

export function normalizePhone(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  const compact = trimmed.replace(/[\s\-().]/g, "");

  if (!compact.startsWith("+")) {
    return compact.replace(/\+/g, "");
  }

  return `+${compact.slice(1).replace(/\+/g, "")}`;
}

export function validatePhone(value: string) {
  return PHONE_VALIDATION_PATTERN.test(normalizePhone(value));
}
