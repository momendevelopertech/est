import { NextResponse } from "next/server";

import {
  getRequestQuery,
  handleAttendanceRouteError,
  readJsonBody,
  requireAttendanceApiRole
} from "@/lib/attendance/http";
import {
  getAttendanceAssignments,
  updateAttendance
} from "@/lib/attendance/service";
import { toAssignmentDTO } from "@/lib/assignments/dto";
import {
  attendanceListQuerySchema,
  updateAttendanceSchema
} from "@/lib/attendance/validation";

export async function GET(request: Request) {
  const auth = await requireAttendanceApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const query = attendanceListQuerySchema.parse(getRequestQuery(request));
    const result = await getAttendanceAssignments(query);

    return NextResponse.json({
      ok: true,
      data: result.data.map((record) => toAssignmentDTO(record)),
      attendance: result.attendance,
      pagination: result.pagination
    });
  } catch (error) {
    return handleAttendanceRouteError(error);
  }
}

export async function POST(request: Request) {
  const auth = await requireAttendanceApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const body = await readJsonBody(request);
    const input = updateAttendanceSchema.parse(body);
    const result = await updateAttendance(input, auth.session.user.id);

    return NextResponse.json({
      ok: true,
      data: {
        assignment: toAssignmentDTO(result.assignment),
        attendance: result.attendance,
        replacement: result.replacement
      }
    });
  } catch (error) {
    return handleAttendanceRouteError(error);
  }
}
