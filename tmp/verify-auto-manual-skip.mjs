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

    const idx = trimmed.indexOf("=");
    if (idx <= 0) {
      continue;
    }

    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();

    if (process.env[key] === undefined) {
      process.env[key] = value.replace(/^"|"$/g, "");
    }
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
    // best effort
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
    const date = "2322-02-10";

    const [building, autoRole, manualRole] = await Promise.all([
      prisma.building.findFirst({ where: { isActive: true }, select: { id: true } }),
      prisma.assignmentRoleDefinition.findFirst({
        where: { isActive: true, manualOnly: false, scope: "BUILDING" },
        orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
        select: { id: true, key: true }
      }),
      prisma.assignmentRoleDefinition.findFirst({
        where: { isActive: true, manualOnly: true, scope: "BUILDING" },
        orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
        select: { id: true, key: true }
      })
    ]);

    ensure(building?.id, "Missing active building");
    ensure(autoRole?.id, "Missing auto role");
    ensure(manualRole?.id, "Missing manual-only role");

    const cycleResponse = await request(
      "/api/cycles",
      {
        method: "POST",
        ...buildJsonRequest({
          code: `AUTO-MANUAL-SKIP-${now}`,
          name: `Auto Manual Skip Cycle ${now}`,
          nameEn: `Auto Manual Skip Cycle EN ${now}`,
          status: "ACTIVE",
          startDate: date,
          endDate: "2322-02-12"
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
          name: `Auto Manual Skip Session ${now}`,
          nameEn: `Auto Manual Skip Session EN ${now}`,
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
        name: `Auto Manual Skip Candidate ${now}`,
        nameEn: `Auto Manual Skip Candidate EN ${now}`,
        phone: `+2013${String(now).slice(-8)}`,
        source: "EXTERNAL",
        averageRating: 4.8,
        isActive: true,
        blockStatus: "CLEAR"
      },
      select: { id: true }
    });
    cleanup.userIds.push(user.id);

    const autoResponse = await request(
      "/api/assignments/auto",
      {
        method: "POST",
        ...buildJsonRequest({
          sessionId,
          roleDefinitionIds: [manualRole.id, autoRole.id],
          candidateUserIds: [user.id],
          dryRun: false
        })
      },
      cookie
    );

    ensure(autoResponse.response.ok, `Auto assign failed: ${JSON.stringify(autoResponse.body)}`);
    ensure(autoResponse.body?.data?.skippedManualRoleCount === 1, "Expected one skipped manual role");
    ensure(autoResponse.body?.data?.roleCount === 1, "Expected one active auto role in execution");
    ensure(autoResponse.body?.data?.createdAssignmentsCount === 1, "Expected one created assignment");

    const assignments = await prisma.assignment.findMany({
      where: { sessionId },
      select: { id: true, roleDefinitionId: true, status: true }
    });

    for (const assignment of assignments) {
      cleanup.assignmentIds.push(assignment.id);
    }

    ensure(assignments.length === 1, `Expected exactly one assignment, got ${assignments.length}`);
    ensure(assignments[0].roleDefinitionId === autoRole.id, "Manual-only role should never be auto-assigned");

    console.log(
      JSON.stringify(
        {
          cycleId,
          sessionId,
          manualRoleId: manualRole.id,
          autoRoleId: autoRole.id,
          skippedManualRoleCount: autoResponse.body?.data?.skippedManualRoleCount,
          createdAssignmentsCount: autoResponse.body?.data?.createdAssignmentsCount
        },
        null,
        2
      )
    );
  } finally {
    if (cleanup.assignmentIds.length > 0) {
      await prisma.assignment.deleteMany({ where: { id: { in: cleanup.assignmentIds } } });
    }

    if (cleanup.userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: cleanup.userIds } } });
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
