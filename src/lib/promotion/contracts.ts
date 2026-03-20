export type PromotionSuggestionThresholdsContract = {
  minRatingThreshold: number;
  minSessionsRequired: number;
  minAttendanceRatio: number;
};

export type PromotionSuggestionsQueryContract = {
  limit?: number;
};

export type PromotionSuggestionBreakdownContract = {
  averageRating: number;
  attendanceRatio: number;
  totalCompletedSessions: number;
  attendanceEligibleCount: number;
  attendanceConfirmedCount: number;
  ratingScore: number;
  attendanceScore: number;
  sessionsScore: number;
};

export type PromotionSuggestionContract = {
  userId: string;
  name: string;
  nameEn: string | null;
  score: number;
  rank: number;
  breakdown: PromotionSuggestionBreakdownContract;
};

export type PromotionSuggestionsResultContract = {
  checkedAt: Date;
  thresholds: PromotionSuggestionThresholdsContract;
  totals: {
    candidateUsersCount: number;
    eligibleUsersCount: number;
    rankedUsersCount: number;
  };
  data: PromotionSuggestionContract[];
};
