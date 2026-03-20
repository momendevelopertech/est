import assert from "node:assert/strict";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const baseUrl = process.env.EXAMOPS_BASE_URL ?? "http://127.0.0.1:4010";
const adminEmail = process.env.EXAMOPS_ADMIN_EMAIL ?? "admin@examops.local";
const adminPassword =
  process.env.EXAMOPS_ADMIN_PASSWORD ??
  process.env.SEED_APP_USERS_PASSWORD ??
  "ChangeMe123!";

const requiredTemplateKeys = [
  "locations",
  "proctors",
  "cycle_proctors",
  "sphinx_staff"
];

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

function parseTemplateResponse(payload) {
  const wrapped = asRecord(payload);
  const dataEnvelope = asRecord(wrapped?.data);
  const templates = Array.isArray(dataEnvelope?.data) ? dataEnvelope.data : null;

  return {
    ok: wrapped?.ok === true,
    locale: dataEnvelope?.locale,
    templates
  };
}

function parseCsvLines(csvWithBom) {
  const withoutBom = csvWithBom.replace(/^\uFEFF/, "");
  const normalized = withoutBom.trimEnd();

  return normalized.split(/\r?\n/);
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
    throw new Error("Could not authenticate admin user for Step 1 verification.");
  }

  return `examops_session=${token}`;
}

async function fetchTemplateList(cookie, locale) {
  const response = await fetch(`${baseUrl}/api/import/templates?locale=${locale}`, {
    headers: {
      Accept: "application/json",
      Cookie: cookie
    }
  });
  const body = await response.json();

  return {
    status: response.status,
    body
  };
}

async function downloadTemplate(cookie, templateKey, withSample) {
  const params = new URLSearchParams();
  params.set("locale", "en");
  params.set("withSample", withSample ? "true" : "false");

  const response = await fetch(
    `${baseUrl}/api/import/templates/${templateKey}/download?${params.toString()}`,
    {
      headers: {
        Accept: "text/csv",
        Cookie: cookie
      }
    }
  );

  const content = await response.text();

  return {
    status: response.status,
    contentType: response.headers.get("content-type"),
    disposition: response.headers.get("content-disposition"),
    content
  };
}

function countTemplateDownloadLogs(logs, templateKey, withSample) {
  return logs.filter((log) => {
    const metadata = asRecord(log.metadata);
    return (
      metadata?.templateKey === templateKey && metadata?.withSample === withSample
    );
  }).length;
}

async function fetchRecentDownloadLogs(scriptStartedAt, adminAppUserId) {
  return prisma.activityLog.findMany({
    where: {
      action: "download_template",
      entityType: "import_template",
      actorAppUserId: adminAppUserId,
      occurredAt: {
        gte: scriptStartedAt
      }
    },
    orderBy: {
      occurredAt: "asc"
    },
    select: {
      id: true,
      actorAppUserId: true,
      metadata: true
    }
  });
}

async function verify() {
  const scriptStartedAt = new Date();
  const adminUser = await prisma.appUser.findUnique({
    where: {
      email: adminEmail
    },
    select: {
      id: true
    }
  });
  expect(adminUser, `Admin app user not found for email ${adminEmail}.`);

  const cookie = await loginAndGetCookie();

  const unauthorizedListResponse = await fetch(
    `${baseUrl}/api/import/templates?locale=en`,
    {
      headers: {
        Accept: "application/json"
      }
    }
  );
  assert.equal(
    unauthorizedListResponse.status,
    401,
    "Templates list should reject unauthenticated requests."
  );

  const listEn = await fetchTemplateList(cookie, "en");
  assert.equal(listEn.status, 200, "English template list should return 200.");
  const parsedListEn = parseTemplateResponse(listEn.body);
  assert.equal(parsedListEn.ok, true, "English list response should be ok.");
  assert.equal(parsedListEn.locale, "en", "English list locale should be en.");
  expect(parsedListEn.templates, "English list templates payload is missing.");

  const keys = parsedListEn.templates.map((template) => template.key);
  const uniqueKeys = new Set(keys);
  assert.equal(uniqueKeys.size, keys.length, "Template list must not contain duplicates.");
  for (const requiredKey of requiredTemplateKeys) {
    expect(uniqueKeys.has(requiredKey), `Template key ${requiredKey} is missing.`);
  }

  for (const template of parsedListEn.templates) {
    expect(Array.isArray(template.columns), `Template ${template.key} columns must be an array.`);
    expect(template.columns.length > 0, `Template ${template.key} columns must not be empty.`);
    assert.equal(
      template.columnCount,
      template.columns.length,
      `Template ${template.key} columnCount must match columns length.`
    );
    expect(
      template.sampleRowCount >= 0,
      `Template ${template.key} sampleRowCount must be non-negative.`
    );
  }

  const listAr = await fetchTemplateList(cookie, "ar");
  assert.equal(listAr.status, 200, "Arabic template list should return 200.");
  const parsedListAr = parseTemplateResponse(listAr.body);
  assert.equal(parsedListAr.ok, true, "Arabic list response should be ok.");
  assert.equal(parsedListAr.locale, "ar", "Arabic list locale should be ar.");
  expect(parsedListAr.templates, "Arabic list templates payload is missing.");
  assert.equal(
    parsedListAr.templates.length,
    parsedListEn.templates.length,
    "Arabic and English template lists must return equal item counts."
  );

  const locationsTemplateDownload = await downloadTemplate(cookie, "locations", false);
  assert.equal(
    locationsTemplateDownload.status,
    200,
    "Blank locations template download should return 200."
  );
  expect(
    locationsTemplateDownload.contentType?.includes("text/csv"),
    "Blank locations template must return CSV content type."
  );
  expect(
    locationsTemplateDownload.disposition?.includes(
      "examops-locations-import-template.csv"
    ),
    "Blank locations template filename is incorrect."
  );
  const locationsLines = parseCsvLines(locationsTemplateDownload.content);
  expect(locationsLines.length >= 1, "Blank template must contain a header row.");
  expect(
    locationsLines[0].includes("governorateCode"),
    "Blank locations template header is missing expected columns."
  );
  assert.equal(
    locationsLines.length,
    1,
    "Blank template should only include the header row."
  );

  const proctorsSampleDownload = await downloadTemplate(cookie, "proctors", true);
  assert.equal(
    proctorsSampleDownload.status,
    200,
    "Proctors sample template download should return 200."
  );
  expect(
    proctorsSampleDownload.contentType?.includes("text/csv"),
    "Proctors sample template must return CSV content type."
  );
  expect(
    proctorsSampleDownload.disposition?.includes("examops-proctors-import-sample.csv"),
    "Proctors sample template filename is incorrect."
  );
  const proctorsLines = parseCsvLines(proctorsSampleDownload.content);
  expect(proctorsLines.length > 1, "Sample template should include at least one sample row.");
  expect(
    proctorsLines[0].includes("phone"),
    "Proctors sample template header is missing expected columns."
  );

  const logsAfterSuccess = await fetchRecentDownloadLogs(scriptStartedAt, adminUser.id);
  const locationsTemplateLogs = countTemplateDownloadLogs(
    logsAfterSuccess,
    "locations",
    false
  );
  const proctorsSampleLogs = countTemplateDownloadLogs(
    logsAfterSuccess,
    "proctors",
    true
  );
  expect(
    locationsTemplateLogs >= 1,
    "Locations template download activity log is missing."
  );
  expect(proctorsSampleLogs >= 1, "Proctors sample download activity log is missing.");

  const invalidTemplateResponse = await fetch(
    `${baseUrl}/api/import/templates/not_a_valid_template/download?locale=en&withSample=true`,
    {
      headers: {
        Accept: "application/json",
        Cookie: cookie
      }
    }
  );
  const invalidTemplateBody = await invalidTemplateResponse.json();
  assert.equal(
    invalidTemplateResponse.status,
    400,
    "Invalid template key should return validation error."
  );
  assert.equal(invalidTemplateBody.ok, false, "Invalid template response should not be ok.");
  assert.equal(
    invalidTemplateBody.error,
    "validation_error",
    "Invalid template should map to validation_error."
  );

  const logsAfterInvalid = await fetchRecentDownloadLogs(scriptStartedAt, adminUser.id);
  const invalidTemplateLogs = countTemplateDownloadLogs(
    logsAfterInvalid,
    "not_a_valid_template",
    true
  );
  assert.equal(
    invalidTemplateLogs,
    0,
    "Invalid template request must not create download activity logs."
  );

  const createdLogIds = logsAfterInvalid.map((log) => log.id);

  console.log("Phase 8 Step 1 verification passed.");
  console.log(
    JSON.stringify(
      {
        realApiBehavior: "passed",
        edgeCaseInvalidTemplateRejected: "passed",
        rollbackSafetyNoLogOnValidationFailure: "passed",
        noDuplicateTemplateKeys: "passed",
        activityLogging: "passed",
        templateCount: parsedListEn.templates.length
      },
      null,
      2
    )
  );

  return {
    createdLogIds
  };
}

let createdLogIds = [];

try {
  const result = await verify();
  createdLogIds = result.createdLogIds;
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

  await prisma.$disconnect();
}
