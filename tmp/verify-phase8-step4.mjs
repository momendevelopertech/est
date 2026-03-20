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

function mapCards(cards) {
  return new Map(cards.map((card) => [card.key, card.value]));
}

function mapBreakdownItems(items) {
  return new Map(items.map((item) => [item.key, item.count]));
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
    throw new Error("Could not authenticate admin user for Step 4 verification.");
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
          examType: "EST1",
          sessionDate,
          startsAt,
          endsAt,
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
        continue;
      }

      throw error;
    }
  }

  throw new Error(`Could not create a unique session for ${input.name}.`);
}

async function createFixture(adminAppUserId) {
  const now = new Date();
  const seed = Date.now();
  const suffix = String(seed).slice(-8);
  const cycleStart = toSessionDate(addDays(now, -5));
  const cycleEnd = toSessionDate(addDays(now, 20));
  const startsAt = addDays(now, -2);
  startsAt.setHours(9, 0, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);

  const createdUserIds = [];
  const createdSessionIds = [];
  const createdSessionBuildingIds = [];
  const createdAssignmentIds = [];
  const createdAttendanceIds = [];
  const createdEvaluationIds = [];

  const cycle = await prisma.cycle.create({
    data: {
      code: `REPORT-${seed}`,
      name: `Reports Verify ${seed}`,
      nameEn: `Reports Verify ${seed}`,
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
      code: `REPORT-EMPTY-${seed}`,
      name: `Reports Empty ${seed}`,
      nameEn: `Reports Empty ${seed}`,
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
  expect(building, "No active building is available for reports verification.");

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
    "building_head role definition is missing for reports verification."
  );

  const session = await createSessionWithRetry({
    cycleId: cycle.id,
    name: `REPORT_SESSION_${seed}`,
    nameEn: `Report Session ${seed}`,
    baseSessionDate: addDays(now, -2),
    baseStartsAt: startsAt,
    baseEndsAt: endsAt
  });
  createdSessionIds.push(session.id);

  const sessionBuilding = await prisma.sessionBuilding.create({
    data: {
      sessionId: session.id,
      buildingId: building.id,
      isActive: true
    },
    select: {
      id: true
    }
  });
  createdSessionBuildingIds.push(sessionBuilding.id);

  const userA = await prisma.user.create({
    data: {
      name: `Reports User A ${seed}`,
      nameEn: `Reports User A ${seed}`,
      phone: `20174${suffix}`,
      source: "EXTERNAL",
      averageRating: 4.6,
      totalSessions: 6,
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
      name: `Reports User B ${seed}`,
      nameEn: `Reports User B ${seed}`,
      phone: `20175${suffix}`,
      source: "EXTERNAL",
      averageRating: 3.4,
      totalSessions: 3,
      blockStatus: "CLEAR",
      isActive: true
    },
    select: {
      id: true
    }
  });
  createdUserIds.push(userB.id);

  const assignmentA = await prisma.assignment.create({
    data: {
      sessionId: session.id,
      userId: userA.id,
      buildingId: building.id,
      roleDefinitionId: roleDefinition.id,
      status: "COMPLETED",
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
      sessionId: session.id,
      userId: userB.id,
      buildingId: building.id,
      roleDefinitionId: roleDefinition.id,
      status: "CONFIRMED",
      assignedMethod: "AUTO",
      isManualOverride: false
    },
    select: {
      id: true
    }
  });
  createdAssignmentIds.push(assignmentB.id);

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

  const evaluationAId = randomUUID();
  await prisma.$executeRawUnsafe(
    "INSERT INTO evaluations (id, session_id, subject_user_id, evaluator_app_user_id, score, created_at, updated_at) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::numeric, NOW(), NOW())",
    evaluationAId,
    session.id,
    userA.id,
    adminAppUserId,
    new Prisma.Decimal("4.50")
  );
  createdEvaluationIds.push(evaluationAId);

  const evaluationBId = randomUUID();
  await prisma.$executeRawUnsafe(
    "INSERT INTO evaluations (id, session_id, subject_user_id, evaluator_app_user_id, score, created_at, updated_at) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::numeric, NOW(), NOW())",
    evaluationBId,
    session.id,
    userB.id,
    adminAppUserId,
    new Prisma.Decimal("2.50")
  );
  createdEvaluationIds.push(evaluationBId);

  return {
    cycleId: cycle.id,
    emptyCycleId: emptyCycle.id,
    sessionId: session.id,
    buildingId: building.id,
    createdUserIds,
    createdSessionIds,
    createdSessionBuildingIds,
    createdAssignmentIds,
    createdAttendanceIds,
    createdEvaluationIds
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
  return { response, body };
}

async function getHtml({ cookie, path }) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Accept: "text/html",
      Cookie: cookie
    }
  });
  const text = await response.text();
  return { response, text };
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

  fixture = await createFixture(adminUser.id);
  const cookie = await loginAndGetCookie();
  const scriptStartedAt = new Date();

  const assignmentsReport = await getJson({
    cookie,
    path: `/api/reports/assignments?sessionId=${fixture.sessionId}&locale=en`
  });
  assert.equal(assignmentsReport.response.status, 200);
  assert.equal(assignmentsReport.body.ok, true);
  assert.equal(assignmentsReport.body.data.reportType, "assignments");
  expect(
    assignmentsReport.body.data.exportUrl?.includes("/api/export/assignments"),
    "Assignments report should include assignments export URL."
  );
  const assignmentCards = mapCards(assignmentsReport.body.data.cards);
  assert.equal(assignmentCards.get("totalSessions"), 1);
  assert.equal(assignmentCards.get("totalAssignments"), 2);
  assert.equal(assignmentCards.get("uniqueAssignedUsers"), 2);
  assert.equal(assignmentCards.get("manualAssignments"), 1);
  assert.equal(assignmentCards.get("autoAssignments"), 1);
  assert.equal(assignmentCards.get("completedAssignments"), 1);
  assert.equal(assignmentCards.get("cancelledAssignments"), 0);

  const attendanceReport = await getJson({
    cookie,
    path: `/api/reports/attendance?sessionId=${fixture.sessionId}&locale=en`
  });
  assert.equal(attendanceReport.response.status, 200);
  assert.equal(attendanceReport.body.ok, true);
  assert.equal(attendanceReport.body.data.reportType, "attendance");
  expect(
    attendanceReport.body.data.exportUrl?.includes("/api/export/attendance"),
    "Attendance report should include attendance export URL."
  );
  const attendanceCards = mapCards(attendanceReport.body.data.cards);
  assert.equal(attendanceCards.get("totalSessions"), 1);
  assert.equal(attendanceCards.get("totalAssignments"), 2);
  assert.equal(attendanceCards.get("attendanceRecords"), 2);
  assert.equal(attendanceCards.get("confirmedCount"), 1);
  assert.equal(attendanceCards.get("pendingCount"), 0);
  assert.equal(attendanceCards.get("absentCount"), 1);
  assert.equal(attendanceCards.get("attendanceRatio"), 50);

  const evaluationsReport = await getJson({
    cookie,
    path: `/api/reports/evaluations?sessionId=${fixture.sessionId}&locale=en`
  });
  assert.equal(evaluationsReport.response.status, 200);
  assert.equal(evaluationsReport.body.ok, true);
  assert.equal(evaluationsReport.body.data.reportType, "evaluations");
  const evaluationCards = mapCards(evaluationsReport.body.data.cards);
  assert.equal(evaluationCards.get("totalEvaluations"), 2);
  assert.equal(evaluationCards.get("averageScore"), 3.5);
  assert.equal(evaluationCards.get("evaluatedUsers"), 2);
  assert.equal(evaluationCards.get("evaluatedSessions"), 1);
  const scoreBreakdown = evaluationsReport.body.data.breakdowns.find(
    (section) => section.key === "scoreBuckets"
  );
  expect(scoreBreakdown, "Evaluation score breakdown should exist.");
  const scoreItems = mapBreakdownItems(scoreBreakdown.items);
  assert.equal(scoreItems.get("low"), 1);
  assert.equal(scoreItems.get("medium"), 0);
  assert.equal(scoreItems.get("high"), 1);

  const evaluationsWithLocation = await getJson({
    cookie,
    path:
      `/api/reports/evaluations?sessionId=${fixture.sessionId}` +
      `&locationId=${fixture.buildingId}&locale=en`
  });
  if (evaluationsWithLocation.response.status !== 200) {
    console.error("evaluationsWithLocation failure", evaluationsWithLocation.body);
  }
  assert.equal(evaluationsWithLocation.response.status, 200);
  assert.equal(evaluationsWithLocation.body.ok, true);
  assert.equal(evaluationsWithLocation.body.data.cards.length > 0, true);

  const invalidQuery = await getJson({
    cookie,
    path: "/api/reports/assignments?sessionId=bad-value"
  });
  assert.equal(invalidQuery.response.status, 400);
  assert.equal(invalidQuery.body.ok, false);
  assert.equal(invalidQuery.body.error, "validation_error");

  const emptyDataReport = await getJson({
    cookie,
    path: `/api/reports/assignments?cycleId=${fixture.emptyCycleId}&locale=en`
  });
  assert.equal(emptyDataReport.response.status, 200);
  assert.equal(emptyDataReport.body.ok, true);
  const emptyCards = mapCards(emptyDataReport.body.data.cards);
  assert.equal(emptyCards.get("totalSessions"), 0);
  assert.equal(emptyCards.get("totalAssignments"), 0);

  const assignmentsExportResponse = await fetch(
    `${baseUrl}${assignmentsReport.body.data.exportUrl}`,
    {
      headers: {
        Accept: "text/csv",
        Cookie: cookie
      }
    }
  );
  assert.equal(assignmentsExportResponse.status, 200);
  expect(
    assignmentsExportResponse.headers.get("content-type")?.includes("text/csv"),
    "Assignments export should return CSV."
  );

  const attendanceExportResponse = await fetch(
    `${baseUrl}${attendanceReport.body.data.exportUrl}`,
    {
      headers: {
        Accept: "text/csv",
        Cookie: cookie
      }
    }
  );
  assert.equal(attendanceExportResponse.status, 200);
  expect(
    attendanceExportResponse.headers.get("content-type")?.includes("text/csv"),
    "Attendance export should return CSV."
  );

  const enCookie = `${cookie}; examops_locale=en`;
  const arCookie = `${cookie}; examops_locale=ar`;

  const reportsHubEn = await getHtml({
    cookie: enCookie,
    path: "/reports"
  });
  assert.equal(reportsHubEn.response.status, 200);
  expect(
    reportsHubEn.text.includes("Reports hub"),
    "English reports hub page should render localized heading."
  );

  const reportsHubAr = await getHtml({
    cookie: arCookie,
    path: "/reports"
  });
  assert.equal(reportsHubAr.response.status, 200);
  expect(
    reportsHubAr.text.includes("مركز التقارير"),
    "Arabic reports hub page should render localized heading."
  );

  const assignmentsPageEn = await getHtml({
    cookie: enCookie,
    path: "/reports/assignments"
  });
  assert.equal(assignmentsPageEn.response.status, 200);
  expect(
    assignmentsPageEn.text.includes("Assignments report"),
    "English assignments report page should render localized title."
  );

  const assignmentsPageAr = await getHtml({
    cookie: arCookie,
    path: "/reports/assignments"
  });
  assert.equal(assignmentsPageAr.response.status, 200);
  expect(
    assignmentsPageAr.text.includes("تقرير التكليفات"),
    "Arabic assignments report page should render localized title."
  );

  const reportLogs = await prisma.activityLog.findMany({
    where: {
      action: "report_view",
      entityType: "report",
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
  const exportLogs = await prisma.activityLog.findMany({
    where: {
      action: "export_generate",
      entityType: "export",
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
  createdLogIds = [...reportLogs.map((row) => row.id), ...exportLogs.map((row) => row.id)];

  const hasAssignmentsReportLog = reportLogs.some((row) => {
    const metadata = metadataObject(row.metadata);
    return (
      metadataString(metadata, "reportType") === "assignments" &&
      metadataObject(metadata?.filters)?.sessionId === fixture.sessionId
    );
  });
  const hasAttendanceReportLog = reportLogs.some((row) => {
    const metadata = metadataObject(row.metadata);
    return (
      metadataString(metadata, "reportType") === "attendance" &&
      metadataObject(metadata?.filters)?.sessionId === fixture.sessionId
    );
  });
  const hasEvaluationsReportLog = reportLogs.some((row) => {
    const metadata = metadataObject(row.metadata);
    return (
      metadataString(metadata, "reportType") === "evaluations" &&
      metadataObject(metadata?.filters)?.sessionId === fixture.sessionId
    );
  });
  const hasAssignmentsExportLog = exportLogs.some((row) => {
    const metadata = metadataObject(row.metadata);
    return (
      metadataString(metadata, "exportType") === "assignments" &&
      metadataString(metadata, "sessionId") === fixture.sessionId
    );
  });
  const hasAttendanceExportLog = exportLogs.some((row) => {
    const metadata = metadataObject(row.metadata);
    return (
      metadataString(metadata, "exportType") === "attendance" &&
      metadataString(metadata, "sessionId") === fixture.sessionId
    );
  });

  expect(hasAssignmentsReportLog, "Assignments report view log is missing.");
  expect(hasAttendanceReportLog, "Attendance report view log is missing.");
  expect(hasEvaluationsReportLog, "Evaluations report view log is missing.");
  expect(hasAssignmentsExportLog, "Assignments export log is missing.");
  expect(hasAttendanceExportLog, "Attendance export log is missing.");

  console.log("Phase 8 Step 4 verification passed.");
  console.log(
    JSON.stringify(
      {
        validQueries: "passed",
        invalidQueryRejection: "passed",
        emptyDataHandling: "passed",
        aggregationCorrectness: "passed",
        activityLogs: "passed",
        uiRenderingEnAr: "passed"
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

      for (const evaluationId of fixture.createdEvaluationIds) {
        await tx.$executeRawUnsafe(
          "DELETE FROM evaluations WHERE id = $1::uuid",
          evaluationId
        );
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
