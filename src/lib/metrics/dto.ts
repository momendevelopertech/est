import { serializeForApi } from "@/lib/dto/serialize";

import type {
  AssignmentsMetricsContract,
  AttendanceMetricsContract,
  SessionsMetricsContract
} from "./contracts";

export function toSessionsMetricsDTO(value: SessionsMetricsContract) {
  return serializeForApi(value);
}

export function toAssignmentsMetricsDTO(value: AssignmentsMetricsContract) {
  return serializeForApi(value);
}

export function toAttendanceMetricsDTO(value: AttendanceMetricsContract) {
  return serializeForApi(value);
}
