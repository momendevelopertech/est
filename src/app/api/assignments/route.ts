import { NextResponse } from "next/server";

import { toAssignmentDTO } from "@/lib/assignments/dto";
import {
  getRequestQuery,
  handleAssignmentRouteError,
  readJsonBody,
  requireAssignmentsApiRole
} from "@/lib/assignments/http";
import {
  createAssignment,
  getAssignments
} from "@/lib/assignments/service";
import {
  assignmentListQuerySchema,
  createAssignmentSchema
} from "@/lib/assignments/validation";

export async function GET(request: Request) {
  const auth = await requireAssignmentsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const query = assignmentListQuerySchema.parse(getRequestQuery(request));
    const result = await getAssignments(query);

    return NextResponse.json({
      ok: true,
      data: result.data.map((assignment) => toAssignmentDTO(assignment)),
      pagination: result.pagination
    });
  } catch (error) {
    return handleAssignmentRouteError(error);
  }
}

export async function POST(request: Request) {
  const auth = await requireAssignmentsApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const body = await readJsonBody(request);
    const input = createAssignmentSchema.parse(body);
    const data = await createAssignment(input, auth.session.user.id);

    return NextResponse.json(
      {
        ok: true,
        data: toAssignmentDTO(data)
      },
      {
        status: 201
      }
    );
  } catch (error) {
    return handleAssignmentRouteError(error);
  }
}
