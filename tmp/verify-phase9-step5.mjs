import assert from "node:assert/strict";

import { PrismaClient, SettingValueType } from "@prisma/client";

const prisma = new PrismaClient();

const baseUrl = process.env.EXAMOPS_BASE_URL ?? "http://127.0.0.1:4010";
const adminEmail = process.env.EXAMOPS_ADMIN_EMAIL ?? "admin@examops.local";
const adminPassword =
  process.env.EXAMOPS_ADMIN_PASSWORD ??
  process.env.SEED_APP_USERS_PASSWORD ??
  "ChangeMe123!";

const seed = Date.now();
const suffix = String(seed).slice(-8);
const assignmentTemplateKey = "assignment_created";
const notificationSettingKeys = [
  "email_enabled",
  "whatsapp_enabled",
  "whatsapp_provider",
  "whatsapp_api_key",
  "whatsapp_sender_id",
  "whatsapp_account_sid",
  "sms_enabled",
  "sms_provider",
  "sms_api_key",
  "sms_sender_id",
  "sms_account_sid"
];

const assignmentTemplate = {
  type: "assignment",
  variables: [
    "name",
    "session",
    "role",
    "building",
    "examType",
    "sessionDate",
    "assignmentId",
    "assignmentStatus",
    "assignedMethod"
  ],
  subjectEn: "Assignment {{name}}",
  subjectAr: "\u062a\u0643\u0644\u064a\u0641 {{name}}",
  bodyEn: "Session {{session}} role {{role}} in {{building}}.",
  bodyAr: "\u0627\u0644\u062c\u0644\u0633\u0629 {{session}} \u0648\u0627\u0644\u062f\u0648\u0631 {{role}} \u0641\u064a {{building}}."
};

function expect(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function asRecord(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }

  return null;
}

function extractCookie(setCookieHeader, cookieName) {
  if (!setCookieHeader) {
    return null;
  }

  const matcher = new RegExp(`${cookieName}=([^;]+)`);
  const match = setCookieHeader.match(matcher);

  return match?.[1] ?? null;
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
  const token = extractCookie(response.headers.get("set-cookie"), "examops_session");

  if (!token) {
    throw new Error("Could not authenticate admin user for Phase 9 Step 5 verification.");
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

function getFutureWindow() {
  const now = new Date();
  const sessionDate = new Date(now);
  sessionDate.setDate(sessionDate.getDate() + 2);
  sessionDate.setHours(0, 0, 0, 0);

  const startsAt = new Date(sessionDate);
  startsAt.setHours(9, 0, 0, 0);

  const endsAt = new Date(sessionDate);
  endsAt.setHours(11, 0, 0, 0);

  return {
    sessionDate,
    startsAt,
    endsAt
  };
}

async function upsertAssignmentTemplate() {
  const existing = await prisma.emailTemplate.findUnique({
    where: {
      key: assignmentTemplateKey
    }
  });

  await prisma.emailTemplate.upsert({
    where: {
      key: assignmentTemplateKey
    },
    create: {
      key: assignmentTemplateKey,
      type: assignmentTemplate.type,
      subjectAr: assignmentTemplate.subjectAr,
      subjectEn: assignmentTemplate.subjectEn,
      bodyAr: assignmentTemplate.bodyAr,
      bodyEn: assignmentTemplate.bodyEn,
      variables: assignmentTemplate.variables,
      isActive: true
    },
    update: {
      type: assignmentTemplate.type,
      subjectAr: assignmentTemplate.subjectAr,
      subjectEn: assignmentTemplate.subjectEn,
      bodyAr: assignmentTemplate.bodyAr,
      bodyEn: assignmentTemplate.bodyEn,
      variables: assignmentTemplate.variables,
      isActive: true
    }
  });

  return existing;
}

async function restoreAssignmentTemplate(backup) {
  if (backup) {
    await prisma.emailTemplate.update({
      where: {
        id: backup.id
      },
      data: {
        key: backup.key,
        type: backup.type,
        subjectAr: backup.subjectAr,
        subjectEn: backup.subjectEn,
        bodyAr: backup.bodyAr,
        bodyEn: backup.bodyEn,
        variables: backup.variables,
        isActive: backup.isActive
      }
    });
    return;
  }

  await prisma.emailTemplate.deleteMany({
    where: {
      key: assignmentTemplateKey
    }
  });
}

async function backupNotificationSettings() {
  const existing = await prisma.setting.findMany({
    where: {
      key: {
        in: notificationSettingKeys
      }
    }
  });

  return new Map(existing.map((setting) => [setting.key, setting]));
}

async function upsertSettingRecord(record) {
  await prisma.setting.upsert({
    where: {
      key: record.key
    },
    create: {
      key: record.key,
      group: "notifications",
      label: record.key,
      labelEn: record.key,
      description: record.key,
      descriptionEn: record.key,
      type: record.type,
      value: record.value,
      isPublic: false,
      isActive: true,
      sortOrder: 500
    },
    update: {
      type: record.type,
      value: record.value,
      isActive: true
    }
  });
}

async function applyNotificationSettings(values) {
  const records = [
    {
      key: "email_enabled",
      type: SettingValueType.BOOLEAN,
      value: values.emailEnabled
    },
    {
      key: "whatsapp_enabled",
      type: SettingValueType.BOOLEAN,
      value: values.whatsapp.enabled
    },
    {
      key: "whatsapp_provider",
      type: SettingValueType.STRING,
      value: values.whatsapp.provider
    },
    {
      key: "whatsapp_api_key",
      type: SettingValueType.STRING,
      value: values.whatsapp.apiKey
    },
    {
      key: "whatsapp_sender_id",
      type: SettingValueType.STRING,
      value: values.whatsapp.senderId
    },
    {
      key: "whatsapp_account_sid",
      type: SettingValueType.STRING,
      value: values.whatsapp.accountSid
    },
    {
      key: "sms_enabled",
      type: SettingValueType.BOOLEAN,
      value: values.sms.enabled
    },
    {
      key: "sms_provider",
      type: SettingValueType.STRING,
      value: values.sms.provider
    },
    {
      key: "sms_api_key",
      type: SettingValueType.STRING,
      value: values.sms.apiKey
    },
    {
      key: "sms_sender_id",
      type: SettingValueType.STRING,
      value: values.sms.senderId
    },
    {
      key: "sms_account_sid",
      type: SettingValueType.STRING,
      value: values.sms.accountSid
    }
  ];

  for (const record of records) {
    await upsertSettingRecord(record);
  }
}

async function restoreNotificationSettings(backupMap) {
  for (const key of notificationSettingKeys) {
    const existing = backupMap.get(key);

    if (existing) {
      await prisma.setting.update({
        where: {
          id: existing.id
        },
        data: {
          key: existing.key,
          group: existing.group,
          label: existing.label,
          labelEn: existing.labelEn,
          description: existing.description,
          descriptionEn: existing.descriptionEn,
          type: existing.type,
          value: existing.value,
          isPublic: existing.isPublic,
          isActive: existing.isActive,
          sortOrder: existing.sortOrder
        }
      });
      continue;
    }

    await prisma.setting.deleteMany({
      where: {
        key
      }
    });
  }
}

async function createFixture() {
  const { sessionDate, startsAt, endsAt } = getFutureWindow();

  const governorate = await prisma.governorate.create({
    data: {
      code: `P9S5-G-${seed}`,
      name: `P9S5 Gov ${seed}`,
      nameEn: `P9S5 Gov ${seed}`
    },
    select: {
      id: true
    }
  });

  const university = await prisma.university.create({
    data: {
      governorateId: governorate.id,
      code: `P9S5-U-${seed}`,
      name: `P9S5 Uni ${seed}`,
      nameEn: `P9S5 Uni ${seed}`
    },
    select: {
      id: true
    }
  });

  const building = await prisma.building.create({
    data: {
      universityId: university.id,
      code: `P9S5-B-${seed}`,
      name: `P9S5 Building ${seed}`,
      nameEn: `P9S5 Building ${seed}`
    },
    select: {
      id: true
    }
  });

  const cycle = await prisma.cycle.create({
    data: {
      code: `P9S5-C-${seed}`,
      name: `P9S5 Cycle ${seed}`,
      nameEn: `P9S5 Cycle ${seed}`,
      status: "ACTIVE",
      startDate: sessionDate,
      endDate: new Date(sessionDate.getTime() + 7 * 24 * 60 * 60 * 1000)
    },
    select: {
      id: true
    }
  });

  const session = await prisma.session.create({
    data: {
      cycleId: cycle.id,
      name: `P9S5 Session ${seed}`,
      nameEn: `P9S5 Session ${seed}`,
      examType: "EST1",
      sessionDate,
      startsAt,
      endsAt,
      status: "LOCKED",
      isActive: true
    },
    select: {
      id: true
    }
  });

  const sessionBuilding = await prisma.sessionBuilding.create({
    data: {
      sessionId: session.id,
      buildingId: building.id,
      isActive: true
    },
    select: {
      id: true
    }
  });

  const roleDefinition = await prisma.assignmentRoleDefinition.findFirst({
    where: {
      key: "building_head",
      isActive: true
    },
    select: {
      id: true
    }
  });
  expect(roleDefinition, "Role definition building_head is missing.");

  return {
    governorateId: governorate.id,
    universityId: university.id,
    buildingId: building.id,
    cycleId: cycle.id,
    sessionId: session.id,
    sessionBuildingId: sessionBuilding.id,
    roleDefinitionId: roleDefinition.id
  };
}

async function createScenarioUser(index, options = {}) {
  const user = await prisma.user.create({
    data: {
      name: `P9S5 User ${index} ${seed}`,
      nameEn: `P9S5 User ${index} ${seed}`,
      phone: options.phone ?? `20188${index}${suffix.slice(0, 4)}`,
      email:
        options.email ??
        `p9s5.user${index}.${seed}@example.com`,
      source: "EXTERNAL",
      preferredLanguage: index % 2 === 0 ? "AR" : "EN",
      isActive: true,
      blockStatus: "CLEAR"
    },
    select: {
      id: true,
      phone: true
    }
  });

  const preferenceOverrides =
    options.notificationPreference && typeof options.notificationPreference === "object"
      ? options.notificationPreference
      : {};

  await prisma.notificationPreference.upsert({
    where: {
      userId: user.id
    },
    create: {
      userId: user.id,
      emailEnabled:
        typeof preferenceOverrides.emailEnabled === "boolean"
          ? preferenceOverrides.emailEnabled
          : true,
      whatsappEnabled:
        typeof preferenceOverrides.whatsappEnabled === "boolean"
          ? preferenceOverrides.whatsappEnabled
          : true,
      smsEnabled:
        typeof preferenceOverrides.smsEnabled === "boolean"
          ? preferenceOverrides.smsEnabled
          : true,
      inAppEnabled:
        typeof preferenceOverrides.inAppEnabled === "boolean"
          ? preferenceOverrides.inAppEnabled
          : true
    },
    update: {
      emailEnabled:
        typeof preferenceOverrides.emailEnabled === "boolean"
          ? preferenceOverrides.emailEnabled
          : true,
      whatsappEnabled:
        typeof preferenceOverrides.whatsappEnabled === "boolean"
          ? preferenceOverrides.whatsappEnabled
          : true,
      smsEnabled:
        typeof preferenceOverrides.smsEnabled === "boolean"
          ? preferenceOverrides.smsEnabled
          : true,
      inAppEnabled:
        typeof preferenceOverrides.inAppEnabled === "boolean"
          ? preferenceOverrides.inAppEnabled
          : true
    }
  });

  return user;
}

async function waitForChannelLog({
  action,
  entityType,
  userId,
  since,
  attempts = 20,
  sleepMs = 250
}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const logs = await prisma.activityLog.findMany({
      where: {
        action,
        entityType,
        occurredAt: {
          gte: since
        }
      },
      orderBy: {
        occurredAt: "desc"
      },
      select: {
        id: true,
        metadata: true
      }
    });
    const matched = logs.find((log) => {
      const metadata = asRecord(log.metadata);
      return metadata?.recipientUserId === userId;
    });

    if (matched) {
      return matched;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, sleepMs);
    });
  }

  return null;
}

async function getChannelLogsForUser({ actions, entityType, userId, since }) {
  const logs = await prisma.activityLog.findMany({
    where: {
      action: {
        in: actions
      },
      entityType,
      occurredAt: {
        gte: since
      }
    },
    select: {
      id: true,
      metadata: true
    }
  });

  return logs.filter((log) => {
    const metadata = asRecord(log.metadata);
    return metadata?.recipientUserId === userId;
  });
}

let backupTemplate = null;
let backupSettings = new Map();
let fixture = null;
let createdUserIds = [];
let createdAssignmentIds = [];
let scriptStartedAt = new Date();

try {
  backupTemplate = await upsertAssignmentTemplate();
  backupSettings = await backupNotificationSettings();
  fixture = await createFixture();
  const cookie = await loginAndGetCookie();
  scriptStartedAt = new Date();

  await applyNotificationSettings({
    emailEnabled: false,
    whatsapp: {
      enabled: false,
      provider: "meta_whatsapp_cloud",
      apiKey: "simulate_success",
      senderId: "+201001234567",
      accountSid: ""
    },
    sms: {
      enabled: true,
      provider: "mock_sms_cloud",
      apiKey: "simulate_success",
      senderId: "+201001234567",
      accountSid: ""
    }
  });

  const fallbackUser = await createScenarioUser(1);
  createdUserIds.push(fallbackUser.id);
  const fallbackScenarioStartedAt = new Date();
  const fallbackAssignResponse = await postJson(
    "/api/assignments",
    {
      sessionId: fixture.sessionId,
      userId: fallbackUser.id,
      buildingId: fixture.buildingId,
      roleDefinitionId: fixture.roleDefinitionId
    },
    cookie
  );
  assert.equal(fallbackAssignResponse.status, 201);
  assert.equal(fallbackAssignResponse.body.ok, true);
  createdAssignmentIds.push(fallbackAssignResponse.body.data.id);

  const smsFallbackLog = await waitForChannelLog({
    action: "sms_sent",
    entityType: "notification_sms",
    userId: fallbackUser.id,
    since: fallbackScenarioStartedAt
  });
  expect(smsFallbackLog, "Expected sms_sent log when both email and WhatsApp are disabled.");
  const fallbackMetadata = asRecord(smsFallbackLog.metadata);
  assert.equal(fallbackMetadata?.provider, "mock_sms_cloud");

  const fallbackWhatsAppLogs = await getChannelLogsForUser({
    actions: ["whatsapp_sent", "whatsapp_failed"],
    entityType: "notification_whatsapp",
    userId: fallbackUser.id,
    since: fallbackScenarioStartedAt
  });
  assert.equal(
    fallbackWhatsAppLogs.length,
    0,
    "WhatsApp logs should not exist when WhatsApp is disabled."
  );

  await applyNotificationSettings({
    emailEnabled: true,
    whatsapp: {
      enabled: true,
      provider: "meta_whatsapp_cloud",
      apiKey: "simulate_failure",
      senderId: "+201001234567",
      accountSid: ""
    },
    sms: {
      enabled: true,
      provider: "mock_sms_cloud",
      apiKey: "simulate_success",
      senderId: "+201001234567",
      accountSid: ""
    }
  });

  const noFallbackUser = await createScenarioUser(2);
  createdUserIds.push(noFallbackUser.id);
  const noFallbackScenarioStartedAt = new Date();
  const noFallbackAssignResponse = await postJson(
    "/api/assignments",
    {
      sessionId: fixture.sessionId,
      userId: noFallbackUser.id,
      buildingId: fixture.buildingId,
      roleDefinitionId: fixture.roleDefinitionId
    },
    cookie
  );
  assert.equal(noFallbackAssignResponse.status, 201);
  assert.equal(noFallbackAssignResponse.body.ok, true);
  createdAssignmentIds.push(noFallbackAssignResponse.body.data.id);

  await new Promise((resolve) => {
    setTimeout(resolve, 500);
  });
  const noFallbackWhatsAppLogs = await getChannelLogsForUser({
    actions: ["whatsapp_sent", "whatsapp_failed"],
    entityType: "notification_whatsapp",
    userId: noFallbackUser.id,
    since: noFallbackScenarioStartedAt
  });
  assert.equal(
    noFallbackWhatsAppLogs.length,
    0,
    "WhatsApp must not trigger when email delivery succeeds."
  );
  const noFallbackSmsLogs = await getChannelLogsForUser({
    actions: ["sms_sent", "sms_failed"],
    entityType: "notification_sms",
    userId: noFallbackUser.id,
    since: noFallbackScenarioStartedAt
  });
  assert.equal(
    noFallbackSmsLogs.length,
    0,
    "SMS must not trigger when email succeeds even if WhatsApp fails."
  );

  await applyNotificationSettings({
    emailEnabled: false,
    whatsapp: {
      enabled: false,
      provider: "meta_whatsapp_cloud",
      apiKey: "simulate_success",
      senderId: "+201001234567",
      accountSid: ""
    },
    sms: {
      enabled: false,
      provider: "mock_sms_cloud",
      apiKey: "simulate_success",
      senderId: "+201001234567",
      accountSid: ""
    }
  });

  const smsDisabledUser = await createScenarioUser(3);
  createdUserIds.push(smsDisabledUser.id);
  const smsDisabledStartedAt = new Date();
  const smsDisabledAssignResponse = await postJson(
    "/api/assignments",
    {
      sessionId: fixture.sessionId,
      userId: smsDisabledUser.id,
      buildingId: fixture.buildingId,
      roleDefinitionId: fixture.roleDefinitionId
    },
    cookie
  );
  assert.equal(smsDisabledAssignResponse.status, 201);
  assert.equal(smsDisabledAssignResponse.body.ok, true);
  createdAssignmentIds.push(smsDisabledAssignResponse.body.data.id);

  await new Promise((resolve) => {
    setTimeout(resolve, 500);
  });
  const disabledSmsLogs = await getChannelLogsForUser({
    actions: ["sms_sent", "sms_failed"],
    entityType: "notification_sms",
    userId: smsDisabledUser.id,
    since: smsDisabledStartedAt
  });
  assert.equal(
    disabledSmsLogs.length,
    0,
    "Disabled SMS settings should skip fallback without sms_sent/sms_failed logs."
  );

  await applyNotificationSettings({
    emailEnabled: false,
    whatsapp: {
      enabled: false,
      provider: "meta_whatsapp_cloud",
      apiKey: "simulate_success",
      senderId: "+201001234567",
      accountSid: ""
    },
    sms: {
      enabled: true,
      provider: "twilio",
      apiKey: "",
      senderId: "",
      accountSid: ""
    }
  });

  const invalidConfigUser = await createScenarioUser(4);
  createdUserIds.push(invalidConfigUser.id);
  const invalidConfigStartedAt = new Date();
  const invalidConfigAssignResponse = await postJson(
    "/api/assignments",
    {
      sessionId: fixture.sessionId,
      userId: invalidConfigUser.id,
      buildingId: fixture.buildingId,
      roleDefinitionId: fixture.roleDefinitionId
    },
    cookie
  );
  assert.equal(invalidConfigAssignResponse.status, 201);
  assert.equal(invalidConfigAssignResponse.body.ok, true);
  createdAssignmentIds.push(invalidConfigAssignResponse.body.data.id);

  const invalidConfigLog = await waitForChannelLog({
    action: "sms_failed",
    entityType: "notification_sms",
    userId: invalidConfigUser.id,
    since: invalidConfigStartedAt
  });
  expect(invalidConfigLog, "Expected sms_failed log for invalid SMS configuration.");
  const invalidConfigMetadata = asRecord(invalidConfigLog.metadata);
  assert.equal(invalidConfigMetadata?.provider, "twilio");
  assert.equal(invalidConfigMetadata?.reason, "config_missing");

  await applyNotificationSettings({
    emailEnabled: false,
    whatsapp: {
      enabled: false,
      provider: "meta_whatsapp_cloud",
      apiKey: "simulate_success",
      senderId: "+201001234567",
      accountSid: ""
    },
    sms: {
      enabled: true,
      provider: "mock_sms_cloud",
      apiKey: "simulate_failure",
      senderId: "+201001234567",
      accountSid: ""
    }
  });

  const providerFailureUser = await createScenarioUser(5);
  createdUserIds.push(providerFailureUser.id);
  const providerFailureStartedAt = new Date();
  const providerFailureAssignResponse = await postJson(
    "/api/assignments",
    {
      sessionId: fixture.sessionId,
      userId: providerFailureUser.id,
      buildingId: fixture.buildingId,
      roleDefinitionId: fixture.roleDefinitionId
    },
    cookie
  );
  assert.equal(providerFailureAssignResponse.status, 201);
  assert.equal(providerFailureAssignResponse.body.ok, true);
  createdAssignmentIds.push(providerFailureAssignResponse.body.data.id);

  const providerFailureLog = await waitForChannelLog({
    action: "sms_failed",
    entityType: "notification_sms",
    userId: providerFailureUser.id,
    since: providerFailureStartedAt
  });
  expect(providerFailureLog, "Expected sms_failed log when SMS provider fails.");
  const providerFailureMetadata = asRecord(providerFailureLog.metadata);
  assert.equal(providerFailureMetadata?.provider, "mock_sms_cloud");
  assert.equal(providerFailureMetadata?.reason, "provider_failed");

  await applyNotificationSettings({
    emailEnabled: false,
    whatsapp: {
      enabled: false,
      provider: "meta_whatsapp_cloud",
      apiKey: "simulate_success",
      senderId: "+201001234567",
      accountSid: ""
    },
    sms: {
      enabled: true,
      provider: "mock_sms_cloud",
      apiKey: "simulate_success",
      senderId: "+201001234567",
      accountSid: ""
    }
  });

  const invalidPhoneUser = await createScenarioUser(6, {
    phone: "invalid_phone_value"
  });
  createdUserIds.push(invalidPhoneUser.id);
  const invalidPhoneStartedAt = new Date();
  const invalidPhoneAssignResponse = await postJson(
    "/api/assignments",
    {
      sessionId: fixture.sessionId,
      userId: invalidPhoneUser.id,
      buildingId: fixture.buildingId,
      roleDefinitionId: fixture.roleDefinitionId
    },
    cookie
  );
  assert.equal(invalidPhoneAssignResponse.status, 201);
  assert.equal(invalidPhoneAssignResponse.body.ok, true);
  createdAssignmentIds.push(invalidPhoneAssignResponse.body.data.id);

  await new Promise((resolve) => {
    setTimeout(resolve, 500);
  });
  const invalidPhoneSmsLogs = await getChannelLogsForUser({
    actions: ["sms_sent", "sms_failed"],
    entityType: "notification_sms",
    userId: invalidPhoneUser.id,
    since: invalidPhoneStartedAt
  });
  assert.equal(
    invalidPhoneSmsLogs.length,
    0,
    "SMS fallback must not run when phone number is invalid."
  );

  const smsTestEndpointResponse = await postJson(
    "/api/notifications/sms/test",
    {
      phoneNumber: fallbackUser.phone,
      locale: "en",
      type: "test_message",
      title: {
        en: "Step 5 test",
        ar: "\u0627\u062e\u062a\u0628\u0627\u0631 \u0627\u0644\u062e\u0637\u0648\u0629 5"
      },
      body: {
        en: "Trigger SMS test endpoint",
        ar: "\u0627\u062e\u062a\u0628\u0627\u0631 \u0648\u0627\u062c\u0647\u0629 SMS"
      }
    },
    cookie
  );
  assert.equal(smsTestEndpointResponse.status, 200);
  assert.equal(smsTestEndpointResponse.body.ok, true);
  assert.equal(smsTestEndpointResponse.body?.data?.delivery?.status, "sent");

  console.log("Phase 9 Step 5 verification passed.");
  console.log(
    JSON.stringify(
      {
        smsTriggeredAsFallbackOnly: "passed",
        disabledConfigSkip: "passed",
        invalidConfigSafeHandling: "passed",
        loggingCorrectness: "passed",
        noCrashOnFailure: "passed"
      },
      null,
      2
    )
  );
} finally {
  const logsToDelete = await prisma.activityLog.findMany({
    where: {
      action: {
        in: ["sms_sent", "sms_failed", "whatsapp_sent", "whatsapp_failed"]
      },
      entityType: {
        in: ["notification_sms", "notification_whatsapp"]
      },
      occurredAt: {
        gte: scriptStartedAt
      }
    },
    select: {
      id: true,
      metadata: true
    }
  });
  const matchedLogIds = logsToDelete
    .filter((log) => {
      const metadata = asRecord(log.metadata);
      const recipientUserId =
        typeof metadata?.recipientUserId === "string"
          ? metadata.recipientUserId
          : null;

      return (
        !recipientUserId ||
        createdUserIds.includes(recipientUserId) ||
        metadata?.source === "api_sms_test"
      );
    })
    .map((log) => log.id);

  if (matchedLogIds.length > 0) {
    await prisma.activityLog.deleteMany({
      where: {
        id: {
          in: matchedLogIds
        }
      }
    });
  }

  if (createdAssignmentIds.length > 0) {
    await prisma.assignment.deleteMany({
      where: {
        id: {
          in: createdAssignmentIds
        }
      }
    });
  }

  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({
      where: {
        id: {
          in: createdUserIds
        }
      }
    });
  }

  if (fixture) {
    await prisma.sessionBuilding.deleteMany({
      where: {
        id: fixture.sessionBuildingId
      }
    });

    await prisma.session.deleteMany({
      where: {
        id: fixture.sessionId
      }
    });

    await prisma.cycle.deleteMany({
      where: {
        id: fixture.cycleId
      }
    });

    await prisma.building.deleteMany({
      where: {
        id: fixture.buildingId
      }
    });

    await prisma.university.deleteMany({
      where: {
        id: fixture.universityId
      }
    });

    await prisma.governorate.deleteMany({
      where: {
        id: fixture.governorateId
      }
    });
  }

  await restoreNotificationSettings(backupSettings);
  await restoreAssignmentTemplate(backupTemplate);
  await prisma.$disconnect();
}
