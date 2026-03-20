export type NotificationEmailLocale = "en" | "ar";

export type NotificationEmailLocalizedContentContract = {
  en: string;
  ar: string;
};

export type NotificationEmailTemplateContract = {
  id: string;
  key: string;
  type: string;
  isActive: boolean;
  variables: string[];
  subject: NotificationEmailLocalizedContentContract;
  body: NotificationEmailLocalizedContentContract;
  createdAt: Date;
  updatedAt: Date;
};

export type NotificationEmailTemplateListContract = {
  data: NotificationEmailTemplateContract[];
  total: number;
};

export type UpsertNotificationEmailTemplateResultContract = {
  mode: "created" | "updated";
  data: NotificationEmailTemplateContract;
};

export type NotificationEmailPreviewVariablesContract = Record<
  string,
  string | number | boolean | null
>;

export type NotificationEmailRenderResultContract = {
  templateId: string;
  templateKey: string;
  templateType: string;
  locale: NotificationEmailLocale;
  renderedSubject: string;
  renderedBody: string;
  usedVariables: string[];
  missingVariables: string[];
  unexpectedVariables: string[];
};

export type NotificationEmailPreviewResultContract =
  NotificationEmailRenderResultContract;
