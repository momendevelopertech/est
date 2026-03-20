export const importTemplateKeys = [
  "locations",
  "proctors",
  "cycle_proctors",
  "sphinx_staff"
] as const;

export type ImportTemplateKey = (typeof importTemplateKeys)[number];

export type ImportTemplateLocale = "en" | "ar";
export type ImportTemplateFormat = "csv";

export type ImportTemplateContract = {
  key: ImportTemplateKey;
  name: string;
  description: string;
  format: ImportTemplateFormat;
  columns: string[];
  columnCount: number;
  sampleRowCount: number;
  templateFileName: string;
  sampleFileName: string;
};

export type ImportTemplateListContract = {
  locale: ImportTemplateLocale;
  data: ImportTemplateContract[];
};

export type ImportTemplateDownloadContract = {
  templateKey: ImportTemplateKey;
  locale: ImportTemplateLocale;
  withSample: boolean;
};

export type ImportTemplateDownloadResultContract = {
  key: ImportTemplateKey;
  locale: ImportTemplateLocale;
  withSample: boolean;
  fileName: string;
  format: ImportTemplateFormat;
  contentType: string;
  content: string;
};
