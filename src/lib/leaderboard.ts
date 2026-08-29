import { fetchAcceptedFriends } from "@/lib/friends";
import {
  distinctTrainingDays,
  getCalendarMonthBounds,
  getCalendarWeekBounds,
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

type MonthlyWeightRecord = {
  user_id: string;
  logged_at: string;
  weight_kg: number;
};

export type LeaderboardEntry = {
  userId: string;
  displayName: string;
  isCurrentUser: boolean;
  weeklyVolume: number;
  weeklyTrainingDays: number;
  monthlyTrainingDays: number;
  monthlyWeightChange: number | null;
};

export type LeaderboardData = {
  entries: LeaderboardEntry[];
  friendCount: number;
};

export async function fetchLeaderboardData(userId: string): Promise<LeaderboardData> {
  const friends = await fetchAcceptedFriends(userId);
  const participantIds = [userId, ...friends.map((friend) => friend.id)];
  const week = getCalendarWeekBounds();
  const month = getCalendarMonthBounds();
  const workoutStart = week.start < month.start ? week.start : month.start;
  const workoutEnd = week.end > month.end ? week.end : month.end;

  const [profilesResult, workoutsResult, weightsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,username,display_name")
      .in("id", participantIds),
    supabase
      .from("workout_logs")
      .select("user_id,exercise_id,logged_at,weight_kg")
      .in("user_id", participantIds)
      .gte("logged_at", workoutStart)
      .lte("logged_at", workoutEnd),
    supabase
      .from("body_weight_logs")
      .select("user_id,logged_at,weight_kg")
      .in("user_id", participantIds)
      .gte("logged_at", month.start)
      .lte("logged_at", month.end)
      .order("logged_at", { ascending: true }),
  ]);

  const firstError =
    profilesResult.error || workoutsResult.error || weightsResult.error;
  if (firstError) throw firstError;

  const names = new Map(
    ((profilesResult.data ?? []) as ProfileRecord[]).map((profile) => [
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

  const monthlyWeightsByUser = new Map<string, MonthlyWeightRecord[]>();
  for (const weight of (weightsResult.data ?? []) as MonthlyWeightRecord[]) {
    const existing = monthlyWeightsByUser.get(weight.user_id) ?? [];
    existing.push({ ...weight, weight_kg: Number(weight.weight_kg) });
    monthlyWeightsByUser.set(weight.user_id, existing);
  }

  return {
    friendCount: friends.length,
    entries: participantIds.map((participantId) => {
      const participantWorkouts = workoutsByUser.get(participantId) ?? [];
      const weeklyWorkouts = participantWorkouts.filter(
        (workout) => workout.logged_at >= week.start && workout.logged_at <= week.end,
      );
      const monthlyWorkouts = participantWorkouts.filter(
        (workout) => workout.logged_at >= month.start && workout.logged_at <= month.end,
      );
      const monthlyWeights = monthlyWeightsByUser.get(participantId) ?? [];
      const firstWeight = monthlyWeights[0]?.weight_kg;
      const lastWeight = monthlyWeights.at(-1)?.weight_kg;
      return {
        userId: participantId,
        displayName: names.get(participantId) ?? "You",
        isCurrentUser: participantId === userId,
        weeklyVolume: totalTrainingVolume(weeklyWorkouts),
        weeklyTrainingDays: distinctTrainingDays(weeklyWorkouts),
        monthlyTrainingDays: distinctTrainingDays(monthlyWorkouts),
        monthlyWeightChange:
          firstWeight === undefined || lastWeight === undefined || monthlyWeights.length < 2
            ? null
            : lastWeight - firstWeight,
      };
    }),
  };
}
