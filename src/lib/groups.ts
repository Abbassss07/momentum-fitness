import { getCalendarMonthBounds, getCalendarWeekBounds, todayIso } from "@/lib/fitness";
import {
  LeaderboardEntry,
  volumeConsistencyScores,
} from "@/lib/leaderboard";
import { supabase } from "@/lib/supabase";

export type Group = {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  created_at: string;
};

export type GroupProfile = {
  id: string;
  username: string;
  display_name: string | null;
};

export type GroupMember = {
  group_id: string;
  user_id: string;
  joined_at: string;
  profile: GroupProfile;
};

export type GroupJoinRequestStatus = "pending" | "approved" | "declined";

export type GroupJoinRequest = {
  group_id: string;
  user_id: string;
  status: GroupJoinRequestStatus;
  created_at: string;
  updated_at: string;
  profile: GroupProfile;
};

export type GroupDirectInviteStatus = "pending" | "accepted" | "declined";

export type GroupDirectInvite = {
  id: string;
  group_id: string;
  invited_user_id: string;
  invited_by: string;
  status: GroupDirectInviteStatus;
  created_at: string;
  updated_at: string;
  profile: GroupProfile;
};

export type OwnGroupDirectInvite = {
  id: string;
  group_id: string;
  group_name: string;
  status: GroupDirectInviteStatus;
  created_at: string;
};

type GroupJoinRequestRecord = Omit<GroupJoinRequest, "profile">;
type GroupDirectInviteRecord = Omit<GroupDirectInvite, "profile">;

type GroupLeaderboardRow = {
  member_id: string;
  username: string;
  display_name: string | null;
  exercise_id: string | null;
  logged_at: string | null;
  weight_kg: number | null;
};

export type GroupLeaderboardData = {
  entries: LeaderboardEntry[];
  memberCount: number;
};

export async function fetchGroups(): Promise<Group[]> {
  const { data, error } = await supabase
    .from("groups")
    .select("id,name,owner_id,invite_code,created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Group[];
}

export async function createGroup(userId: string, name: string): Promise<Group> {
  const { data, error } = await supabase
    .from("groups")
    .insert({ name: name.trim(), owner_id: userId })
    .select("id,name,owner_id,invite_code,created_at")
    .single();
  if (error) throw error;
  return data as Group;
}

export async function renameGroup(groupId: string, name: string): Promise<Group> {
  const { data, error } = await supabase
    .from("groups")
    .update({ name: name.trim() })
    .eq("id", groupId)
    .select("id,name,owner_id,invite_code,created_at")
    .single();
  if (error) throw error;
  return data as Group;
}

export async function findGroupByInviteCode(inviteCode: string) {
  const { data, error } = await supabase.rpc("get_group_by_invite_code", {
    search_invite_code: inviteCode,
  });
  if (error) throw error;
  return ((data ?? []) as Group[])[0] ?? null;
}

export async function fetchOwnGroupRequest(groupId: string, userId: string) {
  const { data, error } = await supabase
    .from("group_join_requests")
    .select("group_id,user_id,status,created_at,updated_at")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as GroupJoinRequestRecord | null;
}

export async function requestToJoinGroup(inviteCode: string) {
  const { data, error } = await supabase.rpc("request_to_join_group", {
    search_invite_code: inviteCode,
  });
  if (error) throw error;
  return ((data ?? []) as Array<{ group_id: string; status: GroupJoinRequestStatus }>)[0];
}

export async function fetchGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from("group_members")
    .select("group_id,user_id,joined_at")
    .eq("group_id", groupId)
    .order("joined_at");
  if (error) throw error;

  const members = (data ?? []) as Array<Omit<GroupMember, "profile">>;
  const profiles = await fetchProfiles(members.map((member) => member.user_id));
  return members.map((member) => ({
    ...member,
    profile: profileOrFallback(profiles, member.user_id),
  }));
}

export async function fetchPendingGroupRequests(
  groupId: string,
): Promise<GroupJoinRequest[]> {
  const { data, error } = await supabase
    .from("group_join_requests")
    .select("group_id,user_id,status,created_at,updated_at")
    .eq("group_id", groupId)
    .eq("status", "pending")
    .order("created_at");
  if (error) throw error;

  const requests = (data ?? []) as GroupJoinRequestRecord[];
  const profiles = await fetchProfiles(requests.map((request) => request.user_id));
  return requests.map((request) => ({
    ...request,
    profile: profileOrFallback(profiles, request.user_id),
  }));
}

export async function respondToGroupJoinRequest(
  groupId: string,
  userId: string,
  status: "approved" | "declined",
) {
  const { error } = await supabase
    .from("group_join_requests")
    .update({ status })
    .eq("group_id", groupId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function fetchGroupDirectInvites(
  groupId: string,
): Promise<GroupDirectInvite[]> {
  const { data, error } = await supabase
    .from("group_direct_invites")
    .select("id,group_id,invited_user_id,invited_by,status,created_at,updated_at")
    .eq("group_id", groupId)
    .eq("status", "pending")
    .order("created_at");
  if (error) throw error;

  const invites = (data ?? []) as GroupDirectInviteRecord[];
  const profiles = await fetchProfiles(invites.map((invite) => invite.invited_user_id));
  return invites.map((invite) => ({
    ...invite,
    profile: profileOrFallback(profiles, invite.invited_user_id),
  }));
}

export async function fetchOwnGroupDirectInvites(
  userId: string,
): Promise<OwnGroupDirectInvite[]> {
  const { data, error } = await supabase
    .from("group_direct_invites")
    .select("id,group_id,group_name,status,created_at")
    .eq("invited_user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as OwnGroupDirectInvite[];
}

export async function sendGroupDirectInvite(
  groupId: string,
  invitedUserId: string,
  invitedBy: string,
) {
  const { error } = await supabase.from("group_direct_invites").insert({
    group_id: groupId,
    invited_user_id: invitedUserId,
    invited_by: invitedBy,
  });
  if (error) throw error;
}

export async function respondToGroupDirectInvite(
  inviteId: string,
  status: "accepted" | "declined",
) {
  const { error } = await supabase
    .from("group_direct_invites")
    .update({ status })
    .eq("id", inviteId);
  if (error) throw error;
}

export async function removeGroupMember(groupId: string, userId: string) {
  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function deleteGroup(groupId: string) {
  const { error } = await supabase.from("groups").delete().eq("id", groupId);
  if (error) throw error;
}

export async function fetchGroupLeaderboardData(
  groupId: string,
  currentUserId: string,
): Promise<GroupLeaderboardData> {
  const week = getCalendarWeekBounds();
  const month = getCalendarMonthBounds();
  const rangeStart = week.start < month.start ? week.start : month.start;
  const rangeEnd = week.end > month.end ? week.end : month.end;
  const { data, error } = await supabase.rpc("get_group_leaderboard_workouts", {
    target_group_id: groupId,
    reference_date: todayIso(),
    range_start: rangeStart,
    range_end: rangeEnd,
  });
  if (error) throw error;

  const rows = (data ?? []) as GroupLeaderboardRow[];
  const profiles = new Map<string, GroupProfile>();
  const workouts = new Map<
    string,
    Array<{ user_id: string; exercise_id: string; logged_at: string; weight_kg: number | null }>
  >();

  for (const row of rows) {
    profiles.set(row.member_id, {
      id: row.member_id,
      username: row.username,
      display_name: row.display_name,
    });
    if (!row.exercise_id || !row.logged_at) continue;
    const existing = workouts.get(row.member_id) ?? [];
    existing.push({
      user_id: row.member_id,
      exercise_id: row.exercise_id,
      logged_at: row.logged_at,
      weight_kg: row.weight_kg === null ? null : Number(row.weight_kg),
    });
    workouts.set(row.member_id, existing);
  }

  const participantIds = [...profiles.keys()];
  return {
    memberCount: participantIds.length,
    entries: participantIds.map((memberId) => ({
      userId: memberId,
      displayName: displayName(profiles.get(memberId)),
      isCurrentUser: memberId === currentUserId,
      ...volumeConsistencyScores(workouts.get(memberId) ?? [], week, month),
      currentStreak: 0,
    })),
  };
}

async function fetchProfiles(userIds: string[]) {
  const profiles = new Map<string, GroupProfile>();
  if (!userIds.length) return profiles;

  const { data, error } = await supabase
    .from("profiles")
    .select("id,username,display_name")
    .in("id", userIds);
  if (error) throw error;
  for (const profile of (data ?? []) as GroupProfile[]) profiles.set(profile.id, profile);
  return profiles;
}

function profileOrFallback(profiles: Map<string, GroupProfile>, userId: string) {
  return profiles.get(userId) ?? {
    id: userId,
    username: "momentum_member",
    display_name: null,
  };
}

function displayName(profile?: GroupProfile) {
  return profile?.display_name?.trim() || profile?.username.trim() || "Member";
}
