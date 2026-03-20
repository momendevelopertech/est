import { z } from "zod";

import { localeQuerySchema, uuidSchema } from "@/lib/validation/common";

export const metricsQuerySchema = z.object({
  sessionId: uuidSchema.optional(),
  cycleId: uuidSchema.optional(),
  locationId: uuidSchema.optional(),
  locale: localeQuerySchema.optional()
});

export type MetricsQuery = z.infer<typeof metricsQuerySchema>;
