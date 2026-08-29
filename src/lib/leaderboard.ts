import { fetchAcceptedFriends } from "@/lib/friends";
import {
  getCalendarMonthBounds,
  getCalendarWeekBounds,
  trainingVolume,
} from "@/lib/fitness";
import { supabase } from "@/lib/supabase";

type ProfileRecord = {
  id: string;
  username: string;
  display_name: string | null;
};

type WeeklyWorkoutRecord = {
  user_id: string;
  weight_kg: number;
  sets: number;
  reps: number;
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
  weeklyWorkoutCount: number;
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

  const [profilesResult, workoutsResult, weightsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,username,display_name")
      .in("id", participantIds),
    supabase
      .from("workout_logs")
      .select("user_id,weight_kg,sets,reps")
      .in("user_id", participantIds)
      .gte("logged_at", week.start)
      .lte("logged_at", week.end),
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
  for (const friend of friends) {
    if (!names.has(friend.id)) {
      names.set(
        friend.id,
        friend.display_name?.trim() || friend.username.trim(),
      );
    }
  }

  if (friends.some((friend) => !names.get(friend.id))) {
    throw new Error("Could not load an accepted friend's profile.");
  }
  const weeklyVolumeByUser = new Map<string, number>();
  const weeklyCountByUser = new Map<string, number>();

  for (const workout of (workoutsResult.data ?? []) as WeeklyWorkoutRecord[]) {
    weeklyVolumeByUser.set(
      workout.user_id,
      (weeklyVolumeByUser.get(workout.user_id) ?? 0) + trainingVolume(workout),
    );
    // Replace this raw count with progress toward each user's weekly goal when goals exist.
    weeklyCountByUser.set(
      workout.user_id,
      (weeklyCountByUser.get(workout.user_id) ?? 0) + 1,
    );
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
      const monthlyWeights = monthlyWeightsByUser.get(participantId) ?? [];
      const firstWeight = monthlyWeights[0]?.weight_kg;
      const lastWeight = monthlyWeights.at(-1)?.weight_kg;
      return {
        userId: participantId,
        displayName: names.get(participantId) ?? "You",
        isCurrentUser: participantId === userId,
        weeklyVolume: weeklyVolumeByUser.get(participantId) ?? 0,
        weeklyWorkoutCount: weeklyCountByUser.get(participantId) ?? 0,
        monthlyWeightChange:
          firstWeight === undefined || lastWeight === undefined || monthlyWeights.length < 2
            ? null
            : lastWeight - firstWeight,
      };
    }),
  };
}
