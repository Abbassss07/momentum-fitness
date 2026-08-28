import { supabase } from "@/lib/supabase";

export type AcceptedFriend = {
  friendshipId: string;
  userId: string;
  acceptedAt: string;
};

type FriendshipRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  updated_at: string;
};

/**
 * Returns the other participant for each friendship accepted by the current user.
 * RLS independently limits the query to friendships the caller belongs to.
 */
export async function fetchAcceptedFriends(
  userId: string,
): Promise<AcceptedFriend[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, updated_at")
    .eq("status", "accepted")
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return ((data as FriendshipRow[] | null) ?? []).map((friendship) => ({
    friendshipId: friendship.id,
    userId:
      friendship.requester_id === userId
        ? friendship.addressee_id
        : friendship.requester_id,
    acceptedAt: friendship.updated_at,
  }));
}
