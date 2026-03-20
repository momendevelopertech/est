import assert from "node:assert/strict";
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const baseUrl = process.env.EXAMOPS_BASE_URL ?? "http://127.0.0.1:4010";
const adminEmail = process.env.EXAMOPS_ADMIN_EMAIL ?? "admin@examops.local";
const adminPassword = process.env.EXAMOPS_ADMIN_PASSWORD ?? "ChangeMe123!";

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
    throw new Error("Could not authenticate admin user for API verification.");
  }

  return `examops_session=${token}`;
}

async function createFixture() {
  const createdUserIds = [];

  const cycle = await prisma.cycle.findFirst({
    where: {
      isActive: true
    },
    select: {
      id: true,
      startDate: true,
      endDate: true
    }
  });
  expect(cycle, "No active cycle available for attendance verification.");

  const building = await prisma.building.findFirst({
    where: {
      isActive: true,
      floors: {
        some: {
          isActive: true
        }
      }
    },
    select: {
      id: true,
      floors: {
        where: {
          isActive: true
        },
        orderBy: [{ levelNumber: "asc" }, { id: "asc" }],
        select: {
          id: true
        }
      }
    }
  });
  expect(building, "No active building available for attendance verification.");
  const floorId = building.floors[0]?.id;
  expect(floorId, "No active floor available for attendance verification.");

  const roleDefinition = await prisma.assignmentRoleDefinition.findFirst({
    where: {
      key: "building_head",
      isActive: true
    },
    select: {
      id: true
    }
  });
  expect(roleDefinition, "building_head role definition is missing.");

  let users = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        { blockStatus: "CLEAR" },
        {
          blockStatus: "TEMPORARY",
          blockEndsAt: {
            lte: new Date()
          }
        }
      ]
    },
    orderBy: [{ averageRating: "desc" }, { createdAt: "asc" }],
    take: 8,
    select: {
      id: true
    }
  });

  if (users.length < 5) {
    const missingCount = 5 - users.length;

    for (let index = 0; index < missingCount; index += 1) {
      const seed = `${Date.now()}${index}`;
      const created = await prisma.user.create({
        data: {
          name: `Attendance Fixture User ${seed}`,
          nameEn: `Attendance Fixture User ${seed}`,
          phone: `2016${seed.slice(-8)}`,
          source: "EXTERNAL",
          averageRating: 4,
          totalSessions: 0,
          blockStatus: "CLEAR",
          isActive: true
        },
        select: {
          id: true
        }
      });
      createdUserIds.push(created.id);
    }

    users = await prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { blockStatus: "CLEAR" },
          {
            blockStatus: "TEMPORARY",
            blockEndsAt: {
              lte: new Date()
            }
          }
        ]
      },
      orderBy: [{ averageRating: "desc" }, { createdAt: "asc" }],
      take: 8,
      select: {
        id: true
      }
    });
  }

  expect(users.length >= 5, "At least 5 eligible users are required for attendance verification.");

  const userA = users[0].id;
  const userB = users[1].id;
  const userC = users[2].id;
  const userD = users[3].id;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() + 15);
  startDate.setHours(9, 0, 0, 0);
  const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

  let session = null;
  let dayOffset = 0;

  while (!session && dayOffset < 30) {
    const sessionDate = new Date(startDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    sessionDate.setHours(0, 0, 0, 0);

    try {
      session = await prisma.session.create({
        data: {
          cycleId: cycle.id,
          name: `ATTENDANCE_TEST_${Date.now()}_${dayOffset}`,
          nameEn: `Attendance Test ${Date.now()} ${dayOffset}`,
          examType: "EST1",
          sessionDate,
          startsAt: new Date(startDate.getTime() + dayOffset * 24 * 60 * 60 * 1000),
          endsAt: new Date(endDate.getTime() + dayOffset * 24 * 60 * 60 * 1000),
          status: "LOCKED",
          isActive: true
        },
        select: {
          id: true,
          cycleId: true
        }
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        dayOffset += 1;
        continue;
      }

      throw error;
    }
  }

  expect(session, "Could not create fixture session for attendance verification.");

  await prisma.sessionBuilding.create({
    data: {
      sessionId: session.id,
      buildingId: building.id,
      isActive: true
    }
  });

  const [assignmentA, assignmentB, assignmentConflict] = await Promise.all([
    prisma.assignment.create({
      data: {
        sessionId: session.id,
        userId: userA,
        buildingId: building.id,
        floorId: null,
        roomId: null,
        roleDefinitionId: roleDefinition.id,
        status: "DRAFT",
        assignedMethod: "MANUAL",
        isManualOverride: false
      },
      select: {
        id: true,
        userId: true,
        sessionId: true
      }
    }),
    prisma.assignment.create({
      data: {
        sessionId: session.id,
        userId: userB,
        buildingId: building.id,
        floorId: null,
        roomId: null,
        roleDefinitionId: roleDefinition.id,
        status: "DRAFT",
        assignedMethod: "MANUAL",
        isManualOverride: false
      },
      select: {
        id: true,
        userId: true,
        sessionId: true
      }
    }),
    prisma.assignment.create({
      data: {
        sessionId: session.id,
        userId: userD,
        buildingId: building.id,
        floorId: null,
        roomId: null,
        roleDefinitionId: roleDefinition.id,
        status: "DRAFT",
        assignedMethod: "MANUAL",
        isManualOverride: false
      },
      select: {
        id: true,
        userId: true,
        sessionId: true
      }
    })
  ]);

  const [waitingGood, waitingConflict] = await Promise.all([
    prisma.waitingList.create({
      data: {
        sessionId: session.id,
        cycleId: session.cycleId,
        userId: userC,
        buildingId: building.id,
        roleDefinitionId: roleDefinition.id,
        priority: 1,
        status: "WAITING",
        entrySource: "attendance_fixture"
      },
      select: {
        id: true
      }
    }),
    prisma.waitingList.create({
      data: {
        sessionId: session.id,
        cycleId: session.cycleId,
        userId: userD,
        buildingId: building.id,
        roleDefinitionId: roleDefinition.id,
        priority: 2,
        status: "WAITING",
        entrySource: "attendance_fixture_conflict"
      },
      select: {
        id: true
      }
    })
  ]);

  return {
    createdUserIds,
    sessionId: session.id,
    assignmentAId: assignmentA.id,
    assignmentBId: assignmentB.id,
    assignmentConflictId: assignmentConflict.id,
    waitingGoodId: waitingGood.id,
    waitingConflictId: waitingConflict.id,
    userA,
    userB,
    userC,
    userD
  };
}

async function postAttendance(cookie, payload) {
  const response = await fetch(`${baseUrl}/api/attendance`, {
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

async function verify() {
  const fixture = await createFixture();
  const logEntityIds = new Set([fixture.sessionId, fixture.assignmentAId, fixture.assignmentBId]);

  try {
    const cookie = await loginAndGetCookie();

    const listResponse = await fetch(
      `${baseUrl}/api/attendance?sessionId=${fixture.sessionId}&page=1&pageSize=100`,
      {
        headers: {
          Accept: "application/json",
          Cookie: cookie
        }
      }
    );
    const listPayload = await listResponse.json();

    if (listResponse.status !== 200) {
      console.error("attendance list failure payload", listPayload);
    }

    assert.equal(listResponse.status, 200, "Attendance list should load successfully.");
    assert.equal(listPayload.ok, true, "Attendance list response should be ok.");
    expect(Array.isArray(listPayload.data), "Attendance list data should be an array.");
    expect(listPayload.data.length >= 3, "Attendance list should include fixture assignments.");

    const confirmedUpdate = await postAttendance(cookie, {
      assignmentId: fixture.assignmentAId,
      status: "CONFIRMED",
      notes: "attendance confirmed by verification"
    });

    assert.equal(confirmedUpdate.status, 200, "Confirmed attendance update should succeed.");
    assert.equal(confirmedUpdate.body.ok, true, "Confirmed attendance response should be ok.");

    const attendanceAfterConfirmed = await prisma.attendance.findUnique({
      where: {
        assignmentId: fixture.assignmentAId
      },
      select: {
        status: true,
        checkedInAt: true,
        notes: true
      }
    });

    expect(attendanceAfterConfirmed, "Attendance record should be created after confirmation.");
    assert.equal(attendanceAfterConfirmed.status, "CONFIRMED");
    expect(Boolean(attendanceAfterConfirmed.checkedInAt), "Confirmed attendance should have checkedInAt.");

    const replacementSuggestionsResponse = await fetch(
      `${baseUrl}/api/attendance/replacements?assignmentId=${fixture.assignmentAId}`,
      {
        headers: {
          Accept: "application/json",
          Cookie: cookie
        }
      }
    );
    const replacementSuggestionsPayload = await replacementSuggestionsResponse.json();

    assert.equal(replacementSuggestionsResponse.status, 200, "Replacement suggestions should load successfully.");
    assert.equal(replacementSuggestionsPayload.ok, true, "Replacement suggestions response should be ok.");

    const goodSuggestion = replacementSuggestionsPayload.data.find(
      (entry) => entry.id === fixture.waitingGoodId
    );
    expect(goodSuggestion, "Expected replacement suggestion is missing.");
    assert.equal(goodSuggestion.compatibility.roleCompatible, true);
    assert.equal(goodSuggestion.compatibility.buildingCompatible, true);

    const invalidReplacement = await postAttendance(cookie, {
      assignmentId: fixture.assignmentAId,
      status: "CONFIRMED",
      replacementWaitingListId: fixture.waitingGoodId
    });

    assert.equal(invalidReplacement.status, 400, "Invalid replacement status should fail validation.");
    assert.equal(invalidReplacement.body.error, "validation_error");

    const absentWithReplacement = await postAttendance(cookie, {
      assignmentId: fixture.assignmentAId,
      status: "ABSENT",
      notes: "absent with replacement",
      replacementWaitingListId: fixture.waitingGoodId
    });

    assert.equal(absentWithReplacement.status, 200, "Absent replacement flow should succeed.");
    assert.equal(absentWithReplacement.body.ok, true);

    const [assignmentAAfterReplacement, waitingGoodAfterReplacement, promotedAssignment] = await Promise.all([
      prisma.assignment.findUniqueOrThrow({
        where: { id: fixture.assignmentAId },
        select: { status: true }
      }),
      prisma.waitingList.findUniqueOrThrow({
        where: { id: fixture.waitingGoodId },
        select: { status: true }
      }),
      prisma.assignment.findFirst({
        where: {
          sessionId: fixture.sessionId,
          userId: fixture.userC,
          status: {
            not: "CANCELLED"
          }
        },
        select: {
          id: true,
          status: true
        }
      })
    ]);

    assert.equal(assignmentAAfterReplacement.status, "CANCELLED", "Original assignment should be cancelled after replacement.");
    assert.equal(waitingGoodAfterReplacement.status, "PROMOTED", "Replacement waiting-list entry should be promoted.");
    expect(promotedAssignment, "Replacement assignment should be created.");
    logEntityIds.add(promotedAssignment.id);

    const assignmentBBeforeRollback = await prisma.assignment.findUniqueOrThrow({
      where: { id: fixture.assignmentBId },
      select: { status: true }
    });

    const rollbackAttempt = await postAttendance(cookie, {
      assignmentId: fixture.assignmentBId,
      status: "ABSENT",
      replacementWaitingListId: fixture.waitingConflictId
    });

    assert.equal(rollbackAttempt.status, 409, "Rollback scenario must fail on duplicate replacement assignment.");
    assert.equal(rollbackAttempt.body.error, "duplicate_assignment");

    const [assignmentBAfterRollback, attendanceBAfterRollback] = await Promise.all([
      prisma.assignment.findUniqueOrThrow({
        where: { id: fixture.assignmentBId },
        select: { status: true }
      }),
      prisma.attendance.findUnique({
        where: { assignmentId: fixture.assignmentBId },
        select: { id: true, status: true }
      })
    ]);

    assert.equal(
      assignmentBAfterRollback.status,
      assignmentBBeforeRollback.status,
      "Assignment status should stay unchanged after rollback failure."
    );
    assert.equal(
      attendanceBAfterRollback,
      null,
      "Attendance record should not be persisted when replacement transaction fails."
    );

    const [attendanceLogsCount, waitingPromoteLogsCount] = await Promise.all([
      prisma.activityLog.count({
        where: {
          action: "attendance_update",
          metadata: {
            path: ["sessionId"],
            equals: fixture.sessionId
          }
        }
      }),
      prisma.activityLog.count({
        where: {
          action: "promote",
          entityType: "waiting_list",
          metadata: {
            path: ["sessionId"],
            equals: fixture.sessionId
          }
        }
      })
    ]);

    expect(attendanceLogsCount >= 2, "Attendance update logs should be written for successful updates.");
    expect(waitingPromoteLogsCount >= 1, "Waiting-list promote log should be written during replacement.");

    console.log("Attendance API verification passed.");
    console.log(
      JSON.stringify(
        {
          attendanceUpdate: "passed",
          replacementSuggestions: "passed",
          absentReplacementFlow: "passed",
          invalidStatusValidation: "passed",
          rollbackSafety: "passed",
          activityLogs: "passed",
          sessionId: fixture.sessionId
        },
        null,
        2
      )
    );

    return {
      fixture,
      logEntityIds: Array.from(logEntityIds)
    };
  } catch (error) {
    throw error;
  }
}

const { fixture, logEntityIds } = await verify();

await prisma.$transaction(async (tx) => {
  await tx.activityLog.deleteMany({
    where: {
      entityId: {
        in: logEntityIds
      }
    }
  });
  await tx.attendance.deleteMany({ where: { assignment: { sessionId: fixture.sessionId } } });
  await tx.waitingList.deleteMany({ where: { sessionId: fixture.sessionId } });
  await tx.assignment.deleteMany({ where: { sessionId: fixture.sessionId } });
  await tx.sessionBuilding.deleteMany({ where: { sessionId: fixture.sessionId } });
  await tx.session.deleteMany({ where: { id: fixture.sessionId } });
  if (fixture.createdUserIds.length > 0) {
    await tx.user.deleteMany({
      where: {
        id: {
          in: fixture.createdUserIds
        }
      }
    });
  }
});

await prisma.$disconnect();
