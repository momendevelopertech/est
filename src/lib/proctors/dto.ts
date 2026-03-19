import { serializeForApi } from "@/lib/dto/serialize";

export function toProctorDTO<T>(proctor: T) {
  return serializeForApi(proctor);
}

export function toProctorProfileDTO<T>(profile: T) {
  return serializeForApi(profile);
}
