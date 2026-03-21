import fs from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

const baseUrl = process.env.EXAMOPS_BASE_URL ?? "http://127.0.0.1:3105";
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

async function requestWithRetry(
  pathname,
  options = {},
  cookie,
  attempts = 3,
  retryDelayMs = 400
) {
  let lastResult = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = await request(pathname, options, cookie);
    lastResult = result;

    const isRetriable =
      result.response.status >= 500 ||
      result.body?.error === "internal_server_error";

    if (!isRetriable || attempt === attempts) {
      return result;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, retryDelayMs * attempt);
    });
  }

  return lastResult;
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

async function login() {
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
  return cookie;
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
    createdUserIds: [],
    sessionIds: [],
    cycleIds: [],
    assignmentIds: []
  };

  let cleanupCookie = null;

  try {
    const cookie = await login();
    cleanupCookie = cookie;

    const now = Date.now();
    const baseDate = new Date(Date.UTC(2320 + (now % 15), 0, 10));
    const cycleStartDate = toDateOnly(baseDate);
    const cycleEndDate = toDateOnly(new Date(baseDate.getTime() + 3 * 24 * 60 * 60 * 1000));
    const sessionDate = toDateOnly(baseDate);

    const [buildings, roleDefinition] = await Promise.all([
      prisma.building.findMany({
        where: {
          isActive: true
        },
        orderBy: {
          createdAt: "asc"
        },
        take: 2,
        select: {
          id: true
        }
      }),
      prisma.assignmentRoleDefinition.findFirst({
        where: {
          isActive: true,
          manualOnly: false,
          scope: "BUILDING"
        },
        orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
        select: {
          id: true
        }
      })
    ]);

    ensure(buildings.length >= 2, "At least two active buildings are required for overlap verification");
    ensure(roleDefinition?.id, "No active non-manual BUILDING role definition found");
    const targetBuildingId = buildings[0].id;
    const overlapBuildingId = buildings[1].id;

    const cycleResponse = await requestWithRetry(
      "/api/cycles",
      {
        method: "POST",
        ...buildJsonRequest({
          code: `AUTO-ASSIGN-CYCLE-${now}`,
          name: `Auto Assignment Cycle ${now}`,
          nameEn: `Auto Assignment Cycle EN ${now}`,
          status: "ACTIVE",
          startDate: cycleStartDate,
          endDate: cycleEndDate,
          notes: "Auto-assignment v1 verification"
        })
      },
      cookie
    );
    ensure(cycleResponse.response.ok, `Create cycle failed: ${JSON.stringify(cycleResponse.body)}`);
    const cycleId = cycleResponse.body?.data?.id;
    ensure(cycleId, "Cycle id missing");
    cleanup.cycleIds.push(cycleId);

    const targetSessionResponse = await requestWithRetry(
      "/api/sessions",
      {
        method: "POST",
        ...buildJsonRequest({
          cycleId,
          name: `Auto Assignment Target Session ${now}`,
          nameEn: `Auto Assignment Target Session EN ${now}`,
          examType: "EST1",
          startDateTime: `${sessionDate}T09:00:00+02:00`,
          endDateTime: `${sessionDate}T11:00:00+02:00`,
          buildingIds: [targetBuildingId],
          notes: "Auto-assignment target session"
        })
      },
      cookie
    );
    ensure(
      targetSessionResponse.response.ok,
      `Create target session failed: ${JSON.stringify(targetSessionResponse.body)}`
    );
    const targetSessionId = targetSessionResponse.body?.data?.id;
    ensure(targetSessionId, "Target session id missing");
    cleanup.sessionIds.push(targetSessionId);

    const overlapSessionResponse = await requestWithRetry(
      "/api/sessions",
      {
        method: "POST",
        ...buildJsonRequest({
          cycleId,
          name: `Auto Assignment Overlap Session ${now}`,
          nameEn: `Auto Assignment Overlap Session EN ${now}`,
          examType: "EST2",
          startDateTime: `${sessionDate}T09:30:00+02:00`,
          endDateTime: `${sessionDate}T11:30:00+02:00`,
          buildingIds: [overlapBuildingId],
          notes: "Overlap exclusion session"
        })
      },
      cookie
    );
    ensure(
      overlapSessionResponse.response.ok,
      `Create overlap session failed: ${JSON.stringify(overlapSessionResponse.body)}`
    );
    const overlapSessionId = overlapSessionResponse.body?.data?.id;
    ensure(overlapSessionId, "Overlap session id missing");
    cleanup.sessionIds.push(overlapSessionId);

    const createUser = async (suffix) => {
      const user = await prisma.user.create({
        data: {
          name: `Auto Assign Candidate ${suffix} ${now}`,
          nameEn: `Auto Assign Candidate EN ${suffix} ${now}`,
          phone: `+2015${String(now + suffix).slice(-8)}`,
          source: "EXTERNAL",
          averageRating: 4.75,
          totalSessions: suffix,
          blockStatus: "CLEAR",
          isActive: true
        },
        select: {
          id: true
        }
      });

      cleanup.createdUserIds.push(user.id);
      return user.id;
    };

    const candidateAId = await createUser(1);
    const candidateBId = await createUser(2);

    const overlapAssignmentResponse = await request(
      "/api/assignments",
      {
        method: "POST",
        ...buildJsonRequest({
          sessionId: overlapSessionId,
          userId: candidateBId,
          buildingId: overlapBuildingId,
          roleDefinitionId: roleDefinition.id
        })
      },
      cookie
    );
    ensure(
      overlapAssignmentResponse.response.status === 201,
      `Create overlap assignment failed: ${JSON.stringify(overlapAssignmentResponse.body)}`
    );
    const overlapAssignmentId = overlapAssignmentResponse.body?.data?.id;
    ensure(overlapAssignmentId, "Overlap assignment id missing");
    cleanup.assignmentIds.push(overlapAssignmentId);

    const initialLogCount = await prisma.activityLog.count({
      where: {
        action: "auto_assign",
        entityType: "assignment",
        entityId: targetSessionId
      }
    });

    const dryRunResponse = await request(
      "/api/assignments/auto",
      {
        method: "POST",
        ...buildJsonRequest({
          sessionId: targetSessionId,
          roleDefinitionIds: [roleDefinition.id],
          candidateUserIds: [candidateAId, candidateBId],
          dryRun: true
        })
      },
      cookie
    );
    ensure(dryRunResponse.response.ok, `Dry-run failed: ${JSON.stringify(dryRunResponse.body)}`);
    ensure(
      dryRunResponse.body?.data?.dryRun === true,
      `Dry-run response flag mismatch: ${JSON.stringify(dryRunResponse.body)}`
    );
    ensure(
      dryRunResponse.body?.data?.createdAssignmentsCount === 0,
      `Dry-run should not create assignments: ${JSON.stringify(dryRunResponse.body)}`
    );
    ensure(
      dryRunResponse.body?.data?.plannedAssignmentsCount === 1,
      `Dry-run should plan exactly one assignment: ${JSON.stringify(dryRunResponse.body)}`
    );

    const executeResponse = await request(
      "/api/assignments/auto",
      {
        method: "POST",
        ...buildJsonRequest({
          sessionId: targetSessionId,
          roleDefinitionIds: [roleDefinition.id],
          candidateUserIds: [candidateAId, candidateBId],
          dryRun: false
        })
      },
      cookie
    );
    ensure(executeResponse.response.ok, `Auto-assign failed: ${JSON.stringify(executeResponse.body)}`);

    const autoResult = executeResponse.body?.data;
    ensure(autoResult?.dryRun === false, "Execution response should report dryRun=false");
    ensure(
      autoResult?.createdAssignmentsCount === 1,
      `Expected one created assignment: ${JSON.stringify(autoResult)}`
    );
    ensure(
      autoResult?.plannedAssignmentsCount === 1,
      `Expected one planned assignment: ${JSON.stringify(autoResult)}`
    );
    ensure(
      Array.isArray(autoResult?.createdAssignmentIds) && autoResult.createdAssignmentIds.length === 1,
      `Expected one created assignment id: ${JSON.stringify(autoResult)}`
    );

    const createdAssignmentId = autoResult.createdAssignmentIds[0];
    cleanup.assignmentIds.push(createdAssignmentId);

    const createdAssignment = await prisma.assignment.findUnique({
      where: {
        id: createdAssignmentId
      },
      select: {
        id: true,
        sessionId: true,
        userId: true,
        assignedMethod: true,
        status: true,
        roleDefinitionId: true,
        buildingId: true
      }
    });
    ensure(createdAssignment?.sessionId === targetSessionId, "Created assignment session linkage mismatch");
    ensure(createdAssignment?.userId === candidateAId, "Overlap candidate should be excluded from assignment");
    ensure(createdAssignment?.assignedMethod === "AUTO", "Created assignment should be AUTO");
    ensure(createdAssignment?.status === "DRAFT", "Created assignment status should be DRAFT");

    const secondRunResponse = await request(
      "/api/assignments/auto",
      {
        method: "POST",
        ...buildJsonRequest({
          sessionId: targetSessionId,
          roleDefinitionIds: [roleDefinition.id],
          candidateUserIds: [candidateAId, candidateBId],
          dryRun: false
        })
      },
      cookie
    );
    ensure(secondRunResponse.response.ok, `Second run failed: ${JSON.stringify(secondRunResponse.body)}`);
    ensure(
      secondRunResponse.body?.data?.createdAssignmentsCount === 0,
      `Second run should not create duplicate assignments: ${JSON.stringify(secondRunResponse.body)}`
    );

    const targetAssignments = await prisma.assignment.findMany({
      where: {
        sessionId: targetSessionId
      },
      select: {
        id: true,
        userId: true,
        status: true
      }
    });

    const assignedToA = targetAssignments.filter((item) => item.userId === candidateAId);
    const assignedToB = targetAssignments.filter((item) => item.userId === candidateBId);
    ensure(assignedToA.length === 1, "Candidate A should have one assignment in target session");
    ensure(assignedToB.length === 0, "Candidate B should be excluded due to overlap");

    const finalLogCount = await prisma.activityLog.count({
      where: {
        action: "auto_assign",
        entityType: "assignment",
        entityId: targetSessionId
      }
    });
    ensure(
      finalLogCount === initialLogCount + 2,
      `Expected two auto_assign logs (two execution runs), got ${finalLogCount - initialLogCount}`
    );

    const latestLog = await prisma.activityLog.findFirst({
      where: {
        action: "auto_assign",
        entityType: "assignment",
        entityId: targetSessionId
      },
      orderBy: {
        occurredAt: "desc"
      },
      select: {
        metadata: true
      }
    });
    ensure(latestLog?.metadata && typeof latestLog.metadata === "object", "Auto-assign log metadata missing");

    const metadata = latestLog.metadata;
    ensure(metadata.sessionId === targetSessionId, "Auto-assign log metadata sessionId mismatch");

    console.log(
      JSON.stringify(
        {
          cycleId,
          targetSessionId,
          overlapSessionId,
          roleDefinitionId: roleDefinition.id,
          createdAssignmentId,
          plannedAssignmentsCount: autoResult.plannedAssignmentsCount,
          createdAssignmentsCount: autoResult.createdAssignmentsCount,
          secondRunCreatedAssignmentsCount: secondRunResponse.body?.data?.createdAssignmentsCount,
          autoAssignLogIncrement: finalLogCount - initialLogCount
        },
        null,
        2
      )
    );
  } finally {
    if (cleanup.assignmentIds.length > 0) {
      await prisma.assignment.deleteMany({
        where: {
          id: {
            in: cleanup.assignmentIds
          }
        }
      });
    }

    if (cleanupCookie) {
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
