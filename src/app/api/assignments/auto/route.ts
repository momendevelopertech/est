import { NextResponse } from "next/server";

import {
  handleAssignmentRouteError,
  readJsonBody,
  requireAssignmentsApiRole
} from "@/lib/assignments/http";
import { autoAssignSessionAssignments } from "@/lib/assignments/service";
import { autoAssignAssignmentsSchema } from "@/lib/assignments/validation";

export async function POST(request: Request) {
  const auth = await requireAssignmentsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const body = await readJsonBody(request);
    const input = autoAssignAssignmentsSchema.parse(body);
    const result = await autoAssignSessionAssignments(
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
