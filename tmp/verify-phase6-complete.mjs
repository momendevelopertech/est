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
    const baseDate = new Date(Date.UTC(2330 + (now % 10), 0, 12));
    const startDate = toDateOnly(baseDate);
    const endDate = toDateOnly(new Date(baseDate.getTime() + 3 * 24 * 60 * 60 * 1000));

    const [building, roles] = await Promise.all([
      prisma.building.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
        select: { id: true }
      }),
      prisma.assignmentRoleDefinition.findMany({
        where: {
          isActive: true,
          key: {
            in: ["building_head", "control_room", "room_proctor"]
          }
        },
        select: {
          id: true,
          key: true,
          scope: true,
          manualOnly: true
        }
      })
    ]);

    ensure(building?.id, "Missing active building for verification");

    const roleMap = new Map(roles.map((role) => [role.key, role]));
    const autoHeadRole = roleMap.get("building_head");
    const manualBuildingRole = roleMap.get("control_room");

    ensure(autoHeadRole?.id, "Missing building_head role");
    ensure(manualBuildingRole?.id, "Missing control_room role");

    const cycleResponse = await request(
      "/api/cycles",
      {
        method: "POST",
        ...buildJsonRequest({
          code: `PH6-COMPLETE-${now}`,
          name: `Phase6 Complete Cycle ${now}`,
          nameEn: `Phase6 Complete Cycle EN ${now}`,
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
          name: `Phase6 Main Session ${now}`,
          nameEn: `Phase6 Main Session EN ${now}`,
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

    const scheduleResponse = await request(
      `/api/sessions/${sessionId}/status`,
      {
        method: "PATCH",
        ...buildJsonRequest({ status: "SCHEDULED" })
      },
      cookie
    );
    ensure(scheduleResponse.response.ok, `Schedule failed: ${JSON.stringify(scheduleResponse.body)}`);

    const lockBlockedResponse = await request(
      `/api/sessions/${sessionId}/status`,
      {
        method: "PATCH",
        ...buildJsonRequest({ status: "LOCKED" })
      },
      cookie
    );
    ensure(
      lockBlockedResponse.response.status === 409,
      `Lock should fail before coverage: ${JSON.stringify(lockBlockedResponse.body)}`
    );
    ensure(
      lockBlockedResponse.body?.error === "session_lock_validation_failed",
      `Unexpected lock error: ${JSON.stringify(lockBlockedResponse.body)}`
    );

    const lockValidationResponse = await request(
      `/api/sessions/${sessionId}/lock-validation`,
      { method: "GET" },
      cookie
    );
    ensure(
      lockValidationResponse.response.ok,
      `Lock validation endpoint failed: ${JSON.stringify(lockValidationResponse.body)}`
    );
    ensure(lockValidationResponse.body?.data?.isReady === false, "Lock validation should report not ready");

    const createUser = async (suffix) => {
      const user = await prisma.user.create({
        data: {
          name: `Phase6 Candidate ${suffix} ${now}`,
          nameEn: `Phase6 Candidate EN ${suffix} ${now}`,
          phone: `+2017${String(now + suffix).slice(-8)}`,
          source: "EXTERNAL",
          averageRating: 4.7,
          totalSessions: suffix,
          blockStatus: "CLEAR",
          isActive: true
        },
        select: { id: true }
      });
      cleanup.userIds.push(user.id);
      return user.id;
    };

    const manualUserId = await createUser(1);
    const autoUserId = await createUser(2);
    const assnUserId = await createUser(3);

    const manualAssignmentResponse = await request(
      "/api/assignments",
      {
        method: "POST",
        ...buildJsonRequest({
          sessionId,
          userId: manualUserId,
          buildingId: building.id,
          roleDefinitionId: manualBuildingRole.id
        })
      },
      cookie
    );
    ensure(
      manualAssignmentResponse.response.status === 201,
      `Manual assignment failed: ${JSON.stringify(manualAssignmentResponse.body)}`
    );
    const manualAssignmentId = manualAssignmentResponse.body?.data?.id;
    ensure(manualAssignmentId, "Manual assignment id missing");
    cleanup.assignmentIds.push(manualAssignmentId);

    const autoAssignmentResponse = await request(
      "/api/assignments/auto",
      {
        method: "POST",
        ...buildJsonRequest({
          sessionId,
          roleDefinitionIds: [autoHeadRole.id],
          candidateUserIds: [autoUserId],
          dryRun: false
        })
      },
      cookie
    );
    ensure(autoAssignmentResponse.response.ok, `Auto assignment failed: ${JSON.stringify(autoAssignmentResponse.body)}`);
    ensure(autoAssignmentResponse.body?.data?.createdAssignmentsCount === 1, "Auto assignment should create one row");
    const autoAssignmentId = autoAssignmentResponse.body?.data?.createdAssignmentIds?.[0];
    ensure(autoAssignmentId, "Auto assignment id missing");
    cleanup.assignmentIds.push(autoAssignmentId);

    const rerankLogCountBefore = await prisma.activityLog.count({
      where: {
        action: "late_import_rerank",
        entityType: "assignment",
        entityId: sessionId
      }
    });

    const rerankDryRunResponse = await request(
      "/api/assignments/rerank",
      {
        method: "POST",
        ...buildJsonRequest({
          sessionId,
          roleDefinitionIds: [autoHeadRole.id],
          candidateUserIds: [autoUserId],
          dryRun: true
        })
      },
      cookie
    );
    ensure(
      rerankDryRunResponse.response.ok,
      `Rerank dry-run failed: ${JSON.stringify(rerankDryRunResponse.body)}`
    );
    ensure(
      rerankDryRunResponse.body?.data?.resetAssignmentsCount >= 1,
      `Rerank dry-run should report resettable drafts: ${JSON.stringify(rerankDryRunResponse.body)}`
    );
    ensure(
      rerankDryRunResponse.body?.data?.preservedManualAssignmentCount >= 1,
      `Rerank dry-run should preserve manual assignments: ${JSON.stringify(rerankDryRunResponse.body)}`
    );

    const rerankExecuteResponse = await request(
      "/api/assignments/rerank",
      {
        method: "POST",
        ...buildJsonRequest({
          sessionId,
          roleDefinitionIds: [autoHeadRole.id],
          candidateUserIds: [autoUserId],
          dryRun: false
        })
      },
      cookie
    );
    ensure(
      rerankExecuteResponse.response.ok,
      `Rerank execute failed: ${JSON.stringify(rerankExecuteResponse.body)}`
    );

    const manualStillExists = await prisma.assignment.findUnique({
      where: { id: manualAssignmentId },
      select: { id: true, assignedMethod: true }
    });
    ensure(manualStillExists?.assignedMethod === "MANUAL", "Manual assignment must be preserved after rerank");

    const rerankLogCountAfter = await prisma.activityLog.count({
      where: {
        action: "late_import_rerank",
        entityType: "assignment",
        entityId: sessionId
      }
    });
    ensure(
      rerankLogCountAfter === rerankLogCountBefore + 1,
      `Rerank execute should add one log entry: before=${rerankLogCountBefore}, after=${rerankLogCountAfter}`
    );

    const assnSessionResponse = await request(
      "/api/sessions",
      {
        method: "POST",
        ...buildJsonRequest({
          cycleId,
          name: `Phase6 ASSN Session ${now}`,
          nameEn: `Phase6 ASSN Session EN ${now}`,
          examType: "EST_ASSN",
          startDateTime: `${startDate}T12:00:00+02:00`,
          endDateTime: `${startDate}T14:00:00+02:00`,
          buildingIds: [building.id]
        })
      },
      cookie
    );
    ensure(assnSessionResponse.response.ok, `Create ASSN session failed: ${JSON.stringify(assnSessionResponse.body)}`);
    const assnSessionId = assnSessionResponse.body?.data?.id;
    ensure(assnSessionId, "ASSN session id missing");
    cleanup.sessionIds.push(assnSessionId);

    const assnAutoResponse = await request(
      "/api/assignments/auto",
      {
        method: "POST",
        ...buildJsonRequest({
          sessionId: assnSessionId,
          candidateUserIds: [assnUserId],
          dryRun: false
        })
      },
      cookie
    );
    ensure(assnAutoResponse.response.ok, `ASSN auto run failed: ${JSON.stringify(assnAutoResponse.body)}`);

    const assnRoomAutoAssignments = await prisma.assignment.count({
      where: {
        sessionId: assnSessionId,
        assignedMethod: "AUTO",
        roleDefinition: {
          scope: "ROOM"
        }
      }
    });
    ensure(assnRoomAutoAssignments === 0, `ASSN session should not have AUTO room assignments: ${assnRoomAutoAssignments}`);

    console.log(
      JSON.stringify(
        {
          sessionId,
          lockBlockedError: lockBlockedResponse.body?.error,
          rerankDryRunResetAssignments: rerankDryRunResponse.body?.data?.resetAssignmentsCount,
          rerankPreservedManualCount: rerankDryRunResponse.body?.data?.preservedManualAssignmentCount,
          rerankLogIncrement: rerankLogCountAfter - rerankLogCountBefore,
          assnSessionId,
          assnRoomAutoAssignments
        },
        null,
        2
      )
    );
  } finally {
    if (cleanup.assignmentIds.length > 0 || cleanup.sessionIds.length > 0) {
      await prisma.assignment.deleteMany({
        where: {
          OR: [
            cleanup.assignmentIds.length > 0
              ? {
                  id: {
                    in: cleanup.assignmentIds
                  }
                }
              : undefined,
            cleanup.sessionIds.length > 0
              ? {
                  sessionId: {
                    in: cleanup.sessionIds
                  }
                }
              : undefined
          ].filter(Boolean)
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
