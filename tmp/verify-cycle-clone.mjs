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

  if (cookie) {
    headers.set("Cookie", cookie);
  }

  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers
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
}

async function safeRequest(pathname, options, cookie) {
  try {
    await request(pathname, options, cookie);
  } catch {
    // best-effort cleanup
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

function getShiftDays(sourceDateTime, targetDateTime) {
  return Math.round((new Date(targetDateTime).getTime() - new Date(sourceDateTime).getTime()) / millisecondsPerDay);
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
    const sourceStartDate = "2099-06-01";
    const sourceEndDate = "2099-06-04";
    const cloneStartDate = "2099-07-01";
    const cloneEndDate = "2099-07-04";
    const expectedShiftDays = Math.round(
      (normalizeDateOnly(cloneStartDate).getTime() - normalizeDateOnly(sourceStartDate).getTime()) /
        millisecondsPerDay
    );

    const sourceCycle = await request(
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
          notes: "Clone workflow verification source cycle"
        })
      },
      cookie
    );
    ensure(sourceCycle.response.ok, `Create source cycle failed: ${JSON.stringify(sourceCycle.body)}`);
    const sourceCycleId = sourceCycle.body?.data?.id;
    ensure(sourceCycleId, "Source cycle id missing");
    cleanup.cycleIds.push(sourceCycleId);

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

    const sourceSessionAResponse = await request(
      "/api/sessions",
      {
        method: "POST",
        ...buildJsonRequest({
          cycleId: sourceCycleId,
          name: `Clone Session A ${now}`,
          nameEn: `Clone Session A EN ${now}`,
          examType: "EST1",
          startDateTime: "2099-06-01T09:00:00+02:00",
          endDateTime: "2099-06-01T11:00:00+02:00",
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
          startDateTime: "2099-06-02T12:00:00+02:00",
          endDateTime: "2099-06-02T14:00:00+02:00",
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

    const scheduleSourceSession = await request(
      `/api/sessions/${sourceSessionA.id}/status`,
      {
        method: "PATCH",
        ...buildJsonRequest({
          status: "SCHEDULED"
        })
      },
      cookie
    );
    ensure(scheduleSourceSession.response.ok, `Schedule source session failed: ${JSON.stringify(scheduleSourceSession.body)}`);

    let roleDefinition = await prisma.assignmentRoleDefinition.findFirst({
      where: {
        isActive: true
      },
      select: {
        id: true
      }
    });
    let user = await prisma.user.findFirst({
      where: {
        isActive: true
      },
      select: {
        id: true
      }
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
        select: {
          id: true
        }
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
        select: {
          id: true
        }
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
      select: {
        id: true
      }
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
      cloneResponse.body?.summary?.clonedSessionsCount === 2,
      `Unexpected cloned session count: ${JSON.stringify(cloneResponse.body?.summary)}`
    );
    ensure(
      cloneResponse.body?.summary?.dateShiftDays === expectedShiftDays,
      `Unexpected clone date shift days: ${JSON.stringify(cloneResponse.body?.summary)}`
    );

    const sourceSessionsList = await request(
      `/api/sessions?cycleId=${sourceCycleId}&includeInactive=true&page=1&pageSize=20`,
      {
        method: "GET"
      },
      cookie
    );
    ensure(sourceSessionsList.response.ok, `List source sessions failed: ${JSON.stringify(sourceSessionsList.body)}`);
    const sourceSessions = sourceSessionsList.body?.data ?? [];
    ensure(sourceSessions.length === 2, `Unexpected source sessions length: ${sourceSessions.length}`);

    const clonedSessionsList = await request(
      `/api/sessions?cycleId=${clonedCycleId}&includeInactive=true&page=1&pageSize=20`,
      {
        method: "GET"
      },
      cookie
    );
    ensure(clonedSessionsList.response.ok, `List cloned sessions failed: ${JSON.stringify(clonedSessionsList.body)}`);
    const clonedSessions = clonedSessionsList.body?.data ?? [];
    ensure(clonedSessions.length === 2, `Unexpected cloned sessions length: ${clonedSessions.length}`);

    for (const clonedSession of clonedSessions) {
      cleanup.sessionIds.push(clonedSession.id);
    }

    for (const sourceSession of sourceSessions) {
      const clonedMatch = clonedSessions.find((session) => session.examType === sourceSession.examType);
      ensure(clonedMatch, `Missing cloned session for examType ${sourceSession.examType}`);
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
        `Shifted startDateTime mismatch for examType ${sourceSession.examType}`
      );
      ensure(
        getShiftDays(sourceSession.endDateTime, clonedMatch.endDateTime) === expectedShiftDays,
        `Shifted endDateTime mismatch for examType ${sourceSession.examType}`
      );
    }

    const overlappingCloneAttempt = await request(
      `/api/cycles/${sourceCycleId}/clone`,
      {
        method: "POST",
        ...buildJsonRequest({
          newStartDate: sourceStartDate,
          newEndDate: sourceEndDate
        })
      },
      cookie
    );
    ensure(overlappingCloneAttempt.response.status === 409, "Overlapping clone attempt was not rejected");
    ensure(
      overlappingCloneAttempt.body?.error === "overlapping_cycle",
      `Unexpected overlap error payload: ${JSON.stringify(overlappingCloneAttempt.body)}`
    );

    const inactiveSourceCycle = await request(
      "/api/cycles",
      {
        method: "POST",
        ...buildJsonRequest({
          code: `CLONE-INACTIVE-${now}`,
          name: `Clone Inactive ${now}`,
          nameEn: `Clone Inactive EN ${now}`,
          status: "DRAFT",
          startDate: "2099-08-10",
          endDate: "2099-08-12",
          notes: "Inactive clone guard test"
        })
      },
      cookie
    );
    ensure(inactiveSourceCycle.response.ok, `Create inactive source cycle failed: ${JSON.stringify(inactiveSourceCycle.body)}`);
    const inactiveSourceCycleId = inactiveSourceCycle.body?.data?.id;
    ensure(inactiveSourceCycleId, "Inactive source cycle id missing");
    cleanup.cycleIds.push(inactiveSourceCycleId);

    const deactivateInactiveSource = await request(
      `/api/cycles/${inactiveSourceCycleId}`,
      {
        method: "PATCH",
        ...buildJsonRequest({
          isActive: false
        })
      },
      cookie
    );
    ensure(deactivateInactiveSource.response.ok, `Deactivate inactive source cycle failed: ${JSON.stringify(deactivateInactiveSource.body)}`);

    const inactiveCloneAttempt = await request(
      `/api/cycles/${inactiveSourceCycleId}/clone`,
      {
        method: "POST",
        ...buildJsonRequest({
          newStartDate: "2099-09-10",
          newEndDate: "2099-09-12"
        })
      },
      cookie
    );
    ensure(inactiveCloneAttempt.response.status === 409, "Inactive source clone was not rejected");
    ensure(
      inactiveCloneAttempt.body?.error === "invalid_source",
      `Unexpected inactive source clone error payload: ${JSON.stringify(inactiveCloneAttempt.body)}`
    );

    console.log(
      JSON.stringify(
        {
          sourceCycleId,
          clonedCycleId,
          sourceSessionIds: sourceSessions.map((session) => session.id),
          clonedSessionIds: clonedSessions.map((session) => session.id),
          clonedSessionsCount: cloneResponse.body.summary.clonedSessionsCount,
          expectedShiftDays,
          overlapError: overlappingCloneAttempt.body?.error,
          inactiveSourceError: inactiveCloneAttempt.body?.error
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
