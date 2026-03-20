import { z } from "zod";

import { localeQuerySchema, uuidSchema } from "@/lib/validation/common";

import { sessionExportFormats } from "./contracts";

export const sessionExportQuerySchema = z.object({
  sessionId: uuidSchema,
  format: z.enum(sessionExportFormats).optional(),
  locale: localeQuerySchema.optional()
});

export type SessionExportQuery = z.infer<typeof sessionExportQuerySchema>;
