import { serializeForApi } from "@/lib/dto/serialize";

export function toCycleDTO<T>(cycle: T) {
  return serializeForApi(cycle);
}
