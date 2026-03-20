import fs from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

const baseUrl = "http://127.0.0.1:3105";
const millisecondsPerDay = 24 * 60 * 60 * 1000;
const loginPayload = {
  email: "admin@examops.local",
  password: process.env.SEED_APP_USERS_PASSWORD || "ChangeMe123!"
};

function ensure(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const raw = fs.readFileSync(envPath, "utf8");

  for (const line of raw.split(/\r?\n/g)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = value.replace(/^"|"$/g, "");
  }
}

function formatCookie(headers) {
  const raw = headers.get("set-cookie");

  if (!raw) {
    return null;
  }

  return raw
    .split(",")
    .map((item) => item.split(";")[0])
    .join("; ");
}

async function request(pathname, options = {}, cookie) {
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  if (cookie) {
    headers.set("Cookie", cookie);
  }

  try {
    const response = await fetch(`${baseUrl}${pathname}`, {
      ...options,
      headers,
      signal: controller.signal
    });

    const text = await response.text();
    let body = null;

    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = {
        raw: text
      };
    }

    return {
      response,
      body
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function safeRequest(pathname, options, cookie) {
  try {
    await request(pathname, options, cookie);
  } catch {
    // ignore cleanup failure
  }
}

function buildJsonRequest(body) {
  return {
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  };
}

function normalizeDateOnly(value) {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date, days) {
  return new Date(date.getTime() + days * millisecondsPerDay);
}

function toDateOnly(value) {
  return value.toISOString().slice(0, 10);
}

function getShiftDays(sourceDateTime, targetDateTime) {
  return Math.round(
    (new Date(targetDateTime).getTime() - new Date(sourceDateTime).getTime()) / millisecondsPerDay
  );
}

async function run() {
  loadEnvFile();
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });

  const cleanup = {
    assignmentIds: [],
    createdUserIds: [],
    createdRoleDefinitionIds: [],
    sessionIds: [],
    cycleIds: []
  };

  try {
    const loginForm = new URLSearchParams();
    loginForm.set("email", loginPayload.email);
    loginForm.set("password", loginPayload.password);
    loginForm.set("redirectTo", "/dashboard");
    loginForm.set("locale", "en");

    const loginResponse = await request(
      "/api/auth/login",
      {
        method: "POST",
        redirect: "manual",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: loginForm.toString()
      },
      null
    );

    ensure(
      loginResponse.response.status === 303,
      `Login failed: ${loginResponse.response.status} ${JSON.stringify(loginResponse.body)}`
    );
    const cookie = formatCookie(loginResponse.response.headers);
    ensure(cookie, "Missing auth cookie after login");

    const now = Date.now();

    const buildingsResponse = await request(
      "/api/locations/buildings?includeInactive=false&page=1&pageSize=10",
      {
        method: "GET"
      },
      cookie
    );
    ensure(buildingsResponse.response.ok, `List buildings failed: ${JSON.stringify(buildingsResponse.body)}`);
    const firstBuilding = buildingsResponse.body?.data?.[0];
    ensure(firstBuilding?.id, "Missing active building for clone verification");

    const baseDate = new Date(Date.UTC(2200 + (now % 40), 0, 1));
    const sourceStartDate = toDateOnly(addDays(baseDate, 0));
    const sourceEndDate = toDateOnly(addDays(baseDate, 4));
    const cloneStartDate = toDateOnly(addDays(baseDate, 31));
    const cloneEndDate = toDateOnly(addDays(baseDate, 35));
    const sourceSessionBDate = toDateOnly(addDays(baseDate, 1));
    const sourceSessionCDate = toDateOnly(addDays(baseDate, 2));
    const conflictSourceStartDate = toDateOnly(addDays(baseDate, 70));
    const conflictSourceEndDate = toDateOnly(addDays(baseDate, 71));
    const blockingTargetStartDate = toDateOnly(addDays(baseDate, 100));
    const blockingTargetEndDate = toDateOnly(addDays(baseDate, 101));
    const expectedShiftDays = Math.round(
      (normalizeDateOnly(cloneStartDate).getTime() - normalizeDateOnly(sourceStartDate).getTime()) /
        millisecondsPerDay
    );

    const sourceCycleResponse = await request(
      "/api/cycles",
      {
        method: "POST",
        ...buildJsonRequest({
          code: `CLONE-SRC-${now}`,
          name: `Clone Source ${now}`,
          nameEn: `Clone Source EN ${now}`,
          status: "ACTIVE",
          startDate: sourceStartDate,
          endDate: sourceEndDate,
          notes: "Clone foundation verification source"
        })
      },
      cookie
    );
    ensure(sourceCycleResponse.response.ok, `Create source cycle failed: ${JSON.stringify(sourceCycleResponse.body)}`);
    const sourceCycleId = sourceCycleResponse.body?.data?.id;
    ensure(sourceCycleId, "Source cycle id missing");
    cleanup.cycleIds.push(sourceCycleId);

    const sourceSessionAResponse = await request(
      "/api/sessions",
      {
        method: "POST",
        ...buildJsonRequest({
          cycleId: sourceCycleId,
          name: `Clone Session A ${now}`,
          nameEn: `Clone Session A EN ${now}`,
          examType: "EST1",
          startDateTime: `${sourceStartDate}T09:00:00+02:00`,
          endDateTime: `${sourceStartDate}T11:00:00+02:00`,
          buildingIds: [firstBuilding.id],
          notes: "Source session A"
        })
      },
      cookie
    );
    ensure(sourceSessionAResponse.response.ok, `Create source session A failed: ${JSON.stringify(sourceSessionAResponse.body)}`);
    const sourceSessionA = sourceSessionAResponse.body?.data;
    ensure(sourceSessionA?.id, "Source session A id missing");
    cleanup.sessionIds.push(sourceSessionA.id);

    const sourceSessionBResponse = await request(
      "/api/sessions",
      {
        method: "POST",
        ...buildJsonRequest({
          cycleId: sourceCycleId,
          name: `Clone Session B ${now}`,
          nameEn: `Clone Session B EN ${now}`,
          examType: "EST2",
          startDateTime: `${sourceSessionBDate}T12:00:00+02:00`,
          endDateTime: `${sourceSessionBDate}T14:00:00+02:00`,
          buildingIds: [firstBuilding.id],
          notes: "Source session B"
        })
      },
      cookie
    );
    ensure(sourceSessionBResponse.response.ok, `Create source session B failed: ${JSON.stringify(sourceSessionBResponse.body)}`);
    const sourceSessionB = sourceSessionBResponse.body?.data;
    ensure(sourceSessionB?.id, "Source session B id missing");
    cleanup.sessionIds.push(sourceSessionB.id);

    const sourceSessionCResponse = await request(
      "/api/sessions",
      {
        method: "POST",
        ...buildJsonRequest({
          cycleId: sourceCycleId,
          name: `Clone Session C ${now}`,
          nameEn: `Clone Session C EN ${now}`,
          examType: "EST_ASSN",
          startDateTime: `${sourceSessionCDate}T15:00:00+02:00`,
          endDateTime: `${sourceSessionCDate}T17:00:00+02:00`,
          buildingIds: [firstBuilding.id],
          notes: "Source session C"
        })
      },
      cookie
    );
    ensure(sourceSessionCResponse.response.ok, `Create source session C failed: ${JSON.stringify(sourceSessionCResponse.body)}`);
    const sourceSessionC = sourceSessionCResponse.body?.data;
    ensure(sourceSessionC?.id, "Source session C id missing");
    cleanup.sessionIds.push(sourceSessionC.id);

    const scheduleSessionA = await request(
      `/api/sessions/${sourceSessionA.id}/status`,
      {
        method: "PATCH",
        ...buildJsonRequest({ status: "SCHEDULED" })
      },
      cookie
    );
    ensure(scheduleSessionA.response.ok, `Schedule source session A failed: ${JSON.stringify(scheduleSessionA.body)}`);

    const scheduleSessionB = await request(
      `/api/sessions/${sourceSessionB.id}/status`,
      {
        method: "PATCH",
        ...buildJsonRequest({ status: "SCHEDULED" })
      },
      cookie
    );
    ensure(scheduleSessionB.response.ok, `Schedule source session B failed: ${JSON.stringify(scheduleSessionB.body)}`);

    const lockSessionB = await request(
      `/api/sessions/${sourceSessionB.id}/status`,
      {
        method: "PATCH",
        ...buildJsonRequest({ status: "LOCKED" })
      },
      cookie
    );
    ensure(lockSessionB.response.ok, `Lock source session B failed: ${JSON.stringify(lockSessionB.body)}`);

    const deactivateSessionC = await request(
      `/api/sessions/${sourceSessionC.id}`,
      {
        method: "DELETE"
      },
      cookie
    );
    ensure(deactivateSessionC.response.ok, `Deactivate source session C failed: ${JSON.stringify(deactivateSessionC.body)}`);

    let roleDefinition = await prisma.assignmentRoleDefinition.findFirst({
      where: { isActive: true },
      select: { id: true }
    });

    let user = await prisma.user.findFirst({
      where: { isActive: true },
      select: { id: true }
    });

    if (!roleDefinition?.id) {
      const createdRoleDefinition = await prisma.assignmentRoleDefinition.create({
        data: {
          key: `clone_verify_role_${now}`,
          name: `Clone Verify Role ${now}`,
          nameEn: `Clone Verify Role EN ${now}`,
          scope: "BUILDING",
          isActive: true
        },
        select: { id: true }
      });
      cleanup.createdRoleDefinitionIds.push(createdRoleDefinition.id);
      roleDefinition = createdRoleDefinition;
    }

    if (!user?.id) {
      const createdUser = await prisma.user.create({
        data: {
          name: `Clone Verify User ${now}`,
          nameEn: `Clone Verify User EN ${now}`,
          phone: `+2010000${String(now).slice(-7)}`,
          source: "EXTERNAL",
          isActive: true
        },
        select: { id: true }
      });
      cleanup.createdUserIds.push(createdUser.id);
      user = createdUser;
    }

    const assignment = await prisma.assignment.create({
      data: {
        sessionId: sourceSessionA.id,
        userId: user.id,
        buildingId: firstBuilding.id,
        roleDefinitionId: roleDefinition.id,
        status: "DRAFT"
      },
      select: { id: true }
    });
    cleanup.assignmentIds.push(assignment.id);

    const cloneResponse = await request(
      `/api/cycles/${sourceCycleId}/clone`,
      {
        method: "POST",
        ...buildJsonRequest({
          newStartDate: cloneStartDate,
          newEndDate: cloneEndDate
        })
      },
      cookie
    );
    ensure(cloneResponse.response.status === 201, `Clone cycle failed: ${JSON.stringify(cloneResponse.body)}`);
    ensure(cloneResponse.body?.ok && cloneResponse.body?.data?.id, "Clone response missing cycle payload");
    const clonedCycleId = cloneResponse.body.data.id;
    cleanup.cycleIds.push(clonedCycleId);

    ensure(
      cloneResponse.body?.summary?.clonedSessionsCount === 3,
      `Unexpected cloned session count: ${JSON.stringify(cloneResponse.body?.summary)}`
    );
    ensure(
      cloneResponse.body?.summary?.dateShiftDays === expectedShiftDays,
      `Unexpected clone date shift days: ${JSON.stringify(cloneResponse.body?.summary)}`
    );

    const sourceSessionsList = await request(
      `/api/sessions?cycleId=${sourceCycleId}&includeInactive=true&page=1&pageSize=20`,
      { method: "GET" },
      cookie
    );
    ensure(sourceSessionsList.response.ok, `List source sessions failed: ${JSON.stringify(sourceSessionsList.body)}`);
    const sourceSessions = sourceSessionsList.body?.data ?? [];
    ensure(sourceSessions.length === 3, `Unexpected source sessions length: ${sourceSessions.length}`);

    const clonedSessionsList = await request(
      `/api/sessions?cycleId=${clonedCycleId}&includeInactive=true&page=1&pageSize=20`,
      { method: "GET" },
      cookie
    );
    ensure(clonedSessionsList.response.ok, `List cloned sessions failed: ${JSON.stringify(clonedSessionsList.body)}`);
    const clonedSessions = clonedSessionsList.body?.data ?? [];
    ensure(clonedSessions.length === 3, `Unexpected cloned sessions length: ${clonedSessions.length}`);

    for (const clonedSession of clonedSessions) {
      cleanup.sessionIds.push(clonedSession.id);
    }

    for (const sourceSession of sourceSessions) {
      const clonedMatch = clonedSessions.find((session) => session.name === sourceSession.name);
      ensure(clonedMatch, `Missing cloned session for source ${sourceSession.id}`);
      ensure(clonedMatch.status === "DRAFT", `Cloned session status was not reset to DRAFT: ${clonedMatch.status}`);
      ensure(
        clonedMatch._count?.assignments === 0,
        `Cloned session assignments leaked from source: ${JSON.stringify(clonedMatch._count)}`
      );
      ensure(
        clonedMatch._count?.waitingList === 0,
        `Cloned session waiting list leaked from source: ${JSON.stringify(clonedMatch._count)}`
      );
      ensure(
        clonedMatch._count?.evaluations === 0,
        `Cloned session evaluations leaked from source: ${JSON.stringify(clonedMatch._count)}`
      );
      ensure(
        getShiftDays(sourceSession.startDateTime, clonedMatch.startDateTime) === expectedShiftDays,
        `Shifted startDateTime mismatch for source ${sourceSession.id}`
      );
      ensure(
        getShiftDays(sourceSession.endDateTime, clonedMatch.endDateTime) === expectedShiftDays,
        `Shifted endDateTime mismatch for source ${sourceSession.id}`
      );
    }

    const cloneLog = await prisma.activityLog.findFirst({
      where: {
        action: "clone",
        entityType: "cycle",
        entityId: clonedCycleId
      },
      orderBy: {
        occurredAt: "desc"
      },
      select: {
        metadata: true
      }
    });

    const cloneLogMetadata =
      cloneLog && cloneLog.metadata && typeof cloneLog.metadata === "object" ? cloneLog.metadata : null;
    ensure(cloneLogMetadata, "Missing clone activity log metadata");
    ensure(cloneLogMetadata.sourceCycleId === sourceCycleId, "Clone log sourceCycleId mismatch");
    ensure(cloneLogMetadata.newCycleId === clonedCycleId, "Clone log newCycleId mismatch");
    ensure(cloneLogMetadata.sessionCount === 3, "Clone log sessionCount mismatch");
    ensure(cloneLogMetadata.userId, "Clone log userId missing");

    const conflictSourceCycleResponse = await request(
      "/api/cycles",
      {
        method: "POST",
        ...buildJsonRequest({
          code: `CLONE-SRC-CONFLICT-${now}`,
          name: `Clone Source Conflict ${now}`,
          nameEn: `Clone Source Conflict EN ${now}`,
          status: "ACTIVE",
          startDate: conflictSourceStartDate,
          endDate: conflictSourceEndDate,
          notes: "Conflict source cycle"
        })
      },
      cookie
    );
    ensure(conflictSourceCycleResponse.response.ok, `Create conflict source cycle failed: ${JSON.stringify(conflictSourceCycleResponse.body)}`);
    const conflictSourceCycleId = conflictSourceCycleResponse.body?.data?.id;
    ensure(conflictSourceCycleId, "Conflict source cycle id missing");
    cleanup.cycleIds.push(conflictSourceCycleId);

    const conflictSourceSessionResponse = await request(
      "/api/sessions",
      {
        method: "POST",
        ...buildJsonRequest({
          cycleId: conflictSourceCycleId,
          name: `Conflict Clone Source Session ${now}`,
          nameEn: `Conflict Clone Source Session EN ${now}`,
          examType: "EST1",
          startDateTime: `${conflictSourceStartDate}T09:00:00+02:00`,
          endDateTime: `${conflictSourceStartDate}T11:00:00+02:00`,
          buildingIds: [firstBuilding.id],
          notes: "Conflict clone source session"
        })
      },
      cookie
    );
    ensure(conflictSourceSessionResponse.response.ok, `Create conflict source session failed: ${JSON.stringify(conflictSourceSessionResponse.body)}`);
    const conflictSourceSessionId = conflictSourceSessionResponse.body?.data?.id;
    ensure(conflictSourceSessionId, "Conflict source session id missing");
    cleanup.sessionIds.push(conflictSourceSessionId);

    const blockingCycleResponse = await request(
      "/api/cycles",
      {
        method: "POST",
        ...buildJsonRequest({
          code: `CLONE-BLOCK-${now}`,
          name: `Clone Block ${now}`,
          nameEn: `Clone Block EN ${now}`,
          status: "ACTIVE",
          startDate: blockingTargetStartDate,
          endDate: blockingTargetEndDate,
          notes: "Blocks conflict clone target"
        })
      },
      cookie
    );
    ensure(blockingCycleResponse.response.ok, `Create blocking cycle failed: ${JSON.stringify(blockingCycleResponse.body)}`);
    const blockingCycleId = blockingCycleResponse.body?.data?.id;
    ensure(blockingCycleId, "Blocking cycle id missing");
    cleanup.cycleIds.push(blockingCycleId);

    const blockingSessionResponse = await request(
      "/api/sessions",
      {
        method: "POST",
        ...buildJsonRequest({
          cycleId: blockingCycleId,
          name: `Blocking Session ${now}`,
          nameEn: `Blocking Session EN ${now}`,
          examType: "EST1",
          startDateTime: `${blockingTargetStartDate}T09:00:00+02:00`,
          endDateTime: `${blockingTargetStartDate}T11:00:00+02:00`,
          buildingIds: [firstBuilding.id],
          notes: "Blocking overlap check"
        })
      },
      cookie
    );
    ensure(blockingSessionResponse.response.ok, `Create blocking session failed: ${JSON.stringify(blockingSessionResponse.body)}`);
    const blockingSessionId = blockingSessionResponse.body?.data?.id;
    ensure(blockingSessionId, "Blocking session id missing");
    cleanup.sessionIds.push(blockingSessionId);

    const cloneCountBefore = await prisma.cycle.count({
      where: {
        sourceCycleId: conflictSourceCycleId,
        isActive: true
      }
    });

    const overlapCloneAttempt = await request(
      `/api/cycles/${conflictSourceCycleId}/clone`,
      {
        method: "POST",
        ...buildJsonRequest({
          newStartDate: blockingTargetStartDate,
          newEndDate: blockingTargetEndDate
        })
      },
      cookie
    );

    ensure(overlapCloneAttempt.response.status === 409, "Overlapping clone attempt should fail with 409");
    ensure(
      overlapCloneAttempt.body?.error === "overlapping_session",
      `Unexpected overlap error payload: ${JSON.stringify(overlapCloneAttempt.body)}`
    );

    const cloneCountAfter = await prisma.cycle.count({
      where: {
        sourceCycleId: conflictSourceCycleId,
        isActive: true
      }
    });
    ensure(cloneCountAfter === cloneCountBefore, "Failed clone created a cycle record; transaction rollback failed");

    const midnightSourceStartDate = toDateOnly(addDays(baseDate, 150));
    const midnightSourceEndDate = toDateOnly(addDays(baseDate, 151));
    const midnightTargetStartDate = toDateOnly(addDays(baseDate, 180));
    const midnightTargetEndDate = toDateOnly(addDays(baseDate, 181));

    const midnightSourceCycleResponse = await request(
      "/api/cycles",
      {
        method: "POST",
        ...buildJsonRequest({
          code: `CLONE-MIDNIGHT-SRC-${now}`,
          name: `Clone Midnight Source ${now}`,
          nameEn: `Clone Midnight Source EN ${now}`,
          status: "ACTIVE",
          startDate: midnightSourceStartDate,
          endDate: midnightSourceEndDate,
          notes: "Cross-midnight clone validation source"
        })
      },
      cookie
    );
    ensure(
      midnightSourceCycleResponse.response.ok,
      `Create midnight source cycle failed: ${JSON.stringify(midnightSourceCycleResponse.body)}`
    );
    const midnightSourceCycleId = midnightSourceCycleResponse.body?.data?.id;
    ensure(midnightSourceCycleId, "Midnight source cycle id missing");
    cleanup.cycleIds.push(midnightSourceCycleId);

    const malformedSession = await prisma.session.create({
      data: {
        cycleId: midnightSourceCycleId,
        name: `Malformed Midnight Session ${now}`,
        nameEn: `Malformed Midnight Session EN ${now}`,
        examType: "EST1",
        sessionDate: new Date(`${midnightSourceStartDate}T00:00:00.000Z`),
        dayIndex: 1,
        startsAt: new Date(`${midnightSourceStartDate}T22:30:00.000Z`),
        endsAt: new Date(`${midnightSourceEndDate}T00:30:00.000Z`),
        status: "DRAFT",
        isActive: true,
        notes: "Cross-midnight malformed session for clone validation"
      },
      select: {
        id: true
      }
    });
    cleanup.sessionIds.push(malformedSession.id);

    await prisma.sessionBuilding.create({
      data: {
        sessionId: malformedSession.id,
        buildingId: firstBuilding.id,
        isActive: true
      }
    });

    const midnightCloneCountBefore = await prisma.cycle.count({
      where: {
        sourceCycleId: midnightSourceCycleId,
        isActive: true
      }
    });

    const midnightCloneAttempt = await request(
      `/api/cycles/${midnightSourceCycleId}/clone`,
      {
        method: "POST",
        ...buildJsonRequest({
          newStartDate: midnightTargetStartDate,
          newEndDate: midnightTargetEndDate
        })
      },
      cookie
    );
    ensure(
      midnightCloneAttempt.response.status === 400 || midnightCloneAttempt.response.status === 409,
      `Cross-midnight clone should fail with 400/409. Got ${midnightCloneAttempt.response.status}: ${JSON.stringify(midnightCloneAttempt.body)}`
    );
    ensure(
      midnightCloneAttempt.body?.error === "invalid_date_range",
      `Unexpected cross-midnight clone error payload: ${JSON.stringify(midnightCloneAttempt.body)}`
    );

    const midnightCloneCountAfter = await prisma.cycle.count({
      where: {
        sourceCycleId: midnightSourceCycleId,
        isActive: true
      }
    });
    ensure(
      midnightCloneCountAfter === midnightCloneCountBefore,
      "Cross-midnight failed clone created a cycle record; transaction rollback failed"
    );

    console.log(
      JSON.stringify(
        {
          sourceCycleId,
          clonedCycleId,
          clonedSessionsCount: cloneResponse.body.summary.clonedSessionsCount,
          expectedShiftDays,
          activityLogMetadata: {
            sourceCycleId: cloneLogMetadata.sourceCycleId,
            newCycleId: cloneLogMetadata.newCycleId,
            sessionCount: cloneLogMetadata.sessionCount,
            userId: cloneLogMetadata.userId
          },
          overlapError: overlapCloneAttempt.body?.error,
          crossMidnightError: midnightCloneAttempt.body?.error,
          cloneCountBefore,
          cloneCountAfter,
          midnightCloneCountBefore,
          midnightCloneCountAfter
        },
        null,
        2
      )
    );
  } finally {
    const loginForm = new URLSearchParams();
    loginForm.set("email", loginPayload.email);
    loginForm.set("password", loginPayload.password);
    loginForm.set("redirectTo", "/dashboard");
    loginForm.set("locale", "en");

    const loginResponse = await request(
      "/api/auth/login",
      {
        method: "POST",
        redirect: "manual",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: loginForm.toString()
      },
      null
    );
    const cleanupCookie = formatCookie(loginResponse.response.headers);

    if (cleanup.assignmentIds.length > 0) {
      await prisma.assignment.deleteMany({
        where: {
          id: {
            in: cleanup.assignmentIds
          }
        }
      });
    }

    if (cleanup.createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: {
          id: {
            in: cleanup.createdUserIds
          }
        }
      });
    }

    if (cleanup.createdRoleDefinitionIds.length > 0) {
      await prisma.assignmentRoleDefinition.deleteMany({
        where: {
          id: {
            in: cleanup.createdRoleDefinitionIds
          }
        }
      });
    }

    for (const sessionId of cleanup.sessionIds.reverse()) {
      await safeRequest(
        `/api/sessions/${sessionId}`,
        {
          method: "DELETE"
        },
        cleanupCookie
      );
    }

    for (const cycleId of cleanup.cycleIds.reverse()) {
      await safeRequest(
        `/api/cycles/${cycleId}`,
        {
          method: "PATCH",
          ...buildJsonRequest({
            isActive: false
          })
        },
        cleanupCookie
      );
    }

    await prisma.$disconnect();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
