import { ProctorOperationalRole } from "@prisma/client";

import type { Locale } from "@/lib/i18n";

export const proctorOperationalRoleValues = [
  ProctorOperationalRole.HEAD,
  ProctorOperationalRole.SENIOR,
  ProctorOperationalRole.ROAMING,
  ProctorOperationalRole.PROCTOR,
  ProctorOperationalRole.CONTROL,
  ProctorOperationalRole.SERVICE
] as const;

const proctorOperationalRoleLabels: Record<
  ProctorOperationalRole,
  { ar: string; en: string }
> = {
  HEAD: {
    ar: "هيد",
    en: "Head"
  },
  SENIOR: {
    ar: "سنيور",
    en: "Senior"
  },
  ROAMING: {
    ar: "رومينج",
    en: "Roaming"
  },
  PROCTOR: {
    ar: "بروكتور",
    en: "Proctor"
  },
  CONTROL: {
    ar: "كنترول",
    en: "Control"
  },
  SERVICE: {
    ar: "سيرفيس",
    en: "Service"
  }
};

export function getProctorOperationalRoleLabel(
  role: ProctorOperationalRole | null | undefined,
  locale: Locale
) {
  if (!role) {
    return locale === "ar" ? "-" : "-";
  }

  return proctorOperationalRoleLabels[role][locale];
}

export function getProctorOperationalRoleOptions(locale: Locale) {
  return proctorOperationalRoleValues.map((role) => ({
    value: role,
    label: getProctorOperationalRoleLabel(role, locale)
  }));
}
