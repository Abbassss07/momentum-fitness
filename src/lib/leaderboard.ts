import { readAllPages } from "@/lib/readAllPages";
import { fetchAcceptedFriends } from "@/lib/friends";
import {
  currentStreak,
  distinctTrainingDays,
  getCalendarMonthBounds,
  getCalendarWeekBounds,
  todayIso,
  totalTrainingVolume,
} from "@/lib/fitness";
import { supabase } from "@/lib/supabase";

type ProfileRecord = {
  id: string;
  username: string;
  display_name: string | null;
};

type WorkoutRecord = {
  user_id: string;
  exercise_id: string;
  logged_at: string;
  weight_kg: number | null;
};

type LeaderboardPeriod = {
  start: string;
  end: string;
};

export type VolumeConsistencyScores = {
  weeklyVolume: number;
  weeklyTrainingDays: number;
  monthlyTrainingDays: number;
};

export type LeaderboardEntry = {
  userId: string;
  displayName: string;
  isCurrentUser: boolean;
  weeklyVolume: number;
  weeklyTrainingDays: number;
  monthlyTrainingDays: number;
  currentStreak: number;
};

export type LeaderboardData = {
  entries: LeaderboardEntry[];
  friendCount: number;
};

export function volumeConsistencyScores(
  workouts: WorkoutRecord[],
  week: LeaderboardPeriod,
  month: LeaderboardPeriod,
): VolumeConsistencyScores {
  const weeklyWorkouts = workouts.filter(
    (workout) => workout.logged_at >= week.start && workout.logged_at <= week.end,
  );
  const monthlyWorkouts = workouts.filter(
    (workout) => workout.logged_at >= month.start && workout.logged_at <= month.end,
  );

  return {
    weeklyVolume: totalTrainingVolume(weeklyWorkouts),
    weeklyTrainingDays: distinctTrainingDays(weeklyWorkouts),
    monthlyTrainingDays: distinctTrainingDays(monthlyWorkouts),
  };
}

export async function fetchLeaderboardData(userId: string): Promise<LeaderboardData> {
  const friends = await fetchAcceptedFriends(userId);
  const participantIds = [userId, ...friends.map((friend) => friend.id)];
  const week = getCalendarWeekBounds();
  const month = getCalendarMonthBounds();
  const today = todayIso();
  const workoutStart = week.start < month.start
    ? week.start
    : month.start;
  const workoutEnd = week.end > month.end ? week.end : month.end;

  const [profilesResult, workoutsResult, streakWorkoutsResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id,username,display_name")
        .eq("id", userId),
      readAllPages<WorkoutRecord>((from, to) => supabase
        .from("workout_logs")
        .select("user_id,exercise_id,logged_at,weight_kg")
        .in("user_id", participantIds)
        .gte("logged_at", workoutStart)
        .lte("logged_at", workoutEnd).order("id").range(from, to)),
      readAllPages<Pick<WorkoutRecord, "user_id" | "logged_at">>((from, to) => supabase
        .from("workout_logs")
        .select("user_id,logged_at")
        .in("user_id", participantIds)
        .lte("logged_at", today).order("id").range(from, to)),
    ]);

  const firstError =
    profilesResult.error ||
    workoutsResult.error ||
    streakWorkoutsResult.error;
  if (firstError) throw firstError;

  const names = new Map(
    [...((profilesResult.data ?? []) as ProfileRecord[]), ...friends].map((profile) => [
      profile.id,
      profile.display_name?.trim() || profile.username.trim(),
    ]),
  );

  if (friends.some((friend) => !names.get(friend.id))) {
    throw new Error("Could not load an accepted friend's profile.");
  }
  const workoutsByUser = new Map<string, WorkoutRecord[]>();
  for (const workout of (workoutsResult.data ?? []) as WorkoutRecord[]) {
    const existing = workoutsByUser.get(workout.user_id) ?? [];
    existing.push({
      ...workout,
      weight_kg:
        workout.weight_kg === null ? null : Number(workout.weight_kg),
    });
    workoutsByUser.set(workout.user_id, existing);
  }

  const streakDatesByUser = new Map<string, Array<Pick<WorkoutRecord, "logged_at">>>();
  for (const workout of (streakWorkoutsResult.data ?? []) as WorkoutRecord[]) {
    const existing = streakDatesByUser.get(workout.user_id) ?? [];
    existing.push({ logged_at: workout.logged_at });
    streakDatesByUser.set(workout.user_id, existing);
  }

  return {
    friendCount: friends.length,
    entries: participantIds.map((participantId) => {
      const participantWorkouts = workoutsByUser.get(participantId) ?? [];
      const trainingHistory = streakDatesByUser.get(participantId) ?? [];
      const scores = volumeConsistencyScores(participantWorkouts, week, month);
      return {
        userId: participantId,
        displayName: names.get(participantId) ?? "You",
        isCurrentUser: participantId === userId,
        ...scores,
        currentStreak: currentStreak(trainingHistory).days,
      };
    }),
  };
}


