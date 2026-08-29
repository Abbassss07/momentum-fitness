import type { BodyWeightLog, WorkoutLog } from "@/lib/fitness";
import { supabase } from "@/lib/supabase";

export type FriendProfile = {
  id: string;
  username: string;
  display_name: string | null;
};

export type FriendProgress = {
  workouts: WorkoutLog[];
  weights: BodyWeightLog[];
};

export type FriendshipStatus = "pending" | "accepted" | "declined";

export type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
};

export type FriendshipLists = {
  friends: Array<{ friendship: Friendship; profile: FriendProfile }>;
  incoming: Array<{ friendship: Friendship; profile: FriendProfile }>;
  outgoing: Array<{ friendship: Friendship; profile: FriendProfile }>;
  declined: Friendship[];
};

export async function findProfileByUsername(username: string) {
  const { data, error } = await supabase.rpc("find_profile_by_username", {
    search_username: username.trim().toLowerCase(),
  });
  if (error) throw error;
  const profile = ((data ?? []) as Array<Omit<FriendProfile, "display_name">>)[0];
  return profile ? { ...profile, display_name: null } : null;
}

export async function fetchFriendshipLists(userId: string): Promise<FriendshipLists> {
  const { data, error } = await supabase
    .from("friendships")
    .select("*")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const friendships = (data ?? []) as Friendship[];
  const profileIds = [...new Set(friendships.map((item) =>
    item.requester_id === userId ? item.addressee_id : item.requester_id,
  ))];
  const profiles = new Map<string, FriendProfile>();

  if (profileIds.length) {
    const result = await supabase
      .from("profiles")
      .select("id,username,display_name")
      .in("id", profileIds);
    if (result.error) throw result.error;
    for (const profile of (result.data ?? []) as FriendProfile[]) profiles.set(profile.id, profile);
  }

  const entry = (friendship: Friendship) => {
    const profileId = friendship.requester_id === userId
      ? friendship.addressee_id
      : friendship.requester_id;
    return {
      friendship,
      profile: profiles.get(profileId) ?? {
        id: profileId,
        username: "momentum_member",
        display_name: null,
      },
    };
  };

  return {
    friends: friendships.filter((item) => item.status === "accepted").map(entry),
    incoming: friendships
      .filter((item) => item.status === "pending" && item.addressee_id === userId)
      .map(entry),
    outgoing: friendships
      .filter((item) => item.status === "pending" && item.requester_id === userId)
      .map(entry),
    declined: friendships.filter((item) => item.status === "declined"),
  };
}

export async function fetchAcceptedFriends(userId: string) {
  return (await fetchFriendshipLists(userId)).friends.map((item) => item.profile);
}

export async function sendFriendRequest(
  userId: string,
  addresseeId: string,
  declined: Friendship[] = [],
) {
  const previous = declined.find((item) =>
    [item.requester_id, item.addressee_id].includes(addresseeId),
  );
  if (previous) {
    const removed = await supabase.from("friendships").delete().eq("id", previous.id);
    if (removed.error) throw removed.error;
  }
  const { error } = await supabase.from("friendships").insert({
    requester_id: userId,
    addressee_id: addresseeId,
    status: "pending",
  });
  if (error) throw error;
}

export async function respondToRequest(id: string, status: "accepted" | "declined") {
  const { error } = await supabase.from("friendships").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function removeFriendship(id: string) {
  const { error } = await supabase.from("friendships").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchFriendProgress(friendId: string): Promise<FriendProgress> {
  const [workouts, weights] = await Promise.all([
    supabase
      .from("workout_logs")
      .select("*")
      .eq("user_id", friendId)
      .order("logged_at", { ascending: false }),
    supabase
      .from("body_weight_logs")
      .select("*")
      .eq("user_id", friendId)
      .order("logged_at", { ascending: true }),
  ]);
  if (workouts.error) throw workouts.error;
  if (weights.error) throw weights.error;

  return {
    workouts: ((workouts.data ?? []) as WorkoutLog[]).map((item) => ({
      ...item,
      weight_kg: item.weight_kg === null ? null : Number(item.weight_kg),
    })),
    weights: ((weights.data ?? []) as BodyWeightLog[]).map((item) => ({
      ...item,
      weight_kg: Number(item.weight_kg),
    })),
  };
}
