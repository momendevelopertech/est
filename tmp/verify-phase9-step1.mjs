import assert from "node:assert/strict";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const baseUrl = process.env.EXAMOPS_BASE_URL ?? "http://127.0.0.1:4010";
const adminEmail = process.env.EXAMOPS_ADMIN_EMAIL ?? "admin@examops.local";
const adminPassword =
  process.env.EXAMOPS_ADMIN_PASSWORD ??
  process.env.SEED_APP_USERS_PASSWORD ??
  "ChangeMe123!";

const seed = Date.now();
const templateKey = `phase9_step1_${seed}`;

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

function asRecord(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }

  return null;
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
    throw new Error("Could not authenticate admin user for Phase 9 Step 1 verification.");
  }

  return `examops_session=${token}`;
}

async function postJson(path, payload, cookie) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Cookie: cookie
    },
    body: JSON.stringify(payload)
  });
  const body = await response.json();

  return {
    status: response.status,
    body
  };
}

function readTemplateFromUpsertResponse(payload) {
  const dataEnvelope = asRecord(payload?.data);
  return {
    mode: dataEnvelope?.mode ?? null,
    template: asRecord(dataEnvelope?.data)
  };
}

function metadataObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value;
}

let createdTemplateId = null;
let createdLogIds = [];
let scriptStartedAt = new Date();

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

  scriptStartedAt = new Date();
  const cookie = await loginAndGetCookie();

  const createPayload = {
    key: templateKey,
    type: "assignment",
    variables: ["name", "session", "role"],
    subject: {
      en: "Assignment notice for {{name}}",
      ar: "\u0625\u0634\u0639\u0627\u0631 \u062a\u0643\u0644\u064a\u0641 \u0644\u0640 {{name}}"
    },
    body: {
      en: "Hello {{name}}, your role is {{role}} in session {{session}}.",
      ar: "\u0645\u0631\u062d\u0628\u0627 {{name}} \u062f\u0648\u0631\u0643 {{role}} \u0641\u064a \u062c\u0644\u0633\u0629 {{session}}."
    },
    isActive: true
  };

  const createResponse = await postJson(
    "/api/notifications/email/templates",
    createPayload,
    cookie
  );
  assert.equal(createResponse.status, 201);
  assert.equal(createResponse.body.ok, true);
  const created = readTemplateFromUpsertResponse(createResponse.body);
  assert.equal(created.mode, "created");
  expect(created.template, "Create response template payload is missing.");
  assert.equal(created.template.key, templateKey);
  assert.equal(created.template.type, "assignment");
  assert.deepEqual(created.template.variables, ["name", "role", "session"]);
  createdTemplateId = created.template.id;

  const duplicateResponse = await postJson(
    "/api/notifications/email/templates",
    createPayload,
    cookie
  );
  assert.equal(duplicateResponse.status, 409);
  assert.equal(duplicateResponse.body.ok, false);
  assert.equal(
    duplicateResponse.body.error,
    "duplicate_email_template_key"
  );

  const updatePayload = {
    ...createPayload,
    templateId: createdTemplateId,
    subject: {
      en: "Updated assignment notice for {{name}}",
      ar: "\u062a\u062d\u062f\u064a\u062b \u0625\u0634\u0639\u0627\u0631 \u0627\u0644\u062a\u0643\u0644\u064a\u0641 \u0644\u0640 {{name}}"
    }
  };
  const updateResponse = await postJson(
    "/api/notifications/email/templates",
    updatePayload,
    cookie
  );
  assert.equal(updateResponse.status, 200);
  assert.equal(updateResponse.body.ok, true);
  const updated = readTemplateFromUpsertResponse(updateResponse.body);
  assert.equal(updated.mode, "updated");
  expect(updated.template, "Update response template payload is missing.");
  assert.equal(
    updated.template.subject.en,
    "Updated assignment notice for {{name}}"
  );

  const listResponse = await fetch(
    `${baseUrl}/api/notifications/email/templates?type=assignment&includeInactive=true`,
    {
      headers: {
        Accept: "application/json",
        Cookie: cookie
      }
    }
  );
  const listBody = await listResponse.json();
  assert.equal(listResponse.status, 200);
  assert.equal(listBody.ok, true);
  const listedTemplates = Array.isArray(listBody?.data?.data)
    ? listBody.data.data
    : [];
  const listedTemplate = listedTemplates.find(
    (template) => template.key === templateKey
  );
  expect(listedTemplate, "Created template should be returned by GET templates.");

  const previewCompleteResponse = await postJson(
    "/api/notifications/email/preview",
    {
      templateKey,
      locale: "en",
      variables: {
        name: "Sara",
        role: "building_head",
        session: "EST-2026-05-10"
      }
    },
    cookie
  );
  assert.equal(previewCompleteResponse.status, 200);
  assert.equal(previewCompleteResponse.body.ok, true);
  const previewComplete = asRecord(previewCompleteResponse.body.data);
  assert.equal(
    previewComplete?.renderedSubject,
    "Updated assignment notice for Sara"
  );
  assert.equal(
    previewComplete?.renderedBody,
    "Hello Sara, your role is building_head in session EST-2026-05-10."
  );
  assert.deepEqual(previewComplete?.missingVariables, []);
  assert.deepEqual(previewComplete?.unexpectedVariables, []);

  const previewMissingResponse = await postJson(
    "/api/notifications/email/preview",
    {
      templateKey,
      locale: "en",
      variables: {
        name: "Sara"
      }
    },
    cookie
  );
  assert.equal(previewMissingResponse.status, 200);
  assert.equal(previewMissingResponse.body.ok, true);
  const previewMissing = asRecord(previewMissingResponse.body.data);
  expect(
    typeof previewMissing?.renderedBody === "string",
    "Preview with missing variables should still render safely."
  );
  assert.deepEqual(previewMissing?.missingVariables, ["role", "session"]);

  const previewArabicResponse = await postJson(
    "/api/notifications/email/preview",
    {
      templateKey,
      locale: "ar",
      variables: {
        name: "\u0633\u0627\u0631\u0629",
        role: "\u0631\u0626\u064a\u0633 \u0645\u0628\u0646\u0649",
        session: "EST-2026-05-10"
      }
    },
    cookie
  );
  assert.equal(previewArabicResponse.status, 200);
  assert.equal(previewArabicResponse.body.ok, true);
  const previewArabic = asRecord(previewArabicResponse.body.data);
  expect(
    String(previewArabic?.renderedSubject ?? "").includes(
      "\u0633\u0627\u0631\u0629"
    ),
    "Arabic preview should use Arabic template content."
  );
  expect(
    String(previewArabic?.renderedBody ?? "").includes(
      "\u0631\u0626\u064a\u0633 \u0645\u0628\u0646\u0649"
    ),
    "Arabic preview body should render Arabic variable values."
  );

  const templateLogs = await prisma.activityLog.findMany({
    where: {
      actorAppUserId: adminUser.id,
      entityType: "email_template",
      entityId: createdTemplateId,
      occurredAt: {
        gte: scriptStartedAt
      }
    },
    select: {
      id: true,
      action: true,
      entityId: true,
      metadata: true
    }
  });
  createdLogIds = templateLogs.map((log) => log.id);
  const createLog = templateLogs.find((log) => log.action === "create_template");
  const updateLog = templateLogs.find((log) => log.action === "update_template");
  const previewLogs = templateLogs.filter((log) => log.action === "preview_template");

  expect(createLog, "Template create activity log is missing.");
  expect(updateLog, "Template update activity log is missing.");
  expect(
    previewLogs.length >= 3,
    "Template preview activity logs should be recorded for each preview request."
  );

  const previewLogWithMissing = previewLogs.some((log) => {
    const metadata = metadataObject(log.metadata);
    const missingVariables = Array.isArray(metadata?.missingVariables)
      ? metadata.missingVariables
      : [];
    return missingVariables.includes("role") && missingVariables.includes("session");
  });
  expect(
    previewLogWithMissing,
    "Preview log metadata should include missing variable details."
  );

  console.log("Phase 9 Step 1 verification passed.");
  console.log(
    JSON.stringify(
      {
        templateCreation: "passed",
        duplicatePrevention: "passed",
        updateAndLogging: "passed",
        renderingCorrectness: "passed",
        missingVariableHandling: "passed",
        bilingualPreview: "passed",
        activityLogs: "passed"
      },
      null,
      2
    )
  );
} finally {
  if (createdLogIds.length > 0) {
    await prisma.activityLog.deleteMany({
      where: {
        id: {
          in: createdLogIds
        }
      }
    });
  }

  if (createdTemplateId) {
    await prisma.emailTemplate.deleteMany({
      where: {
        id: createdTemplateId
      }
    });
  } else {
    await prisma.emailTemplate.deleteMany({
      where: {
        key: templateKey
      }
    });
  }

  await prisma.$disconnect();
}
