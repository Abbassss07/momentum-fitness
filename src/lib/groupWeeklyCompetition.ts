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
  const { data, error } = await supabase.rpc("get_group_weekly_competition", {
    target_group_id: groupId,
    reference_date: new Date().toISOString().slice(0, 10),
  });
  if (error) throw error;
  return data as GroupWeeklyCompetition;
}

