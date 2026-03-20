import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

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

function addDays(baseDate, daysToAdd) {
  return new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
}

function toSessionDate(baseDate) {
  const date = new Date(baseDate);
  date.setHours(0, 0, 0, 0);
  return date;
}

function metadataObject(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  return metadata;
}

function metadataString(metadata, key) {
  const value = metadataObject(metadata)?.[key];
  return typeof value === "string" ? value : null;
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
    throw new Error("Could not authenticate admin user for Step 3 verification.");
  }

  return `examops_session=${token}`;
}

async function createSessionWithRetry(input) {
  const maxAttempts = 40;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const sessionDate = toSessionDate(addDays(input.baseSessionDate, attempt));
    const startsAt = addDays(input.baseStartsAt, attempt);
    const endsAt = addDays(input.baseEndsAt, attempt);

    try {
      return await prisma.session.create({
        data: {
          cycleId: input.cycleId,
          name: `${input.name}_${attempt}`,
          nameEn: `${input.nameEn} ${attempt}`,
          examType: input.examType,
          sessionDate,
          startsAt,
          endsAt,
          status: input.status,
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

  throw new Error(`Could not create a unique session for ${input.name}.`);
}

async function createFixture() {
  const now = new Date();
  const seed = Date.now();
  const suffix = String(seed).slice(-8);
  const cycleStart = toSessionDate(addDays(now, -5));
  const cycleEnd = toSessionDate(addDays(now, 20));
  const startsA = addDays(now, -2);
  startsA.setHours(9, 0, 0, 0);
  const endsA = new Date(startsA.getTime() + 2 * 60 * 60 * 1000);
  const startsB = addDays(now, -1);
  startsB.setHours(9, 0, 0, 0);
  const endsB = new Date(startsB.getTime() + 2 * 60 * 60 * 1000);

  const createdUserIds = [];
  const createdSessionIds = [];
  const createdSessionBuildingIds = [];
  const createdAssignmentIds = [];
  const createdAttendanceIds = [];

  const cycle = await prisma.cycle.create({
    data: {
      code: `METRIC-${seed}`,
      name: `Metrics Verify ${seed}`,
      nameEn: `Metrics Verify ${seed}`,
      status: "ACTIVE",
      startDate: cycleStart,
      endDate: cycleEnd,
      isActive: true
    },
    select: {
      id: true
    }
  });

  const emptyCycle = await prisma.cycle.create({
    data: {
      code: `METRIC-EMPTY-${seed}`,
      name: `Metrics Empty ${seed}`,
      nameEn: `Metrics Empty ${seed}`,
      status: "DRAFT",
      startDate: cycleStart,
      endDate: cycleEnd,
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
  expect(building, "No active building is available for metrics verification.");

  const roleDefinition = await prisma.assignmentRoleDefinition.findFirst({
    where: {
      key: "building_head",
      isActive: true
    },
    select: {
      id: true
    }
  });
  expect(
    roleDefinition,
    "building_head role definition is missing for metrics verification."
  );

  const completedSession = await createSessionWithRetry({
    cycleId: cycle.id,
    name: `METRIC_SESSION_A_${seed}`,
    nameEn: `Metric Session A ${seed}`,
    examType: "EST1",
    baseSessionDate: addDays(now, -2),
    baseStartsAt: startsA,
    baseEndsAt: endsA,
    status: "COMPLETED"
  });
  createdSessionIds.push(completedSession.id);

  const cancelledSession = await createSessionWithRetry({
    cycleId: cycle.id,
    name: `METRIC_SESSION_B_${seed}`,
    nameEn: `Metric Session B ${seed}`,
    examType: "EST2",
    baseSessionDate: addDays(now, -1),
    baseStartsAt: startsB,
    baseEndsAt: endsB,
    status: "CANCELLED"
  });
  createdSessionIds.push(cancelledSession.id);

  for (const sessionId of [completedSession.id, cancelledSession.id]) {
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

  const userA = await prisma.user.create({
    data: {
      name: `Metrics User A ${seed}`,
      nameEn: `Metrics User A ${seed}`,
      phone: `20171${suffix}`,
      source: "EXTERNAL",
      averageRating: 4.3,
      totalSessions: 5,
      blockStatus: "CLEAR",
      isActive: true
    },
    select: {
      id: true
    }
  });
  createdUserIds.push(userA.id);

  const userB = await prisma.user.create({
    data: {
      name: `Metrics User B ${seed}`,
      nameEn: `Metrics User B ${seed}`,
      phone: `20172${suffix}`,
      source: "EXTERNAL",
      averageRating: 3.8,
      totalSessions: 3,
      blockStatus: "CLEAR",
      isActive: true
    },
    select: {
      id: true
    }
  });
  createdUserIds.push(userB.id);

  const userC = await prisma.user.create({
    data: {
      name: `Metrics User C ${seed}`,
      nameEn: `Metrics User C ${seed}`,
      phone: `20173${suffix}`,
      source: "EXTERNAL",
      averageRating: 3.1,
      totalSessions: 1,
      blockStatus: "CLEAR",
      isActive: true
    },
    select: {
      id: true
    }
  });
  createdUserIds.push(userC.id);

  const assignmentA = await prisma.assignment.create({
    data: {
      sessionId: completedSession.id,
      userId: userA.id,
      buildingId: building.id,
      roleDefinitionId: roleDefinition.id,
      status: "CONFIRMED",
      assignedMethod: "MANUAL",
      isManualOverride: false
    },
    select: {
      id: true
    }
  });
  createdAssignmentIds.push(assignmentA.id);

  const assignmentB = await prisma.assignment.create({
    data: {
      sessionId: completedSession.id,
      userId: userB.id,
      buildingId: building.id,
      roleDefinitionId: roleDefinition.id,
      status: "COMPLETED",
      assignedMethod: "AUTO",
      isManualOverride: false
    },
    select: {
      id: true
    }
  });
  createdAssignmentIds.push(assignmentB.id);

  const assignmentC = await prisma.assignment.create({
    data: {
      sessionId: cancelledSession.id,
      userId: userC.id,
      buildingId: building.id,
      roleDefinitionId: roleDefinition.id,
      status: "CANCELLED",
      assignedMethod: "MANUAL",
      isManualOverride: false
    },
    select: {
      id: true
    }
  });
  createdAssignmentIds.push(assignmentC.id);

  const attendanceA = await prisma.attendance.create({
    data: {
      assignmentId: assignmentA.id,
      status: "CONFIRMED",
      checkedInAt: addDays(now, -2)
    },
    select: {
      id: true
    }
  });
  createdAttendanceIds.push(attendanceA.id);

  const attendanceB = await prisma.attendance.create({
    data: {
      assignmentId: assignmentB.id,
      status: "ABSENT"
    },
    select: {
      id: true
    }
  });
  createdAttendanceIds.push(attendanceB.id);

  return {
    cycleId: cycle.id,
    emptyCycleId: emptyCycle.id,
    buildingId: building.id,
    completedSessionId: completedSession.id,
    createdUserIds,
    createdSessionIds,
    createdSessionBuildingIds,
    createdAssignmentIds,
    createdAttendanceIds
  };
}

async function getJson({ cookie, path }) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Accept: "application/json",
      Cookie: cookie
    }
  });

  const body = await response.json();
  return {
    response,
    body
  };
}

let fixture = null;
let createdLogIds = [];

try {
  const adminUser = await prisma.appUser.findUnique({
    where: {
      email: adminEmail
    },
    select: {
      id: true
    }
  });
  expect(adminUser, `Admin app user not found for email ${adminEmail}.`);

  fixture = await createFixture();
  const cookie = await loginAndGetCookie();
  const scriptStartedAt = new Date();

  const sessionsMetrics = await getJson({
    cookie,
    path: `/api/metrics/sessions?cycleId=${fixture.cycleId}&locale=en`
  });
  assert.equal(sessionsMetrics.response.status, 200);
  assert.equal(sessionsMetrics.body.ok, true);
  assert.equal(sessionsMetrics.body.data.metricType, "sessions");
  assert.equal(sessionsMetrics.body.data.totals.totalSessions, 2);
  assert.equal(sessionsMetrics.body.data.totals.activeSessions, 0);
  assert.equal(sessionsMetrics.body.data.totals.completedSessions, 1);
  assert.equal(sessionsMetrics.body.data.totals.cancelledSessions, 1);

  const assignmentsMetrics = await getJson({
    cookie,
    path: `/api/metrics/assignments?cycleId=${fixture.cycleId}&locale=en`
  });
  assert.equal(assignmentsMetrics.response.status, 200);
  assert.equal(assignmentsMetrics.body.ok, true);
  assert.equal(assignmentsMetrics.body.data.metricType, "assignments");
  assert.equal(assignmentsMetrics.body.data.totals.totalAssignments, 3);
  assert.equal(assignmentsMetrics.body.data.totals.uniqueAssignedUsers, 3);
  assert.equal(assignmentsMetrics.body.data.totals.manualAssignments, 2);
  assert.equal(assignmentsMetrics.body.data.totals.autoAssignments, 1);
  assert.equal(assignmentsMetrics.body.data.totals.cancelledAssignments, 1);
  assert.equal(assignmentsMetrics.body.data.totals.completedAssignments, 1);

  const attendanceMetrics = await getJson({
    cookie,
    path: `/api/metrics/attendance?cycleId=${fixture.cycleId}&locale=en`
  });
  assert.equal(attendanceMetrics.response.status, 200);
  assert.equal(attendanceMetrics.body.ok, true);
  assert.equal(attendanceMetrics.body.data.metricType, "attendance");
  assert.equal(attendanceMetrics.body.data.totals.totalAssignments, 3);
  assert.equal(attendanceMetrics.body.data.totals.attendanceRecords, 2);
  assert.equal(attendanceMetrics.body.data.totals.confirmedCount, 1);
  assert.equal(attendanceMetrics.body.data.totals.absentCount, 1);
  assert.equal(attendanceMetrics.body.data.totals.declinedCount, 0);
  assert.equal(attendanceMetrics.body.data.totals.pendingCount, 1);
  assert.equal(attendanceMetrics.body.data.totals.attendanceRatio, 0.3333);

  const filteredMetrics = await getJson({
    cookie,
    path:
      `/api/metrics/attendance?sessionId=${fixture.completedSessionId}` +
      `&cycleId=${fixture.cycleId}&locationId=${fixture.buildingId}&locale=ar`
  });
  assert.equal(filteredMetrics.response.status, 200);
  assert.equal(filteredMetrics.body.ok, true);
  assert.equal(filteredMetrics.body.data.filters.sessionId, fixture.completedSessionId);
  assert.equal(filteredMetrics.body.data.filters.cycleId, fixture.cycleId);
  assert.equal(filteredMetrics.body.data.filters.locationId, fixture.buildingId);
  assert.equal(filteredMetrics.body.data.totals.totalAssignments, 2);

  const invalidQuery = await getJson({
    cookie,
    path: "/api/metrics/sessions?cycleId=not-a-uuid"
  });
  assert.equal(invalidQuery.response.status, 400);
  assert.equal(invalidQuery.body.ok, false);
  assert.equal(invalidQuery.body.error, "validation_error");

  const mismatchedFilters = await getJson({
    cookie,
    path:
      `/api/metrics/sessions?sessionId=${fixture.completedSessionId}` +
      `&cycleId=${fixture.emptyCycleId}`
  });
  assert.equal(mismatchedFilters.response.status, 409);
  assert.equal(mismatchedFilters.body.ok, false);
  assert.equal(mismatchedFilters.body.error, "metrics_filter_mismatch");

  const emptyDataMetrics = await getJson({
    cookie,
    path: `/api/metrics/attendance?cycleId=${fixture.emptyCycleId}`
  });
  assert.equal(emptyDataMetrics.response.status, 200);
  assert.equal(emptyDataMetrics.body.ok, true);
  assert.equal(emptyDataMetrics.body.data.totals.totalAssignments, 0);
  assert.equal(emptyDataMetrics.body.data.totals.attendanceRecords, 0);
  assert.equal(emptyDataMetrics.body.data.totals.pendingCount, 0);
  assert.equal(emptyDataMetrics.body.data.totals.attendanceRatio, 0);

  const metricLogs = await prisma.activityLog.findMany({
    where: {
      action: "metrics_view",
      entityType: "metrics",
      actorAppUserId: adminUser.id,
      occurredAt: {
        gte: scriptStartedAt
      }
    },
    select: {
      id: true,
      metadata: true
    }
  });
  expect(metricLogs.length >= 3, "Expected metrics_view activity logs.");
  createdLogIds = metricLogs.map((row) => row.id);

  const hasSessionsLog = metricLogs.some((row) => {
    const metadata = metadataObject(row.metadata);
    return (
      metadataString(metadata, "metricType") === "sessions" &&
      metadataObject(metadata?.filters)?.cycleId === fixture.cycleId
    );
  });
  const hasAssignmentsLog = metricLogs.some((row) => {
    const metadata = metadataObject(row.metadata);
    return (
      metadataString(metadata, "metricType") === "assignments" &&
      metadataObject(metadata?.filters)?.cycleId === fixture.cycleId
    );
  });
  const hasAttendanceLog = metricLogs.some((row) => {
    const metadata = metadataObject(row.metadata);
    return (
      metadataString(metadata, "metricType") === "attendance" &&
      metadataObject(metadata?.filters)?.cycleId === fixture.cycleId
    );
  });

  expect(hasSessionsLog, "Sessions metrics activity log is missing.");
  expect(hasAssignmentsLog, "Assignments metrics activity log is missing.");
  expect(hasAttendanceLog, "Attendance metrics activity log is missing.");

  console.log("Phase 8 Step 3 verification passed.");
  console.log(
    JSON.stringify(
      {
        validQueries: "passed",
        invalidQueryRejection: "passed",
        emptyDataHandling: "passed",
        aggregationCorrectness: "passed",
        activityLogs: "passed"
      },
      null,
      2
    )
  );
} finally {
  if (fixture) {
    await prisma.$transaction(async (tx) => {
      if (createdLogIds.length > 0) {
        await tx.activityLog.deleteMany({
          where: {
            id: {
              in: createdLogIds
            }
          }
        });
      }

      if (fixture.createdAttendanceIds.length > 0) {
        await tx.attendance.deleteMany({
          where: {
            id: {
              in: fixture.createdAttendanceIds
            }
          }
        });
      }

      if (fixture.createdAssignmentIds.length > 0) {
        await tx.assignment.deleteMany({
          where: {
            id: {
              in: fixture.createdAssignmentIds
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
      await tx.cycle.delete({
        where: {
          id: fixture.emptyCycleId
        }
      });
    });
  }

  await prisma.$disconnect();
}
