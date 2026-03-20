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

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (character === "\"") {
      if (inQuotes && next === "\"") {
        field += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }

      continue;
    }

    if (character === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && next === "\n") {
        index += 1;
      }

      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += character;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows
    .map((currentRow) => currentRow.map((value) => value.replace(/\uFEFF/g, "")))
    .filter((currentRow) => currentRow.some((value) => value.trim().length > 0));
}

function toSessionDate(baseDate) {
  const date = new Date(baseDate);
  date.setHours(0, 0, 0, 0);
  return date;
}

function metadataString(metadata, key) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  return typeof metadata[key] === "string" ? metadata[key] : null;
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
    throw new Error("Could not authenticate admin user for Step 2 verification.");
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
          status: input.status ?? "COMPLETED",
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
  const createdAssignmentIds = [];
  const createdAttendanceIds = [];

  const cycleSeed = Date.now();
  const now = new Date();
  const cycleStartDate = toSessionDate(addDays(now, -5));
  const cycleEndDate = toSessionDate(addDays(now, 20));
  const dataStart = addDays(now, -2);
  dataStart.setHours(9, 0, 0, 0);
  const dataEnd = new Date(dataStart.getTime() + 2 * 60 * 60 * 1000);
  const emptyStart = addDays(now, -1);
  emptyStart.setHours(9, 0, 0, 0);
  const emptyEnd = new Date(emptyStart.getTime() + 2 * 60 * 60 * 1000);

  const cycle = await prisma.cycle.create({
    data: {
      code: `EXP-${cycleSeed}`,
      name: `Export Verify ${cycleSeed}`,
      nameEn: `Export Verify ${cycleSeed}`,
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
  expect(building, "No active building is available for export verification.");

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

  const sessionData = await createSessionWithRetry({
    cycleId: cycle.id,
    name: `EXPORT_DATA_${cycleSeed}`,
    nameEn: `Export Data ${cycleSeed}`,
    baseSessionDate: addDays(now, -2),
    baseStartsAt: dataStart,
    baseEndsAt: dataEnd,
    status: "COMPLETED"
  });
  createdSessionIds.push(sessionData.id);

  const sessionEmpty = await createSessionWithRetry({
    cycleId: cycle.id,
    name: `EXPORT_EMPTY_${cycleSeed}`,
    nameEn: `Export Empty ${cycleSeed}`,
    baseSessionDate: addDays(now, -1),
    baseStartsAt: emptyStart,
    baseEndsAt: emptyEnd,
    status: "COMPLETED"
  });
  createdSessionIds.push(sessionEmpty.id);

  for (const sessionId of [sessionData.id, sessionEmpty.id]) {
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
  const user1 = await prisma.user.create({
    data: {
      name: `Export User A ${userSeed}`,
      nameEn: `Export User A ${userSeed}`,
      phone: `20171${userSeed.slice(-6)}`,
      source: "EXTERNAL",
      averageRating: 4.2,
      totalSessions: 4,
      blockStatus: "CLEAR",
      isActive: true
    },
    select: {
      id: true
    }
  });
  createdUserIds.push(user1.id);

  const user2 = await prisma.user.create({
    data: {
      name: `Export User B ${userSeed}`,
      nameEn: `Export User B ${userSeed}`,
      phone: `20172${userSeed.slice(-6)}`,
      source: "EXTERNAL",
      averageRating: 3.7,
      totalSessions: 2,
      blockStatus: "CLEAR",
      isActive: true
    },
    select: {
      id: true
    }
  });
  createdUserIds.push(user2.id);

  const assignment1 = await prisma.assignment.create({
    data: {
      sessionId: sessionData.id,
      userId: user1.id,
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
  createdAssignmentIds.push(assignment1.id);

  const assignment2 = await prisma.assignment.create({
    data: {
      sessionId: sessionData.id,
      userId: user2.id,
      buildingId: building.id,
      roleDefinitionId: roleDefinition.id,
      status: "DRAFT",
      assignedMethod: "AUTO",
      isManualOverride: false
    },
    select: {
      id: true
    }
  });
  createdAssignmentIds.push(assignment2.id);

  const attendance1 = await prisma.attendance.create({
    data: {
      assignmentId: assignment1.id,
      status: "CONFIRMED",
      checkedInAt: addDays(now, -2)
    },
    select: {
      id: true
    }
  });
  createdAttendanceIds.push(attendance1.id);

  const attendance2 = await prisma.attendance.create({
    data: {
      assignmentId: assignment2.id,
      status: "ABSENT"
    },
    select: {
      id: true
    }
  });
  createdAttendanceIds.push(attendance2.id);

  return {
    cycleId: cycle.id,
    sessionDataId: sessionData.id,
    sessionEmptyId: sessionEmpty.id,
    expectedAssignmentIds: [assignment1.id, assignment2.id],
    createdUserIds,
    createdSessionIds,
    createdSessionBuildingIds,
    createdAssignmentIds,
    createdAttendanceIds
  };
}

async function downloadExport({ cookie, path, sessionId }) {
  const response = await fetch(`${baseUrl}${path}?sessionId=${sessionId}`, {
    headers: {
      Accept: "text/csv",
      Cookie: cookie
    }
  });

  const contentType = response.headers.get("content-type");
  const contentDisposition = response.headers.get("content-disposition");
  const text = await response.text();

  return {
    status: response.status,
    contentType,
    contentDisposition,
    text
  };
}

async function verify() {
  const scriptStartedAt = new Date();
  const fixture = await createFixture();

  const adminUser = await prisma.appUser.findUnique({
    where: {
      email: adminEmail
    },
    select: {
      id: true
    }
  });
  expect(adminUser, `Admin app user not found for email ${adminEmail}.`);

  try {
    const cookie = await loginAndGetCookie();

    const assignmentsExport = await downloadExport({
      cookie,
      path: "/api/export/assignments",
      sessionId: fixture.sessionDataId
    });
    assert.equal(assignmentsExport.status, 200, "Assignments export should return 200.");
    expect(
      assignmentsExport.contentType?.includes("text/csv"),
      "Assignments export should return CSV content type."
    );
    expect(
      assignmentsExport.contentDisposition?.includes("attachment;"),
      "Assignments export should be downloadable as attachment."
    );

    const assignmentRows = parseCsvRows(assignmentsExport.text);
    expect(assignmentRows.length >= 1, "Assignments export should include at least header row.");
    const assignmentHeader = assignmentRows[0];
    expect(
      assignmentHeader.includes("Assignment ID / معرف التكليف"),
      "Assignments export header is missing assignment ID column."
    );
    expect(
      assignmentHeader.includes("Session Name (AR) / اسم الجلسة (عربي)"),
      "Assignments export header is missing bilingual session column."
    );
    assert.equal(
      assignmentRows.length,
      1 + fixture.expectedAssignmentIds.length,
      "Assignments export should contain one row per fixture assignment."
    );

    const assignmentIdColumn = assignmentHeader.indexOf("Assignment ID / معرف التكليف");
    expect(assignmentIdColumn >= 0, "Assignment ID header index is missing.");
    const assignmentIds = assignmentRows.slice(1).map((row) => row[assignmentIdColumn]);
    const uniqueAssignmentIds = new Set(assignmentIds);
    assert.equal(
      uniqueAssignmentIds.size,
      assignmentIds.length,
      "Assignments export must not contain duplicate rows."
    );
    for (const expectedAssignmentId of fixture.expectedAssignmentIds) {
      expect(
        uniqueAssignmentIds.has(expectedAssignmentId),
        `Assignment ${expectedAssignmentId} is missing from assignments export.`
      );
    }

    const attendanceExport = await downloadExport({
      cookie,
      path: "/api/export/attendance",
      sessionId: fixture.sessionDataId
    });
    assert.equal(attendanceExport.status, 200, "Attendance export should return 200.");
    expect(
      attendanceExport.contentType?.includes("text/csv"),
      "Attendance export should return CSV content type."
    );

    const attendanceRows = parseCsvRows(attendanceExport.text);
    const attendanceHeader = attendanceRows[0];
    expect(
      attendanceHeader.includes("Attendance Status / حالة الحضور"),
      "Attendance export header is missing attendance status column."
    );
    assert.equal(
      attendanceRows.length,
      1 + fixture.expectedAssignmentIds.length,
      "Attendance export should contain one row per fixture assignment."
    );

    const attendanceAssignmentIdColumn = attendanceHeader.indexOf(
      "Assignment ID / معرف التكليف"
    );
    expect(
      attendanceAssignmentIdColumn >= 0,
      "Attendance export assignment ID column is missing."
    );
    const attendanceAssignmentIds = attendanceRows
      .slice(1)
      .map((row) => row[attendanceAssignmentIdColumn]);
    const uniqueAttendanceAssignmentIds = new Set(attendanceAssignmentIds);
    assert.equal(
      uniqueAttendanceAssignmentIds.size,
      attendanceAssignmentIds.length,
      "Attendance export must not contain duplicate assignment rows."
    );

    const attendanceStatusColumn = attendanceHeader.indexOf(
      "Attendance Status / حالة الحضور"
    );
    expect(attendanceStatusColumn >= 0, "Attendance status column index is missing.");
    const exportedStatuses = attendanceRows
      .slice(1)
      .map((row) => row[attendanceStatusColumn]);
    expect(
      exportedStatuses.some((status) => status.includes("Confirmed")),
      "Attendance export must include confirmed status label."
    );
    expect(
      exportedStatuses.some((status) => status.includes("Absent")),
      "Attendance export must include absent status label."
    );

    const emptyExport = await downloadExport({
      cookie,
      path: "/api/export/assignments",
      sessionId: fixture.sessionEmptyId
    });
    assert.equal(emptyExport.status, 200, "Empty-session export should still return 200.");
    const emptyRows = parseCsvRows(emptyExport.text);
    assert.equal(emptyRows.length, 1, "Empty-session export should only contain header row.");

    const invalidSessionId = randomUUID();
    const invalidResponse = await fetch(
      `${baseUrl}/api/export/assignments?sessionId=${invalidSessionId}`,
      {
        headers: {
          Accept: "application/json",
          Cookie: cookie
        }
      }
    );
    const invalidBody = await invalidResponse.json();
    assert.equal(
      invalidResponse.status,
      404,
      "Invalid session export should return not found."
    );
    assert.equal(invalidBody.ok, false, "Invalid session export response should not be ok.");
    assert.equal(
      invalidBody.error,
      "session_not_found",
      "Invalid session export should return session_not_found."
    );

    const logs = await prisma.activityLog.findMany({
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

    const assignmentLog = logs.find((log) => {
      const metadataSessionId = metadataString(log.metadata, "sessionId");
      const metadataExportType = metadataString(log.metadata, "exportType");

      return (
        metadataSessionId === fixture.sessionDataId &&
        metadataExportType === "assignments"
      );
    });
    const attendanceLog = logs.find((log) => {
      const metadataSessionId = metadataString(log.metadata, "sessionId");
      const metadataExportType = metadataString(log.metadata, "exportType");

      return (
        metadataSessionId === fixture.sessionDataId &&
        metadataExportType === "attendance"
      );
    });
    const emptySessionLog = logs.find((log) => {
      const metadataSessionId = metadataString(log.metadata, "sessionId");
      const metadataExportType = metadataString(log.metadata, "exportType");

      return (
        metadataSessionId === fixture.sessionEmptyId &&
        metadataExportType === "assignments"
      );
    });
    expect(assignmentLog, "Assignments export activity log is missing.");
    expect(attendanceLog, "Attendance export activity log is missing.");
    expect(emptySessionLog, "Empty-session export activity log is missing.");

    const createdLogIds = logs.map((log) => log.id);

    console.log("Phase 8 Step 2 verification passed.");
    console.log(
      JSON.stringify(
        {
          validExport: "passed",
          invalidSession: "passed",
          emptyDataCase: "passed",
          structureValidation: "passed",
          noDuplicates: "passed",
          loggingCreated: "passed"
        },
        null,
        2
      )
    );

    return {
      fixture,
      createdLogIds
    };
  } catch (error) {
    throw error;
  }
}

const { fixture, createdLogIds } = await verify();

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
});

await prisma.$disconnect();
