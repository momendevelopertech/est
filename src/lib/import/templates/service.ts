import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import { logActivity } from "@/lib/activity/log";
import { parseCsvRows, stringifyCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import {
  getLocationsImportSampleCsv,
  getLocationsImportTemplateColumns
} from "@/lib/locations/import";
import {
  getProctorsImportSampleCsv,
  getProctorsImportTemplateColumns
} from "@/lib/proctors/import";

import type {
  ImportTemplateContract,
  ImportTemplateDownloadContract,
  ImportTemplateDownloadResultContract,
  ImportTemplateKey,
  ImportTemplateListContract,
  ImportTemplateLocale
} from "./contracts";

const cycleProctorsImportColumns = [
  "cycleCode",
  "sessionDate",
  "examType",
  "phone",
  "preferredBuildingCode",
  "preferredRoleKey",
  "priority",
  "notes"
] as const;

const sphinxStaffImportColumns = [
  "name",
  "nameEn",
  "phone",
  "email",
  "nationalId",
  "organization",
  "branch",
  "governorateCode",
  "preferredLanguage",
  "status",
  "notes"
] as const;

type TemplateStaticDefinition = {
  key: ImportTemplateKey;
  templateFileName: string;
  sampleFileName: string;
  getColumns: () => readonly string[];
  getSampleRows: () => string[][];
  title: Record<ImportTemplateLocale, string>;
  description: Record<ImportTemplateLocale, string>;
};

function createRowsFromHeaderAndData(
  columns: readonly string[],
  rows: string[][]
) {
  return [columns as string[], ...rows];
}

function extractSampleRowsFromCsv(sampleCsv: string) {
  const rows = parseCsvRows(sampleCsv);

  if (rows.length <= 1) {
    return [] as string[][];
  }

  return rows.slice(1);
}

const templateDefinitions: Record<ImportTemplateKey, TemplateStaticDefinition> = {
  locations: {
    key: "locations",
    templateFileName: "examops-locations-import-template.csv",
    sampleFileName: "examops-locations-import-sample.csv",
    getColumns: () => getLocationsImportTemplateColumns(),
    getSampleRows: () => extractSampleRowsFromCsv(getLocationsImportSampleCsv()),
    title: {
      en: "Locations import",
      ar: "\u0627\u0633\u062a\u064a\u0631\u0627\u062f \u0627\u0644\u0645\u0648\u0627\u0642\u0639"
    },
    description: {
      en: "Governorate-to-room hierarchy template used by the locations CSV import API.",
      ar: "\u0642\u0627\u0644\u0628 \u0647\u064a\u0643\u0644 \u0627\u0644\u0645\u0648\u0627\u0642\u0639 \u0645\u0646 \u0627\u0644\u0645\u062d\u0627\u0641\u0638\u0629 \u0625\u0644\u0649 \u0627\u0644\u0642\u0627\u0639\u0629 \u0644\u0627\u0633\u062a\u062e\u062f\u0627\u0645\u0647 \u0641\u064a \u0648\u0627\u062c\u0647\u0629 \u0627\u0644\u0627\u0633\u062a\u064a\u0631\u0627\u062f."
    }
  },
  proctors: {
    key: "proctors",
    templateFileName: "examops-proctors-import-template.csv",
    sampleFileName: "examops-proctors-import-sample.csv",
    getColumns: () => getProctorsImportTemplateColumns(),
    getSampleRows: () => extractSampleRowsFromCsv(getProctorsImportSampleCsv()),
    title: {
      en: "Proctors import",
      ar: "\u0627\u0633\u062a\u064a\u0631\u0627\u062f \u0627\u0644\u0645\u0631\u0627\u0642\u0628\u064a\u0646"
    },
    description: {
      en: "Canonical proctors CSV template with bilingual names and phone-based matching fields.",
      ar: "\u0627\u0644\u0642\u0627\u0644\u0628 \u0627\u0644\u0645\u0639\u062a\u0645\u062f \u0644\u0627\u0633\u062a\u064a\u0631\u0627\u062f \u0627\u0644\u0645\u0631\u0627\u0642\u0628\u064a\u0646 \u0645\u0639 \u062d\u0642\u0648\u0644 \u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u062b\u0646\u0627\u0626\u064a \u0648\u0627\u0644\u0645\u0637\u0627\u0628\u0642\u0629 \u0628\u0627\u0644\u0647\u0627\u062a\u0641."
    }
  },
  cycle_proctors: {
    key: "cycle_proctors",
    templateFileName: "examops-cycle-proctors-import-template.csv",
    sampleFileName: "examops-cycle-proctors-import-sample.csv",
    getColumns: () => cycleProctorsImportColumns,
    getSampleRows: () => [
      [
        "SPRING-2026",
        "2026-05-10",
        "EST1",
        "01001234567",
        "ENG-1",
        "building_head",
        "1",
        "priority candidate for session placement"
      ],
      [
        "SPRING-2026",
        "2026-05-11",
        "EST2",
        "01002223333",
        "",
        "",
        "",
        "fallback candidate when vacancy exists"
      ]
    ],
    title: {
      en: "Cycle proctors import",
      ar: "\u0627\u0633\u062a\u064a\u0631\u0627\u062f \u0645\u0631\u0627\u0642\u0628\u064a \u0627\u0644\u062f\u0648\u0631\u0627\u062a"
    },
    description: {
      en: "Cycle/session mapping template for assigning imported proctor candidates by phone.",
      ar: "\u0642\u0627\u0644\u0628 \u0631\u0628\u0637 \u0627\u0644\u062f\u0648\u0631\u0629 \u0648\u0627\u0644\u062c\u0644\u0633\u0629 \u0644\u062a\u0648\u0632\u064a\u0639 \u0645\u0631\u0634\u062d\u064a \u0627\u0644\u0645\u0631\u0627\u0642\u0628\u064a\u0646 \u0627\u0644\u0645\u0633\u062a\u0648\u0631\u062f\u064a\u0646 \u0628\u0627\u0644\u0647\u0627\u062a\u0641."
    }
  },
  sphinx_staff: {
    key: "sphinx_staff",
    templateFileName: "examops-sphinx-staff-import-template.csv",
    sampleFileName: "examops-sphinx-staff-import-sample.csv",
    getColumns: () => sphinxStaffImportColumns,
    getSampleRows: () => [
      [
        "Ahmed Salah",
        "Ahmed Salah",
        "01005556666",
        "ahmed.salah@example.com",
        "29801011234567",
        "Sphinx",
        "Cairo Branch",
        "CAI",
        "AR",
        "active",
        "existing sphinx staff import sample"
      ]
    ],
    title: {
      en: "Sphinx staff import",
      ar: "\u0627\u0633\u062a\u064a\u0631\u0627\u062f \u0641\u0631\u064a\u0642 Sphinx"
    },
    description: {
      en: "Staff import template for Sphinx-owned pools prior to assignment and waiting-list workflows.",
      ar: "\u0642\u0627\u0644\u0628 \u0627\u0633\u062a\u064a\u0631\u0627\u062f \u0641\u0631\u064a\u0642 Sphinx \u0642\u0628\u0644 \u062a\u062f\u0641\u0642\u0627\u062a \u0627\u0644\u062a\u0648\u0632\u064a\u0639 \u0648\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0627\u0646\u062a\u0638\u0627\u0631."
    }
  }
};

export class ImportTemplatesServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ImportTemplatesServiceError";
  }
}

function resolveLocale(locale?: string): ImportTemplateLocale {
  return locale === "ar" ? "ar" : "en";
}

function getTemplateDefinition(templateKey: ImportTemplateKey) {
  return templateDefinitions[templateKey];
}

function toTemplateContract(
  definition: TemplateStaticDefinition,
  locale: ImportTemplateLocale
): ImportTemplateContract {
  const columns = [...definition.getColumns()];
  const sampleRows = definition.getSampleRows();

  return {
    key: definition.key,
    name: definition.title[locale],
    description: definition.description[locale],
    format: "csv",
    columns,
    columnCount: columns.length,
    sampleRowCount: sampleRows.length,
    templateFileName: definition.templateFileName,
    sampleFileName: definition.sampleFileName
  };
}

async function logTemplateDownload(input: {
  actorAppUserId: string;
  template: ImportTemplateContract;
  locale: ImportTemplateLocale;
  withSample: boolean;
}) {
  await db.$transaction(
    async (tx) => {
      await logActivity({
        client: tx,
        userId: input.actorAppUserId,
        action: "download_template",
        entityType: "import_template",
        entityId: randomUUID(),
        description: `Downloaded ${input.template.key} import template.`,
        metadata: {
          templateKey: input.template.key,
          locale: input.locale,
          withSample: input.withSample,
          format: input.template.format,
          fileName: input.withSample
            ? input.template.sampleFileName
            : input.template.templateFileName
        }
      });
    },
    {
      maxWait: 10000,
      timeout: 30000,
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
    }
  );
}

export async function listImportTemplates(input: {
  locale?: string;
}): Promise<ImportTemplateListContract> {
  const locale = resolveLocale(input.locale);

  return {
    locale,
    data: Object.values(templateDefinitions).map((definition) =>
      toTemplateContract(definition, locale)
    )
  };
}

export async function downloadImportTemplate(
  input: ImportTemplateDownloadContract & {
    actorAppUserId: string;
  }
): Promise<ImportTemplateDownloadResultContract> {
  const locale = resolveLocale(input.locale);
  const definition = getTemplateDefinition(input.templateKey);
  const template = toTemplateContract(definition, locale);
  const sampleRows = input.withSample ? definition.getSampleRows() : [];
  const csvRows = createRowsFromHeaderAndData(template.columns, sampleRows);
  const csvContent = stringifyCsv(csvRows);
  const content = `\uFEFF${csvContent}`;

  await logTemplateDownload({
    actorAppUserId: input.actorAppUserId,
    template,
    locale,
    withSample: input.withSample
  });

  return {
    key: template.key,
    locale,
    withSample: input.withSample,
    fileName: input.withSample
      ? template.sampleFileName
      : template.templateFileName,
    format: "csv",
    contentType: "text/csv; charset=utf-8",
    content
  };
}
