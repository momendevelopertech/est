import { metricsQuerySchema } from "@/lib/metrics/validation";
import { z } from "zod";

export const reportQuerySchema = metricsQuerySchema;

export type ReportQuery = z.infer<typeof reportQuerySchema>;
