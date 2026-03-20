import { serializeForApi } from "@/lib/dto/serialize";

type BlockLike = Record<string, unknown>;

export function toBlockDTO<T extends BlockLike>(value: T) {
  return serializeForApi(value);
}
