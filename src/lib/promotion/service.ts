import {
  AssignmentStatus,
  AttendanceStatus,
  Prisma,
  SessionStatus
} from "@prisma/client";

import { isUserBlockedState } from "@/lib/blocks/state";
import { db } from "@/lib/db";
import { getDerivedSessionStatus } from "@/lib/sessions/status";

import type {
  PromotionSuggestionBreakdownContract,
  PromotionSuggestionContract,
  PromotionSuggestionsQueryContract,
  PromotionSuggestionsResultContract,
  PromotionSuggestionThresholdsContract
} from "./contracts";
import type { PromotionSuggestionsQuery } from "./validation";

const PROMOTION_SETTINGS_KEYS = {
  minRatingThreshold: [
    "min_rating_threshold",
    "distribution.min_rating_threshold"
  ],
  minSessionsRequired: [
    "min_sessions_required",
    "distribution.min_sessions_required"
  ],
  minAttendanceRatio: [
    "min_attendance_ratio",
    "distribution.min_attendance_ratio"
  ]
} as const;

const SCORE_WEIGHTS = {
  rating: 0.5,
  attendance: 0.3,
  sessions: 0.2
} as const;

const promotionUserSelect = {
  id: true,
  name: true,
  nameEn: true,
  averageRating: true,
  totalSessions: true,
  isActive: true,
  blockStatus: true,
  blockEndsAt: true
} satisfies Prisma.UserSelect;

const promotionAssignmentSelect = {
  id: true,
  userId: true,
  status: true,
  session: {
    select: {
      id: true,
      status: true,
      startsAt: true,
      endsAt: true,
      isActive: true,
      cycle: {
        select: {
          id: true,
          isActive: true
        }
      }
    }
  },
  attendance: {
    select: {
      status: true
    }
  }
} satisfies Prisma.AssignmentSelect;

type PromotionUserRecord = Prisma.UserGetPayload<{
  select: typeof promotionUserSelect;
}>;

type PromotionAssignmentRecord = Prisma.AssignmentGetPayload<{
  select: typeof promotionAssignmentSelect;
}>;

type CandidateAggregation = {
  user: PromotionUserRecord;
  averageRating: number;
  totalCompletedSessions: number;
  attendanceEligibleCount: number;
  attendanceConfirmedCount: number;
  attendanceRatio: number;
};

export class PromotionServiceError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "PromotionServiceError";
  }
}

function toNumber(value: Prisma.Decimal | number) {
  return Number(
    value instanceof Prisma.Decimal ? value.toString() : value.toString()
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundTo(value: number, digits: number) {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

function parseNumberSettingValue(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function isCompletedSessionForScoring(
  assignment: PromotionAssignmentRecord,
  now = new Date()
) {
  if (assignment.status === AssignmentStatus.CANCELLED) {
    return false;
  }

  if (!assignment.session.isActive || !assignment.session.cycle.isActive) {
    return false;
  }

  const derivedStatus = getDerivedSessionStatus(assignment.session, now);

  return (
    assignment.session.status === SessionStatus.COMPLETED ||
    derivedStatus === SessionStatus.COMPLETED
  );
}

function getAttendanceEligibilityStatus(status: AttendanceStatus | null | undefined) {
  if (!status || status === AttendanceStatus.PENDING) {
    return null;
  }

  return status;
}

async function getThresholds(): Promise<PromotionSuggestionThresholdsContract> {
  const settingKeys = Array.from(
    new Set([
      ...PROMOTION_SETTINGS_KEYS.minRatingThreshold,
      ...PROMOTION_SETTINGS_KEYS.minSessionsRequired,
      ...PROMOTION_SETTINGS_KEYS.minAttendanceRatio
    ])
  );
  const settings = await db.setting.findMany({
    where: {
      key: {
        in: settingKeys
      },
      isActive: true
    },
    select: {
      key: true,
      value: true
    }
  });
  const settingsMap = new Map(settings.map((setting) => [setting.key, setting.value]));

  const resolveSetting = (keys: readonly string[], fallback: number) => {
    for (const key of keys) {
      if (!settingsMap.has(key)) {
        continue;
      }

      return parseNumberSettingValue(settingsMap.get(key), fallback);
    }

    return fallback;
  };

  return {
    minRatingThreshold: clamp(
      resolveSetting(PROMOTION_SETTINGS_KEYS.minRatingThreshold, 0),
      0,
      5
    ),
    minSessionsRequired: Math.max(
      0,
      Math.floor(resolveSetting(PROMOTION_SETTINGS_KEYS.minSessionsRequired, 0))
    ),
    minAttendanceRatio: clamp(
      resolveSetting(PROMOTION_SETTINGS_KEYS.minAttendanceRatio, 0),
      0,
      1
    )
  };
}

function buildCandidateAggregations(
  users: PromotionUserRecord[],
  assignments: PromotionAssignmentRecord[]
) {
  const candidateByUserId = new Map<string, CandidateAggregation>();

  for (const user of users) {
    candidateByUserId.set(user.id, {
      user,
      averageRating: toNumber(user.averageRating),
      totalCompletedSessions: 0,
      attendanceEligibleCount: 0,
      attendanceConfirmedCount: 0,
      attendanceRatio: 0
    });
  }

  for (const assignment of assignments) {
    const candidate = candidateByUserId.get(assignment.userId);

    if (!candidate || !isCompletedSessionForScoring(assignment)) {
      continue;
    }

    candidate.totalCompletedSessions += 1;

    const attendanceStatus = getAttendanceEligibilityStatus(
      assignment.attendance?.status
    );

    if (!attendanceStatus) {
      continue;
    }

    candidate.attendanceEligibleCount += 1;

    if (attendanceStatus === AttendanceStatus.CONFIRMED) {
      candidate.attendanceConfirmedCount += 1;
    }
  }

  for (const candidate of Array.from(candidateByUserId.values())) {
    candidate.attendanceRatio =
      candidate.attendanceEligibleCount > 0
        ? candidate.attendanceConfirmedCount / candidate.attendanceEligibleCount
        : 0;
  }

  return Array.from(candidateByUserId.values());
}

function buildSuggestionBreakdown(input: {
  averageRating: number;
  attendanceRatio: number;
  totalCompletedSessions: number;
  attendanceEligibleCount: number;
  attendanceConfirmedCount: number;
  maxCompletedSessions: number;
}) {
  const ratingScore = clamp(input.averageRating / 5, 0, 1);
  const attendanceScore = clamp(input.attendanceRatio, 0, 1);
  const sessionsScore =
    input.maxCompletedSessions > 0
      ? clamp(input.totalCompletedSessions / input.maxCompletedSessions, 0, 1)
      : 0;
  const breakdown: PromotionSuggestionBreakdownContract = {
    averageRating: roundTo(input.averageRating, 2),
    attendanceRatio: roundTo(input.attendanceRatio, 4),
    totalCompletedSessions: input.totalCompletedSessions,
    attendanceEligibleCount: input.attendanceEligibleCount,
    attendanceConfirmedCount: input.attendanceConfirmedCount,
    ratingScore: roundTo(ratingScore, 4),
    attendanceScore: roundTo(attendanceScore, 4),
    sessionsScore: roundTo(sessionsScore, 4)
  };

  return breakdown;
}

function buildSuggestionScore(breakdown: PromotionSuggestionBreakdownContract) {
  return roundTo(
    breakdown.ratingScore * SCORE_WEIGHTS.rating +
      breakdown.attendanceScore * SCORE_WEIGHTS.attendance +
      breakdown.sessionsScore * SCORE_WEIGHTS.sessions,
    6
  );
}

export async function getPromotionSuggestions(
  query: PromotionSuggestionsQuery
): Promise<PromotionSuggestionsResultContract> {
  const contractQuery: PromotionSuggestionsQueryContract = query;
  const limit = contractQuery.limit ?? 100;
  const now = new Date();
  const thresholds = await getThresholds();
  const users = await db.user.findMany({
    where: {
      isActive: true
    },
    select: promotionUserSelect
  });
  const candidates = users.filter((user) => !isUserBlockedState(user, now));

  if (candidates.length === 0) {
    return {
      checkedAt: now,
      thresholds,
      totals: {
        candidateUsersCount: 0,
        eligibleUsersCount: 0,
        rankedUsersCount: 0
      },
      data: []
    };
  }

  const assignments = await db.assignment.findMany({
    where: {
      userId: {
        in: candidates.map((user) => user.id)
      },
      status: {
        not: AssignmentStatus.CANCELLED
      }
    },
    select: promotionAssignmentSelect
  });
  const candidateAggregations = buildCandidateAggregations(candidates, assignments);
  const eligibleCandidates = candidateAggregations.filter((candidate) => {
    if (candidate.averageRating < thresholds.minRatingThreshold) {
      return false;
    }

    if (candidate.totalCompletedSessions < thresholds.minSessionsRequired) {
      return false;
    }

    if (candidate.attendanceRatio < thresholds.minAttendanceRatio) {
      return false;
    }

    return true;
  });
  const maxCompletedSessions = Math.max(
    1,
    ...eligibleCandidates.map((candidate) => candidate.totalCompletedSessions)
  );
  const rankedUsers = eligibleCandidates
    .map((candidate) => {
      const breakdown = buildSuggestionBreakdown({
        averageRating: candidate.averageRating,
        attendanceRatio: candidate.attendanceRatio,
        totalCompletedSessions: candidate.totalCompletedSessions,
        attendanceEligibleCount: candidate.attendanceEligibleCount,
        attendanceConfirmedCount: candidate.attendanceConfirmedCount,
        maxCompletedSessions
      });
      const suggestion: PromotionSuggestionContract = {
        userId: candidate.user.id,
        name: candidate.user.name,
        nameEn: candidate.user.nameEn,
        score: buildSuggestionScore(breakdown),
        rank: 0,
        breakdown
      };

      return suggestion;
    })
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      if (b.breakdown.averageRating !== a.breakdown.averageRating) {
        return b.breakdown.averageRating - a.breakdown.averageRating;
      }

      if (b.breakdown.attendanceRatio !== a.breakdown.attendanceRatio) {
        return b.breakdown.attendanceRatio - a.breakdown.attendanceRatio;
      }

      if (b.breakdown.totalCompletedSessions !== a.breakdown.totalCompletedSessions) {
        return b.breakdown.totalCompletedSessions - a.breakdown.totalCompletedSessions;
      }

      return a.userId.localeCompare(b.userId);
    })
    .slice(0, limit)
    .map((suggestion, index) => ({
      ...suggestion,
      rank: index + 1
    }));

  return {
    checkedAt: now,
    thresholds,
    totals: {
      candidateUsersCount: candidates.length,
      eligibleUsersCount: eligibleCandidates.length,
      rankedUsersCount: rankedUsers.length
    },
    data: rankedUsers
  };
}
