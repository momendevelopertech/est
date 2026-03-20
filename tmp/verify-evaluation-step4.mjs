import assert from "node:assert/strict";

import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const baseUrl = process.env.EXAMOPS_BASE_URL ?? "http://127.0.0.1:4010";
const adminEmail = process.env.EXAMOPS_ADMIN_EMAIL ?? "admin@examops.local";
const adminPassword = process.env.EXAMOPS_ADMIN_PASSWORD ?? "ChangeMe123!";

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
    throw new Error("Could not authenticate admin user for API verification.");
  }

  return `examops_session=${token}`;
}

async function createFixture() {
  const createdUserIds = [];

  const cycle = await prisma.cycle.findFirst({
    where: {
      isActive: true
    },
    select: {
      id: true
    }
  });
  expect(cycle, "No active cycle available for evaluation verification.");

  const building = await prisma.building.findFirst({
    where: {
      isActive: true
    },
    select: {
      id: true
    }
  });
  expect(building, "No active building available for evaluation verification.");

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

  let users = await prisma.user.findMany({
    where: {
      isActive: true
    },
    orderBy: [{ averageRating: "desc" }, { createdAt: "asc" }],
    take: 5,
    select: {
      id: true
    }
  });

  if (users.length < 2) {
    const missingCount = 2 - users.length;

    for (let index = 0; index < missingCount; index += 1) {
      const seed = `${Date.now()}${index}`;
      const created = await prisma.user.create({
        data: {
          name: `Evaluation Fixture User ${seed}`,
          nameEn: `Evaluation Fixture User ${seed}`,
          phone: `2015${seed.slice(-8)}`,
          source: "EXTERNAL",
          averageRating: 3.5,
          totalSessions: 0,
          blockStatus: "CLEAR",
          isActive: true
        },
        select: {
          id: true
        }
      });
      createdUserIds.push(created.id);
    }

    users = await prisma.user.findMany({
      where: {
        isActive: true
      },
      orderBy: [{ averageRating: "desc" }, { createdAt: "asc" }],
      take: 5,
      select: {
        id: true
      }
    });
  }

  expect(users.length >= 2, "At least 2 active users are required for verification.");

  const evaluableUserId = users[0].id;
  const cancelledUserId = users[1].id;

  const now = new Date();
  const startedAt = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const endedAt = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const sessionDate = new Date(endedAt);
  sessionDate.setHours(0, 0, 0, 0);

  let session = null;
  let dayOffset = 0;

  while (!session && dayOffset < 30) {
    const currentDate = new Date(sessionDate.getTime() - dayOffset * 24 * 60 * 60 * 1000);

    try {
      session = await prisma.session.create({
        data: {
          cycleId: cycle.id,
          name: `EVALUATION_TEST_${Date.now()}_${dayOffset}`,
          nameEn: `Evaluation Test ${Date.now()} ${dayOffset}`,
          examType: "EST1",
          sessionDate: currentDate,
          startsAt: new Date(startedAt.getTime() - dayOffset * 24 * 60 * 60 * 1000),
          endsAt: new Date(endedAt.getTime() - dayOffset * 24 * 60 * 60 * 1000),
          status: "COMPLETED",
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
        dayOffset += 1;
        continue;
      }

      throw error;
    }
  }

  expect(session, "Could not create fixture session for evaluation verification.");

  await prisma.sessionBuilding.create({
    data: {
      sessionId: session.id,
      buildingId: building.id,
      isActive: true
    }
  });

  const [assignmentEvaluable, assignmentCancelled] = await Promise.all([
    prisma.assignment.create({
      data: {
        sessionId: session.id,
        userId: evaluableUserId,
        buildingId: building.id,
        floorId: null,
        roomId: null,
        roleDefinitionId: roleDefinition.id,
        status: "CONFIRMED",
        assignedMethod: "MANUAL",
        isManualOverride: false
      },
      select: {
        id: true,
        userId: true
      }
    }),
    prisma.assignment.create({
      data: {
        sessionId: session.id,
        userId: cancelledUserId,
        buildingId: building.id,
        floorId: null,
        roomId: null,
        roleDefinitionId: roleDefinition.id,
        status: "CANCELLED",
        assignedMethod: "MANUAL",
        isManualOverride: false
      },
      select: {
        id: true,
        userId: true
      }
    })
  ]);

  return {
    createdUserIds,
    sessionId: session.id,
    evaluableAssignmentId: assignmentEvaluable.id,
    evaluableUserId,
    cancelledAssignmentId: assignmentCancelled.id,
    cancelledUserId
  };
}

async function postEvaluation(cookie, payload) {
  const response = await fetch(`${baseUrl}/api/evaluations`, {
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

async function verify() {
  const fixture = await createFixture();
  let evaluationId = null;

  try {
    const cookie = await loginAndGetCookie();

    const created = await postEvaluation(cookie, {
      sessionId: fixture.sessionId,
      assignmentId: fixture.evaluableAssignmentId,
      userId: fixture.evaluableUserId,
      rating: 4.5,
      notes: "evaluation verification create"
    });

    assert.equal(created.status, 201, "Evaluation creation should succeed.");
    assert.equal(created.body.ok, true, "Evaluation create response should be ok.");
    assert.equal(created.body.mode, "created", "Create response mode should be 'created'.");
    evaluationId = created.body?.data?.id ?? null;
    expect(evaluationId, "Created evaluation id is missing.");

    const createdEvaluation = await prisma.evaluation.findUnique({
      where: {
        id: evaluationId
      },
      select: {
        id: true,
        sessionId: true,
        subjectUserId: true,
        score: true
      }
    });

    expect(createdEvaluation, "Created evaluation row is missing in DB.");
    assert.equal(createdEvaluation.sessionId, fixture.sessionId);
    assert.equal(createdEvaluation.subjectUserId, fixture.evaluableUserId);
    assert.equal(createdEvaluation.score.toString(), "4.5");

    const duplicate = await postEvaluation(cookie, {
      sessionId: fixture.sessionId,
      assignmentId: fixture.evaluableAssignmentId,
      userId: fixture.evaluableUserId,
      rating: 4.7
    });

    assert.equal(duplicate.status, 409, "Duplicate evaluation should be rejected.");
    assert.equal(duplicate.body.error, "duplicate_evaluation");

    const invalidRating = await postEvaluation(cookie, {
      sessionId: fixture.sessionId,
      assignmentId: fixture.evaluableAssignmentId,
      userId: fixture.evaluableUserId,
      rating: 7
    });

    assert.equal(invalidRating.status, 400, "Invalid rating should fail validation.");
    assert.equal(invalidRating.body.error, "validation_error");

    const cancelledAssignment = await postEvaluation(cookie, {
      sessionId: fixture.sessionId,
      assignmentId: fixture.cancelledAssignmentId,
      userId: fixture.cancelledUserId,
      rating: 3
    });

    assert.equal(
      cancelledAssignment.status,
      409,
      "Cancelled assignment evaluation should be rejected."
    );
    assert.equal(
      cancelledAssignment.body.error,
      "evaluation_assignment_not_operational"
    );

    const listResponse = await fetch(
      `${baseUrl}/api/evaluations?sessionId=${fixture.sessionId}&page=1&pageSize=20`,
      {
        headers: {
          Accept: "application/json",
          Cookie: cookie
        }
      }
    );
    const listBody = await listResponse.json();

    assert.equal(listResponse.status, 200, "Evaluation list should load successfully.");
    assert.equal(listBody.ok, true, "Evaluation list response should be ok.");
    expect(Array.isArray(listBody.data), "Evaluation list data should be an array.");
    const listedEvaluation = listBody.data.find((entry) => entry.id === evaluationId);
    expect(listedEvaluation, "Created evaluation should be returned in session list.");
    assert.equal(listedEvaluation.assignmentId, fixture.evaluableAssignmentId);
    assert.equal(listedEvaluation.sessionId, fixture.sessionId);
    assert.equal(listedEvaluation.subjectUserId, fixture.evaluableUserId);

    const activityLog = await prisma.activityLog.findFirst({
      where: {
        action: "evaluation_create",
        entityType: "evaluation",
        entityId: evaluationId
      },
      orderBy: {
        occurredAt: "desc"
      },
      select: {
        id: true,
        metadata: true
      }
    });

    expect(activityLog, "Evaluation create activity log is missing.");
    assert.equal(activityLog.metadata?.sessionId, fixture.sessionId);
    assert.equal(activityLog.metadata?.assignmentId, fixture.evaluableAssignmentId);
    assert.equal(activityLog.metadata?.subjectUserId, fixture.evaluableUserId);

    console.log("Evaluation Step 4 verification passed.");
    console.log(
      JSON.stringify(
        {
          successCreation: "passed",
          duplicateRejection: "passed",
          invalidRatingRejection: "passed",
          cancelledAssignmentRejection: "passed",
          linkingValidation: "passed",
          activityLogCheck: "passed",
          sessionId: fixture.sessionId,
          evaluationId
        },
        null,
        2
      )
    );

    return {
      fixture,
      evaluationId
    };
  } catch (error) {
    throw error;
  }
}

const { fixture, evaluationId } = await verify();

await prisma.$transaction(async (tx) => {
  if (evaluationId) {
    await tx.activityLog.deleteMany({
      where: {
        entityType: "evaluation",
        entityId: evaluationId
      }
    });
  }

  await tx.evaluation.deleteMany({
    where: {
      sessionId: fixture.sessionId
    }
  });
  await tx.assignment.deleteMany({
    where: {
      sessionId: fixture.sessionId
    }
  });
  await tx.sessionBuilding.deleteMany({
    where: {
      sessionId: fixture.sessionId
    }
  });
  await tx.session.deleteMany({
    where: {
      id: fixture.sessionId
    }
  });

  if (fixture.createdUserIds.length > 0) {
    await tx.user.deleteMany({
      where: {
        id: {
          in: fixture.createdUserIds
        }
      }
    });
  }
});

await prisma.$disconnect();
