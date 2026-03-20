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

  return { response, body };
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
    // cleanup best effort
  }
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
    sessionIds: [],
    cycleIds: [],
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

    ensure(loginResponse.response.status === 303, `Login failed: ${loginResponse.response.status}`);
    const cookie = formatCookie(loginResponse.response.headers);
    ensure(cookie, "Missing auth cookie");

    const now = Date.now();
    const date = "2321-01-10";

    const [building, roleDefinition] = await Promise.all([
      prisma.building.findFirst({
        where: { isActive: true },
        select: { id: true }
      }),
      prisma.assignmentRoleDefinition.findFirst({
        where: { isActive: true, manualOnly: false, scope: "BUILDING" },
        orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
        select: { id: true }
      })
    ]);

    ensure(building?.id, "Missing active building");
    ensure(roleDefinition?.id, "Missing active auto role");

    const cycleResponse = await request(
      "/api/cycles",
      {
        method: "POST",
        ...buildJsonRequest({
          code: `AUTO-CANCELLED-${now}`,
          name: `Auto Cancelled Cycle ${now}`,
          nameEn: `Auto Cancelled Cycle EN ${now}`,
          status: "ACTIVE",
          startDate: date,
          endDate: "2321-01-12"
        })
      },
      cookie
    );
    ensure(cycleResponse.response.ok, `Create cycle failed: ${JSON.stringify(cycleResponse.body)}`);
    const cycleId = cycleResponse.body?.data?.id;
    ensure(cycleId, "Missing cycle id");
    cleanup.cycleIds.push(cycleId);

    const sessionResponse = await request(
      "/api/sessions",
      {
        method: "POST",
        ...buildJsonRequest({
          cycleId,
          name: `Auto Cancelled Session ${now}`,
          nameEn: `Auto Cancelled Session EN ${now}`,
          examType: "EST1",
          startDateTime: `${date}T09:00:00+02:00`,
          endDateTime: `${date}T11:00:00+02:00`,
          buildingIds: [building.id]
        })
      },
      cookie
    );
    ensure(sessionResponse.response.ok, `Create session failed: ${JSON.stringify(sessionResponse.body)}`);
    const sessionId = sessionResponse.body?.data?.id;
    ensure(sessionId, "Missing session id");
    cleanup.sessionIds.push(sessionId);

    const user = await prisma.user.create({
      data: {
        name: `Auto Cancelled Candidate ${now}`,
        nameEn: `Auto Cancelled Candidate EN ${now}`,
        phone: `+2014${String(now).slice(-8)}`,
        source: "EXTERNAL",
        averageRating: 4.5,
        isActive: true,
        blockStatus: "CLEAR"
      },
      select: { id: true }
    });
    cleanup.userIds.push(user.id);

    const createResponse = await request(
      "/api/assignments",
      {
        method: "POST",
        ...buildJsonRequest({
          sessionId,
          userId: user.id,
          buildingId: building.id,
          roleDefinitionId: roleDefinition.id
        })
      },
      cookie
    );
    ensure(createResponse.response.status === 201, `Create assignment failed: ${JSON.stringify(createResponse.body)}`);
    const assignmentId = createResponse.body?.data?.id;
    ensure(assignmentId, "Missing created assignment id");
    cleanup.assignmentIds.push(assignmentId);

    const cancelResponse = await request(
      `/api/assignments/${assignmentId}`,
      { method: "DELETE" },
      cookie
    );
    ensure(cancelResponse.response.ok, `Cancel assignment failed: ${JSON.stringify(cancelResponse.body)}`);

    const autoResponse = await request(
      "/api/assignments/auto",
      {
        method: "POST",
        ...buildJsonRequest({
          sessionId,
          roleDefinitionIds: [roleDefinition.id],
          candidateUserIds: [user.id],
          dryRun: false
        })
      },
      cookie
    );

    ensure(autoResponse.response.ok, `Auto assign should not fail after cancellation: ${JSON.stringify(autoResponse.body)}`);
    ensure(
      autoResponse.body?.data?.createdAssignmentsCount === 0,
      `Expected no new assignments because cancelled user is excluded: ${JSON.stringify(autoResponse.body)}`
    );

    const sessionAssignments = await prisma.assignment.findMany({
      where: { sessionId },
      select: { id: true, status: true, userId: true }
    });

    ensure(sessionAssignments.length === 1, `Expected one historical cancelled assignment, got ${sessionAssignments.length}`);
    ensure(sessionAssignments[0].status === "CANCELLED", "Historical assignment status should remain CANCELLED");

    console.log(
      JSON.stringify(
        {
          cycleId,
          sessionId,
          userId: user.id,
          createdAssignmentsCount: autoResponse.body?.data?.createdAssignmentsCount,
          skippedUserPoolCount: autoResponse.body?.data?.skippedUserPoolCount,
          existingAssignmentsCount: autoResponse.body?.data?.existingAssignmentsCount
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
      await safeRequest(`/api/sessions/${sessionId}`, { method: "DELETE" }, cleanupCookie);
    }

    for (const cycleId of cleanup.cycleIds.reverse()) {
      await safeRequest(
        `/api/cycles/${cycleId}`,
        {
          method: "PATCH",
          ...buildJsonRequest({ isActive: false })
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
