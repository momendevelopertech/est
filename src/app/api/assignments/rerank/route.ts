import { NextResponse } from "next/server";

import {
  handleAssignmentRouteError,
  readJsonBody,
  requireAssignmentsApiRole
} from "@/lib/assignments/http";
import { rerankSessionAssignmentsForLateImport } from "@/lib/assignments/service";
import { lateImportRerankAssignmentsSchema } from "@/lib/assignments/validation";

export async function POST(request: Request) {
  const auth = await requireAssignmentsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const body = await readJsonBody(request);
    const input = lateImportRerankAssignmentsSchema.parse(body);
    const result = await rerankSessionAssignmentsForLateImport(
      input,
      auth.session.user.id
    );

    return NextResponse.json({
      ok: true,
      data: result
    });
  } catch (error) {
    return handleAssignmentRouteError(error);
  }
}
