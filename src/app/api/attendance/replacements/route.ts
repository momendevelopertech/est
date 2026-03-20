import { NextResponse } from "next/server";

import {
  getRequestQuery,
  handleAttendanceRouteError,
  requireAttendanceApiRole
} from "@/lib/attendance/http";
import { getAttendanceReplacementSuggestions } from "@/lib/attendance/service";
import { attendanceReplacementQuerySchema } from "@/lib/attendance/validation";
import { serializeForApi } from "@/lib/dto/serialize";

export async function GET(request: Request) {
  const auth = await requireAttendanceApiRole();

  if ("response" in auth) {
    return auth.response;
  }

  try {
    const query = attendanceReplacementQuerySchema.parse(getRequestQuery(request));
    const data = await getAttendanceReplacementSuggestions(query);

    return NextResponse.json({
      ok: true,
      data: serializeForApi(data)
    });
  } catch (error) {
    return handleAttendanceRouteError(error);
  }
}
