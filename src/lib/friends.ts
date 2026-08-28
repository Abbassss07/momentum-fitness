import { supabase } from "@/lib/supabase";

export type FriendProfile = {
  id: string;
  email: string;
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

export async function findProfileByEmail(email: string) {
  const { data, error } = await supabase.rpc("find_profile_by_email", {
    search_email: email.trim(),
  });
  if (error) throw error;
  return ((data ?? []) as FriendProfile[])[0] ?? null;
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
    const result = await supabase.from("profiles").select("id,email").in("id", profileIds);
    if (result.error) throw result.error;
    for (const profile of (result.data ?? []) as FriendProfile[]) profiles.set(profile.id, profile);
  }

  const entry = (friendship: Friendship) => {
    const profileId = friendship.requester_id === userId
      ? friendship.addressee_id
      : friendship.requester_id;
    return { friendship, profile: profiles.get(profileId) ?? { id: profileId, email: "Momentum member" } };
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

export async function fetchFriendSummary(friendId: string) {
  const [workouts, weights] = await Promise.all([
    supabase.from("workout_logs").select("logged_at").eq("user_id", friendId),
    supabase
      .from("body_weight_logs")
      .select("logged_at,weight_kg")
      .eq("user_id", friendId)
      .order("logged_at", { ascending: false })
      .limit(1),
  ]);
  if (workouts.error) throw workouts.error;
  if (weights.error) throw weights.error;
  return {
    workoutCount: workouts.data?.length ?? 0,
    latestWeight: weights.data?.[0]
      ? { ...weights.data[0], weight_kg: Number(weights.data[0].weight_kg) }
      : null,
  };
}
