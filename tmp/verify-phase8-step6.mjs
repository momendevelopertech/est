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

function decodeXmlText(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

function parseSpreadsheetRows(xmlText) {
  const rowMatches = [...xmlText.matchAll(/<Row>([\s\S]*?)<\/Row>/g)];

  return rowMatches.map((rowMatch) => {
    const rowBody = rowMatch[1];
    const cellMatches = [...rowBody.matchAll(/<Data ss:Type=\"String\">([\s\S]*?)<\/Data>/g)];
    return cellMatches.map((cellMatch) => decodeXmlText(cellMatch[1]));
  });
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
    throw new Error("Could not authenticate admin user for Step 6 verification.");
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

  throw new Error("Could not create unique session for Step 6 verification.");
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
      code: `STEP6-${seed}`,
      name: `Step6 Cycle ${seed}`,
      nameEn: `Step6 Cycle ${seed}`,
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
  expect(building, "No active building found for Step 6 verification.");

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
    name: `STEP6_SESSION_${seed}`,
    nameEn: `Step6 Session ${seed}`,
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
      name: `Step6 User A ${seed}`,
      nameEn: `Step6 User A ${seed}`,
      phone: `20183${suffix}`,
      source: "EXTERNAL",
      averageRating: 4.4,
      totalSessions: 7,
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
      name: `Step6 User B ${seed}`,
      nameEn: `Step6 User B ${seed}`,
      phone: `20184${suffix}`,
      source: "EXTERNAL",
      averageRating: 3.9,
      totalSessions: 5,
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
      score: new Prisma.Decimal("4.25"),
      notes: "Step 6 verification evaluation"
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

async function downloadExcel({ cookie, path }) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Accept: "application/vnd.ms-excel",
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

  const assignmentsExcel = await downloadExcel({
    cookie,
    path: `/api/export/assignments?sessionId=${fixture.sessionId}&format=excel&locale=en`
  });
  assert.equal(assignmentsExcel.response.status, 200);
  expect(
    assignmentsExcel.response.headers
      .get("content-type")
      ?.includes("application/vnd.ms-excel"),
    "Assignments export should return Excel content type."
  );
  const assignmentsRows = parseSpreadsheetRows(assignmentsExcel.text);
  expect(assignmentsRows.length >= 3, "Assignments Excel should include headers + data.");
  assert.equal(assignmentsRows[0][0], "معرف التكليف");
  assert.equal(assignmentsRows[1][0], "Assignment ID");

  const attendanceExcel = await downloadExcel({
    cookie,
    path: `/api/export/attendance?sessionId=${fixture.sessionId}&format=excel&locale=en`
  });
  assert.equal(attendanceExcel.response.status, 200);
  const attendanceRows = parseSpreadsheetRows(attendanceExcel.text);
  expect(attendanceRows.length >= 3, "Attendance Excel should include headers + data.");
  assert.equal(attendanceRows[0][0], "معرف التكليف");
  assert.equal(attendanceRows[1][0], "Assignment ID");
  assert.equal(attendanceRows[0][17], "حالة الحضور");
  assert.equal(attendanceRows[1][17], "Attendance Status");

  const evaluationsExcel = await downloadExcel({
    cookie,
    path: `/api/export/evaluations?sessionId=${fixture.sessionId}&format=excel&locale=en`
  });
  assert.equal(evaluationsExcel.response.status, 200);
  const evaluationsRows = parseSpreadsheetRows(evaluationsExcel.text);
  expect(evaluationsRows.length >= 3, "Evaluations Excel should include headers + data.");
  assert.equal(evaluationsRows[0][0], "معرف التقييم");
  assert.equal(evaluationsRows[1][0], "Evaluation ID");

  const proctorsExcel = await downloadExcel({
    cookie,
    path: "/api/proctors/export?format=excel&status=all&locale=en"
  });
  assert.equal(proctorsExcel.response.status, 200);
  const proctorRows = parseSpreadsheetRows(proctorsExcel.text);
  expect(proctorRows.length >= 2, "Proctors Excel should include bilingual header rows.");
  assert.equal(proctorRows[1][0], "Name");
  expect(
    proctorRows[0][0] !== proctorRows[1][0],
    "Proctors Excel should expose different Arabic/English header rows."
  );

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
  createdLogIds = exportLogs.map((log) => log.id);

  const hasAssignmentsExcelLog = exportLogs.some((log) => {
    const metadata = metadataObject(log.metadata);
    return (
      metadataString(metadata, "exportType") === "assignments" &&
      metadataString(metadata, "sessionId") === fixture.sessionId &&
      metadataString(metadata, "format") === "excel"
    );
  });
  const hasAttendanceExcelLog = exportLogs.some((log) => {
    const metadata = metadataObject(log.metadata);
    return (
      metadataString(metadata, "exportType") === "attendance" &&
      metadataString(metadata, "sessionId") === fixture.sessionId &&
      metadataString(metadata, "format") === "excel"
    );
  });
  const hasEvaluationsExcelLog = exportLogs.some((log) => {
    const metadata = metadataObject(log.metadata);
    return (
      metadataString(metadata, "exportType") === "evaluations" &&
      metadataString(metadata, "sessionId") === fixture.sessionId &&
      metadataString(metadata, "format") === "excel"
    );
  });

  expect(hasAssignmentsExcelLog, "Assignments Excel export log is missing.");
  expect(hasAttendanceExcelLog, "Attendance Excel export log is missing.");
  expect(hasEvaluationsExcelLog, "Evaluations Excel export log is missing.");

  console.log("Phase 8 Step 6 verification passed.");
  console.log(
    JSON.stringify(
      {
        bilingualExcelHeaders: "passed",
        endpointsCovered: "assignments_attendance_evaluations_proctors",
        excelActivityLogs: "passed"
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
