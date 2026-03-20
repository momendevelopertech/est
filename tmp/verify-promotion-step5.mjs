import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const baseUrl = process.env.EXAMOPS_BASE_URL ?? "http://127.0.0.1:4010";
const adminEmail = process.env.EXAMOPS_ADMIN_EMAIL ?? "admin@examops.local";
const adminPassword =
  process.env.EXAMOPS_ADMIN_PASSWORD ??
  process.env.SEED_APP_USERS_PASSWORD ??
  "ChangeMe123!";

const promotionSettingKeys = [
  "min_rating_threshold",
  "min_sessions_required",
  "min_attendance_ratio"
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
    throw new Error("Could not authenticate admin user for promotion verification.");
  }

  return `examops_session=${token}`;
}

async function createFixture() {
  const createdUserIds = [];
  const createdSessionIds = [];
  const createdCycleIds = [];
  const createdAssignmentIds = [];
  const previousSettings = new Map();

  const cycleSeed = Date.now();
  const cycleStartDate = new Date();
  cycleStartDate.setDate(cycleStartDate.getDate() - 30);
  cycleStartDate.setHours(0, 0, 0, 0);
  const cycleEndDate = new Date();
  cycleEndDate.setDate(cycleEndDate.getDate() + 30);
  cycleEndDate.setHours(0, 0, 0, 0);
  const cycle = await prisma.cycle.create({
    data: {
      code: `PROMO-${cycleSeed}`,
      name: `Promotion Verify ${cycleSeed}`,
      nameEn: `Promotion Verify ${cycleSeed}`,
      status: "ACTIVE",
      startDate: cycleStartDate,
      endDate: cycleEndDate,
      isActive: true
    },
    select: {
      id: true
    }
  });
  createdCycleIds.push(cycle.id);

  const building = await prisma.building.findFirst({
    where: {
      isActive: true
    },
    select: {
      id: true
    }
  });
  expect(building, "No active building available for promotion verification.");

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

  const existingPromotionSettings = await prisma.setting.findMany({
    where: {
      key: {
        in: promotionSettingKeys
      }
    }
  });

  for (const setting of existingPromotionSettings) {
    previousSettings.set(setting.key, setting);
  }

  await prisma.$transaction(async (tx) => {
    await tx.setting.upsert({
      where: {
        key: "min_rating_threshold"
      },
      update: {
        group: "promotion",
        label: "Minimum rating threshold",
        labelEn: "Minimum rating threshold",
        type: "NUMBER",
        value: 4.0,
        isActive: true
      },
      create: {
        key: "min_rating_threshold",
        group: "promotion",
        label: "Minimum rating threshold",
        labelEn: "Minimum rating threshold",
        type: "NUMBER",
        value: 4.0,
        isActive: true,
        isPublic: false
      }
    });

    await tx.setting.upsert({
      where: {
        key: "min_sessions_required"
      },
      update: {
        group: "promotion",
        label: "Minimum sessions required",
        labelEn: "Minimum sessions required",
        type: "NUMBER",
        value: 2,
        isActive: true
      },
      create: {
        key: "min_sessions_required",
        group: "promotion",
        label: "Minimum sessions required",
        labelEn: "Minimum sessions required",
        type: "NUMBER",
        value: 2,
        isActive: true,
        isPublic: false
      }
    });

    await tx.setting.upsert({
      where: {
        key: "min_attendance_ratio"
      },
      update: {
        group: "promotion",
        label: "Minimum attendance ratio",
        labelEn: "Minimum attendance ratio",
        type: "NUMBER",
        value: 0.6,
        isActive: true
      },
      create: {
        key: "min_attendance_ratio",
        group: "promotion",
        label: "Minimum attendance ratio",
        labelEn: "Minimum attendance ratio",
        type: "NUMBER",
        value: 0.6,
        isActive: true,
        isPublic: false
      }
    });
  });

  const seed = Date.now();
  const userHigh = await prisma.user.create({
    data: {
      name: `Promotion High ${seed}`,
      nameEn: `Promotion High ${seed}`,
      phone: `20141${String(seed).slice(-6)}`,
      source: "EXTERNAL",
      averageRating: 4.9,
      totalSessions: 10,
      blockStatus: "CLEAR",
      isActive: true
    },
    select: {
      id: true
    }
  });
  createdUserIds.push(userHigh.id);

  const userMedium = await prisma.user.create({
    data: {
      name: `Promotion Medium ${seed}`,
      nameEn: `Promotion Medium ${seed}`,
      phone: `20142${String(seed).slice(-6)}`,
      source: "EXTERNAL",
      averageRating: 4.4,
      totalSessions: 8,
      blockStatus: "CLEAR",
      isActive: true
    },
    select: {
      id: true
    }
  });
  createdUserIds.push(userMedium.id);

  const userLowRating = await prisma.user.create({
    data: {
      name: `Promotion Low ${seed}`,
      nameEn: `Promotion Low ${seed}`,
      phone: `20143${String(seed).slice(-6)}`,
      source: "EXTERNAL",
      averageRating: 3.2,
      totalSessions: 12,
      blockStatus: "CLEAR",
      isActive: true
    },
    select: {
      id: true
    }
  });
  createdUserIds.push(userLowRating.id);

  const userBlocked = await prisma.user.create({
    data: {
      name: `Promotion Blocked ${seed}`,
      nameEn: `Promotion Blocked ${seed}`,
      phone: `20144${String(seed).slice(-6)}`,
      source: "EXTERNAL",
      averageRating: 5.0,
      totalSessions: 14,
      blockStatus: "PERMANENT",
      isActive: true
    },
    select: {
      id: true
    }
  });
  createdUserIds.push(userBlocked.id);

  for (let index = 0; index < 3; index += 1) {
    const start = new Date();
    start.setDate(start.getDate() - 5 - index);
    start.setHours(9, 0, 0, 0);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const sessionDate = new Date(start);
    sessionDate.setHours(0, 0, 0, 0);

    const session = await prisma.session.create({
      data: {
        cycleId: cycle.id,
        name: `PROMOTION_TEST_${seed}_${index}`,
        nameEn: `Promotion Test ${seed} ${index}`,
        examType: "EST1",
        sessionDate,
        startsAt: start,
        endsAt: end,
        status: "COMPLETED",
        isActive: true
      },
      select: {
        id: true
      }
    });
    createdSessionIds.push(session.id);

    await prisma.sessionBuilding.create({
      data: {
        sessionId: session.id,
        buildingId: building.id,
        isActive: true
      }
    });

    const [aHigh, aMedium, aLow, aBlocked] = await Promise.all([
      prisma.assignment.create({
        data: {
          sessionId: session.id,
          userId: userHigh.id,
          buildingId: building.id,
          roleDefinitionId: roleDefinition.id,
          assignedMethod: "MANUAL",
          status: "COMPLETED"
        },
        select: {
          id: true
        }
      }),
      prisma.assignment.create({
        data: {
          sessionId: session.id,
          userId: userMedium.id,
          buildingId: building.id,
          roleDefinitionId: roleDefinition.id,
          assignedMethod: "MANUAL",
          status: "COMPLETED"
        },
        select: {
          id: true
        }
      }),
      prisma.assignment.create({
        data: {
          sessionId: session.id,
          userId: userLowRating.id,
          buildingId: building.id,
          roleDefinitionId: roleDefinition.id,
          assignedMethod: "MANUAL",
          status: "COMPLETED"
        },
        select: {
          id: true
        }
      }),
      prisma.assignment.create({
        data: {
          sessionId: session.id,
          userId: userBlocked.id,
          buildingId: building.id,
          roleDefinitionId: roleDefinition.id,
          assignedMethod: "MANUAL",
          status: "COMPLETED"
        },
        select: {
          id: true
        }
      })
    ]);
    createdAssignmentIds.push(aHigh.id, aMedium.id, aLow.id, aBlocked.id);

    await Promise.all([
      prisma.attendance.create({
        data: {
          assignmentId: aHigh.id,
          status: "CONFIRMED",
          checkedInAt: new Date(end.getTime() - 30 * 60 * 1000)
        }
      }),
      prisma.attendance.create({
        data: {
          assignmentId: aMedium.id,
          status: index === 0 ? "ABSENT" : "CONFIRMED"
        }
      }),
      prisma.attendance.create({
        data: {
          assignmentId: aLow.id,
          status: "CONFIRMED"
        }
      }),
      prisma.attendance.create({
        data: {
          assignmentId: aBlocked.id,
          status: "CONFIRMED"
        }
      })
    ]);
  }

  return {
    createdUserIds,
    createdSessionIds,
    createdCycleIds,
    createdAssignmentIds,
    previousSettings,
    expected: {
      highUserId: userHigh.id,
      mediumUserId: userMedium.id,
      lowRatingUserId: userLowRating.id,
      blockedUserId: userBlocked.id
    }
  };
}

async function verify() {
  const fixture = await createFixture();

  try {
    const cookie = await loginAndGetCookie();
    const response = await fetch(
      `${baseUrl}/api/promotion/suggestions?limit=50`,
      {
        headers: {
          Accept: "application/json",
          Cookie: cookie
        }
      }
    );
    const payload = await response.json();

    assert.equal(response.status, 200, "Promotion suggestions should return 200.");
    assert.equal(payload.ok, true, "Promotion suggestions response should be ok.");
    expect(Array.isArray(payload.data?.data), "Promotion suggestions data should be an array.");

    const suggestions = payload.data.data;
    const rankedUserIds = suggestions.map((entry) => entry.userId);

    expect(
      rankedUserIds.includes(fixture.expected.highUserId),
      "High candidate must be included."
    );
    expect(
      rankedUserIds.includes(fixture.expected.mediumUserId),
      "Medium candidate must be included."
    );

    expect(
      !rankedUserIds.includes(fixture.expected.lowRatingUserId),
      "Low-rating candidate must be filtered by threshold."
    );
    expect(
      !rankedUserIds.includes(fixture.expected.blockedUserId),
      "Blocked user must be excluded."
    );

    const highIndex = rankedUserIds.indexOf(fixture.expected.highUserId);
    const mediumIndex = rankedUserIds.indexOf(fixture.expected.mediumUserId);
    expect(highIndex >= 0 && mediumIndex >= 0, "Expected users were not ranked.");
    expect(highIndex < mediumIndex, "Ranking should place high candidate before medium candidate.");

    const highSuggestion = suggestions[highIndex];
    const mediumSuggestion = suggestions[mediumIndex];
    expect(
      highSuggestion.score > mediumSuggestion.score,
      "High candidate score must exceed medium candidate score."
    );

    console.log("Promotion Step 5 verification passed.");
    console.log(
      JSON.stringify(
        {
          rankingCorrectness: "passed",
          thresholdFiltering: "passed",
          blockedUsersExcluded: "passed",
          highUserRank: highSuggestion.rank,
          mediumUserRank: mediumSuggestion.rank
        },
        null,
        2
      )
    );

    return fixture;
  } catch (error) {
    throw error;
  }
}

function toSerializableSetting(setting) {
  return {
    group: setting.group,
    label: setting.label,
    labelEn: setting.labelEn,
    description: setting.description,
    descriptionEn: setting.descriptionEn,
    type: setting.type,
    value: setting.value,
    isPublic: setting.isPublic,
    isActive: setting.isActive,
    sortOrder: setting.sortOrder
  };
}

const fixture = await verify();

await prisma.$transaction(async (tx) => {
  if (fixture.createdSessionIds.length > 0) {
    await tx.attendance.deleteMany({
      where: {
        assignment: {
          sessionId: {
            in: fixture.createdSessionIds
          }
        }
      }
    });
    await tx.assignment.deleteMany({
      where: {
        sessionId: {
          in: fixture.createdSessionIds
        }
      }
    });
    await tx.sessionBuilding.deleteMany({
      where: {
        sessionId: {
          in: fixture.createdSessionIds
        }
      }
    });
    await tx.session.deleteMany({
      where: {
        id: {
          in: fixture.createdSessionIds
        }
      }
    });
  }

  if (fixture.createdUserIds.length > 0) {
    await tx.user.deleteMany({
      where: {
        id: {
          in: fixture.createdUserIds
        }
      }
    });
  }

  if (fixture.createdCycleIds.length > 0) {
    await tx.cycle.deleteMany({
      where: {
        id: {
          in: fixture.createdCycleIds
        }
      }
    });
  }

  for (const key of promotionSettingKeys) {
    if (!fixture.previousSettings.has(key)) {
      await tx.setting.deleteMany({
        where: {
          key
        }
      });
      continue;
    }

    const previous = fixture.previousSettings.get(key);
    await tx.setting.update({
      where: {
        key
      },
      data: toSerializableSetting(previous)
    });
  }
});

await prisma.$disconnect();
