import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const tmpDir = path.dirname(currentFile);
const rootDir = path.resolve(tmpDir, "..");

const baseUrl = process.env.EXAMOPS_BASE_URL ?? "http://127.0.0.1:4010";
const adminEmail = process.env.EXAMOPS_ADMIN_EMAIL ?? "admin@examops.local";
const adminPassword =
  process.env.EXAMOPS_ADMIN_PASSWORD ??
  process.env.SEED_APP_USERS_PASSWORD ??
  "ChangeMe123!";
const viewerEmail = process.env.EXAMOPS_VIEWER_EMAIL ?? "viewer@examops.local";
const viewerPassword =
  process.env.EXAMOPS_VIEWER_PASSWORD ??
  process.env.SEED_APP_USERS_PASSWORD ??
  "ChangeMe123!";

const pwaStaticAssets = [
  "public/manifest.webmanifest",
  "public/sw.js",
  "public/offline.html",
  "public/icons/icon-192.svg",
  "public/icons/icon-512.svg",
  "public/icons/icon-maskable.svg"
];

const responsiveAuditFiles = [
  "src/components/dashboard/premium-dashboard.tsx",
  "src/components/sessions/sessions-workspace.tsx",
  "src/components/reports/report-summary-workspace.tsx",
  "src/components/notifications/notifications-workspace.tsx",
  "src/components/notifications/notification-preferences-workspace.tsx"
];

function extractCookie(setCookieHeader, cookieName) {
  if (!setCookieHeader) {
    return null;
  }

  const matcher = new RegExp(`${cookieName}=([^;]+)`);
  const match = setCookieHeader.match(matcher);

  return match?.[1] ?? null;
}

function flattenKeys(value, prefix = "") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, child]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    return flattenKeys(child, nextPrefix);
  });
}

function assertNoRawErrorLeak(payload, context) {
  const serialized = typeof payload === "string" ? payload : JSON.stringify(payload);
  const leakPattern =
    /Error:\s|ReferenceError|TypeError|SyntaxError|at\s+\w+|\.ts:\d+:\d+|node:internal/i;

  assert.equal(
    leakPattern.test(serialized),
    false,
    `${context} appears to leak raw internal errors.`
  );
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function isServerUp() {
  try {
    const response = await fetch(`${baseUrl}/login`, {
      method: "GET"
    });
    return response.status >= 200 && response.status < 500;
  } catch {
    return false;
  }
}

async function waitForServer(timeoutMs = 30_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isServerUp()) {
      return true;
    }
    await sleep(500);
  }

  return false;
}

function startServer() {
  const nextCliPath = path.join(rootDir, "node_modules", "next", "dist", "bin", "next");
  const hasBuild = fs.existsSync(path.join(rootDir, ".next", "BUILD_ID"));
  const mode = hasBuild ? "start" : "dev";
  const child = spawn(process.execPath, [nextCliPath, mode, "-p", String(new URL(baseUrl).port || 4010)], {
    cwd: rootDir,
    stdio: "inherit",
    env: {
      ...process.env
    }
  });

  return {
    child,
    mode
  };
}

async function loginAndGetCookie(locale, credentials = {}) {
  const email = credentials.email ?? adminEmail;
  const password = credentials.password ?? adminPassword;
  const form = new FormData();
  form.set("email", email);
  form.set("password", password);
  form.set("locale", locale);
  form.set("redirectTo", "/dashboard");

  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    body: form,
    redirect: "manual"
  });
  const sessionToken = extractCookie(response.headers.get("set-cookie"), "examops_session");

  if (!sessionToken) {
    throw new Error(`Could not authenticate ${email} for locale ${locale}.`);
  }

  return `examops_session=${sessionToken}; examops_locale=${locale}`;
}

async function getText(pathname, cookie) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "GET",
    headers: {
      Accept: "text/html",
      Cookie: cookie
    }
  });
  return {
    status: response.status,
    body: await response.text()
  };
}

async function getJson(pathname, cookie) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Cookie: cookie
    }
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
    status: response.status,
    body
  };
}

async function postJson(pathname, payload, cookie) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Cookie: cookie
    },
    body: JSON.stringify(payload)
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
    status: response.status,
    body
  };
}

const results = {
  localeParity: "pending",
  pwaAssets: "pending",
  pwaEndpoints: "pending",
  localeRendering: "pending",
  responsivenessAudit: "pending",
  themeAudit: "pending",
  accessibilityAudit: "pending",
  errorHandlingAudit: "pending"
};

let serverProcess = null;
let startedByScript = false;

try {
  if (!(await isServerUp())) {
    const started = startServer();
    serverProcess = started.child;
    startedByScript = true;
    console.log(`Started app server in ${started.mode} mode for production audit verification.`);

    const ready = await waitForServer();
    if (!ready) {
      throw new Error("Timed out waiting for app server.");
    }
  }

  const enMessages = JSON.parse(
    fs.readFileSync(path.join(rootDir, "src/locales/en.json"), "utf8")
  );
  const arMessages = JSON.parse(
    fs.readFileSync(path.join(rootDir, "src/locales/ar.json"), "utf8")
  );
  const enKeys = flattenKeys(enMessages).filter(Boolean);
  const arKeySet = new Set(flattenKeys(arMessages).filter(Boolean));
  const missingInAr = enKeys.filter((key) => !arKeySet.has(key));
  const extraInAr = [...arKeySet].filter((key) => !enKeys.includes(key));

  assert.equal(missingInAr.length, 0, `Missing Arabic keys: ${missingInAr.slice(0, 10).join(", ")}`);
  assert.equal(extraInAr.length, 0, `Extra Arabic keys: ${extraInAr.slice(0, 10).join(", ")}`);
  results.localeParity = "passed";

  for (const relativePath of pwaStaticAssets) {
    const absolutePath = path.join(rootDir, relativePath);
    assert.equal(fs.existsSync(absolutePath), true, `Missing PWA asset: ${relativePath}`);
  }
  results.pwaAssets = "passed";

  const manifestResponse = await getJson("/manifest.webmanifest", "");
  assert.equal(manifestResponse.status, 200);
  assert.equal(typeof manifestResponse.body?.name, "string");
  assert.equal(typeof manifestResponse.body?.start_url, "string");
  assert.equal(Array.isArray(manifestResponse.body?.icons), true);

  const swResponse = await getText("/sw.js", "");
  assert.equal(swResponse.status, 200);
  assert.equal(swResponse.body.includes("self.addEventListener"), true);

  const offlineResponse = await getText("/offline.html", "");
  assert.equal(offlineResponse.status, 200);
  assert.equal(offlineResponse.body.includes("You"), true);
  assert.equal(/[\u0600-\u06FF]/.test(offlineResponse.body), true);
  results.pwaEndpoints = "passed";

  const locales = ["en", "ar"];
  const pages = [
    "/dashboard",
    "/sessions",
    "/reports",
    "/notifications",
    "/settings/notifications"
  ];

  for (const locale of locales) {
    const cookie = await loginAndGetCookie(locale);

    for (const route of pages) {
      const pageResponse = await getText(route, cookie);
      assert.equal(pageResponse.status, 200, `Expected 200 for ${route} (${locale}).`);
      assert.equal(
        pageResponse.body.includes(locale === "ar" ? 'dir="rtl"' : 'dir="ltr"'),
        true,
        `Locale direction mismatch on ${route} (${locale}).`
      );
    }
  }
  results.localeRendering = "passed";

  for (const relativePath of responsiveAuditFiles) {
    const content = fs.readFileSync(path.join(rootDir, relativePath), "utf8");
    assert.equal(
      /(?:sm|md|lg|xl):/.test(content),
      true,
      `Responsive classes missing in ${relativePath}.`
    );
  }
  results.responsivenessAudit = "passed";

  const globalStyles = fs.readFileSync(path.join(rootDir, "src/app/globals.css"), "utf8");
  assert.equal(globalStyles.includes("html.dark"), true);
  assert.equal(globalStyles.includes("prefers-color-scheme: dark"), true);
  results.themeAudit = "passed";

  assert.equal(globalStyles.includes("prefers-reduced-motion: reduce"), true);
  const buttonComponent = fs.readFileSync(
    path.join(rootDir, "src/components/ui/button.tsx"),
    "utf8"
  );
  assert.equal(buttonComponent.includes("focus-visible:ring"), true);
  results.accessibilityAudit = "passed";

  const linkedUserCookie = await loginAndGetCookie("en", {
    email: viewerEmail,
    password: viewerPassword
  });

  const preferencesValidation = await postJson(
    "/api/notifications/preferences",
    {},
    linkedUserCookie
  );
  assert.equal(
    preferencesValidation.status >= 400 && preferencesValidation.status < 500,
    true
  );
  assertNoRawErrorLeak(preferencesValidation.body, "Notifications preferences validation response");

  const reportsValidation = await getJson(
    "/api/reports/assignments?sessionId=invalid_uuid",
    linkedUserCookie
  );
  assert.equal(reportsValidation.status >= 400 && reportsValidation.status < 500, true);
  assertNoRawErrorLeak(reportsValidation.body, "Reports validation response");

  const exportValidation = await getJson(
    "/api/export/assignments?format=invalid",
    linkedUserCookie
  );
  assert.equal(exportValidation.status >= 400 && exportValidation.status < 500, true);
  assertNoRawErrorLeak(exportValidation.body, "Export validation response");
  results.errorHandlingAudit = "passed";

  console.log("Production audit verification passed.");
  console.log(JSON.stringify(results, null, 2));
} finally {
  if (startedByScript && serverProcess) {
    serverProcess.kill("SIGTERM");
    await sleep(500);
  }
}
