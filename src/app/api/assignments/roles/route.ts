import { NextResponse } from "next/server";

import {
  handleAssignmentRouteError,
  requireAssignmentsApiRole
} from "@/lib/assignments/http";
import { listActiveAssignmentRoleDefinitions } from "@/lib/assignments/service";
import { serializeForApi } from "@/lib/dto/serialize";

export async function GET() {
  const auth = await requireAssignmentsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const data = await listActiveAssignmentRoleDefinitions();

    return NextResponse.json({
      ok: true,
      data: serializeForApi(data)
    });
  } catch (error) {
    return handleAssignmentRouteError(error);
  }
}
