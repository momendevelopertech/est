import { NextResponse } from "next/server";

import { toAssignmentDTO } from "@/lib/assignments/dto";
import { handleAssignmentRouteError, requireAssignmentsApiRole } from "@/lib/assignments/http";
import {
  cancelAssignment,
  getAssignmentById
} from "@/lib/assignments/service";
import { assignmentRouteParamsSchema } from "@/lib/assignments/validation";

type RouteParams = {
  params: {
    assignmentId: string;
  };
};

export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireAssignmentsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const routeParams = assignmentRouteParamsSchema.parse(params);
    const data = await getAssignmentById(routeParams.assignmentId);

    return NextResponse.json({
      ok: true,
      data: toAssignmentDTO(data)
    });
  } catch (error) {
    return handleAssignmentRouteError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const auth = await requireAssignmentsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const routeParams = assignmentRouteParamsSchema.parse(params);
    const data = await cancelAssignment(routeParams.assignmentId, auth.session.user.id);

    return NextResponse.json({
      ok: true,
      data: toAssignmentDTO(data)
    });
  } catch (error) {
    return handleAssignmentRouteError(error);
  }
}
