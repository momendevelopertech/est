import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const currentFile = fileURLToPath(import.meta.url);
const tmpDir = path.dirname(currentFile);
const rootDir = path.resolve(tmpDir, "..");

const monitoringSettingKeys = [
  "monitoring.api_error_alert_threshold",
  "monitoring.api_error_alert_window_minutes",
  "monitoring.notification_failure_alert_threshold",
  "monitoring.notification_failure_alert_window_minutes"
];

const httpHelpers = [
  "src/lib/assignments/http.ts",
  "src/lib/attendance/http.ts",
  "src/lib/blocks/http.ts",
  "src/lib/cycles/http.ts",
  "src/lib/evaluations/http.ts",
  "src/lib/export/http.ts",
  "src/lib/import/templates/http.ts",
  "src/lib/locations/http.ts",
  "src/lib/metrics/http.ts",
  "src/lib/notifications/email/http.ts",
  "src/lib/notifications/in-app/http.ts",
  "src/lib/notifications/preferences/http.ts",
  "src/lib/notifications/sms/http.ts",
  "src/lib/notifications/triggers/http.ts",
  "src/lib/notifications/whatsapp/http.ts",
  "src/lib/proctors/http.ts",
  "src/lib/promotion/http.ts",
  "src/lib/reports/http.ts",
  "src/lib/sessions/http.ts",
  "src/lib/swaps/http.ts",
  "src/lib/waiting-list/http.ts"
];

const monitoringCallsites = [
  "src/lib/notifications/sms/service.ts",
  "src/lib/notifications/whatsapp/service.ts",
  "src/lib/notifications/triggers/service.ts"
];

const result = {
  monitoringModuleExists: "pending",
  apiErrorMonitoringHooks: "pending",
  notificationFailureHooks: "pending",
  monitoringSettingsSeeded: "pending"
};

try {
  const monitoringModulePath = path.join(rootDir, "src/lib/monitoring/service.ts");
  assert.equal(
    fs.existsSync(monitoringModulePath),
    true,
    "Monitoring service module is missing."
  );
  result.monitoringModuleExists = "passed";

  for (const relativePath of httpHelpers) {
    const content = fs.readFileSync(path.join(rootDir, relativePath), "utf8");
    assert.equal(
      content.includes("reportApiError"),
      true,
      `Missing reportApiError hook in ${relativePath}.`
    );
  }
  result.apiErrorMonitoringHooks = "passed";

  for (const relativePath of monitoringCallsites) {
    const content = fs.readFileSync(path.join(rootDir, relativePath), "utf8");
    assert.equal(
      content.includes("reportNotificationFailure"),
      true,
      `Missing reportNotificationFailure hook in ${relativePath}.`
    );
  }
  result.notificationFailureHooks = "passed";

  const settings = await prisma.setting.findMany({
    where: {
      key: {
        in: monitoringSettingKeys
      },
      isActive: true
    },
    select: {
      key: true,
      value: true
    }
  });

  assert.equal(
    settings.length,
    monitoringSettingKeys.length,
    "Monitoring alert-threshold settings are not fully present in the database."
  );

  const settingMap = new Map(settings.map((setting) => [setting.key, setting.value]));

  for (const key of monitoringSettingKeys) {
    const value = settingMap.get(key);
    const numeric =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value)
          : null;
    assert.equal(
      typeof numeric === "number" && Number.isFinite(numeric) && numeric > 0,
      true,
      `Monitoring setting ${key} must be a positive number.`
    );
  }

  result.monitoringSettingsSeeded = "passed";

  console.log("Phase 10 Step 3 verification passed.");
  console.log(JSON.stringify(result, null, 2));
} finally {
  await prisma.$disconnect();
}
