import { z } from "zod";

import { integerQueryParamSchema } from "@/lib/validation/common";

export const promotionSuggestionsQuerySchema = z.object({
  limit: integerQueryParamSchema({
    min: 1,
    max: 500
  })
});

export type PromotionSuggestionsQuery = z.infer<
  typeof promotionSuggestionsQuerySchema
>;
