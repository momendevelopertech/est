import { z } from "zod";

import {
  booleanQueryParamSchema,
  localeQuerySchema
} from "@/lib/validation/common";

import { importTemplateKeys } from "./contracts";

export const importTemplateRouteParamsSchema = z.object({
  templateKey: z.enum(importTemplateKeys)
});

export const importTemplateListQuerySchema = z.object({
  locale: localeQuerySchema.optional()
});

export const importTemplateDownloadQuerySchema = z.object({
  locale: localeQuerySchema.optional(),
  withSample: booleanQueryParamSchema
});

export type ImportTemplateRouteParams = z.infer<
  typeof importTemplateRouteParamsSchema
>;
export type ImportTemplateListQuery = z.infer<
  typeof importTemplateListQuerySchema
>;
export type ImportTemplateDownloadQuery = z.infer<
  typeof importTemplateDownloadQuerySchema
>;
