import fs from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

const baseUrl = process.env.EXAMOPS_BASE_URL ?? "http://127.0.0.1:3105";
const loginPayload = {
  email: "coordinator@examops.local",
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

function buildJsonRequest(body) {
  return {
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  };
}

async function safeRequest(pathname, options, cookie) {
  try {
    await request(pathname, options, cookie);
  } catch {
    // best effort cleanup
  }
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
    cycleIds: [],
    sessionIds: [],
    waitingListIds: [],
    assignmentIds: [],
    userIds: []
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
    const baseDate = new Date(Date.UTC(2360 + (now % 10), 0, 10));
    const startDate = toDateOnly(baseDate);
    const endDate = toDateOnly(new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000));

    const [building, role] = await Promise.all([
      prisma.building.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
        select: { id: true }
      }),
      prisma.assignmentRoleDefinition.findFirst({
        where: {
          isActive: true,
          manualOnly: false,
          scope: "BUILDING"
        },
        orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
        select: { id: true }
      })
    ]);

    ensure(building?.id, "Missing active building");
    ensure(role?.id, "Missing active role definition");

    const cycleResponse = await request(
      "/api/cycles",
      {
        method: "POST",
        ...buildJsonRequest({
          code: `PH7-WL-${now}`,
          name: `Phase7 Waiting List ${now}`,
          nameEn: `Phase7 Waiting List EN ${now}`,
          status: "ACTIVE",
          startDate,
          endDate
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
          name: `Phase7 Waiting Session ${now}`,
          nameEn: `Phase7 Waiting Session EN ${now}`,
          examType: "EST1",
          startDateTime: `${startDate}T09:00:00+02:00`,
          endDateTime: `${startDate}T11:00:00+02:00`,
          buildingIds: [building.id]
        })
      },
      cookie
    );
    ensure(sessionResponse.response.ok, `Create session failed: ${JSON.stringify(sessionResponse.body)}`);
    const sessionId = sessionResponse.body?.data?.id;
    ensure(sessionId, "Session id missing");
    cleanup.sessionIds.push(sessionId);

    const createUser = async (suffix, rating) => {
      const user = await prisma.user.create({
        data: {
          name: `Phase7 Waiting Candidate ${suffix} ${now}`,
          nameEn: `Phase7 Waiting Candidate EN ${suffix} ${now}`,
          phone: `+2018${String(now + suffix).slice(-8)}`,
          source: "EXTERNAL",
          averageRating: rating,
          totalSessions: suffix,
          blockStatus: "CLEAR",
          isActive: true
        },
        select: { id: true }
      });
      cleanup.userIds.push(user.id);
      return user.id;
    };

    const lowerRatedUserId = await createUser(1, 3.6);
    const higherRatedUserId = await createUser(2, 4.9);
    const assignedUserId = await createUser(3, 4.2);

    const waitingLogBefore = await prisma.activityLog.count({
      where: {
        entityType: "waiting_list"
      }
    });

    const entryOneResponse = await request(
      "/api/waiting-list",
      {
        method: "POST",
        ...buildJsonRequest({
          sessionId,
          userId: lowerRatedUserId,
          buildingId: building.id,
          roleDefinitionId: role.id,
          entrySource: "manual"
        })
      },
      cookie
    );
    ensure(entryOneResponse.response.status === 201, `Create waiting entry #1 failed: ${JSON.stringify(entryOneResponse.body)}`);

    const entryTwoResponse = await request(
      "/api/waiting-list",
      {
        method: "POST",
        ...buildJsonRequest({
          sessionId,
          userId: higherRatedUserId,
          buildingId: building.id,
          roleDefinitionId: role.id,
          entrySource: "manual"
        })
      },
      cookie
    );
    ensure(entryTwoResponse.response.status === 201, `Create waiting entry #2 failed: ${JSON.stringify(entryTwoResponse.body)}`);

    const waitingListResponse = await request(
      `/api/waiting-list?sessionId=${sessionId}&status=WAITING&page=1&pageSize=20`,
      { method: "GET" },
      cookie
    );
    ensure(waitingListResponse.response.ok, `List waiting entries failed: ${JSON.stringify(waitingListResponse.body)}`);
    const waitingEntries = waitingListResponse.body?.data ?? [];
    ensure(waitingEntries.length === 2, `Expected 2 waiting entries, got ${waitingEntries.length}`);
    ensure(waitingEntries[0].userId === higherRatedUserId, "Higher-rated user should be priority #1");
    ensure(waitingEntries[0].priority === 1, "First waiting entry should have priority 1");
    ensure(waitingEntries[1].priority === 2, "Second waiting entry should have priority 2");

    const duplicateWaitingResponse = await request(
      "/api/waiting-list",
      {
        method: "POST",
        ...buildJsonRequest({
          sessionId,
          userId: higherRatedUserId,
          buildingId: building.id,
          roleDefinitionId: role.id
        })
      },
      cookie
    );
    ensure(duplicateWaitingResponse.response.status === 409, "Duplicate waiting-list entry should return 409");
    ensure(
      duplicateWaitingResponse.body?.error === "duplicate_waiting_list_entry",
      `Unexpected duplicate waiting-list error: ${JSON.stringify(duplicateWaitingResponse.body)}`
    );

    const assignmentResponse = await request(
      "/api/assignments",
      {
        method: "POST",
        ...buildJsonRequest({
          sessionId,
          userId: assignedUserId,
          buildingId: building.id,
          roleDefinitionId: role.id
        })
      },
      cookie
    );
    ensure(assignmentResponse.response.status === 201, `Manual assignment create failed: ${JSON.stringify(assignmentResponse.body)}`);
    const assignmentId = assignmentResponse.body?.data?.id;
    ensure(assignmentId, "Manual assignment id missing");
    cleanup.assignmentIds.push(assignmentId);

    const waitingForAssignedUserResponse = await request(
      "/api/waiting-list",
      {
        method: "POST",
        ...buildJsonRequest({
          sessionId,
          userId: assignedUserId,
          buildingId: building.id,
          roleDefinitionId: role.id
        })
      },
      cookie
    );
    ensure(waitingForAssignedUserResponse.response.status === 409, "Assigned user waiting-list create should return 409");
    ensure(
      waitingForAssignedUserResponse.body?.error === "duplicate_assignment",
      `Unexpected assigned-user waiting-list error: ${JSON.stringify(waitingForAssignedUserResponse.body)}`
    );

    const promoteTarget = waitingEntries[0];
    const promoteResponse = await request(
      `/api/waiting-list/${promoteTarget.id}/promote`,
      {
        method: "POST",
        ...buildJsonRequest({})
      },
      cookie
    );
    ensure(promoteResponse.response.ok, `Promote waiting-list entry failed: ${JSON.stringify(promoteResponse.body)}`);

    const promotedAssignmentId = promoteResponse.body?.data?.assignment?.id;
    ensure(promotedAssignmentId, "Promotion did not return created assignment id");
    cleanup.assignmentIds.push(promotedAssignmentId);

    const rePromoteResponse = await request(
      `/api/waiting-list/${promoteTarget.id}/promote`,
      {
        method: "POST",
        ...buildJsonRequest({})
      },
      cookie
    );
    ensure(rePromoteResponse.response.status === 409, "Re-promoting should return 409");
    ensure(
      rePromoteResponse.body?.error === "waiting_list_entry_not_waiting",
      `Unexpected re-promote error: ${JSON.stringify(rePromoteResponse.body)}`
    );

    const removeTarget = waitingEntries[1];
    const removeResponse = await request(
      `/api/waiting-list/${removeTarget.id}/remove`,
      {
        method: "POST",
        ...buildJsonRequest({
          reason: "manual_cleanup"
        })
      },
      cookie
    );
    ensure(removeResponse.response.ok, `Remove waiting-list entry failed: ${JSON.stringify(removeResponse.body)}`);

    const waitingLogAfter = await prisma.activityLog.count({
      where: {
        entityType: "waiting_list"
      }
    });
    ensure(
      waitingLogAfter >= waitingLogBefore + 4,
      `Expected waiting-list logs to increase by at least 4. before=${waitingLogBefore}, after=${waitingLogAfter}`
    );

    const finalWaitingEntriesResponse = await request(
      `/api/waiting-list?sessionId=${sessionId}&status=WAITING&page=1&pageSize=20`,
      { method: "GET" },
      cookie
    );
    ensure(finalWaitingEntriesResponse.response.ok, `Final waiting-list fetch failed: ${JSON.stringify(finalWaitingEntriesResponse.body)}`);
    ensure(
      (finalWaitingEntriesResponse.body?.data?.length ?? 0) === 0,
      `Expected no WAITING entries after promote/remove, got ${finalWaitingEntriesResponse.body?.data?.length ?? 0}`
    );

    console.log(
      JSON.stringify(
        {
          sessionId,
          waitingCreated: 2,
          rankedTopUserId: waitingEntries[0].userId,
          promotedWaitingId: promoteTarget.id,
          removedWaitingId: removeTarget.id,
          promotedAssignmentId,
          duplicateWaitingError: duplicateWaitingResponse.body?.error,
          assignedUserConflictError: waitingForAssignedUserResponse.body?.error,
          rePromoteError: rePromoteResponse.body?.error,
          waitingLogDelta: waitingLogAfter - waitingLogBefore
        },
        null,
        2
      )
    );
  } finally {
    if (cleanup.sessionIds.length > 0) {
      await prisma.waitingList.deleteMany({
        where: {
          sessionId: {
            in: cleanup.sessionIds
          }
        }
      });

      await prisma.assignment.deleteMany({
        where: {
          sessionId: {
            in: cleanup.sessionIds
          }
        }
      });
    }

    if (cleanup.userIds.length > 0) {
      await prisma.user.deleteMany({
        where: {
          id: {
            in: cleanup.userIds
          }
        }
      });
    }

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
