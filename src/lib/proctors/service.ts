import { LocaleCode, Prisma, UserSource, type PrismaClient } from "@prisma/client";

import { db } from "@/lib/db";

import type {
  CreateProctorInput,
  ProctorListQuery,
  UpdateProctorInput
} from "./validation";

export type IncludeInactiveOptions = {
  includeInactive?: boolean;
};

type DuplicateField = "phone" | "email" | "nationalId";

type DuplicateConflict = {
  field: DuplicateField;
  value: string;
  conflictingRecordId: string;
};

export class ProctorsServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ProctorsServiceError";
  }
}

export const proctorSelect = {
  id: true,
  name: true,
  nameEn: true,
  phone: true,
  nationalId: true,
  email: true,
  source: true,
  organization: true,
  branch: true,
  governorateId: true,
  averageRating: true,
  totalSessions: true,
  blockStatus: true,
  blockEndsAt: true,
  preferredLanguage: true,
  isActive: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  governorate: {
    select: {
      id: true,
      name: true,
      nameEn: true,
      code: true
    }
  },
  _count: {
    select: {
      assignments: true,
      waitingListEntries: true,
      evaluationsReceived: true,
      blocks: true
    }
  }
} satisfies Prisma.UserSelect;

function createSearchFilter(search?: string) {
  if (!search) {
    return undefined;
  }

  return {
    OR: [
      {
        name: {
          contains: search,
          mode: "insensitive" as const
        }
      },
      {
        nameEn: {
          contains: search,
          mode: "insensitive" as const
        }
      },
      {
        phone: {
          contains: search,
          mode: "insensitive" as const
        }
      },
      {
        email: {
          contains: search,
          mode: "insensitive" as const
        }
      },
      {
        nationalId: {
          contains: search,
          mode: "insensitive" as const
        }
      },
      {
        organization: {
          contains: search,
          mode: "insensitive" as const
        }
      },
      {
        branch: {
          contains: search,
          mode: "insensitive" as const
        }
      }
    ]
  };
}

function createActiveFilter(includeInactive: boolean) {
  return includeInactive ? {} : { isActive: true };
}

export function normalizeEmail(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

export function normalizePhone(value: string) {
  return value.replace(/[\s\-()]+/g, "").trim();
}

export function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function toRecordJson(value: unknown) {
  return value as Prisma.InputJsonValue;
}

export function createActivityLogEntry(params: {
  actorAppUserId: string;
  action: "create" | "update" | "delete";
  entityId: string;
  description: string;
  metadata?: Record<string, unknown>;
  beforePayload?: unknown;
  afterPayload?: unknown;
}) {
  return {
    actorAppUserId: params.actorAppUserId,
    action: params.action,
    entityType: "proctor",
    entityId: params.entityId,
    description: params.description,
    metadata: toRecordJson({
      userId: params.actorAppUserId,
      entityType: "proctor",
      entityId: params.entityId,
      action: params.action,
      ...(params.metadata ?? {})
    }),
    beforePayload:
      params.beforePayload === undefined ? undefined : toRecordJson(params.beforePayload),
    afterPayload:
      params.afterPayload === undefined ? undefined : toRecordJson(params.afterPayload)
  } satisfies Prisma.ActivityLogUncheckedCreateInput;
}

function isKnownPrismaError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

function normalizeMutationError(error: unknown): never {
  if (isKnownPrismaError(error) && error.code === "P2025") {
    throw new ProctorsServiceError("proctor_not_found", 404, "Proctor not found.");
  }

  if (isKnownPrismaError(error) && error.code === "P2002") {
    throw new ProctorsServiceError(
      "duplicate_proctor",
      409,
      "The requested proctor change conflicts with an existing record.",
      error.meta ?? null
    );
  }

  throw error;
}

export async function assertGovernorateExists(
  governorateId: string,
  options: { requireActive?: boolean } = {}
) {
  const governorate = await db.governorate.findUnique({
    where: {
      id: governorateId
    },
    select: {
      id: true,
      name: true,
      nameEn: true,
      isActive: true
    }
  });

  if (!governorate) {
    throw new ProctorsServiceError("governorate_not_found", 404, "Governorate not found.");
  }

  if (options.requireActive && !governorate.isActive) {
    throw new ProctorsServiceError(
      "inactive_parent",
      409,
      "Cannot link a proctor to an inactive governorate."
    );
  }

  return governorate;
}

async function assertProctorExists(
  proctorId: string,
  options: IncludeInactiveOptions = {}
) {
  const proctor = await db.user.findUnique({
    where: {
      id: proctorId
    },
    select: proctorSelect
  });

  if (!proctor || (!options.includeInactive && !proctor.isActive)) {
    throw new ProctorsServiceError("proctor_not_found", 404, "Proctor not found.");
  }

  return proctor;
}

async function findDuplicateConflicts(
  tx: Prisma.TransactionClient | PrismaClient,
  input: {
    phone: string;
    email?: string;
    nationalId?: string;
    excludeId?: string;
  }
) {
  const candidates = await tx.user.findMany({
    where: {
      ...(input.excludeId
        ? {
            id: {
              not: input.excludeId
            }
          }
        : {}),
      OR: [
        {
          phone: {
            equals: input.phone,
            mode: "insensitive"
          }
        },
        ...(input.email
          ? [
              {
                email: {
                  equals: input.email,
                  mode: "insensitive" as const
                }
              }
            ]
          : []),
        ...(input.nationalId
          ? [
              {
                nationalId: {
                  equals: input.nationalId,
                  mode: "insensitive" as const
                }
              }
            ]
          : [])
      ]
    },
    select: {
      id: true,
      phone: true,
      email: true,
      nationalId: true
    }
  });

  const conflicts: DuplicateConflict[] = [];

  for (const candidate of candidates) {
    if (candidate.phone.trim().toLowerCase() === input.phone.toLowerCase()) {
      conflicts.push({
        field: "phone",
        value: input.phone,
        conflictingRecordId: candidate.id
      });
    }

    if (
      input.email &&
      candidate.email &&
      candidate.email.trim().toLowerCase() === input.email.toLowerCase()
    ) {
      conflicts.push({
        field: "email",
        value: input.email,
        conflictingRecordId: candidate.id
      });
    }

    if (
      input.nationalId &&
      candidate.nationalId &&
      candidate.nationalId.trim().toLowerCase() === input.nationalId.toLowerCase()
    ) {
      conflicts.push({
        field: "nationalId",
        value: input.nationalId,
        conflictingRecordId: candidate.id
      });
    }
  }

  if (conflicts.length > 0) {
    const primaryConflict = conflicts[0];
    throw new ProctorsServiceError(
      `duplicate_${primaryConflict.field}`,
      409,
      `A proctor with the same ${primaryConflict.field} already exists.`,
      conflicts
    );
  }
}

function normalizeUpdateInput(input: UpdateProctorInput) {
  return {
    ...input,
    ...(input.phone ? { phone: normalizePhone(input.phone) } : {}),
    ...(input.email !== undefined ? { email: normalizeEmail(input.email) } : {}),
    ...(input.nationalId !== undefined
      ? { nationalId: normalizeOptionalText(input.nationalId) }
      : {}),
    ...(input.organization !== undefined
      ? { organization: normalizeOptionalText(input.organization) }
      : {}),
    ...(input.branch !== undefined ? { branch: normalizeOptionalText(input.branch) } : {}),
    ...(input.notes !== undefined ? { notes: normalizeOptionalText(input.notes) } : {})
  };
}

function normalizeCreateInput(input: CreateProctorInput) {
  return {
    ...input,
    name: input.name.trim(),
    phone: normalizePhone(input.phone),
    email: normalizeEmail(input.email),
    nationalId: normalizeOptionalText(input.nationalId),
    organization: normalizeOptionalText(input.organization),
    branch: normalizeOptionalText(input.branch),
    notes: normalizeOptionalText(input.notes)
  };
}

function buildCreateProctorData(input: ReturnType<typeof normalizeCreateInput>) {
  return {
    name: input.name,
    nameEn: input.nameEn,
    phone: input.phone,
    nationalId: input.nationalId,
    email: input.email,
    source: input.source,
    organization: input.organization,
    branch: input.branch,
    governorateId: input.governorateId ?? null,
    preferredLanguage:
      input.preferredLanguage === undefined
        ? null
        : input.preferredLanguage === null
          ? null
          : (input.preferredLanguage as LocaleCode),
    isActive: input.isActive ?? true,
    notes: input.notes
  } satisfies Prisma.UserUncheckedCreateInput;
}

function buildUpdateProctorData(input: ReturnType<typeof normalizeUpdateInput>) {
  return {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.nameEn !== undefined ? { nameEn: input.nameEn } : {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
    ...(input.nationalId !== undefined ? { nationalId: input.nationalId ?? null } : {}),
    ...(input.email !== undefined ? { email: input.email ?? null } : {}),
    ...(input.source !== undefined ? { source: input.source as UserSource } : {}),
    ...(input.organization !== undefined
      ? { organization: input.organization ?? null }
      : {}),
    ...(input.branch !== undefined ? { branch: input.branch ?? null } : {}),
    ...(input.governorateId !== undefined
      ? { governorateId: input.governorateId ?? null }
      : {}),
    ...(input.preferredLanguage !== undefined
      ? {
          preferredLanguage:
            input.preferredLanguage === null
              ? null
              : (input.preferredLanguage as LocaleCode)
        }
      : {}),
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    ...(input.notes !== undefined ? { notes: input.notes ?? null } : {})
  } satisfies Prisma.UserUncheckedUpdateInput;
}

export async function listProctors(query: ProctorListQuery) {
  if (query.governorateId) {
    await assertGovernorateExists(query.governorateId);
  }

  return db.user.findMany({
    where: {
      ...(query.governorateId
        ? {
            governorateId: query.governorateId
          }
        : {}),
      ...(query.source
        ? {
            source: query.source
          }
        : {}),
      ...(query.blockStatus
        ? {
            blockStatus: query.blockStatus
          }
        : {}),
      ...createActiveFilter(query.includeInactive),
      ...createSearchFilter(query.search)
    },
    orderBy: [{ name: "asc" }],
    select: proctorSelect
  });
}

export async function getProctor(
  proctorId: string,
  options: IncludeInactiveOptions = {}
) {
  return assertProctorExists(proctorId, options);
}

export async function getProctorProfile(
  proctorId: string,
  options: IncludeInactiveOptions = {}
) {
  const proctor = await assertProctorExists(proctorId, options);

  const [assignments, evaluations, blocks, sessionIds, averageScore] =
    await Promise.all([
      db.assignment.findMany({
        where: {
          userId: proctorId
        },
        orderBy: [{ assignedAt: "desc" }],
        select: {
          id: true,
          status: true,
          assignedMethod: true,
          isManualOverride: true,
          overrideNote: true,
          assignedAt: true,
          createdAt: true,
          updatedAt: true,
          session: {
            select: {
              id: true,
              name: true,
              nameEn: true,
              examType: true,
              sessionDate: true,
              status: true
            }
          },
          building: {
            select: {
              id: true,
              name: true,
              nameEn: true
            }
          },
          floor: {
            select: {
              id: true,
              name: true,
              nameEn: true
            }
          },
          room: {
            select: {
              id: true,
              name: true,
              nameEn: true
            }
          },
          roleDefinition: {
            select: {
              id: true,
              key: true,
              name: true,
              nameEn: true
            }
          },
          attendance: {
            select: {
              id: true,
              status: true,
              checkedInAt: true,
              notes: true,
              createdAt: true,
              updatedAt: true,
              updatedByAppUser: {
                select: {
                  id: true,
                  displayName: true
                }
              }
            }
          }
        }
      }),
      db.evaluation.findMany({
        where: {
          subjectUserId: proctorId
        },
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          score: true,
          notes: true,
          criteriaPayload: true,
          createdAt: true,
          updatedAt: true,
          session: {
            select: {
              id: true,
              name: true,
              nameEn: true,
              examType: true,
              sessionDate: true,
              status: true
            }
          },
          evaluatorAppUser: {
            select: {
              id: true,
              displayName: true,
              role: true
            }
          }
        }
      }),
      db.block.findMany({
        where: {
          userId: proctorId
        },
        orderBy: [{ startsAt: "desc" }],
        select: {
          id: true,
          type: true,
          status: true,
          source: true,
          startsAt: true,
          endsAt: true,
          reason: true,
          notes: true,
          liftReason: true,
          liftedAt: true,
          createdAt: true,
          updatedAt: true,
          createdByAppUser: {
            select: {
              id: true,
              displayName: true
            }
          },
          liftedByAppUser: {
            select: {
              id: true,
              displayName: true
            }
          }
        }
      }),
      db.assignment.findMany({
        where: {
          userId: proctorId
        },
        distinct: ["sessionId"],
        select: {
          sessionId: true
        }
      }),
      db.evaluation.aggregate({
        where: {
          subjectUserId: proctorId
        },
        _avg: {
          score: true
        }
      })
    ]);

  const attendance = assignments
    .filter((assignment) => assignment.attendance)
    .map((assignment) => ({
      assignmentId: assignment.id,
      session: assignment.session,
      attendance: assignment.attendance
    }));

  return {
    ...proctor,
    summary: {
      totalSessions: sessionIds.length,
      averageRating: averageScore._avg.score?.toString() ?? "0.00",
      assignments: assignments.length,
      attendance: attendance.length,
      evaluations: evaluations.length,
      blocks: blocks.length
    },
    history: {
      assignments,
      attendance,
      evaluations,
      blocks
    }
  };
}

export async function createProctor(input: CreateProctorInput, actorAppUserId: string) {
  const normalizedInput = normalizeCreateInput(input);

  if (normalizedInput.governorateId) {
    await assertGovernorateExists(normalizedInput.governorateId, {
      requireActive: true
    });
  }

  await findDuplicateConflicts(db, {
    phone: normalizedInput.phone,
    email: normalizedInput.email,
    nationalId: normalizedInput.nationalId
  });

  try {
    return await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: buildCreateProctorData(normalizedInput),
        select: proctorSelect
      });

      await tx.activityLog.create({
        data: createActivityLogEntry({
          actorAppUserId,
          action: "create",
          entityId: created.id,
          description: `Created proctor ${created.name}.`,
          metadata: {
            source: created.source,
            governorateId: created.governorateId,
            phone: created.phone,
            email: created.email
          },
          afterPayload: created
        })
      });

      return created;
    });
  } catch (error) {
    normalizeMutationError(error);
  }
}

export async function updateProctor(
  proctorId: string,
  input: UpdateProctorInput,
  actorAppUserId: string
) {
  const before = await getProctor(proctorId, {
    includeInactive: true
  });
  const normalizedInput = normalizeUpdateInput(input);
  const governorateId =
    normalizedInput.governorateId === undefined
      ? before.governorateId
      : normalizedInput.governorateId;

  if (governorateId) {
    await assertGovernorateExists(governorateId, {
      requireActive: true
    });
  }

  if (normalizedInput.isActive === true && !before.isActive && governorateId) {
    await assertGovernorateExists(governorateId, {
      requireActive: true
    });
  }

  await findDuplicateConflicts(db, {
    phone: normalizedInput.phone ?? before.phone,
    email: normalizedInput.email ?? normalizeEmail(before.email),
    nationalId: normalizedInput.nationalId ?? normalizeOptionalText(before.nationalId),
    excludeId: proctorId
  });

  try {
    return await db.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: {
          id: proctorId
        },
        data: buildUpdateProctorData(normalizedInput),
        select: proctorSelect
      });

      await tx.activityLog.create({
        data: createActivityLogEntry({
          actorAppUserId,
          action: "update",
          entityId: updated.id,
          description: `Updated proctor ${updated.name}.`,
          metadata: {
            changedFields: Object.keys(normalizedInput)
          },
          beforePayload: before,
          afterPayload: updated
        })
      });

      return updated;
    });
  } catch (error) {
    normalizeMutationError(error);
  }
}

export async function deactivateProctor(proctorId: string, actorAppUserId: string) {
  const before = await getProctor(proctorId, {
    includeInactive: true
  });

  try {
    return await db.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: {
          id: proctorId
        },
        data: {
          isActive: false
        },
        select: proctorSelect
      });

      await tx.activityLog.create({
        data: createActivityLogEntry({
          actorAppUserId,
          action: "delete",
          entityId: updated.id,
          description: `Deactivated proctor ${updated.name}.`,
          metadata: {
            softDeleted: true,
            source: updated.source
          },
          beforePayload: before,
          afterPayload: updated
        })
      });

      return updated;
    });
  } catch (error) {
    normalizeMutationError(error);
  }
}
