import {
  LocaleCode,
  Prisma,
  ProctorOperationalRole,
  UserSource,
  type PrismaClient
} from "@prisma/client";

import { logActivity } from "@/lib/activity/log";
import { db } from "@/lib/db";
import { ERROR_CODES } from "@/lib/errors/codes";
import { buildPaginationMeta, resolvePagination } from "@/lib/pagination";
import { createBilingualSearchFilter } from "@/lib/search/bilingual";
import { normalizePhone, validatePhone } from "@/lib/utils/phone";

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
  operationalRole: true,
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
  return createBilingualSearchFilter(search, [
    "phone",
    "email",
    "nationalId",
    "organization",
    "branch"
  ]);
}

function createActiveFilter(includeInactive: boolean) {
  return includeInactive ? {} : { isActive: true };
}

export function normalizeEmail(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

export function normalizeOptionalText(value?: string | null) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function isKnownPrismaError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

function getDuplicateErrorCode(error: Prisma.PrismaClientKnownRequestError) {
  const targets = Array.isArray(error.meta?.target)
    ? error.meta.target.map((value) => String(value))
    : typeof error.meta?.target === "string"
      ? [error.meta.target]
      : [];

  if (targets.some((target) => target.includes("phone"))) {
    return ERROR_CODES.duplicatePhone;
  }

  if (targets.some((target) => target.includes("email"))) {
    return ERROR_CODES.duplicateEmail;
  }

  if (targets.some((target) => target.includes("national"))) {
    return ERROR_CODES.duplicateNationalId;
  }

  return ERROR_CODES.duplicateProctor;
}

function normalizeMutationError(error: unknown): never {
  if (isKnownPrismaError(error) && error.code === "P2025") {
    throw new ProctorsServiceError(
      ERROR_CODES.proctorNotFound,
      404,
      "Proctor not found."
    );
  }

  if (isKnownPrismaError(error) && error.code === "P2002") {
    const duplicateCode = getDuplicateErrorCode(error);
    throw new ProctorsServiceError(
      duplicateCode,
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
    throw new ProctorsServiceError(
      ERROR_CODES.governorateNotFound,
      404,
      "Governorate not found."
    );
  }

  if (options.requireActive && !governorate.isActive) {
    throw new ProctorsServiceError(
      ERROR_CODES.inactiveParent,
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
    throw new ProctorsServiceError(
      ERROR_CODES.proctorNotFound,
      404,
      "Proctor not found."
    );
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
      primaryConflict.field === "phone"
        ? ERROR_CODES.duplicatePhone
        : primaryConflict.field === "email"
          ? ERROR_CODES.duplicateEmail
          : ERROR_CODES.duplicateNationalId,
      409,
      `A proctor with the same ${primaryConflict.field} already exists.`,
      conflicts
    );
  }
}

function assertValidNormalizedPhone(phone: string) {
  if (!validatePhone(phone)) {
    throw new ProctorsServiceError(
      ERROR_CODES.invalidPhone,
      400,
      "Phone number is invalid."
    );
  }

  return phone;
}

function normalizeUpdateInput(input: UpdateProctorInput) {
  return {
    ...input,
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.nameEn !== undefined
      ? { nameEn: normalizeOptionalText(input.nameEn) }
      : {}),
    ...(input.phone
      ? {
          phone: assertValidNormalizedPhone(normalizePhone(input.phone))
        }
      : {}),
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
    nameEn: normalizeOptionalText(input.nameEn),
    phone: assertValidNormalizedPhone(normalizePhone(input.phone)),
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
    nameEn: input.nameEn ?? null,
    phone: input.phone,
    nationalId: input.nationalId,
    email: input.email,
    source: input.source,
    operationalRole:
      input.operationalRole === null
        ? null
        : (input.operationalRole as ProctorOperationalRole | undefined) ?? null,
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
    ...(input.operationalRole !== undefined
      ? {
          operationalRole:
            input.operationalRole === null
              ? null
              : (input.operationalRole as ProctorOperationalRole | undefined) ?? null
        }
      : {}),
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

function assertSourceOrganizationConsistency(input: {
  source: UserSource;
  organization?: string | null;
}) {
  if (
    input.source === UserSource.UNIVERSITY &&
    !normalizeOptionalText(input.organization ?? undefined)
  ) {
    throw new ProctorsServiceError(
      ERROR_CODES.missingRequiredField,
      400,
      "University source requires a university name or organization.",
      {
        field: "organization",
        source: input.source
      }
    );
  }
}

export async function listProctors(query: ProctorListQuery) {
  if (query.governorateId) {
    await assertGovernorateExists(query.governorateId);
  }

  const pagination = resolvePagination(query);
  const where = {
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
    ...(query.operationalRole
      ? {
          operationalRole: query.operationalRole
        }
      : {}),
    ...(query.blockStatus
      ? {
          blockStatus: query.blockStatus
        }
      : {}),
    ...createActiveFilter(query.includeInactive),
    ...createSearchFilter(query.search)
  } satisfies Prisma.UserWhereInput;

  const [data, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: [{ name: "asc" }],
      ...(pagination
        ? {
            skip: pagination.skip,
            take: pagination.take
          }
        : {}),
      select: proctorSelect
    }),
    db.user.count({
      where
    })
  ]);

  return {
    data,
    pagination: buildPaginationMeta(total, pagination)
  };
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

  assertSourceOrganizationConsistency({
    source: normalizedInput.source,
    organization: normalizedInput.organization
  });

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

      await logActivity({
        client: tx,
        userId: actorAppUserId,
        action: "create",
        entityType: "proctor",
        entityId: created.id,
        description: `Created proctor ${created.name}.`,
        metadata: {
          source: created.source,
          governorateId: created.governorateId,
          phone: created.phone,
          email: created.email
        },
        afterPayload: created
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
  const source = normalizedInput.source ?? before.source;
  const organization =
    normalizedInput.organization === undefined
      ? before.organization
      : normalizedInput.organization;

  assertSourceOrganizationConsistency({
    source,
    organization
  });

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

      await logActivity({
        client: tx,
        userId: actorAppUserId,
        action: "update",
        entityType: "proctor",
        entityId: updated.id,
        description: `Updated proctor ${updated.name}.`,
        metadata: {
          changedFields: Object.keys(normalizedInput)
        },
        beforePayload: before,
        afterPayload: updated
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

      await logActivity({
        client: tx,
        userId: actorAppUserId,
        action: "delete",
        entityType: "proctor",
        entityId: updated.id,
        description: `Deactivated proctor ${updated.name}.`,
        metadata: {
          softDeleted: true,
          source: updated.source
        },
        beforePayload: before,
        afterPayload: updated
      });

      return updated;
    });
  } catch (error) {
    normalizeMutationError(error);
  }
}
