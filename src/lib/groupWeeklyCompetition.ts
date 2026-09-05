import { supabase } from "@/lib/supabase";

export type CompetitionTieBreaker =
  | "active_days"
  | "volume"
  | "workouts"
  | "member_since"
  | "no_activity";

export type CompetitionMemberScore = {
  rank: number;
  userId: string;
  displayName: string;
  isCurrentUser: boolean;
  activeDays: number;
  totalVolume: number;
  totalWorkouts: number;
};

export type CompetitionWeekHistory = {
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  status: "finalized" | "in_progress" | "upcoming" | "finalizing";
  winnerId: string | null;
  winnerDisplayName: string | null;
  activeDays: number | null;
  totalVolume: number | null;
  totalWorkouts: number | null;
  tieBreaker: CompetitionTieBreaker | null;
  finalizedAt: string | null;
};

export type GroupWeeklyCompetition = {
  memberCount: number;
  cycle: {
    start: string;
    end: string;
    number: number;
  };
  currentWeek: {
    number: number;
    start: string;
    end: string;
  };
  frontrunner: CompetitionMemberScore | null;
  tieBreak: {
    isActive: boolean;
    tiedCount: number;
    decidedBy: CompetitionTieBreaker;
  };
  leaderboard: CompetitionMemberScore[];
  history: CompetitionWeekHistory[];
};

export async function fetchGroupWeeklyCompetition(
  groupId: string,
): Promise<GroupWeeklyCompetition> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("Your session has expired. Please sign in again.");

  const response = await fetch(`/api/groups/${encodeURIComponent(groupId)}/weekly-competition`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  const payload = (await response.json()) as GroupWeeklyCompetition | { error?: string };
  if (!response.ok) {
    throw new Error("error" in payload && payload.error
      ? payload.error
      : "Could not load the weekly competition.");
  }

  return payload as GroupWeeklyCompetition;
}

