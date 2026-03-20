import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

const baseUrl = "http://127.0.0.1:3105";
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

function toDateOnly(date) {
  return date.toISOString().slice(0, 10);
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
    const baseDate = new Date(Date.UTC(2310 + (now % 20), 0, 1));
    const cycleStartDate = toDateOnly(baseDate);
    const cycleEndDate = toDateOnly(new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000));
    const sessionDayDate = toDateOnly(baseDate);

    const buildingsResponse = await request(
      "/api/locations/buildings?includeInactive=false&page=1&pageSize=20",
      {
        method: "GET"
      },
      cookie
    );
    ensure(
      buildingsResponse.response.ok,
      `List buildings failed: ${JSON.stringify(buildingsResponse.body)}`
    );
    const firstBuilding = buildingsResponse.body?.data?.[0];
    ensure(firstBuilding?.id, "No active building found for assignment verification");

    const cycleResponse = await request(
      "/api/cycles",
      {
        method: "POST",
        ...buildJsonRequest({
          code: `ASSIGN-CYCLE-${now}`,
          name: `Assignment Contract Cycle ${now}`,
          nameEn: `Assignment Contract Cycle EN ${now}`,
          status: "ACTIVE",
          startDate: cycleStartDate,
          endDate: cycleEndDate,
          notes: "Assignment service contract verification cycle"
        })
      },
      cookie
    );
    ensure(cycleResponse.response.ok, `Create cycle failed: ${JSON.stringify(cycleResponse.body)}`);
    const cycleId = cycleResponse.body?.data?.id;
    ensure(cycleId, "Cycle id missing");
    cleanup.cycleIds.push(cycleId);

    const sessionResponse = await request(
      "/api/sessions",
      {
        method: "POST",
        ...buildJsonRequest({
          cycleId,
          name: `Assignment Contract Session ${now}`,
          nameEn: `Assignment Contract Session EN ${now}`,
          examType: "EST1",
          startDateTime: `${sessionDayDate}T09:00:00+02:00`,
          endDateTime: `${sessionDayDate}T11:00:00+02:00`,
          buildingIds: [firstBuilding.id],
          notes: "Assignment service contract verification session"
        })
      },
      cookie
    );
    ensure(sessionResponse.response.ok, `Create session failed: ${JSON.stringify(sessionResponse.body)}`);
    const sessionId = sessionResponse.body?.data?.id;
    ensure(sessionId, "Session id missing");
    cleanup.sessionIds.push(sessionId);

    const roleDefinition = await prisma.assignmentRoleDefinition.findFirst({
      where: {
        isActive: true,
        scope: "BUILDING"
      },
      orderBy: {
        sortOrder: "asc"
      },
      select: {
        id: true
      }
    });
    ensure(roleDefinition?.id, "Missing active assignment role definition for verification");

    let user = await prisma.user.findFirst({
      where: {
        isActive: true,
        blockStatus: "CLEAR"
      },
      select: {
        id: true
      }
    });

    if (!user?.id) {
      user = await prisma.user.create({
        data: {
          name: `Assignment Verify User ${now}`,
          nameEn: `Assignment Verify User EN ${now}`,
          phone: `+2010000${String(now).slice(-7)}`,
          source: "EXTERNAL",
          isActive: true
        },
        select: {
          id: true
        }
      });
      cleanup.createdUserIds.push(user.id);
    }

    const createAssignmentResponse = await request(
      "/api/assignments",
      {
        method: "POST",
        ...buildJsonRequest({
          sessionId,
          userId: user.id,
          buildingId: firstBuilding.id,
          roleDefinitionId: roleDefinition.id
        })
      },
      cookie
    );
    ensure(
      createAssignmentResponse.response.status === 201,
      `Create assignment failed: ${JSON.stringify(createAssignmentResponse.body)}`
    );
    const assignmentId = createAssignmentResponse.body?.data?.id;
    ensure(assignmentId, "Assignment id missing from create response");
    cleanup.assignmentIds.push(assignmentId);

    ensure(
      createAssignmentResponse.body?.data?.status === "DRAFT",
      `Assignment status should be DRAFT: ${JSON.stringify(createAssignmentResponse.body?.data)}`
    );

    const listAssignmentsResponse = await request(
      `/api/assignments?sessionId=${sessionId}&page=1&pageSize=10`,
      {
        method: "GET"
      },
      cookie
    );
    ensure(
      listAssignmentsResponse.response.ok,
      `List assignments failed: ${JSON.stringify(listAssignmentsResponse.body)}`
    );
    const listData = listAssignmentsResponse.body?.data ?? [];
    ensure(listData.some((item) => item.id === assignmentId), "Created assignment missing from list API");

    const detailAssignmentResponse = await request(
      `/api/assignments/${assignmentId}`,
      {
        method: "GET"
      },
      cookie
    );
    ensure(
      detailAssignmentResponse.response.ok,
      `Get assignment detail failed: ${JSON.stringify(detailAssignmentResponse.body)}`
    );

    const duplicateAssignmentResponse = await request(
      "/api/assignments",
      {
        method: "POST",
        ...buildJsonRequest({
          sessionId,
          userId: user.id,
          buildingId: firstBuilding.id,
          roleDefinitionId: roleDefinition.id
        })
      },
      cookie
    );
    ensure(duplicateAssignmentResponse.response.status === 409, "Duplicate assignment should return 409");
    ensure(
      duplicateAssignmentResponse.body?.error === "duplicate_assignment",
      `Unexpected duplicate assignment error: ${JSON.stringify(duplicateAssignmentResponse.body)}`
    );

    const orphanSessionAssignmentResponse = await request(
      "/api/assignments",
      {
        method: "POST",
        ...buildJsonRequest({
          sessionId: crypto.randomUUID(),
          userId: user.id,
          buildingId: firstBuilding.id,
          roleDefinitionId: roleDefinition.id
        })
      },
      cookie
    );
    ensure(
      orphanSessionAssignmentResponse.response.status === 404,
      "Unknown session assignment should return 404"
    );
    ensure(
      orphanSessionAssignmentResponse.body?.error === "session_not_found",
      `Unexpected orphan session error: ${JSON.stringify(orphanSessionAssignmentResponse.body)}`
    );

    const dbAssignment = await prisma.assignment.findUnique({
      where: {
        id: assignmentId
      },
      select: {
        id: true,
        session: {
          select: {
            id: true
          }
        },
        user: {
          select: {
            id: true
          }
        },
        building: {
          select: {
            id: true
          }
        },
        roleDefinition: {
          select: {
            id: true
          }
        }
      }
    });
    ensure(dbAssignment?.session?.id, "Assignment session linkage missing");
    ensure(dbAssignment?.user?.id, "Assignment user linkage missing");
    ensure(dbAssignment?.building?.id, "Assignment building linkage missing");
    ensure(dbAssignment?.roleDefinition?.id, "Assignment role linkage missing");

    const scheduleSessionResponse = await request(
      `/api/sessions/${sessionId}/status`,
      {
        method: "PATCH",
        ...buildJsonRequest({
          status: "SCHEDULED"
        })
      },
      cookie
    );
    ensure(
      scheduleSessionResponse.response.ok,
      `Session status schedule failed: ${JSON.stringify(scheduleSessionResponse.body)}`
    );

    const invalidTransitionResponse = await request(
      `/api/sessions/${sessionId}/status`,
      {
        method: "PATCH",
        ...buildJsonRequest({
          status: "COMPLETED"
        })
      },
      cookie
    );
    ensure(invalidTransitionResponse.response.status === 409, "Invalid session status transition should return 409");
    ensure(
      invalidTransitionResponse.body?.error === "invalid_session_status_transition",
      `Unexpected invalid transition error: ${JSON.stringify(invalidTransitionResponse.body)}`
    );

    const cancelAssignmentResponse = await request(
      `/api/assignments/${assignmentId}`,
      {
        method: "DELETE"
      },
      cookie
    );
    ensure(
      cancelAssignmentResponse.response.ok,
      `Cancel assignment failed: ${JSON.stringify(cancelAssignmentResponse.body)}`
    );
    ensure(
      cancelAssignmentResponse.body?.data?.status === "CANCELLED",
      `Cancel assignment should set status to CANCELLED: ${JSON.stringify(cancelAssignmentResponse.body)}`
    );

    console.log(
      JSON.stringify(
        {
          assignmentId,
          cycleId,
          sessionId,
          duplicateError: duplicateAssignmentResponse.body?.error,
          orphanError: orphanSessionAssignmentResponse.body?.error,
          invalidTransitionError: invalidTransitionResponse.body?.error,
          cancelledStatus: cancelAssignmentResponse.body?.data?.status
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

    if (cleanup.createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: {
          id: {
            in: cleanup.createdUserIds
          }
        }
      });
    }

    await prisma.$disconnect();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
