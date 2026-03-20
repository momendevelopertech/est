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
const suffix = String(seed).slice(-8);

const templateKeys = {
  assignmentCreated: "assignment_created",
  assignmentSwapped: "assignment_swapped",
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
    subjectEn: "Assign {{name}}",
    subjectAr: "\u062a\u0643\u0644\u064a\u0641 {{name}}",
    bodyEn:
      "Session {{session}} role {{role}} building {{building}} status {{assignmentStatus}}.",
    bodyAr:
      "\u0627\u0644\u062c\u0644\u0633\u0629 {{session}} \u0627\u0644\u062f\u0648\u0631 {{role}} \u0627\u0644\u0645\u0628\u0646\u0649 {{building}} \u0627\u0644\u062d\u0627\u0644\u0629 {{assignmentStatus}}."
  },
  [templateKeys.assignmentSwapped]: {
    type: "assignment",
    variables: ["name", "session", "role", "swapKind"],
    subjectEn: "Swap {{name}}",
    subjectAr: "\u062a\u0628\u062f\u064a\u0644 {{name}}",
    bodyEn: "Swap kind {{swapKind}} for {{name}} in {{session}} as {{role}}.",
    bodyAr:
      "\u0646\u0648\u0639 \u0627\u0644\u062a\u0628\u062f\u064a\u0644 {{swapKind}} \u0644\u0640 {{name}} \u0641\u064a {{session}} \u0628\u062f\u0648\u0631 {{role}}."
  },
  [templateKeys.attendanceMarked]: {
    type: "attendance",
    variables: [
      "name",
      "session",
      "attendanceStatus",
      "attendanceState",
      "role"
    ],
    subjectEn: "Attendance {{attendanceState}} for {{name}}",
    subjectAr:
      "\u062d\u0627\u0644\u0629 \u0627\u0644\u062d\u0636\u0648\u0631 {{attendanceState}} \u0644\u0640 {{name}}",
    bodyEn:
      "Attendance for {{name}} in {{session}} is {{attendanceStatus}} for role {{role}}.",
    bodyAr:
      "\u062d\u0636\u0648\u0631 {{name}} \u0641\u064a {{session}} \u0623\u0635\u0628\u062d {{attendanceStatus}} \u0644\u062f\u0648\u0631 {{role}}."
  }
};

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
  const token = extractCookie(response.headers.get("set-cookie"), "examops_session");

  if (!token) {
    throw new Error("Could not authenticate admin user for Phase 9 Step 2 verification.");
  }

  return `examops_session=${token}`;
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
      code: `P9S2-G-${seed}`,
      name: `P9S2 Gov ${seed}`,
      nameEn: `P9S2 Gov ${seed}`
    },
    select: {
      id: true
    }
  });

  const university = await prisma.university.create({
    data: {
      governorateId: governorate.id,
      code: `P9S2-U-${seed}`,
      name: `P9S2 Uni ${seed}`,
      nameEn: `P9S2 Uni ${seed}`
    },
    select: {
      id: true
    }
  });

  const building = await prisma.building.create({
    data: {
      universityId: university.id,
      code: `P9S2-B-${seed}`,
      name: `P9S2 Building ${seed}`,
      nameEn: `P9S2 Building ${seed}`
    },
    select: {
      id: true
    }
  });

  const floor = await prisma.floor.create({
    data: {
      buildingId: building.id,
      code: `P9S2-F-${seed}`,
      name: `P9S2 Floor ${seed}`,
      nameEn: `P9S2 Floor ${seed}`,
      levelNumber: 1
    },
    select: {
      id: true
    }
  });

  const cycle = await prisma.cycle.create({
    data: {
      code: `P9S2-C-${seed}`,
      name: `P9S2 Cycle ${seed}`,
      nameEn: `P9S2 Cycle ${seed}`,
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
      name: `P9S2 Session ${seed}`,
      nameEn: `P9S2 Session ${seed}`,
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

  const userA = await prisma.user.create({
    data: {
      name: `P9S2 User A ${seed}`,
      nameEn: `P9S2 User A ${seed}`,
      phone: `20187${suffix}`,
      email: `p9s2a.${seed}@example.com`,
      source: "EXTERNAL",
      preferredLanguage: "EN",
      isActive: true,
      blockStatus: "CLEAR"
    },
    select: {
      id: true
    }
  });

  const userB = await prisma.user.create({
    data: {
      name: `P9S2 User B ${seed}`,
      nameEn: `P9S2 User B ${seed}`,
      phone: `20188${suffix}`,
      email: `p9s2b.${seed}@example.com`,
      source: "EXTERNAL",
      preferredLanguage: "AR",
      isActive: true,
      blockStatus: "CLEAR"
    },
    select: {
      id: true
    }
  });

  const roleBuildingHead = await prisma.assignmentRoleDefinition.findFirst({
    where: {
      key: "building_head",
      isActive: true
    },
    select: {
      id: true
    }
  });
  expect(roleBuildingHead, "Role definition building_head is missing.");

  const roleFloorSenior = await prisma.assignmentRoleDefinition.findFirst({
    where: {
      key: "floor_senior",
      isActive: true
    },
    select: {
      id: true
    }
  });
  expect(roleFloorSenior, "Role definition floor_senior is missing.");

  return {
    governorateId: governorate.id,
    universityId: university.id,
    buildingId: building.id,
    floorId: floor.id,
    cycleId: cycle.id,
    sessionId: session.id,
    sessionBuildingId: sessionBuilding.id,
    userAId: userA.id,
    userBId: userB.id,
    roleBuildingHeadId: roleBuildingHead.id,
    roleFloorSeniorId: roleFloorSenior.id
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

function findTriggerLog(logs, eventType) {
  return logs.find((log) => asRecord(log.metadata)?.eventType === eventType);
}

let backupTemplates = new Map();
let fixture = null;
let createdLogIds = [];
let createdAssignmentIds = [];
let createdAttendanceIds = [];

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

  backupTemplates = await setupTemplates();
  fixture = await createFixture();
  const cookie = await loginAndGetCookie();
  const scriptStartedAt = new Date();

  const assignmentOneResponse = await postJson(
    "/api/assignments",
    {
      sessionId: fixture.sessionId,
      userId: fixture.userAId,
      buildingId: fixture.buildingId,
      roleDefinitionId: fixture.roleBuildingHeadId
    },
    cookie
  );
  assert.equal(assignmentOneResponse.status, 201);
  assert.equal(assignmentOneResponse.body.ok, true);
  const assignmentOneId = assignmentOneResponse.body?.data?.id;
  expect(assignmentOneId, "First assignment ID was not returned.");
  createdAssignmentIds.push(assignmentOneId);

  const assignmentTwoResponse = await postJson(
    "/api/assignments",
    {
      sessionId: fixture.sessionId,
      userId: fixture.userBId,
      buildingId: fixture.buildingId,
      floorId: fixture.floorId,
      roleDefinitionId: fixture.roleFloorSeniorId
    },
    cookie
  );
  assert.equal(assignmentTwoResponse.status, 201);
  assert.equal(assignmentTwoResponse.body.ok, true);
  const assignmentTwoId = assignmentTwoResponse.body?.data?.id;
  expect(assignmentTwoId, "Second assignment ID was not returned.");
  createdAssignmentIds.push(assignmentTwoId);

  const attendanceResponse = await postJson(
    "/api/attendance",
    {
      assignmentId: assignmentOneId,
      status: "CONFIRMED"
    },
    cookie
  );
  assert.equal(attendanceResponse.status, 200);
  assert.equal(attendanceResponse.body.ok, true);
  const attendanceId = attendanceResponse.body?.data?.attendance?.attendanceId;
  if (attendanceId) {
    createdAttendanceIds.push(attendanceId);
  }

  const swapResponse = await postJson(
    "/api/swaps",
    {
      kind: "DIRECT_ASSIGNMENT_SWAP",
      sessionId: fixture.sessionId,
      primaryAssignmentId: assignmentOneId,
      secondaryAssignmentId: assignmentTwoId,
      manualOverride: true,
      overrideNote: "phase9_step2_verification"
    },
    cookie
  );
  assert.equal(swapResponse.status, 200);
  assert.equal(swapResponse.body.ok, true);

  const triggerLogs = await prisma.activityLog.findMany({
    where: {
      action: "notification_trigger_execute",
      entityType: "notification_trigger",
      actorAppUserId: adminUser.id,
      occurredAt: {
        gte: scriptStartedAt
      }
    },
    select: {
      id: true,
      metadata: true,
      afterPayload: true
    }
  });
  createdLogIds = triggerLogs.map((log) => log.id);

  const assignmentTriggerLog = findTriggerLog(triggerLogs, "assignment_created");
  const attendanceTriggerLog = findTriggerLog(triggerLogs, "attendance_marked");
  const swapTriggerLog = findTriggerLog(triggerLogs, "assignment_swapped");

  expect(assignmentTriggerLog, "Assignment-created trigger log is missing.");
  expect(attendanceTriggerLog, "Attendance-marked trigger log is missing.");
  expect(swapTriggerLog, "Assignment-swapped trigger log is missing.");

  const assignmentMetadata = asRecord(assignmentTriggerLog.metadata);
  assert.equal(assignmentMetadata?.templateKey, templateKeys.assignmentCreated);
  assert.equal(assignmentMetadata?.status, "prepared");
  expect(
    Number(assignmentMetadata?.targetUsersCount ?? 0) >= 1,
    "Assignment trigger should include at least one target user."
  );

  const attendanceMetadata = asRecord(attendanceTriggerLog.metadata);
  assert.equal(attendanceMetadata?.templateKey, templateKeys.attendanceMarked);
  assert.equal(attendanceMetadata?.status, "prepared");

  const swapMetadata = asRecord(swapTriggerLog.metadata);
  assert.equal(swapMetadata?.templateKey, templateKeys.assignmentSwapped);
  assert.equal(swapMetadata?.status, "prepared");
  expect(
    Number(swapMetadata?.targetUsersCount ?? 0) >= 2,
    "Swap trigger should target both affected assignment users."
  );

  const assignmentAfterPayload = asRecord(assignmentTriggerLog.afterPayload);
  const assignmentPrepared = Array.isArray(
    assignmentAfterPayload?.preparedNotifications
  )
    ? assignmentAfterPayload.preparedNotifications
    : [];
  expect(
    assignmentPrepared.some((entry) =>
      String(entry.subject ?? "").includes("Assign")
    ),
    "Assignment trigger payload should include rendered assignment subject."
  );

  const attendanceAfterPayload = asRecord(attendanceTriggerLog.afterPayload);
  const attendancePrepared = Array.isArray(
    attendanceAfterPayload?.preparedNotifications
  )
    ? attendanceAfterPayload.preparedNotifications
    : [];
  expect(
    attendancePrepared.some((entry) =>
      String(entry.subject ?? "").includes("Attendance PRESENT")
    ),
    "Attendance trigger payload should include rendered attendance subject."
  );

  const swapAfterPayload = asRecord(swapTriggerLog.afterPayload);
  const swapPrepared = Array.isArray(swapAfterPayload?.preparedNotifications)
    ? swapAfterPayload.preparedNotifications
    : [];
  expect(
    swapPrepared.some((entry) =>
      String(entry.body ?? "").includes("DIRECT_ASSIGNMENT_SWAP")
    ),
    "Swap trigger payload should include rendered swap kind."
  );

  console.log("Phase 9 Step 2 verification passed.");
  console.log(
    JSON.stringify(
      {
        assignmentTrigger: "passed",
        attendanceTrigger: "passed",
        swapTrigger: "passed",
        templateResolution: "passed",
        payloadRendering: "passed",
        triggerLogging: "passed"
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

    await prisma.user.deleteMany({
      where: {
        id: {
          in: [fixture.userAId, fixture.userBId]
        }
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
