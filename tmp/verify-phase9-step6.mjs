import assert from "node:assert/strict";

import bcrypt from "bcryptjs";
import { PrismaClient, SettingValueType } from "@prisma/client";

const prisma = new PrismaClient();
const { hash } = bcrypt;

const baseUrl = process.env.EXAMOPS_BASE_URL ?? "http://127.0.0.1:4010";
const adminEmail = process.env.EXAMOPS_ADMIN_EMAIL ?? "admin@examops.local";
const adminPassword =
  process.env.EXAMOPS_ADMIN_PASSWORD ??
  process.env.SEED_APP_USERS_PASSWORD ??
  "ChangeMe123!";

const seed = Date.now();
const suffix = String(seed).slice(-8);
const assignmentTemplateKey = "assignment_created";
const linkedAppUserPassword = `Phase9Step6!${String(seed).slice(-4)}`;

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
  subjectAr: "تكليف {{name}}",
  bodyEn: "Session {{session}} role {{role}} in {{building}}.",
  bodyAr: "الجلسة {{session}} والدور {{role}} في {{building}}."
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

async function loginAndGetCookie({ email, password }) {
  const form = new FormData();
  form.set("email", email);
  form.set("password", password);
  form.set("locale", "en");
  form.set("redirectTo", "/dashboard");

  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    body: form,
    redirect: "manual"
  });
  const token = extractCookie(response.headers.get("set-cookie"), "examops_session");

  if (!token) {
    throw new Error(`Could not authenticate ${email} for Phase 9 Step 6 verification.`);
  }

  return `examops_session=${token}`;
}

async function getJson(path, cookie) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "GET",
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

function getFutureWindow(dayOffset) {
  const now = new Date();
  const sessionDate = new Date(now);
  sessionDate.setDate(sessionDate.getDate() + dayOffset);
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
  const windowA = getFutureWindow(2);
  const windowB = getFutureWindow(3);
  const windowC = getFutureWindow(4);

  const governorate = await prisma.governorate.create({
    data: {
      code: `P9S6-G-${seed}`,
      name: `P9S6 Gov ${seed}`,
      nameEn: `P9S6 Gov ${seed}`
    },
    select: {
      id: true
    }
  });

  const university = await prisma.university.create({
    data: {
      governorateId: governorate.id,
      code: `P9S6-U-${seed}`,
      name: `P9S6 Uni ${seed}`,
      nameEn: `P9S6 Uni ${seed}`
    },
    select: {
      id: true
    }
  });

  const building = await prisma.building.create({
    data: {
      universityId: university.id,
      code: `P9S6-B-${seed}`,
      name: `P9S6 Building ${seed}`,
      nameEn: `P9S6 Building ${seed}`
    },
    select: {
      id: true
    }
  });

  const cycle = await prisma.cycle.create({
    data: {
      code: `P9S6-C-${seed}`,
      name: `P9S6 Cycle ${seed}`,
      nameEn: `P9S6 Cycle ${seed}`,
      status: "ACTIVE",
      startDate: windowA.sessionDate,
      endDate: new Date(windowC.sessionDate.getTime() + 2 * 24 * 60 * 60 * 1000)
    },
    select: {
      id: true
    }
  });

  const sessionA = await prisma.session.create({
    data: {
      cycleId: cycle.id,
      name: `P9S6 Session A ${seed}`,
      nameEn: `P9S6 Session A ${seed}`,
      examType: "EST1",
      sessionDate: windowA.sessionDate,
      startsAt: windowA.startsAt,
      endsAt: windowA.endsAt,
      status: "LOCKED",
      isActive: true
    },
    select: {
      id: true
    }
  });

  const sessionB = await prisma.session.create({
    data: {
      cycleId: cycle.id,
      name: `P9S6 Session B ${seed}`,
      nameEn: `P9S6 Session B ${seed}`,
      examType: "EST2",
      sessionDate: windowB.sessionDate,
      startsAt: windowB.startsAt,
      endsAt: windowB.endsAt,
      status: "LOCKED",
      isActive: true
    },
    select: {
      id: true
    }
  });

  const sessionC = await prisma.session.create({
    data: {
      cycleId: cycle.id,
      name: `P9S6 Session C ${seed}`,
      nameEn: `P9S6 Session C ${seed}`,
      examType: "EST_ASSN",
      sessionDate: windowC.sessionDate,
      startsAt: windowC.startsAt,
      endsAt: windowC.endsAt,
      status: "LOCKED",
      isActive: true
    },
    select: {
      id: true
    }
  });

  const [sessionBuildingA, sessionBuildingB, sessionBuildingC] = await Promise.all([
    prisma.sessionBuilding.create({
      data: {
        sessionId: sessionA.id,
        buildingId: building.id,
        isActive: true
      },
      select: {
        id: true
      }
    }),
    prisma.sessionBuilding.create({
      data: {
        sessionId: sessionB.id,
        buildingId: building.id,
        isActive: true
      },
      select: {
        id: true
      }
    }),
    prisma.sessionBuilding.create({
      data: {
        sessionId: sessionC.id,
        buildingId: building.id,
        isActive: true
      },
      select: {
        id: true
      }
    })
  ]);

  const user = await prisma.user.create({
    data: {
      name: `P9S6 User ${seed}`,
      nameEn: `P9S6 User ${seed}`,
      phone: `20196${suffix}`,
      email: `p9s6.user.${seed}@example.com`,
      source: "EXTERNAL",
      preferredLanguage: "EN",
      isActive: true,
      blockStatus: "CLEAR"
    },
    select: {
      id: true
    }
  });

  const linkedAppUser = await prisma.appUser.create({
    data: {
      email: `p9s6.viewer.${seed}@examops.local`,
      displayName: `P9S6 Viewer ${seed}`,
      role: "VIEWER",
      linkedUserId: user.id,
      preferredLanguage: "EN",
      preferredTheme: "SYSTEM",
      isActive: true,
      passwordHash: await hash(linkedAppUserPassword, 12)
    },
    select: {
      id: true,
      email: true
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
    sessionIds: [sessionA.id, sessionB.id, sessionC.id],
    sessionBuildingIds: [
      sessionBuildingA.id,
      sessionBuildingB.id,
      sessionBuildingC.id
    ],
    userId: user.id,
    linkedAppUserId: linkedAppUser.id,
    linkedAppUserEmail: linkedAppUser.email,
    roleDefinitionId: roleDefinition.id
  };
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

async function createAssignment({
  sessionId,
  userId,
  buildingId,
  roleDefinitionId,
  cookie
}) {
  return postJson(
    "/api/assignments",
    {
      sessionId,
      userId,
      buildingId,
      roleDefinitionId
    },
    cookie
  );
}

let backupTemplate = null;
let backupSettings = new Map();
let backupPreference = null;
let fixture = null;
let createdAssignmentIds = [];
let scriptStartedAt = new Date();

try {
  backupTemplate = await upsertAssignmentTemplate();
  backupSettings = await backupNotificationSettings();
  fixture = await createFixture();
  backupPreference = await prisma.notificationPreference.findUnique({
    where: {
      userId: fixture.userId
    }
  });

  const adminCookie = await loginAndGetCookie({
    email: adminEmail,
    password: adminPassword
  });
  const linkedCookie = await loginAndGetCookie({
    email: fixture.linkedAppUserEmail,
    password: linkedAppUserPassword
  });

  scriptStartedAt = new Date();

  await applyNotificationSettings({
    emailEnabled: true,
    whatsapp: {
      enabled: true,
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

  const pageResponse = await fetch(`${baseUrl}/settings/notifications`, {
    method: "GET",
    headers: {
      Accept: "text/html",
      Cookie: linkedCookie
    }
  });
  assert.equal(pageResponse.status, 200);
  const pageHtml = await pageResponse.text();
  expect(
    pageHtml.includes("Notifications delivery preferences"),
    "Settings notifications page should render basic UI content."
  );

  const invalidPost = await postJson("/api/notifications/preferences", {}, linkedCookie);
  assert.equal(invalidPost.status, 400, "Empty update payload should fail validation.");

  await prisma.notificationPreference.deleteMany({
    where: {
      userId: fixture.userId
    }
  });

  const getAutoCreated = await getJson("/api/notifications/preferences", linkedCookie);
  assert.equal(getAutoCreated.status, 200);
  assert.equal(getAutoCreated.body.ok, true);
  assert.equal(
    getAutoCreated.body?.data?.smsEnabled,
    false,
    "Defaults should auto-create with sms disabled."
  );

  const storedAutoCreated = await prisma.notificationPreference.findUnique({
    where: {
      userId: fixture.userId
    },
    select: {
      id: true
    }
  });
  expect(
    storedAutoCreated,
    "Notification preferences should be auto-created when missing."
  );

  const updateInitial = await postJson(
    "/api/notifications/preferences",
    {
      emailEnabled: false,
      whatsappEnabled: true,
      smsEnabled: true,
      inAppEnabled: true,
      preferredLanguage: "en"
    },
    linkedCookie
  );
  assert.equal(updateInitial.status, 200);
  assert.equal(updateInitial.body.ok, true);
  assert.equal(updateInitial.body?.data?.emailEnabled, false);
  assert.equal(updateInitial.body?.data?.whatsappEnabled, true);
  assert.equal(updateInitial.body?.data?.smsEnabled, true);
  assert.equal(updateInitial.body?.data?.inAppEnabled, true);
  assert.equal(updateInitial.body?.data?.preferredLanguage, "en");

  const preferencesUpdatedLog = await prisma.activityLog.findFirst({
    where: {
      action: "notification_preferences_updated",
      entityType: "notification_preferences",
      occurredAt: {
        gte: scriptStartedAt
      }
    },
    orderBy: {
      occurredAt: "desc"
    },
    select: {
      metadata: true
    }
  });
  expect(
    preferencesUpdatedLog &&
      asRecord(preferencesUpdatedLog.metadata)?.userId === fixture.userId,
    "Expected notification_preferences_updated activity log."
  );

  const scenarioAStartedAt = new Date();
  const assignmentA = await createAssignment({
    sessionId: fixture.sessionIds[0],
    userId: fixture.userId,
    buildingId: fixture.buildingId,
    roleDefinitionId: fixture.roleDefinitionId,
    cookie: adminCookie
  });
  assert.equal(assignmentA.status, 201);
  assert.equal(assignmentA.body.ok, true);
  createdAssignmentIds.push(assignmentA.body.data.id);

  const scenarioAWhatsAppLog = await waitForChannelLog({
    action: "whatsapp_sent",
    entityType: "notification_whatsapp",
    userId: fixture.userId,
    since: scenarioAStartedAt
  });
  expect(
    scenarioAWhatsAppLog,
    "Expected WhatsApp delivery when WhatsApp preference is enabled."
  );

  await new Promise((resolve) => {
    setTimeout(resolve, 500);
  });
  const scenarioASmsLogs = await getChannelLogsForUser({
    actions: ["sms_sent", "sms_failed"],
    entityType: "notification_sms",
    userId: fixture.userId,
    since: scenarioAStartedAt
  });
  assert.equal(
    scenarioASmsLogs.length,
    0,
    "SMS fallback must not trigger when WhatsApp succeeds."
  );

  const updateFallbackScenario = await postJson(
    "/api/notifications/preferences",
    {
      emailEnabled: false,
      whatsappEnabled: false,
      smsEnabled: true,
      inAppEnabled: true
    },
    linkedCookie
  );
  assert.equal(updateFallbackScenario.status, 200);
  assert.equal(updateFallbackScenario.body.ok, true);
  assert.equal(updateFallbackScenario.body?.data?.whatsappEnabled, false);
  assert.equal(updateFallbackScenario.body?.data?.smsEnabled, true);

  const scenarioBStartedAt = new Date();
  const assignmentB = await createAssignment({
    sessionId: fixture.sessionIds[1],
    userId: fixture.userId,
    buildingId: fixture.buildingId,
    roleDefinitionId: fixture.roleDefinitionId,
    cookie: adminCookie
  });
  assert.equal(assignmentB.status, 201);
  assert.equal(assignmentB.body.ok, true);
  createdAssignmentIds.push(assignmentB.body.data.id);

  await new Promise((resolve) => {
    setTimeout(resolve, 500);
  });
  const scenarioBWhatsAppLogs = await getChannelLogsForUser({
    actions: ["whatsapp_sent", "whatsapp_failed"],
    entityType: "notification_whatsapp",
    userId: fixture.userId,
    since: scenarioBStartedAt
  });
  assert.equal(
    scenarioBWhatsAppLogs.length,
    0,
    "WhatsApp should be skipped when user preference disables it."
  );

  const scenarioBSmsLog = await waitForChannelLog({
    action: "sms_sent",
    entityType: "notification_sms",
    userId: fixture.userId,
    since: scenarioBStartedAt
  });
  expect(
    scenarioBSmsLog,
    "Expected SMS fallback when email and WhatsApp are disabled by preference."
  );

  const updateAllDisabled = await postJson(
    "/api/notifications/preferences",
    {
      emailEnabled: false,
      whatsappEnabled: false,
      smsEnabled: false,
      inAppEnabled: false
    },
    linkedCookie
  );
  assert.equal(updateAllDisabled.status, 200);
  assert.equal(updateAllDisabled.body.ok, true);
  assert.equal(updateAllDisabled.body?.data?.inAppEnabled, false);

  const scenarioCStartedAt = new Date();
  const assignmentC = await createAssignment({
    sessionId: fixture.sessionIds[2],
    userId: fixture.userId,
    buildingId: fixture.buildingId,
    roleDefinitionId: fixture.roleDefinitionId,
    cookie: adminCookie
  });
  assert.equal(
    assignmentC.status,
    201,
    "Assignment creation should not crash when all channels are disabled."
  );
  assert.equal(assignmentC.body.ok, true);
  createdAssignmentIds.push(assignmentC.body.data.id);

  await new Promise((resolve) => {
    setTimeout(resolve, 500);
  });
  const scenarioCSmsLogs = await getChannelLogsForUser({
    actions: ["sms_sent", "sms_failed"],
    entityType: "notification_sms",
    userId: fixture.userId,
    since: scenarioCStartedAt
  });
  const scenarioCWhatsAppLogs = await getChannelLogsForUser({
    actions: ["whatsapp_sent", "whatsapp_failed"],
    entityType: "notification_whatsapp",
    userId: fixture.userId,
    since: scenarioCStartedAt
  });
  assert.equal(
    scenarioCSmsLogs.length,
    0,
    "SMS logs must not be created when SMS preference is disabled."
  );
  assert.equal(
    scenarioCWhatsAppLogs.length,
    0,
    "WhatsApp logs must not be created when WhatsApp preference is disabled."
  );

  const getFinal = await getJson("/api/notifications/preferences", linkedCookie);
  assert.equal(getFinal.status, 200);
  assert.equal(getFinal.body.ok, true);
  assert.equal(getFinal.body?.data?.emailEnabled, false);
  assert.equal(getFinal.body?.data?.whatsappEnabled, false);
  assert.equal(getFinal.body?.data?.smsEnabled, false);
  assert.equal(getFinal.body?.data?.inAppEnabled, false);

  console.log("Phase 9 Step 6 verification passed.");
  console.log(
    JSON.stringify(
      {
        toggleChannelsOnOff: "passed",
        triggerRespectsPreferences: "passed",
        fallbackSkipsDisabledChannels: "passed",
        noCrashWhenAllDisabled: "passed",
        apiCorrectness: "passed",
        uiRendersBasic: "passed"
      },
      null,
      2
    )
  );
} finally {
  if (fixture) {
    const candidateLogs = await prisma.activityLog.findMany({
      where: {
        occurredAt: {
          gte: scriptStartedAt
        }
      },
      select: {
        id: true,
        action: true,
        entityType: true,
        actorAppUserId: true,
        metadata: true
      }
    });
    const targetActions = new Set([
      "sms_sent",
      "sms_failed",
      "whatsapp_sent",
      "whatsapp_failed",
      "notification_preferences_updated",
      "notification_created",
      "notification_trigger_execute"
    ]);
    const logIdsToDelete = candidateLogs
      .filter((log) => {
        if (!targetActions.has(log.action)) {
          return false;
        }

        if (log.actorAppUserId === fixture.linkedAppUserId) {
          return true;
        }

        const metadata = asRecord(log.metadata);
        const recipientUserId =
          typeof metadata?.recipientUserId === "string"
            ? metadata.recipientUserId
            : null;
        const metadataUserId =
          typeof metadata?.userId === "string" ? metadata.userId : null;
        const targetUserId =
          typeof metadata?.targetUserId === "string" ? metadata.targetUserId : null;

        return (
          recipientUserId === fixture.userId ||
          metadataUserId === fixture.userId ||
          targetUserId === fixture.userId
        );
      })
      .map((log) => log.id);

    if (logIdsToDelete.length > 0) {
      await prisma.activityLog.deleteMany({
        where: {
          id: {
            in: logIdsToDelete
          }
        }
      });
    }
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

  if (fixture) {
    await prisma.notificationPreference.deleteMany({
      where: {
        userId: fixture.userId
      }
    });

    if (backupPreference) {
      await prisma.notificationPreference.create({
        data: {
          id: backupPreference.id,
          userId: backupPreference.userId,
          emailEnabled: backupPreference.emailEnabled,
          whatsappEnabled: backupPreference.whatsappEnabled,
          smsEnabled: backupPreference.smsEnabled,
          inAppEnabled: backupPreference.inAppEnabled,
          preferredLanguage: backupPreference.preferredLanguage
        }
      });
    }

    await prisma.appUser.deleteMany({
      where: {
        id: fixture.linkedAppUserId
      }
    });

    await prisma.user.deleteMany({
      where: {
        id: fixture.userId
      }
    });

    await prisma.sessionBuilding.deleteMany({
      where: {
        id: {
          in: fixture.sessionBuildingIds
        }
      }
    });

    await prisma.session.deleteMany({
      where: {
        id: {
          in: fixture.sessionIds
        }
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
