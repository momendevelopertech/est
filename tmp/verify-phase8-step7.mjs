import assert from "node:assert/strict";
import fs from "node:fs";

import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const baseUrl = process.env.EXAMOPS_BASE_URL ?? "http://127.0.0.1:4010";
const adminEmail = process.env.EXAMOPS_ADMIN_EMAIL ?? "admin@examops.local";
const adminPassword =
  process.env.EXAMOPS_ADMIN_PASSWORD ??
  process.env.SEED_APP_USERS_PASSWORD ??
  "ChangeMe123!";

const enMessages = JSON.parse(fs.readFileSync("src/locales/en.json", "utf8"));
const arMessages = JSON.parse(fs.readFileSync("src/locales/ar.json", "utf8"));

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
    throw new Error("Could not authenticate admin user for Step 7 verification.");
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

  throw new Error("Could not create unique session for Step 7 verification.");
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
      code: `STEP7-${seed}`,
      name: `Step7 Cycle ${seed}`,
      nameEn: `Step7 Cycle ${seed}`,
      status: "ACTIVE",
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
  expect(building, "No active building found for Step 7 verification.");

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

  const session = await createSessionWithRetry({
    cycleId: cycle.id,
    name: `STEP7_SESSION_${seed}`,
    nameEn: `Step7 Session ${seed}`,
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
      name: `Step7 User A ${seed}`,
      nameEn: `Step7 User A ${seed}`,
      phone: `20185${suffix}`,
      source: "EXTERNAL",
      averageRating: 4.6,
      totalSessions: 8,
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
      name: `Step7 User B ${seed}`,
      nameEn: `Step7 User B ${seed}`,
      phone: `20186${suffix}`,
      source: "EXTERNAL",
      averageRating: 3.7,
      totalSessions: 4,
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

  const evaluationA = await prisma.evaluation.create({
    data: {
      sessionId: session.id,
      subjectUserId: userA.id,
      evaluatorAppUserId: adminAppUserId,
      score: new Prisma.Decimal("4.35"),
      notes: "Step 7 verification evaluation"
    },
    select: {
      id: true
    }
  });
  createdEvaluationIds.push(evaluationA.id);

  return {
    cycleId: cycle.id,
    sessionId: session.id,
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
  const sessionCookie = await loginAndGetCookie();
  const scriptStartedAt = new Date();

  const metricsSessions = await getJson({
    cookie: sessionCookie,
    path: "/api/metrics/sessions?locale=en"
  });
  assert.equal(metricsSessions.response.status, 200);
  assert.equal(metricsSessions.body.ok, true);

  const metricsAssignments = await getJson({
    cookie: sessionCookie,
    path: "/api/metrics/assignments?locale=en"
  });
  assert.equal(metricsAssignments.response.status, 200);
  assert.equal(metricsAssignments.body.ok, true);

  const metricsAttendance = await getJson({
    cookie: sessionCookie,
    path: "/api/metrics/attendance?locale=en"
  });
  assert.equal(metricsAttendance.response.status, 200);
  assert.equal(metricsAttendance.body.ok, true);

  const assignmentsReport = await getJson({
    cookie: sessionCookie,
    path: `/api/reports/assignments?sessionId=${fixture.sessionId}&locale=en`
  });
  assert.equal(assignmentsReport.response.status, 200);
  assert.equal(assignmentsReport.body.ok, true);
  expect(
    assignmentsReport.body.data?.exportOptions?.csv?.includes(
      "/api/export/assignments"
    ),
    "Assignments report should expose CSV export link."
  );
  expect(
    assignmentsReport.body.data?.exportOptions?.excel?.includes("format=excel"),
    "Assignments report should expose Excel export link."
  );
  expect(
    assignmentsReport.body.data?.exportOptions?.pdf?.includes("format=pdf"),
    "Assignments report should expose PDF export link."
  );

  const evaluationsReport = await getJson({
    cookie: sessionCookie,
    path: `/api/reports/evaluations?sessionId=${fixture.sessionId}&locale=en`
  });
  assert.equal(evaluationsReport.response.status, 200);
  assert.equal(evaluationsReport.body.ok, true);
  expect(
    evaluationsReport.body.data?.exportOptions?.pdf?.includes(
      "/api/export/evaluations"
    ),
    "Evaluations report should expose PDF export link."
  );

  const dashboardEn = await getHtml({
    cookie: `${sessionCookie}; examops_locale=en`,
    path: "/dashboard"
  });
  assert.equal(dashboardEn.response.status, 200);
  expect(
    dashboardEn.text.includes(enMessages.dashboard.title),
    "English dashboard should render localized title."
  );
  expect(
    dashboardEn.text.includes(enMessages.dashboard.workspace.sections.quickActionsTitle),
    "English dashboard should render premium quick-actions section."
  );

  const dashboardAr = await getHtml({
    cookie: `${sessionCookie}; examops_locale=ar`,
    path: "/dashboard"
  });
  assert.equal(dashboardAr.response.status, 200);
  expect(
    dashboardAr.text.includes(arMessages.dashboard.title),
    "Arabic dashboard should render localized title."
  );
  expect(
    dashboardAr.text.includes(arMessages.dashboard.workspace.sections.quickActionsTitle),
    "Arabic dashboard should render localized premium section copy."
  );

  const reportsHubEn = await getHtml({
    cookie: `${sessionCookie}; examops_locale=en`,
    path: "/reports"
  });
  assert.equal(reportsHubEn.response.status, 200);
  expect(
    reportsHubEn.text.includes("/reports/assignments"),
    "Reports hub should link to assignments report."
  );

  const dashboardDark = await getHtml({
    cookie: `${sessionCookie}; examops_locale=en; examops_theme=dark`,
    path: "/dashboard"
  });
  assert.equal(dashboardDark.response.status, 200);
  expect(
    dashboardDark.text.includes("dark"),
    "Dashboard HTML should reflect dark theme class resolution."
  );

  const reportAssignmentsEn = await getHtml({
    cookie: `${sessionCookie}; examops_locale=en`,
    path: "/reports/assignments"
  });
  assert.equal(reportAssignmentsEn.response.status, 200);
  expect(
    reportAssignmentsEn.text.includes(enMessages.reports.pages.assignments.title),
    "English assignments report page should render localized title."
  );
  expect(
    reportAssignmentsEn.text.includes(enMessages.reports.workspace.exportTitle),
    "English report workspace should render export panel copy."
  );

  const reportAssignmentsAr = await getHtml({
    cookie: `${sessionCookie}; examops_locale=ar`,
    path: "/reports/assignments"
  });
  assert.equal(reportAssignmentsAr.response.status, 200);
  expect(
    reportAssignmentsAr.text.includes(arMessages.reports.pages.assignments.title),
    "Arabic assignments report page should render localized title."
  );
  expect(
    reportAssignmentsAr.text.includes(arMessages.reports.workspace.exportTitle),
    "Arabic report workspace should render localized export copy."
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
  createdLogIds = reportLogs.map((log) => log.id);

  const hasReportExportOptions = reportLogs.some((log) => {
    const metadata = metadataObject(log.metadata);
    const options = metadataObject(metadata?.exportOptions);
    return (
      metadataString(metadata, "reportType") === "assignments" &&
      typeof options?.pdf === "string" &&
      typeof options?.excel === "string"
    );
  });
  expect(
    hasReportExportOptions,
    "Report view logs should include export options metadata."
  );

  console.log("Phase 8 Step 7 verification passed.");
  console.log(
    JSON.stringify(
      {
        dashboardPremiumLayout: "passed",
        localizedViewsEnAr: "passed",
        metricsAndReportsLinks: "passed",
        themeRendering: "passed",
        reportMetadataLogging: "passed"
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

      if (fixture.createdEvaluationIds.length > 0) {
        await tx.evaluation.deleteMany({
          where: {
            id: {
              in: fixture.createdEvaluationIds
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
    });
  }

  await prisma.$disconnect();
}
