import assert from "node:assert/strict";

import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const baseUrl = process.env.EXAMOPS_BASE_URL ?? "http://127.0.0.1:4010";
const adminEmail = process.env.EXAMOPS_ADMIN_EMAIL ?? "admin@examops.local";
const adminPassword =
  process.env.EXAMOPS_ADMIN_PASSWORD ??
  process.env.SEED_APP_USERS_PASSWORD ??
  "ChangeMe123!";

function expect(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function extractCookie(setCookieHeader, cookieName) {
  if (!setCookieHeader) {
    return null;
  }

  const matcher = new RegExp(`${cookieName}=([^;]+)`);
  const match = setCookieHeader.match(matcher);

  return match?.[1] ?? null;
}

async function loginAndGetCookie() {
  const form = new FormData();
  form.set("email", adminEmail);
  form.set("password", adminPassword);
  form.set("locale", "en");
  form.set("redirectTo", "/dashboard");

  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    body: form,
    redirect: "manual"
  });

  const setCookie = response.headers.get("set-cookie");
  const token = extractCookie(setCookie, "examops_session");

  if (!token) {
    throw new Error("Could not authenticate admin user for block verification.");
  }

  return `examops_session=${token}`;
}

async function postJson(path, cookie, payload) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Cookie: cookie
    },
    body: JSON.stringify(payload)
  });

  const body = await response.json();

  return {
    status: response.status,
    body
  };
}

function addDays(baseDate, daysToAdd) {
  return new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
}

async function createSessionWithRetry(input) {
  const maxAttempts = 40;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const sessionDate = addDays(input.sessionDate, attempt);
    const startsAt = addDays(input.startsAt, attempt);
    const endsAt = addDays(input.endsAt, attempt);

    try {
      return await prisma.session.create({
        data: {
          cycleId: input.cycleId,
          name: `${input.name}_${attempt}`,
          nameEn: `${input.nameEn} ${attempt}`,
          examType: "EST1",
          sessionDate,
          startsAt,
          endsAt,
          status: "SCHEDULED",
          isActive: true
        },
        select: {
          id: true
        }
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new Error(`Could not create unique session for ${input.name}.`);
}

async function createFixture() {
  const createdUserIds = [];
  const createdSessionIds = [];
  const createdSessionBuildingIds = [];
  const createdBlockIds = [];
  const createdAssignmentIds = [];

  const cycleSeed = Date.now();
  const cycleStartDate = addDays(new Date(), -1);
  cycleStartDate.setHours(0, 0, 0, 0);
  const cycleEndDate = addDays(new Date(), 20);
  cycleEndDate.setHours(0, 0, 0, 0);

  const cycle = await prisma.cycle.create({
    data: {
      code: `BLOCK-${cycleSeed}`,
      name: `Block Verify ${cycleSeed}`,
      nameEn: `Block Verify ${cycleSeed}`,
      status: "ACTIVE",
      startDate: cycleStartDate,
      endDate: cycleEndDate,
      isActive: true
    },
    select: {
      id: true
    }
  });

  const building = await prisma.building.findFirst({
    where: {
      isActive: true
    },
    select: {
      id: true
    }
  });
  expect(building, "No active building available for block verification.");

  const roleDefinition = await prisma.assignmentRoleDefinition.findFirst({
    where: {
      key: "building_head",
      isActive: true
    },
    select: {
      id: true
    }
  });
  expect(roleDefinition, "building_head role definition is missing.");

  const now = new Date();
  const sessionDateBase = addDays(now, 2);
  sessionDateBase.setHours(0, 0, 0, 0);
  const sessionStartBase = addDays(now, 2);
  sessionStartBase.setHours(9, 0, 0, 0);
  const sessionEndBase = new Date(sessionStartBase.getTime() + 2 * 60 * 60 * 1000);

  const sessionPermanent = await createSessionWithRetry({
    cycleId: cycle.id,
    name: `BLOCK_PERM_${cycleSeed}`,
    nameEn: `Block Permanent ${cycleSeed}`,
    sessionDate: sessionDateBase,
    startsAt: sessionStartBase,
    endsAt: sessionEndBase
  });
  createdSessionIds.push(sessionPermanent.id);

  const sessionTemporary = await createSessionWithRetry({
    cycleId: cycle.id,
    name: `BLOCK_TEMP_${cycleSeed}`,
    nameEn: `Block Temporary ${cycleSeed}`,
    sessionDate: addDays(sessionDateBase, 1),
    startsAt: addDays(sessionStartBase, 1),
    endsAt: addDays(sessionEndBase, 1)
  });
  createdSessionIds.push(sessionTemporary.id);

  const sessionAuto = await createSessionWithRetry({
    cycleId: cycle.id,
    name: `BLOCK_AUTO_${cycleSeed}`,
    nameEn: `Block Auto ${cycleSeed}`,
    sessionDate: addDays(sessionDateBase, 2),
    startsAt: addDays(sessionStartBase, 2),
    endsAt: addDays(sessionEndBase, 2)
  });
  createdSessionIds.push(sessionAuto.id);

  for (const sessionId of createdSessionIds) {
    const link = await prisma.sessionBuilding.create({
      data: {
        sessionId,
        buildingId: building.id,
        isActive: true
      },
      select: {
        id: true
      }
    });
    createdSessionBuildingIds.push(link.id);
  }

  const userSeed = `${cycleSeed}`;
  const userPermanent = await prisma.user.create({
    data: {
      name: `Block Permanent User ${userSeed}`,
      nameEn: `Block Permanent User ${userSeed}`,
      phone: `20161${userSeed.slice(-6)}`,
      source: "EXTERNAL",
      averageRating: 4.2,
      totalSessions: 3,
      blockStatus: "CLEAR",
      blockEndsAt: null,
      isActive: true
    },
    select: {
      id: true
    }
  });
  createdUserIds.push(userPermanent.id);

  const userTemporary = await prisma.user.create({
    data: {
      name: `Block Temporary User ${userSeed}`,
      nameEn: `Block Temporary User ${userSeed}`,
      phone: `20162${userSeed.slice(-6)}`,
      source: "EXTERNAL",
      averageRating: 4.1,
      totalSessions: 2,
      blockStatus: "CLEAR",
      blockEndsAt: null,
      isActive: true
    },
    select: {
      id: true
    }
  });
  createdUserIds.push(userTemporary.id);

  const userAutoBlocked = await prisma.user.create({
    data: {
      name: `Block Auto User ${userSeed}`,
      nameEn: `Block Auto User ${userSeed}`,
      phone: `20163${userSeed.slice(-6)}`,
      source: "EXTERNAL",
      averageRating: 4.9,
      totalSessions: 1,
      blockStatus: "CLEAR",
      blockEndsAt: null,
      isActive: true
    },
    select: {
      id: true
    }
  });
  createdUserIds.push(userAutoBlocked.id);

  return {
    cycleId: cycle.id,
    createdUserIds,
    createdSessionIds,
    createdSessionBuildingIds,
    createdBlockIds,
    createdAssignmentIds,
    buildingId: building.id,
    roleDefinitionId: roleDefinition.id,
    sessionPermanentId: sessionPermanent.id,
    sessionTemporaryId: sessionTemporary.id,
    sessionAutoId: sessionAuto.id,
    userPermanentId: userPermanent.id,
    userTemporaryId: userTemporary.id,
    userAutoBlockedId: userAutoBlocked.id
  };
}

function metadataUserId(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  return typeof metadata.userId === "string" ? metadata.userId : null;
}

async function verify() {
  const fixture = await createFixture();
  const scriptStartedAt = new Date();

  try {
    const cookie = await loginAndGetCookie();

    const permanentBlock = await postJson("/api/blocks", cookie, {
      userId: fixture.userPermanentId,
      type: "PERMANENT",
      reason: "verification_permanent_block"
    });
    assert.equal(permanentBlock.status, 201, "Permanent block should be created.");
    assert.equal(permanentBlock.body.ok, true, "Permanent block response should be ok.");
    const permanentBlockId = permanentBlock.body?.data?.block?.id ?? null;
    expect(permanentBlockId, "Permanent block id is missing.");
    fixture.createdBlockIds.push(permanentBlockId);

    const blockedManualAssignment = await postJson("/api/assignments", cookie, {
      sessionId: fixture.sessionPermanentId,
      userId: fixture.userPermanentId,
      buildingId: fixture.buildingId,
      roleDefinitionId: fixture.roleDefinitionId,
      assignedMethod: "MANUAL"
    });
    assert.equal(
      blockedManualAssignment.status,
      409,
      "Blocked user should not be manually assignable."
    );
    assert.equal(blockedManualAssignment.body.error, "user_blocked");

    const unblockResult = await postJson("/api/blocks/unblock", cookie, {
      userId: fixture.userPermanentId,
      liftReason: "verification_unblock"
    });
    assert.equal(unblockResult.status, 200, "Unblock should succeed.");
    assert.equal(unblockResult.body.ok, true, "Unblock response should be ok.");

    const unblockedManualAssignment = await postJson("/api/assignments", cookie, {
      sessionId: fixture.sessionPermanentId,
      userId: fixture.userPermanentId,
      buildingId: fixture.buildingId,
      roleDefinitionId: fixture.roleDefinitionId,
      assignedMethod: "MANUAL"
    });
    assert.equal(
      unblockedManualAssignment.status,
      201,
      "Unblocked user should become assignable."
    );
    assert.equal(unblockedManualAssignment.body.ok, true);
    const unblockedAssignmentId = unblockedManualAssignment.body?.data?.id ?? null;
    expect(unblockedAssignmentId, "Unblocked assignment id is missing.");
    fixture.createdAssignmentIds.push(unblockedAssignmentId);

    const temporaryEndsAt = new Date(Date.now() + 8000);
    const temporaryBlock = await postJson("/api/blocks", cookie, {
      userId: fixture.userTemporaryId,
      type: "TEMPORARY",
      endsAt: temporaryEndsAt.toISOString(),
      reason: "verification_temporary_block"
    });
    assert.equal(temporaryBlock.status, 201, "Temporary block should be created.");
    assert.equal(temporaryBlock.body.ok, true);
    const temporaryBlockId = temporaryBlock.body?.data?.block?.id ?? null;
    expect(temporaryBlockId, "Temporary block id is missing.");
    fixture.createdBlockIds.push(temporaryBlockId);

    const temporaryBlockedManualAssignment = await postJson("/api/assignments", cookie, {
      sessionId: fixture.sessionTemporaryId,
      userId: fixture.userTemporaryId,
      buildingId: fixture.buildingId,
      roleDefinitionId: fixture.roleDefinitionId,
      assignedMethod: "MANUAL"
    });
    assert.equal(
      temporaryBlockedManualAssignment.status,
      409,
      "Temporary blocked user should be rejected before expiry."
    );
    assert.equal(temporaryBlockedManualAssignment.body.error, "user_blocked");

    const storedTemporaryEndsAt =
      temporaryBlock.body?.data?.user?.blockEndsAt ??
      temporaryBlock.body?.data?.block?.endsAt ??
      temporaryEndsAt.toISOString();
    const remainingWaitMs = Math.max(
      new Date(storedTemporaryEndsAt).getTime() - Date.now() + 800,
      1500
    );

    await new Promise((resolve) => {
      setTimeout(resolve, remainingWaitMs);
    });

    const temporaryExpiredManualAssignment = await postJson("/api/assignments", cookie, {
      sessionId: fixture.sessionTemporaryId,
      userId: fixture.userTemporaryId,
      buildingId: fixture.buildingId,
      roleDefinitionId: fixture.roleDefinitionId,
      assignedMethod: "MANUAL"
    });
    assert.equal(
      temporaryExpiredManualAssignment.status,
      201,
      "Temporary block expiry should restore assignment eligibility."
    );
    assert.equal(temporaryExpiredManualAssignment.body.ok, true);
    const temporaryAssignmentId = temporaryExpiredManualAssignment.body?.data?.id ?? null;
    expect(temporaryAssignmentId, "Temporary-expiry assignment id is missing.");
    fixture.createdAssignmentIds.push(temporaryAssignmentId);

    const autoBlock = await postJson("/api/blocks", cookie, {
      userId: fixture.userAutoBlockedId,
      type: "PERMANENT",
      reason: "verification_auto_block"
    });
    assert.equal(autoBlock.status, 201, "Auto-test block should be created.");
    assert.equal(autoBlock.body.ok, true);
    const autoBlockId = autoBlock.body?.data?.block?.id ?? null;
    expect(autoBlockId, "Auto-test block id is missing.");
    fixture.createdBlockIds.push(autoBlockId);

    const autoAssignResult = await postJson("/api/assignments/auto", cookie, {
      sessionId: fixture.sessionAutoId,
      roleDefinitionIds: [fixture.roleDefinitionId],
      candidateUserIds: [fixture.userAutoBlockedId],
      dryRun: false
    });
    assert.equal(autoAssignResult.status, 200, "Auto-assignment call should succeed.");
    assert.equal(autoAssignResult.body.ok, true);
    assert.equal(
      autoAssignResult.body.data.createdAssignmentsCount,
      0,
      "Blocked user should not be created by auto-assignment."
    );
    assert.equal(
      autoAssignResult.body.data.plannedAssignmentsCount,
      0,
      "Blocked user should not be planned by auto-assignment."
    );
    assert.equal(
      autoAssignResult.body.data.unfilledSlotsCount,
      1,
      "Auto-assignment slot should remain unfilled when only blocked candidate exists."
    );

    const blockedAutoAssignment = await prisma.assignment.findUnique({
      where: {
        sessionId_userId: {
          sessionId: fixture.sessionAutoId,
          userId: fixture.userAutoBlockedId
        }
      },
      select: {
        id: true
      }
    });
    assert.equal(
      blockedAutoAssignment,
      null,
      "Blocked user should not get assignment row from auto-assignment."
    );

    const blockLogs = await prisma.activityLog.findMany({
      where: {
        action: {
          in: ["block_create", "block_unblock"]
        },
        occurredAt: {
          gte: scriptStartedAt
        }
      },
      orderBy: {
        occurredAt: "asc"
      },
      select: {
        action: true,
        metadata: true
      }
    });

    const permanentCreateLog = blockLogs.find(
      (log) =>
        log.action === "block_create" &&
        metadataUserId(log.metadata) === fixture.userPermanentId
    );
    const permanentUnblockLog = blockLogs.find(
      (log) =>
        log.action === "block_unblock" &&
        metadataUserId(log.metadata) === fixture.userPermanentId
    );
    expect(permanentCreateLog, "Permanent block activity log is missing.");
    expect(permanentUnblockLog, "Unblock activity log is missing.");

    console.log("Block Step 6 verification passed.");
    console.log(
      JSON.stringify(
        {
          blockedUserAssignmentRejected: "passed",
          unblockRestoresEligibility: "passed",
          temporaryExpiryWorks: "passed",
          autoAssignIntegration: "passed",
          blockCreateAndUnblockActivityLogs: "passed"
        },
        null,
        2
      )
    );

    return fixture;
  } catch (error) {
    throw error;
  }
}

const fixture = await verify();

await prisma.$transaction(async (tx) => {
  if (fixture.createdAssignmentIds.length > 0) {
    await tx.activityLog.deleteMany({
      where: {
        entityType: "assignment",
        entityId: {
          in: [...fixture.createdAssignmentIds, ...fixture.createdSessionIds]
        }
      }
    });
    await tx.assignment.deleteMany({
      where: {
        id: {
          in: fixture.createdAssignmentIds
        }
      }
    });
  }

  if (fixture.createdBlockIds.length > 0) {
    await tx.activityLog.deleteMany({
      where: {
        entityType: "block",
        entityId: {
          in: fixture.createdBlockIds
        }
      }
    });
    await tx.block.deleteMany({
      where: {
        id: {
          in: fixture.createdBlockIds
        }
      }
    });
  }

  if (fixture.createdSessionBuildingIds.length > 0) {
    await tx.sessionBuilding.deleteMany({
      where: {
        id: {
          in: fixture.createdSessionBuildingIds
        }
      }
    });
  }

  if (fixture.createdSessionIds.length > 0) {
    await tx.session.deleteMany({
      where: {
        id: {
          in: fixture.createdSessionIds
        }
      }
    });
  }

  if (fixture.createdUserIds.length > 0) {
    await tx.user.deleteMany({
      where: {
        id: {
          in: fixture.createdUserIds
        }
      }
    });
  }

  await tx.cycle.delete({
    where: {
      id: fixture.cycleId
    }
  });
});

await prisma.$disconnect();
