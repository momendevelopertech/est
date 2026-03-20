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
    throw new Error("Could not authenticate admin user for Step 5 verification.");
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

  throw new Error("Could not create unique session for Step 5 verification.");
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
      code: `STEP5-${seed}`,
      name: `Step5 Cycle ${seed}`,
      nameEn: `Step5 Cycle ${seed}`,
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
  expect(building, "No active building found for Step 5 verification.");

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
    name: `STEP5_SESSION_${seed}`,
    nameEn: `Step5 Session ${seed}`,
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
      name: `Step5 User A ${seed}`,
      nameEn: `Step5 User A ${seed}`,
      phone: `20181${suffix}`,
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
      name: `Step5 User B ${seed}`,
      nameEn: `Step5 User B ${seed}`,
      phone: `20182${suffix}`,
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
      score: new Prisma.Decimal("4.75"),
      notes: "Step 5 verification evaluation"
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

async function downloadPdf({ cookie, path }) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Accept: "application/pdf",
      Cookie: cookie
    }
  });
  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  return {
    response,
    bytes,
    text: new TextDecoder().decode(bytes)
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

  fixture = await createFixture(adminUser.id);
  const cookie = await loginAndGetCookie();
  const scriptStartedAt = new Date();

  const assignmentsPdf = await downloadPdf({
    cookie,
    path: `/api/export/assignments?sessionId=${fixture.sessionId}&format=pdf&locale=en`
  });
  if (assignmentsPdf.response.status !== 200) {
    console.error("assignments pdf response", assignmentsPdf.response.status, assignmentsPdf.text);
  }
  assert.equal(assignmentsPdf.response.status, 200);
  expect(
    assignmentsPdf.response.headers.get("content-type")?.includes("application/pdf"),
    "Assignments PDF export should return application/pdf."
  );
  assert.equal(assignmentsPdf.response.headers.get("x-export-format"), "pdf");
  expect(
    Buffer.from(assignmentsPdf.bytes).toString("utf8", 0, 5) === "%PDF-",
    "Assignments export content should start with %PDF- signature."
  );

  const attendancePdf = await downloadPdf({
    cookie,
    path: `/api/export/attendance?sessionId=${fixture.sessionId}&format=pdf&locale=ar`
  });
  if (attendancePdf.response.status !== 200) {
    console.error("attendance pdf response", attendancePdf.response.status, attendancePdf.text);
  }
  assert.equal(attendancePdf.response.status, 200);
  expect(
    attendancePdf.response.headers.get("content-type")?.includes("application/pdf"),
    "Attendance PDF export should return application/pdf."
  );
  assert.equal(attendancePdf.response.headers.get("x-export-format"), "pdf");
  expect(
    Buffer.from(attendancePdf.bytes).toString("utf8", 0, 5) === "%PDF-",
    "Attendance export content should start with %PDF- signature."
  );

  const evaluationsPdf = await downloadPdf({
    cookie,
    path: `/api/export/evaluations?sessionId=${fixture.sessionId}&format=pdf&locale=en`
  });
  if (evaluationsPdf.response.status !== 200) {
    console.error("evaluations pdf response", evaluationsPdf.response.status, evaluationsPdf.text);
  }
  assert.equal(evaluationsPdf.response.status, 200);
  expect(
    evaluationsPdf.response.headers.get("content-type")?.includes("application/pdf"),
    "Evaluations PDF export should return application/pdf."
  );
  assert.equal(evaluationsPdf.response.headers.get("x-export-format"), "pdf");
  expect(
    Buffer.from(evaluationsPdf.bytes).toString("utf8", 0, 5) === "%PDF-",
    "Evaluations export content should start with %PDF- signature."
  );

  const reportResponse = await fetch(
    `${baseUrl}/api/reports/evaluations?sessionId=${fixture.sessionId}&locale=en`,
    {
      headers: {
        Accept: "application/json",
        Cookie: cookie
      }
    }
  );
  const reportBody = await reportResponse.json();
  assert.equal(reportResponse.status, 200);
  assert.equal(reportBody.ok, true);
  expect(
    reportBody.data?.exportOptions?.pdf?.includes("/api/export/evaluations"),
    "Evaluations report should expose PDF export link."
  );

  const invalidSessionResponse = await fetch(
    `${baseUrl}/api/export/evaluations?sessionId=00000000-0000-0000-0000-000000000000&format=pdf`,
    {
      headers: {
        Accept: "application/json",
        Cookie: cookie
      }
    }
  );
  const invalidSessionBody = await invalidSessionResponse.json();
  assert.equal(invalidSessionResponse.status, 404);
  assert.equal(invalidSessionBody.ok, false);
  assert.equal(invalidSessionBody.error, "session_not_found");

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

  const hasAssignmentsPdfLog = exportLogs.some((log) => {
    const metadata = metadataObject(log.metadata);
    return (
      metadataString(metadata, "exportType") === "assignments" &&
      metadataString(metadata, "sessionId") === fixture.sessionId &&
      metadataString(metadata, "format") === "pdf"
    );
  });
  const hasAttendancePdfLog = exportLogs.some((log) => {
    const metadata = metadataObject(log.metadata);
    return (
      metadataString(metadata, "exportType") === "attendance" &&
      metadataString(metadata, "sessionId") === fixture.sessionId &&
      metadataString(metadata, "format") === "pdf"
    );
  });
  const hasEvaluationsPdfLog = exportLogs.some((log) => {
    const metadata = metadataObject(log.metadata);
    return (
      metadataString(metadata, "exportType") === "evaluations" &&
      metadataString(metadata, "sessionId") === fixture.sessionId &&
      metadataString(metadata, "format") === "pdf"
    );
  });

  expect(hasAssignmentsPdfLog, "Assignments PDF export log is missing.");
  expect(hasAttendancePdfLog, "Attendance PDF export log is missing.");
  expect(hasEvaluationsPdfLog, "Evaluations PDF export log is missing.");

  console.log("Phase 8 Step 5 verification passed.");
  console.log(
    JSON.stringify(
      {
        pdfExports: "passed",
        reportPdfLinks: "passed",
        invalidSessionRejection: "passed",
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
