import assert from "node:assert/strict";

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const baseUrl = process.env.EXAMOPS_BASE_URL ?? "http://127.0.0.1:4010";
const adminEmail = process.env.EXAMOPS_ADMIN_EMAIL ?? "admin@examops.local";
const adminPassword =
  process.env.EXAMOPS_ADMIN_PASSWORD ??
  process.env.SEED_APP_USERS_PASSWORD ??
  "ChangeMe123!";

const seed = Date.now();
const suffix = String(seed).slice(-8);
const appUserPassword = `Phase9Step3!${String(seed).slice(-4)}`;
const longName = `P9S3-${"X".repeat(248)}`.slice(0, 255);
const { hash } = bcrypt;

const templateKeys = {
  assignmentCreated: "assignment_created",
  attendanceMarked: "attendance_marked"
};

const templateDefinitions = {
  [templateKeys.assignmentCreated]: {
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
  },
  [templateKeys.attendanceMarked]: {
    type: "attendance",
    variables: ["name", "session", "attendanceStatus", "attendanceState", "role"],
    subjectEn: "Attendance {{attendanceState}} for {{name}}",
    subjectAr: "حالة الحضور {{attendanceState}} لـ {{name}}",
    bodyEn: "Attendance {{attendanceStatus}} in {{session}}.",
    bodyAr: "الحضور {{attendanceStatus}} في {{session}}."
  }
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
    throw new Error(`Could not authenticate ${email} for Phase 9 Step 3 verification.`);
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

async function setupTemplates() {
  const keys = Object.values(templateKeys);
  const existing = await prisma.emailTemplate.findMany({
    where: {
      key: {
        in: keys
      }
    }
  });
  const backupByKey = new Map(existing.map((record) => [record.key, record]));

  for (const key of keys) {
    const definition = templateDefinitions[key];
    await prisma.emailTemplate.upsert({
      where: {
        key
      },
      create: {
        key,
        type: definition.type,
        subjectAr: definition.subjectAr,
        subjectEn: definition.subjectEn,
        bodyAr: definition.bodyAr,
        bodyEn: definition.bodyEn,
        variables: definition.variables,
        isActive: true
      },
      update: {
        type: definition.type,
        subjectAr: definition.subjectAr,
        subjectEn: definition.subjectEn,
        bodyAr: definition.bodyAr,
        bodyEn: definition.bodyEn,
        variables: definition.variables,
        isActive: true
      }
    });
  }

  return backupByKey;
}

async function restoreTemplates(backupByKey) {
  const keys = Object.values(templateKeys);

  for (const key of keys) {
    const backup = backupByKey.get(key);

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
      continue;
    }

    await prisma.emailTemplate.deleteMany({
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
      code: `P9S3-G-${seed}`,
      name: `P9S3 Gov ${seed}`,
      nameEn: `P9S3 Gov ${seed}`
    },
    select: {
      id: true
    }
  });

  const university = await prisma.university.create({
    data: {
      governorateId: governorate.id,
      code: `P9S3-U-${seed}`,
      name: `P9S3 Uni ${seed}`,
      nameEn: `P9S3 Uni ${seed}`
    },
    select: {
      id: true
    }
  });

  const building = await prisma.building.create({
    data: {
      universityId: university.id,
      code: `P9S3-B-${seed}`,
      name: `P9S3 Building ${seed}`,
      nameEn: `P9S3 Building ${seed}`
    },
    select: {
      id: true
    }
  });

  const floor = await prisma.floor.create({
    data: {
      buildingId: building.id,
      code: `P9S3-F-${seed}`,
      name: `P9S3 Floor ${seed}`,
      nameEn: `P9S3 Floor ${seed}`,
      levelNumber: 1
    },
    select: {
      id: true
    }
  });

  const cycle = await prisma.cycle.create({
    data: {
      code: `P9S3-C-${seed}`,
      name: `P9S3 Cycle ${seed}`,
      nameEn: `P9S3 Cycle ${seed}`,
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
      name: `P9S3 Session ${seed}`,
      nameEn: `P9S3 Session ${seed}`,
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

  const linkedUser = await prisma.user.create({
    data: {
      name: `P9S3 User ${seed}`,
      nameEn: `P9S3 User ${seed}`,
      phone: `20189${suffix}`,
      email: `p9s3.user.${seed}@example.com`,
      source: "EXTERNAL",
      preferredLanguage: "AR",
      isActive: true,
      blockStatus: "CLEAR"
    },
    select: {
      id: true
    }
  });

  const longNameUser = await prisma.user.create({
    data: {
      name: longName,
      nameEn: longName,
      phone: `20190${suffix}`,
      email: `p9s3.long.${seed}@example.com`,
      source: "EXTERNAL",
      preferredLanguage: "EN",
      isActive: true,
      blockStatus: "CLEAR"
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

  const linkedAppUser = await prisma.appUser.create({
    data: {
      email: `p9s3.viewer.${seed}@examops.local`,
      displayName: `P9S3 Viewer ${seed}`,
      role: "VIEWER",
      linkedUserId: linkedUser.id,
      preferredLanguage: "AR",
      preferredTheme: "SYSTEM",
      isActive: true,
      passwordHash: await hash(appUserPassword, 12)
    },
    select: {
      id: true,
      email: true
    }
  });

  return {
    governorateId: governorate.id,
    universityId: university.id,
    buildingId: building.id,
    floorId: floor.id,
    cycleId: cycle.id,
    sessionId: session.id,
    sessionBuildingId: sessionBuilding.id,
    linkedUserId: linkedUser.id,
    longNameUserId: longNameUser.id,
    linkedAppUserId: linkedAppUser.id,
    linkedAppUserEmail: linkedAppUser.email,
    roleDefinitionId: roleDefinition.id
  };
}

let backupTemplates = new Map();
let fixture = null;
let createdAssignmentIds = [];
let createdAttendanceIds = [];
let scriptStartedAt = new Date();

try {
  backupTemplates = await setupTemplates();
  fixture = await createFixture();
  scriptStartedAt = new Date();

  const adminCookie = await loginAndGetCookie({
    email: adminEmail,
    password: adminPassword
  });
  const linkedUserCookie = await loginAndGetCookie({
    email: fixture.linkedAppUserEmail,
    password: appUserPassword
  });

  const assignmentResponse = await postJson(
    "/api/assignments",
    {
      sessionId: fixture.sessionId,
      userId: fixture.linkedUserId,
      buildingId: fixture.buildingId,
      roleDefinitionId: fixture.roleDefinitionId
    },
    adminCookie
  );
  assert.equal(assignmentResponse.status, 201);
  assert.equal(assignmentResponse.body.ok, true);
  const assignmentId = assignmentResponse.body?.data?.id;
  expect(assignmentId, "Assignment ID was not returned.");
  createdAssignmentIds.push(assignmentId);

  const notificationsAfterAssignment = await prisma.inAppNotification.findMany({
    where: {
      userId: fixture.linkedUserId
    },
    orderBy: {
      createdAt: "desc"
    },
    select: {
      id: true,
      titleEn: true,
      titleAr: true,
      readAt: true
    }
  });
  expect(
    notificationsAfterAssignment.length > 0,
    "Trigger should create at least one in-app notification."
  );
  const firstNotificationId = notificationsAfterAssignment[0].id;
  expect(
    notificationsAfterAssignment[0].titleEn.includes("Assignment"),
    "English in-app notification title should be rendered."
  );
  expect(
    notificationsAfterAssignment[0].titleAr.includes("تكليف"),
    "Arabic in-app notification title should be rendered."
  );

  const listResponse = await getJson("/api/notifications/in-app?page=1&pageSize=20", linkedUserCookie);
  assert.equal(listResponse.status, 200);
  assert.equal(listResponse.body.ok, true);
  const listedNotifications = Array.isArray(listResponse.body?.data?.data)
    ? listResponse.body.data.data
    : [];
  expect(listedNotifications.length > 0, "Notifications API should list records.");
  expect(
    Number(listResponse.body?.data?.unreadCount ?? 0) >= 1,
    "Unread count should be returned from notifications API."
  );

  const markReadResponse = await postJson(
    "/api/notifications/in-app/read",
    {
      notificationId: firstNotificationId
    },
    linkedUserCookie
  );
  assert.equal(markReadResponse.status, 200);
  assert.equal(markReadResponse.body.ok, true);
  expect(
    markReadResponse.body?.data?.readAt,
    "Mark-as-read should return a non-null readAt."
  );

  const attendanceResponse = await postJson(
    "/api/attendance",
    {
      assignmentId,
      status: "CONFIRMED"
    },
    adminCookie
  );
  assert.equal(attendanceResponse.status, 200);
  assert.equal(attendanceResponse.body.ok, true);
  const attendanceId = attendanceResponse.body?.data?.attendance?.attendanceId;
  if (attendanceId) {
    createdAttendanceIds.push(attendanceId);
  }

  const markAllResponse = await postJson(
    "/api/notifications/in-app/read-all",
    {},
    linkedUserCookie
  );
  assert.equal(markAllResponse.status, 200);
  assert.equal(markAllResponse.body.ok, true);
  expect(
    Number(markAllResponse.body?.data?.updatedCount ?? 0) >= 1,
    "Mark-all-as-read should update at least one record."
  );

  const unreadAfterMarkAll = await prisma.inAppNotification.count({
    where: {
      userId: fixture.linkedUserId,
      readAt: null
    }
  });
  assert.equal(unreadAfterMarkAll, 0);

  await prisma.emailTemplate.update({
    where: {
      key: templateKeys.assignmentCreated
    },
    data: {
      subjectEn: "{{name}}{{name}}{{name}}",
      subjectAr: "{{name}}{{name}}{{name}}"
    }
  });

  const longNameAssignmentResponse = await postJson(
    "/api/assignments",
    {
      sessionId: fixture.sessionId,
      userId: fixture.longNameUserId,
      buildingId: fixture.buildingId,
      roleDefinitionId: fixture.roleDefinitionId
    },
    adminCookie
  );
  assert.equal(longNameAssignmentResponse.status, 201);
  assert.equal(longNameAssignmentResponse.body.ok, true);
  const longNameAssignmentId = longNameAssignmentResponse.body?.data?.id;
  expect(longNameAssignmentId, "Long-name assignment ID was not returned.");
  createdAssignmentIds.push(longNameAssignmentId);

  const longNameInAppCount = await prisma.inAppNotification.count({
    where: {
      userId: fixture.longNameUserId
    }
  });
  assert.equal(
    longNameInAppCount,
    0,
    "In-app notification should fail for oversized rendered title without crashing the trigger flow."
  );

  const triggerLogs = await prisma.activityLog.findMany({
    where: {
      action: "notification_trigger_execute",
      entityType: "notification_trigger",
      occurredAt: {
        gte: scriptStartedAt
      }
    },
    select: {
      metadata: true
    }
  });
  const triggerLog = triggerLogs.find(
    (log) => asRecord(log.metadata)?.eventType === "assignment_created"
  );
  expect(triggerLog, "Assignment trigger activity log should be recorded.");

  const notificationCreatedLogs = await prisma.activityLog.findMany({
    where: {
      action: "notification_created",
      entityType: "notification",
      occurredAt: {
        gte: scriptStartedAt
      }
    },
    select: {
      id: true
    }
  });
  expect(
    notificationCreatedLogs.length >= 2,
    "Notification create activity logs should be recorded."
  );

  const notificationReadLogs = await prisma.activityLog.findMany({
    where: {
      action: "notification_read",
      entityType: "notification",
      actorAppUserId: fixture.linkedAppUserId,
      occurredAt: {
        gte: scriptStartedAt
      }
    },
    select: {
      id: true
    }
  });
  expect(
    notificationReadLogs.length >= 2,
    "Notification read activity logs should be recorded for single and bulk read actions."
  );

  console.log("Phase 9 Step 3 verification passed.");
  console.log(
    JSON.stringify(
      {
        notificationCreatedViaTrigger: "passed",
        notificationListFetch: "passed",
        markAsRead: "passed",
        markAllAsRead: "passed",
        localization: "passed",
        partialFailureNoCrash: "passed",
        activityLogs: "passed"
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
        entityId: true,
        actorAppUserId: true,
        metadata: true
      }
    });
    const targetUserIds = new Set([fixture.linkedUserId, fixture.longNameUserId]);
    const targetEntityIds = new Set([fixture.sessionId, ...createdAssignmentIds]);
    const logIdsToDelete = candidateLogs
      .filter((log) => {
        const metadata = asRecord(log.metadata);
        const metadataTargetUserId =
          typeof metadata?.targetUserId === "string" ? metadata.targetUserId : null;
        const metadataAssignmentId =
          typeof metadata?.assignmentId === "string" ? metadata.assignmentId : null;
        const metadataSourceEntityId =
          typeof metadata?.sourceEntityId === "string"
            ? metadata.sourceEntityId
            : null;

        if (
          log.entityType === "notification" &&
          (targetUserIds.has(metadataTargetUserId ?? "") ||
            log.actorAppUserId === fixture.linkedAppUserId)
        ) {
          return true;
        }

        if (
          log.entityType === "notification_trigger" &&
          targetEntityIds.has(metadataSourceEntityId ?? log.entityId)
        ) {
          return true;
        }

        if (
          log.action === "attendance_update" &&
          targetEntityIds.has(metadataAssignmentId ?? "")
        ) {
          return true;
        }

        if (
          log.action === "create" &&
          log.entityType === "assignment" &&
          targetEntityIds.has(log.entityId)
        ) {
          return true;
        }

        return false;
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

  if (createdAttendanceIds.length > 0) {
    await prisma.attendance.deleteMany({
      where: {
        id: {
          in: createdAttendanceIds
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

  if (fixture) {
    await prisma.appUser.deleteMany({
      where: {
        id: fixture.linkedAppUserId
      }
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: [fixture.linkedUserId, fixture.longNameUserId]
        }
      }
    });

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

    await prisma.floor.deleteMany({
      where: {
        id: fixture.floorId
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

  if (backupTemplates.size > 0) {
    await restoreTemplates(backupTemplates);
  } else {
    await restoreTemplates(new Map());
  }

  await prisma.$disconnect();
}
