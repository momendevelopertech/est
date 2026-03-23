import { stringifyCsv } from "@/lib/csv";
import type { Locale, Messages } from "@/lib/i18n";
import { getMessages } from "@/lib/i18n";
import { getLocalizedName } from "@/lib/i18n/presentation";
import { createSpreadsheetXml } from "@/lib/tabular";

import { db } from "@/lib/db";

import { getProctorOperationalRoleLabel } from "./operational-role";
import { assertGovernorateExists } from "./service";
import type { ProctorExportQuery } from "./validation";

function createStatusFilter(status: ProctorExportQuery["status"]) {
  if (status === "all") {
    return {};
  }

  return {
    isActive: status === "active"
  };
}

function toPreferredLanguageLabel(
  locale: Locale,
  messages: Messages,
  value: "AR" | "EN" | null
) {
  if (value === "AR") {
    return messages.common.arabic;
  }

  if (value === "EN") {
    return messages.common.english;
  }

  return locale === "ar" ? "-" : "-";
}

function toStatusLabel(messages: Messages, isActive: boolean) {
  return isActive ? messages.proctors.labels.active : messages.proctors.labels.inactive;
}

function toRowValue(value: string | null | undefined) {
  return value ?? "";
}

export async function exportProctors(
  query: ProctorExportQuery & {
    locale: Locale;
  }
) {
  if (query.governorateId) {
    await assertGovernorateExists(query.governorateId);
  }

  const records = await db.user.findMany({
    where: {
      ...createStatusFilter(query.status),
      ...(query.governorateId
        ? {
            governorateId: query.governorateId
          }
        : {}),
      ...(query.operationalRole
        ? {
            operationalRole: query.operationalRole
          }
        : {})
    },
    orderBy: [{ name: "asc" }],
    select: {
      name: true,
      nameEn: true,
      phone: true,
      email: true,
      nationalId: true,
      source: true,
      operationalRole: true,
      organization: true,
      branch: true,
      preferredLanguage: true,
      isActive: true,
      governorate: {
        select: {
          name: true,
          nameEn: true
        }
      }
    }
  });

  const messages = getMessages(query.locale);
  const messagesEn = getMessages("en");
  const messagesAr = getMessages("ar");
  const headers = [
    messages.proctors.exportFlow.headers.name,
    messages.proctors.exportFlow.headers.nameEn,
    messages.proctors.exportFlow.headers.phone,
    messages.proctors.exportFlow.headers.email,
    messages.proctors.exportFlow.headers.nationalId,
    messages.proctors.exportFlow.headers.source,
    query.locale === "ar" ? "الدور التشغيلي" : "Operational role",
    messages.proctors.exportFlow.headers.organization,
    messages.proctors.exportFlow.headers.branch,
    messages.proctors.exportFlow.headers.governorate,
    messages.proctors.exportFlow.headers.preferredLanguage,
    messages.proctors.exportFlow.headers.status
  ];
  const bilingualHeaderRows = [
    [
      messagesAr.proctors.exportFlow.headers.name,
      messagesAr.proctors.exportFlow.headers.nameEn,
      messagesAr.proctors.exportFlow.headers.phone,
      messagesAr.proctors.exportFlow.headers.email,
      messagesAr.proctors.exportFlow.headers.nationalId,
      messagesAr.proctors.exportFlow.headers.source,
      "الدور التشغيلي",
      messagesAr.proctors.exportFlow.headers.organization,
      messagesAr.proctors.exportFlow.headers.branch,
      messagesAr.proctors.exportFlow.headers.governorate,
      messagesAr.proctors.exportFlow.headers.preferredLanguage,
      messagesAr.proctors.exportFlow.headers.status
    ],
    [
      messagesEn.proctors.exportFlow.headers.name,
      messagesEn.proctors.exportFlow.headers.nameEn,
      messagesEn.proctors.exportFlow.headers.phone,
      messagesEn.proctors.exportFlow.headers.email,
      messagesEn.proctors.exportFlow.headers.nationalId,
      messagesEn.proctors.exportFlow.headers.source,
      "Operational role",
      messagesEn.proctors.exportFlow.headers.organization,
      messagesEn.proctors.exportFlow.headers.branch,
      messagesEn.proctors.exportFlow.headers.governorate,
      messagesEn.proctors.exportFlow.headers.preferredLanguage,
      messagesEn.proctors.exportFlow.headers.status
    ]
  ];

  const rows = records.map((record) => [
    record.name,
    toRowValue(record.nameEn),
    record.phone,
    toRowValue(record.email),
    toRowValue(record.nationalId),
    messages.proctors.sources[record.source],
    getProctorOperationalRoleLabel(record.operationalRole, query.locale),
    toRowValue(record.organization),
    toRowValue(record.branch),
    record.governorate ? getLocalizedName(record.governorate, query.locale) : "",
    toPreferredLanguageLabel(query.locale, messages, record.preferredLanguage),
    toStatusLabel(messages, record.isActive)
  ]);

  const dateStamp = new Date().toISOString().slice(0, 10);

  if (query.format === "excel") {
    return {
      body: createSpreadsheetXml({
        sheetName: messages.nav.proctors,
        headerRows: bilingualHeaderRows,
        rows
      }),
      contentType: "application/vnd.ms-excel; charset=utf-8",
      fileName: `proctors-export-${dateStamp}.xls`
    };
  }

  const csvBody = `\uFEFF${stringifyCsv([headers, ...rows])}`;

  return {
    body: csvBody,
    contentType: "text/csv; charset=utf-8",
    fileName: `proctors-export-${dateStamp}.csv`
  };
}
