import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { ERROR_CODES } from "@/lib/errors/codes";

export class OperationalResetServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "OperationalResetServiceError";
  }
}

export type OperationalResetCounts = {
  appSessions: number;
  activities: number;
  cycles: number;
  sessions: number;
  sessionBuildings: number;
  assignments: number;
  waitingList: number;
  attendance: number;
  evaluations: number;
  blocks: number;
  governorates: number;
  universities: number;
  buildings: number;
  floors: number;
  rooms: number;
  users: number;
  notificationPreferences: number;
  inAppNotifications: number;
};

async function collectOperationalResetCounts(
  client: Prisma.TransactionClient = db
): Promise<OperationalResetCounts> {
  const [
    appSessions,
    activities,
    cycles,
    sessions,
    sessionBuildings,
    assignments,
    waitingList,
    attendance,
    evaluations,
    blocks,
    governorates,
    universities,
    buildings,
    floors,
    rooms,
    users,
    notificationPreferences,
    inAppNotifications
  ] = await Promise.all([
    client.appSession.count(),
    client.activityLog.count(),
    client.cycle.count(),
    client.session.count(),
    client.sessionBuilding.count(),
    client.assignment.count(),
    client.waitingList.count(),
    client.attendance.count(),
    client.evaluation.count(),
    client.block.count(),
    client.governorate.count(),
    client.university.count(),
    client.building.count(),
    client.floor.count(),
    client.room.count(),
    client.user.count(),
    client.notificationPreference.count(),
    client.inAppNotification.count()
  ]);

  return {
    appSessions,
    activities,
    cycles,
    sessions,
    sessionBuildings,
    assignments,
    waitingList,
    attendance,
    evaluations,
    blocks,
    governorates,
    universities,
    buildings,
    floors,
    rooms,
    users,
    notificationPreferences,
    inAppNotifications
  };
}

export async function getOperationalResetPreview() {
  return collectOperationalResetCounts();
}

export async function resetOperationalData() {
  try {
    return await db.$transaction(
      async (tx) => {
        const before = await collectOperationalResetCounts(tx);

        await tx.appUser.updateMany({
          where: {
            linkedUserId: {
              not: null
            }
          },
          data: {
            linkedUserId: null
          }
        });

        await tx.appSession.deleteMany();
        await tx.inAppNotification.deleteMany();
        await tx.notificationPreference.deleteMany();
        await tx.block.deleteMany();
        await tx.attendance.deleteMany();
        await tx.evaluation.deleteMany();
        await tx.assignment.deleteMany();
        await tx.waitingList.deleteMany();
        await tx.sessionBuilding.deleteMany();
        await tx.session.deleteMany();
        await tx.cycle.deleteMany();
        await tx.room.deleteMany();
        await tx.floor.deleteMany();
        await tx.building.deleteMany();
        await tx.university.deleteMany();
        await tx.governorate.deleteMany();
        await tx.user.deleteMany();
        await tx.activityLog.deleteMany();

        const after = await collectOperationalResetCounts(tx);

        return {
          ok: true as const,
          before,
          after
        };
      },
      {
        maxWait: 10000,
        timeout: 120000,
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
      }
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError ||
      error instanceof Prisma.PrismaClientUnknownRequestError ||
      error instanceof Prisma.PrismaClientRustPanicError
    ) {
      throw new OperationalResetServiceError(
        ERROR_CODES.internalServerError,
        500,
        "Could not reset operational data."
      );
    }

    throw error;
  }
}
