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
    throw new Error("Could not authenticate admin user for swap flow integration test.");
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

async function createFixture() {
  const { sessionDate, startsAt, endsAt } = getFutureWindow();

  const governorate = await prisma.governorate.create({
    data: {
      code: `TSW-G-${seed}`,
      name: `TSW Gov ${seed}`,
      nameEn: `TSW Gov ${seed}`
    },
    select: {
      id: true
    }
  });

  const university = await prisma.university.create({
    data: {
      governorateId: governorate.id,
      code: `TSW-U-${seed}`,
      name: `TSW Uni ${seed}`,
      nameEn: `TSW Uni ${seed}`
    },
    select: {
      id: true
    }
  });

  const building = await prisma.building.create({
    data: {
      universityId: university.id,
      code: `TSW-B-${seed}`,
      name: `TSW Building ${seed}`,
      nameEn: `TSW Building ${seed}`
    },
    select: {
      id: true
    }
  });

  const floor = await prisma.floor.create({
    data: {
      buildingId: building.id,
      code: `TSW-F-${seed}`,
      name: `TSW Floor ${seed}`,
      nameEn: `TSW Floor ${seed}`,
      levelNumber: 1
    },
    select: {
      id: true
    }
  });

  const roomA = await prisma.room.create({
    data: {
      floorId: floor.id,
      code: `TSW-RA-${seed}`,
      name: `TSW Room A ${seed}`,
      nameEn: `TSW Room A ${seed}`,
      roomType: "CLASSROOM",
      supportedExamTypes: ["EST1"],
      capacityMin: 1,
      capacityMax: 50
    },
    select: {
      id: true
    }
  });

  const roomB = await prisma.room.create({
    data: {
      floorId: floor.id,
      code: `TSW-RB-${seed}`,
      name: `TSW Room B ${seed}`,
      nameEn: `TSW Room B ${seed}`,
      roomType: "CLASSROOM",
      supportedExamTypes: ["EST1"],
      capacityMin: 1,
      capacityMax: 50
    },
    select: {
      id: true
    }
  });

  const cycle = await prisma.cycle.create({
    data: {
      code: `TSW-C-${seed}`,
      name: `TSW Cycle ${seed}`,
      nameEn: `TSW Cycle ${seed}`,
      status: "ACTIVE",
      startDate: sessionDate,
      endDate: new Date(sessionDate.getTime() + 5 * 24 * 60 * 60 * 1000)
    },
    select: {
      id: true
    }
  });

  const session = await prisma.session.create({
    data: {
      cycleId: cycle.id,
      name: `TSW Session ${seed}`,
      nameEn: `TSW Session ${seed}`,
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

  const role = await prisma.assignmentRoleDefinition.findFirst({
    where: {
      key: "room_proctor",
      isActive: true
    },
    select: {
      id: true
    }
  });

  if (!role) {
    throw new Error("Role definition room_proctor is missing.");
  }

  const userA = await prisma.user.create({
    data: {
      name: `TSW User A ${seed}`,
      nameEn: `TSW User A ${seed}`,
      phone: `20191${suffix}`,
      email: `tsw.usera.${seed}@example.com`,
      source: "EXTERNAL",
      isActive: true,
      blockStatus: "CLEAR"
    },
    select: {
      id: true
    }
  });

  const userB = await prisma.user.create({
    data: {
      name: `TSW User B ${seed}`,
      nameEn: `TSW User B ${seed}`,
      phone: `20192${suffix}`,
      email: `tsw.userb.${seed}@example.com`,
      source: "EXTERNAL",
      isActive: true,
      blockStatus: "CLEAR"
    },
    select: {
      id: true
    }
  });

  return {
    governorateId: governorate.id,
    universityId: university.id,
    buildingId: building.id,
    floorId: floor.id,
    roomAId: roomA.id,
    roomBId: roomB.id,
    cycleId: cycle.id,
    sessionId: session.id,
    sessionBuildingId: sessionBuilding.id,
    roleDefinitionId: role.id,
    userAId: userA.id,
    userBId: userB.id
  };
}

let fixture = null;
let assignmentIds = [];

try {
  fixture = await createFixture();
  const cookie = await loginAndGetCookie();

  const createAssignmentA = await postJson(
    "/api/assignments",
    {
      sessionId: fixture.sessionId,
      userId: fixture.userAId,
      buildingId: fixture.buildingId,
      floorId: fixture.floorId,
      roomId: fixture.roomAId,
      roleDefinitionId: fixture.roleDefinitionId
    },
    cookie
  );
  assert.equal(createAssignmentA.status, 201);
  assert.equal(createAssignmentA.body.ok, true);
  const assignmentAId = createAssignmentA.body.data.id;
  assignmentIds.push(assignmentAId);

  const createAssignmentB = await postJson(
    "/api/assignments",
    {
      sessionId: fixture.sessionId,
      userId: fixture.userBId,
      buildingId: fixture.buildingId,
      floorId: fixture.floorId,
      roomId: fixture.roomBId,
      roleDefinitionId: fixture.roleDefinitionId
    },
    cookie
  );
  assert.equal(createAssignmentB.status, 201);
  assert.equal(createAssignmentB.body.ok, true);
  const assignmentBId = createAssignmentB.body.data.id;
  assignmentIds.push(assignmentBId);

  const swapResponse = await postJson(
    "/api/swaps",
    {
      kind: "DIRECT_ASSIGNMENT_SWAP",
      sessionId: fixture.sessionId,
      primaryAssignmentId: assignmentAId,
      secondaryAssignmentId: assignmentBId
    },
    cookie
  );

  assert.equal(swapResponse.status, 200);
  assert.equal(swapResponse.body.ok, true);
  assert.equal(swapResponse.body.data.kind, "DIRECT_ASSIGNMENT_SWAP");
  assert.equal(
    swapResponse.body.data.changedAssignmentIds.length,
    2,
    "Direct swap should report 2 changed assignments."
  );

  const [assignmentAAfter, assignmentBAfter] = await Promise.all([
    prisma.assignment.findUnique({
      where: {
        id: assignmentAId
      },
      select: {
        roomId: true
      }
    }),
    prisma.assignment.findUnique({
      where: {
        id: assignmentBId
      },
      select: {
        roomId: true
      }
    })
  ]);

  assert.equal(
    assignmentAAfter?.roomId,
    fixture.roomBId,
    "Primary assignment room should be swapped."
  );
  assert.equal(
    assignmentBAfter?.roomId,
    fixture.roomAId,
    "Secondary assignment room should be swapped."
  );

  console.log("Swap flow integration test passed.");
} finally {
  if (assignmentIds.length > 0) {
    await prisma.assignment.deleteMany({
      where: {
        id: {
          in: assignmentIds
        }
      }
    });
  }

  if (fixture) {
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [fixture.userAId, fixture.userBId]
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

    await prisma.room.deleteMany({
      where: {
        id: {
          in: [fixture.roomAId, fixture.roomBId]
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

  await prisma.$disconnect();
}
