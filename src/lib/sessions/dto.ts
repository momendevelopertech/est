import { SessionStatus } from "@prisma/client";

import { serializeForApi } from "@/lib/dto/serialize";
import { getDerivedSessionStatus } from "@/lib/sessions/status";

type SessionBuildingLink = {
  building?: unknown;
  buildingId: string;
  id: string;
  isActive: boolean;
  notes?: string | null;
};

type SessionLike = {
  buildings?: SessionBuildingLink[];
  endsAt?: Date | null;
  sessionDate?: Date | null;
  startsAt?: Date | null;
  status: SessionStatus;
} & Record<string, unknown>;

export function toSessionDTO<T extends SessionLike>(session: T) {
  const activeBuildings =
    session.buildings?.filter((buildingLink) => buildingLink.isActive) ?? [];
  const rest = {
    ...session
  };

  delete rest.startsAt;
  delete rest.endsAt;
  delete rest.buildings;

  return serializeForApi({
    ...rest,
    sessionDate: session.sessionDate,
    derivedStatus: getDerivedSessionStatus(session),
    startDateTime: session.startsAt ?? null,
    endDateTime: session.endsAt ?? null,
    buildingIds: activeBuildings.map((buildingLink) => buildingLink.buildingId),
    buildings: activeBuildings
  });
}
