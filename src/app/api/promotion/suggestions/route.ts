import { NextResponse } from "next/server";

import {
  getRequestQuery,
  handlePromotionRouteError,
  requirePromotionApiRole
} from "@/lib/promotion/http";
import { getPromotionSuggestions } from "@/lib/promotion/service";
import { promotionSuggestionsQuerySchema } from "@/lib/promotion/validation";
import { serializeForApi } from "@/lib/dto/serialize";

export async function GET(request: Request) {
  const auth = await requirePromotionApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const query = promotionSuggestionsQuerySchema.parse(getRequestQuery(request));
    const result = await getPromotionSuggestions(query);

    return NextResponse.json({
      ok: true,
      data: serializeForApi(result)
    });
  } catch (error) {
    return handlePromotionRouteError(error);
  }
}
