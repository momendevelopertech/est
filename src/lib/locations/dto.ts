import { serializeForApi } from "@/lib/dto/serialize";

export function toLocationDTO<T>(location: T) {
  return serializeForApi(location);
}
