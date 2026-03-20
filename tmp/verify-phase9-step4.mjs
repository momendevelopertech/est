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
const whatsappSettingKeys = [
  "email_enabled",
  "whatsapp_enabled",
  "whatsapp_provider",
  "whatsapp_api_key",
  "whatsapp_sender_id",
  "whatsapp_account_sid"
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
    throw new Error("Could not authenticate admin user for Phase 9 Step 4 verification.");
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

async function backupWhatsAppSettings() {
  const existing = await prisma.setting.findMany({
    where: {
      key: {
        in: whatsappSettingKeys
      }
    }
  });

  return new Map(existing.map((setting) => [setting.key, setting]));
}

async function applyWhatsAppSettings(values) {
  const records = [
    {
      key: "email_enabled",
      type: SettingValueType.BOOLEAN,
      value: values.emailEnabled
    },
    {
      key: "whatsapp_enabled",
      type: SettingValueType.BOOLEAN,
      value: values.enabled
    },
    {
      key: "whatsapp_provider",
      type: SettingValueType.STRING,
      value: values.provider
    },
    {
      key: "whatsapp_api_key",
      type: SettingValueType.STRING,
      value: values.apiKey
    },
    {
      key: "whatsapp_sender_id",
      type: SettingValueType.STRING,
      value: values.senderId
    },
    {
      key: "whatsapp_account_sid",
      type: SettingValueType.STRING,
      value: values.accountSid
    }
  ];

  for (const record of records) {
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
}

async function restoreWhatsAppSettings(backupMap) {
  for (const key of whatsappSettingKeys) {
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
      code: `P9S4-G-${seed}`,
      name: `P9S4 Gov ${seed}`,
      nameEn: `P9S4 Gov ${seed}`
    },
    select: {
      id: true
    }
  });

  const university = await prisma.university.create({
    data: {
      governorateId: governorate.id,
      code: `P9S4-U-${seed}`,
      name: `P9S4 Uni ${seed}`,
      nameEn: `P9S4 Uni ${seed}`
    },
    select: {
      id: true
    }
  });

  const building = await prisma.building.create({
    data: {
      universityId: university.id,
      code: `P9S4-B-${seed}`,
      name: `P9S4 Building ${seed}`,
      nameEn: `P9S4 Building ${seed}`
    },
    select: {
      id: true
    }
  });

  const cycle = await prisma.cycle.create({
    data: {
      code: `P9S4-C-${seed}`,
      name: `P9S4 Cycle ${seed}`,
      nameEn: `P9S4 Cycle ${seed}`,
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
      name: `P9S4 Session ${seed}`,
      nameEn: `P9S4 Session ${seed}`,
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

async function createScenarioUser(index) {
  return prisma.user.create({
    data: {
      name: `P9S4 User ${index} ${seed}`,
      nameEn: `P9S4 User ${index} ${seed}`,
      phone: `20197${index}${suffix.slice(0, 5)}`,
      email: `p9s4.user${index}.${seed}@example.com`,
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
}

async function waitForWhatsAppLog({
  action,
  userId,
  since,
  attempts = 20,
  sleepMs = 250
}) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const logs = await prisma.activityLog.findMany({
      where: {
        action,
        entityType: "notification_whatsapp",
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

let backupTemplate = null;
let backupSettings = new Map();
let fixture = null;
let createdUserIds = [];
let createdAssignmentIds = [];
let scriptStartedAt = new Date();

try {
  backupTemplate = await upsertAssignmentTemplate();
  backupSettings = await backupWhatsAppSettings();
  fixture = await createFixture();
  const cookie = await loginAndGetCookie();
  scriptStartedAt = new Date();

  await applyWhatsAppSettings({
    emailEnabled: false,
    enabled: true,
    provider: "meta_whatsapp_cloud",
    apiKey: "simulate_success",
    senderId: "+201001234567",
    accountSid: ""
  });

  const userOne = await createScenarioUser(1);
  createdUserIds.push(userOne.id);
  const successAssignResponse = await postJson(
    "/api/assignments",
    {
      sessionId: fixture.sessionId,
      userId: userOne.id,
      buildingId: fixture.buildingId,
      roleDefinitionId: fixture.roleDefinitionId
    },
    cookie
  );
  assert.equal(successAssignResponse.status, 201);
  assert.equal(successAssignResponse.body.ok, true);
  createdAssignmentIds.push(successAssignResponse.body.data.id);

  const sentLog = await waitForWhatsAppLog({
    action: "whatsapp_sent",
    userId: userOne.id,
    since: scriptStartedAt
  });
  expect(sentLog, "Expected whatsapp_sent log for successful provider simulation.");
  const sentMetadata = asRecord(sentLog.metadata);
  assert.equal(sentMetadata?.provider, "meta_whatsapp_cloud");

  const testEndpointResponse = await postJson(
    "/api/notifications/whatsapp/test",
    {
      phoneNumber: userOne.phone,
      locale: "en",
      type: "test_message",
      title: {
        en: "Step 4 test",
        ar: "\u0627\u062e\u062a\u0628\u0627\u0631 \u0627\u0644\u062e\u0637\u0648\u0629 4"
      },
      body: {
        en: "Trigger test endpoint",
        ar: "\u0627\u062e\u062a\u0628\u0627\u0631 \u0648\u0627\u062c\u0647\u0629 \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631"
      }
    },
    cookie
  );
  assert.equal(testEndpointResponse.status, 200);
  assert.equal(testEndpointResponse.body.ok, true);
  assert.equal(testEndpointResponse.body?.data?.delivery?.status, "sent");

  await applyWhatsAppSettings({
    emailEnabled: false,
    enabled: true,
    provider: "meta_whatsapp_cloud",
    apiKey: "simulate_failure",
    senderId: "+201001234567",
    accountSid: ""
  });

  const userTwo = await createScenarioUser(2);
  createdUserIds.push(userTwo.id);
  const failureAssignResponse = await postJson(
    "/api/assignments",
    {
      sessionId: fixture.sessionId,
      userId: userTwo.id,
      buildingId: fixture.buildingId,
      roleDefinitionId: fixture.roleDefinitionId
    },
    cookie
  );
  assert.equal(failureAssignResponse.status, 201);
  assert.equal(failureAssignResponse.body.ok, true);
  createdAssignmentIds.push(failureAssignResponse.body.data.id);

  const providerFailureLog = await waitForWhatsAppLog({
    action: "whatsapp_failed",
    userId: userTwo.id,
    since: scriptStartedAt
  });
  expect(providerFailureLog, "Expected whatsapp_failed log for provider failure.");
  const providerFailureMetadata = asRecord(providerFailureLog.metadata);
  assert.equal(providerFailureMetadata?.provider, "meta_whatsapp_cloud");
  assert.equal(providerFailureMetadata?.reason, "provider_failed");

  await applyWhatsAppSettings({
    emailEnabled: false,
    enabled: false,
    provider: "meta_whatsapp_cloud",
    apiKey: "simulate_success",
    senderId: "+201001234567",
    accountSid: ""
  });

  const userThree = await createScenarioUser(3);
  createdUserIds.push(userThree.id);
  const disabledScenarioStartedAt = new Date();
  const disabledAssignResponse = await postJson(
    "/api/assignments",
    {
      sessionId: fixture.sessionId,
      userId: userThree.id,
      buildingId: fixture.buildingId,
      roleDefinitionId: fixture.roleDefinitionId
    },
    cookie
  );
  assert.equal(disabledAssignResponse.status, 201);
  assert.equal(disabledAssignResponse.body.ok, true);
  createdAssignmentIds.push(disabledAssignResponse.body.data.id);

  await new Promise((resolve) => {
    setTimeout(resolve, 500);
  });
  const disabledScenarioLogs = await prisma.activityLog.findMany({
    where: {
      action: {
        in: ["whatsapp_sent", "whatsapp_failed"]
      },
      entityType: "notification_whatsapp",
      occurredAt: {
        gte: disabledScenarioStartedAt
      }
    },
    select: {
      metadata: true
    }
  });
  const disabledUserLogs = disabledScenarioLogs.filter((log) => {
    const metadata = asRecord(log.metadata);
    return metadata?.recipientUserId === userThree.id;
  });
  assert.equal(
    disabledUserLogs.length,
    0,
    "Disabled WhatsApp config should skip delivery without sent/failed logs."
  );

  await applyWhatsAppSettings({
    emailEnabled: false,
    enabled: true,
    provider: "twilio",
    apiKey: "",
    senderId: "",
    accountSid: ""
  });

  const userFour = await createScenarioUser(4);
  createdUserIds.push(userFour.id);
  const invalidAssignResponse = await postJson(
    "/api/assignments",
    {
      sessionId: fixture.sessionId,
      userId: userFour.id,
      buildingId: fixture.buildingId,
      roleDefinitionId: fixture.roleDefinitionId
    },
    cookie
  );
  assert.equal(invalidAssignResponse.status, 201);
  assert.equal(invalidAssignResponse.body.ok, true);
  createdAssignmentIds.push(invalidAssignResponse.body.data.id);

  const invalidConfigFailureLog = await waitForWhatsAppLog({
    action: "whatsapp_failed",
    userId: userFour.id,
    since: scriptStartedAt
  });
  expect(
    invalidConfigFailureLog,
    "Expected whatsapp_failed log for invalid configuration."
  );
  const invalidMetadata = asRecord(invalidConfigFailureLog.metadata);
  assert.equal(invalidMetadata?.provider, "twilio");
  assert.equal(invalidMetadata?.reason, "config_missing");

  console.log("Phase 9 Step 4 verification passed.");
  console.log(
    JSON.stringify(
      {
        triggerWhatsAppAttempt: "passed",
        disabledConfigSkip: "passed",
        invalidConfigHandling: "passed",
        providerFailureNoCrash: "passed",
        loggingCorrectness: "passed"
      },
      null,
      2
    )
  );
} finally {
  const logsToDelete = await prisma.activityLog.findMany({
    where: {
      action: {
        in: ["whatsapp_sent", "whatsapp_failed"]
      },
      entityType: "notification_whatsapp",
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
        metadata?.source === "api_whatsapp_test"
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

  await restoreWhatsAppSettings(backupSettings);
  await restoreAssignmentTemplate(backupTemplate);
  await prisma.$disconnect();
}
