import { NextResponse } from "next/server";

import { toEvaluationDTO } from "@/lib/evaluations/dto";
import {
  getRequestQuery,
  handleEvaluationRouteError,
  readJsonBody,
  requireEvaluationsApiRole
} from "@/lib/evaluations/http";
import {
  createEvaluation,
  getEvaluations
} from "@/lib/evaluations/service";
import {
  createEvaluationSchema,
  evaluationListQuerySchema
} from "@/lib/evaluations/validation";

export async function GET(request: Request) {
  const auth = await requireEvaluationsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const query = evaluationListQuerySchema.parse(getRequestQuery(request));
    const result = await getEvaluations(query);

    return NextResponse.json({
      ok: true,
      data: result.data.map((evaluation) => toEvaluationDTO(evaluation)),
      pagination: result.pagination
    });
  } catch (error) {
    return handleEvaluationRouteError(error);
  }
}

export async function POST(request: Request) {
  const auth = await requireEvaluationsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const body = await readJsonBody(request);
    const input = createEvaluationSchema.parse(body);
    const result = await createEvaluation(input, auth.session.user.id);

    return NextResponse.json(
      {
        ok: true,
        mode: result.mode,
        data: toEvaluationDTO(result.data)
      },
      {
        status: result.mode === "created" ? 201 : 200
      }
    );
  } catch (error) {
    return handleEvaluationRouteError(error);
  }
}
