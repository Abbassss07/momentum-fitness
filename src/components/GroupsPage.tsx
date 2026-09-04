"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Check,
  Clipboard,
  Copy,
  Dumbbell,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  ConsistencyRange,
  LeaderboardRows,
  LeaderboardView,
  rankEntries,
} from "@/components/LeaderboardPage";
import {
  createGroup,
  deleteGroup,
  fetchGroupLeaderboardData,
  fetchGroupDirectInvites,
  fetchGroupMembers,
  fetchGroups,
  fetchOwnGroupDirectInvites,
  fetchOwnGroupRequest,
  fetchPendingGroupRequests,
  findGroupByInviteCode,
  removeGroupMember,
  renameGroup,
  requestToJoinGroup,
  respondToGroupDirectInvite,
  respondToGroupJoinRequest,
  sendGroupDirectInvite,
} from "@/lib/groups";
import type {
  Group,
  GroupDirectInvite,
  OwnGroupDirectInvite,
  GroupJoinRequest,
  GroupJoinRequestStatus,
  GroupLeaderboardData,
  GroupMember,
  GroupProfile,
} from "@/lib/groups";
import { fetchAcceptedFriends } from "@/lib/friends";
import { initials } from "@/lib/fitness";
import { scrollFocusedFieldIntoView } from "@/lib/scrollFocusedFieldIntoView";

type GroupMetric = Extract<LeaderboardView, "volume" | "consistency">;

export function GroupsPage({
  userId,
  initialInviteCode,
  onNotice,
}: {
  userId: string;
  initialInviteCode?: string;
  onNotice: (message: string) => void;
}) {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteGroup, setInviteGroup] = useState<Group | null>(null);
  const [inviteStatus, setInviteStatus] = useState<GroupJoinRequestStatus | null>(null);
  const [inviteLoading, setInviteLoading] = useState(Boolean(initialInviteCode));
  const [inviteError, setInviteError] = useState("");
  const [directInvites, setDirectInvites] = useState<OwnGroupDirectInvite[]>([]);
  const [directInviteBusyId, setDirectInviteBusyId] = useState("");

  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const [nextGroups, nextDirectInvites] = await Promise.all([
        fetchGroups(),
        fetchOwnGroupDirectInvites(userId),
      ]);
      setGroups(nextGroups);
      setDirectInvites(nextDirectInvites);
      setError("");
      return nextGroups;
    } catch (caught) {
      setError(messageFrom(caught, "Could not load your groups."));
      return [];
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    let ignore = false;
    Promise.all([fetchGroups(), fetchOwnGroupDirectInvites(userId)])
      .then(([nextGroups, nextDirectInvites]) => {
        if (ignore) return;
        setGroups(nextGroups);
        setDirectInvites(nextDirectInvites);
        setError("");
      })
      .catch((caught) => {
        if (!ignore) setError(messageFrom(caught, "Could not load your groups."));
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!initialInviteCode) return;
    let ignore = false;

    async function loadInvite() {
      setInviteLoading(true);
      try {
        const group = await findGroupByInviteCode(initialInviteCode!);
        if (!group) throw new Error("This invite link is invalid or has expired.");
        const request = await fetchOwnGroupRequest(group.id, userId);
        if (!ignore) {
          setInviteGroup(group);
          setInviteStatus(request?.status ?? null);
          setInviteError("");
        }
      } catch (caught) {
        if (!ignore) setInviteError(messageFrom(caught, "Could not open this invite."));
      } finally {
        if (!ignore) setInviteLoading(false);
      }
    }

    void loadInvite();
    return () => {
      ignore = true;
    };
  }, [initialInviteCode, userId]);

  const invitedMembership = inviteGroup
    ? groups.find((group) => group.id === inviteGroup.id)
    : undefined;

  const selectedGroup = groups.find(
    (group) => group.id === (selectedGroupId || invitedMembership?.id),
  );

  async function submitJoinRequest() {
    if (!initialInviteCode) return;
    setInviteLoading(true);
    try {
      const result = await requestToJoinGroup(initialInviteCode);
      setInviteStatus(result?.status ?? "pending");
      onNotice("Join request sent");
    } catch (caught) {
      setInviteError(messageFrom(caught, "Could not send the join request."));
    } finally {
      setInviteLoading(false);
    }
  }

  async function respondToDirectInvite(
    invite: OwnGroupDirectInvite,
    status: "accepted" | "declined",
  ) {
    setDirectInviteBusyId(invite.id);
    try {
      await respondToGroupDirectInvite(invite.id, status);
      onNotice(status === "accepted" ? "Group invite accepted" : "Group invite declined");
      await loadGroups();
    } catch (caught) {
      onNotice(messageFrom(caught, "Could not update the group invite."));
    } finally {
      setDirectInviteBusyId("");
    }
  }

  if (initialInviteCode && !invitedMembership) {
    return (
      <InviteJoinView
        group={inviteGroup}
        status={inviteStatus}
        loading={inviteLoading}
        error={inviteError}
        onRequest={submitJoinRequest}
        onShowGroups={() => router.push("/")}
      />
    );
  }

  if (selectedGroup) {
    return (
      <GroupDetail
        group={selectedGroup}
        userId={userId}
        onBack={() => setSelectedGroupId("")}
        onDeleted={async () => {
          setSelectedGroupId("");
          await loadGroups();
        }}
        onRenamed={(updatedGroup) => {
          setGroups((current) => current.map((item) => (
            item.id === updatedGroup.id ? updatedGroup : item
          )));
        }}
        onNotice={onNotice}
      />
    );
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="section-label">Private squads</p>
          <h1>Groups</h1>
          <p>Train together without changing who you share as friends.</p>
        </div>
        <div className="page-actions">
          <button type="button" className="primary-button" onClick={() => setCreateOpen(true)}>
            <Plus size={16} />
            Create group
          </button>
        </div>
      </header>

      <section className="journal-section groups-section" aria-labelledby="your-groups-title">
        <div className="section-heading">
          <div>
            <p className="section-label">Memberships</p>
            <h2 id="your-groups-title">Your groups</h2>
          </div>
          <button type="button" className="secondary-button groups-mobile-create" onClick={() => setCreateOpen(true)}>
            <Plus size={15} />
            Create
          </button>
        </div>

        {loading ? <div className="leaderboard-skeleton"><span /><span /><span /></div> : null}
        {!loading && error ? (
          <div className="leaderboard-empty" role="alert">
            <RefreshCw size={21} />
            <strong>Groups unavailable</strong>
            <p>{error}</p>
            <button type="button" className="secondary-button" onClick={() => void loadGroups()}>Try again</button>
          </div>
        ) : null}
        {!loading && !error && groups.length === 0 ? (
          <div className="leaderboard-empty">
            <Users size={22} />
            <strong>No groups yet</strong>
            <p>Create a private squad, or open an invite link from a group owner.</p>
          </div>
        ) : null}
        {!loading && !error && groups.length ? (
          <div className="group-list">
            {groups.map((group) => (
              <button type="button" key={group.id} onClick={() => setSelectedGroupId(group.id)}>
                <span className="group-avatar"><Users size={18} /></span>
                <span>
                  <strong>{group.name}</strong>
                  <small>{group.owner_id === userId ? "Owner" : "Member"}</small>
                </span>
                <span className="group-code">{group.invite_code}</span>
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {directInvites.filter((invite) => invite.status === "pending").length ? (
        <section className="journal-section requests-section group-direct-invites" aria-labelledby="direct-group-invites-title">
          <div className="section-heading">
            <div>
              <p className="section-label">Waiting for you</p>
              <h2 id="direct-group-invites-title">Group invites</h2>
            </div>
            <span className="request-count">
              {directInvites.filter((invite) => invite.status === "pending").length}
            </span>
          </div>
          {directInvites.filter((invite) => invite.status === "pending").map((invite) => (
            <div className="request-row" key={invite.id}>
              <div className="friend-identity">
                <span className="friend-avatar"><Users size={16} /></span>
                <span><strong>{invite.group_name}</strong><small>Invite from the group owner</small></span>
              </div>
              <div className="row-actions">
                <button type="button" className="icon-text-button accept" disabled={directInviteBusyId === invite.id} onClick={() => void respondToDirectInvite(invite, "accepted")}><Check size={15} />Accept</button>
                <button type="button" className="icon-text-button" disabled={directInviteBusyId === invite.id} onClick={() => void respondToDirectInvite(invite, "declined")}><X size={15} />Decline</button>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {createOpen ? (
        <CreateGroupModal
          onClose={() => setCreateOpen(false)}
          onCreate={async (name) => {
            const group = await createGroup(userId, name);
            setGroups((current) => [group, ...current]);
            setSelectedGroupId(group.id);
            onNotice("Group created");
          }}
        />
      ) : null}
    </>
  );
}

function InviteJoinView({
  group,
  status,
  loading,
  error,
  onRequest,
  onShowGroups,
}: {
  group: Group | null;
  status: GroupJoinRequestStatus | null;
  loading: boolean;
  error: string;
  onRequest: () => Promise<void>;
  onShowGroups: () => void;
}) {
  return (
    <>
      <header className="page-header compact">
        <div>
          <p className="section-label">Group invitation</p>
          <h1>{group?.name ?? "Join a group"}</h1>
          <p>Membership is private and requires approval from the group owner.</p>
        </div>
      </header>
      <section className="journal-section invite-card">
        {loading && !group ? <div className="leaderboard-skeleton"><span /><span /></div> : null}
        {!loading && error ? (
          <div className="leaderboard-empty" role="alert">
            <X size={22} />
            <strong>Invite unavailable</strong>
            <p>{error}</p>
          </div>
        ) : null}
        {group && !error ? (
          <>
            <span className="invite-icon"><ShieldCheck size={24} /></span>
            <h2>{group.name}</h2>
            {status === "pending" ? (
              <div className="status-note"><Clipboard size={17} />Your request is waiting for owner approval.</div>
            ) : status === "declined" ? (
              <div className="status-note declined"><X size={17} />This join request was declined.</div>
            ) : status === "approved" ? (
              <div className="status-note"><Check size={17} />Your request was approved. Refresh to open the group.</div>
            ) : (
              <button type="button" className="primary-button" disabled={loading} onClick={() => void onRequest()}>
                {loading ? "Sending..." : "Request to join"}
              </button>
            )}
          </>
        ) : null}
        <button type="button" className="text-button" onClick={onShowGroups}>Show my groups</button>
      </section>
    </>
  );
}

function GroupDetail({
  group,
  userId,
  onBack,
  onDeleted,
  onRenamed,
  onNotice,
}: {
  group: Group;
  userId: string;
  onBack: () => void;
  onDeleted: () => Promise<void>;
  onRenamed: (group: Group) => void;
  onNotice: (message: string) => void;
}) {
  const isOwner = group.owner_id === userId;
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [requests, setRequests] = useState<GroupJoinRequest[]>([]);
  const [sentDirectInvites, setSentDirectInvites] = useState<GroupDirectInvite[]>([]);
  const [leaderboard, setLeaderboard] = useState<GroupLeaderboardData | null>(null);
  const [metric, setMetric] = useState<GroupMetric>("volume");
  const [range, setRange] = useState<ConsistencyRange>("week");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [directInviteOpen, setDirectInviteOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextMembers, nextRequests, nextDirectInvites, nextLeaderboard] = await Promise.all([
        fetchGroupMembers(group.id),
        isOwner ? fetchPendingGroupRequests(group.id) : Promise.resolve([]),
        isOwner ? fetchGroupDirectInvites(group.id) : Promise.resolve([]),
        fetchGroupLeaderboardData(group.id, userId),
      ]);
      setMembers(nextMembers);
      setRequests(nextRequests);
      setSentDirectInvites(nextDirectInvites);
      setLeaderboard(nextLeaderboard);
      setError("");
    } catch (caught) {
      setError(messageFrom(caught, "Could not load this group."));
    } finally {
      setLoading(false);
    }
  }, [group.id, isOwner, userId]);

  useEffect(() => {
    let ignore = false;
    Promise.all([
      fetchGroupMembers(group.id),
      isOwner ? fetchPendingGroupRequests(group.id) : Promise.resolve([]),
      isOwner ? fetchGroupDirectInvites(group.id) : Promise.resolve([]),
      fetchGroupLeaderboardData(group.id, userId),
    ])
      .then(([nextMembers, nextRequests, nextDirectInvites, nextLeaderboard]) => {
        if (ignore) return;
        setMembers(nextMembers);
        setRequests(nextRequests);
        setSentDirectInvites(nextDirectInvites);
        setLeaderboard(nextLeaderboard);
        setError("");
      })
      .catch((caught) => {
        if (!ignore) setError(messageFrom(caught, "Could not load this group."));
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [group.id, isOwner, userId]);

  const rankedRows = useMemo(
    () => rankEntries(leaderboard?.entries ?? [], metric, range),
    [leaderboard, metric, range],
  );

  async function respond(request: GroupJoinRequest, status: "approved" | "declined") {
    setBusyId(request.user_id);
    try {
      await respondToGroupJoinRequest(group.id, request.user_id, status);
      onNotice(status === "approved" ? "Member approved" : "Request declined");
      await load();
    } catch (caught) {
      onNotice(messageFrom(caught, "Could not update the request."));
    } finally {
      setBusyId("");
    }
  }

  async function remove(member: GroupMember) {
    const name = member.profile.display_name?.trim() || `@${member.profile.username}`;
    if (!window.confirm(`Remove ${name} from ${group.name}?`)) return;
    setBusyId(member.user_id);
    try {
      await removeGroupMember(group.id, member.user_id);
      onNotice("Member removed");
      await load();
    } catch (caught) {
      onNotice(messageFrom(caught, "Could not remove the member."));
    } finally {
      setBusyId("");
    }
  }

  async function copyInvite() {
    const link = `${window.location.origin}/join/${group.invite_code}`;
    try {
      await navigator.clipboard.writeText(link);
      onNotice("Invite link copied");
    } catch {
      onNotice(link);
    }
  }

  async function rename(name: string) {
    const updatedGroup = await renameGroup(group.id, name);
    onRenamed(updatedGroup);
    setRenameOpen(false);
    onNotice("Group renamed");
  }

  async function sendDirectInvite(friendId: string) {
    await sendGroupDirectInvite(group.id, friendId, userId);
    setDirectInviteOpen(false);
    onNotice("Direct group invite sent");
    await load();
  }

  async function removeGroup() {
    if (!window.confirm(`Delete ${group.name}? This removes the group for every member.`)) return;
    setBusyId("delete-group");
    try {
      await deleteGroup(group.id);
      onNotice("Group deleted");
      await onDeleted();
    } catch (caught) {
      onNotice(messageFrom(caught, "Could not delete the group."));
      setBusyId("");
    }
  }

  return (
    <>
      <button type="button" className="friend-back-button" onClick={onBack}>
        <ArrowLeft size={16} />All groups
      </button>
      <header className="page-header compact group-detail-header">
        <div>
          <p className="section-label">{isOwner ? "You own this group" : "Private squad"}</p>
          <h1>{group.name}</h1>
          <p>{members.length || leaderboard?.memberCount || 0} members</p>
        </div>
        {isOwner ? <button type="button" className="secondary-button" onClick={() => setRenameOpen(true)}><Pencil size={15} />Rename</button> : null}
      </header>

      <section className="journal-section group-invite-section" aria-labelledby="group-invite-title">
        <div className="section-heading">
          <div>
            <p className="section-label">Invite</p>
            <h2 id="group-invite-title">Share this group</h2>
          </div>
          {isOwner ? <button type="button" className="secondary-button" onClick={() => setDirectInviteOpen(true)}><UserPlus size={15} />Direct invite</button> : null}
        </div>
        <p>Anyone with this link can request to join. You can share it with people you trust.</p>
        <div className="group-invite-link">
          <code>/join/{group.invite_code}</code>
          <button type="button" className="secondary-button" onClick={() => void copyInvite()}><Copy size={15} />Copy link</button>
        </div>
      </section>

      {error ? (
        <div className="leaderboard-empty" role="alert">
          <RefreshCw size={21} /><strong>Group unavailable</strong><p>{error}</p>
          <button type="button" className="secondary-button" onClick={() => void load()}>Try again</button>
        </div>
      ) : null}

      <div className="leaderboard-tabs" role="tablist" aria-label="Group leaderboard metric">
        <button type="button" role="tab" aria-selected={metric === "volume"} className={metric === "volume" ? "active" : ""} onClick={() => setMetric("volume")}>Volume</button>
        <button type="button" role="tab" aria-selected={metric === "consistency"} className={metric === "consistency" ? "active" : ""} onClick={() => setMetric("consistency")}>Days</button>
      </div>

      <section className="journal-section leaderboard-page" aria-labelledby="group-leaderboard-title">
        <div className="leaderboard-page-heading">
          <span className="leaderboard-page-icon">{metric === "volume" ? <Dumbbell size={19} /> : <BarChart3 size={19} />}</span>
          <div>
            <h2 id="group-leaderboard-title">{metric === "volume" ? "Weekly training volume" : "Training consistency"}</h2>
            <p>{metric === "volume" ? "One recorded load per exercise per day, Monday through Sunday." : "Distinct calendar days with at least one logged workout."}</p>
          </div>
        </div>
        {metric === "consistency" ? (
          <div className="consistency-range-toggle" role="group" aria-label="Consistency period">
            {(["week", "month"] as ConsistencyRange[]).map((item) => (
              <button type="button" key={item} className={range === item ? "active" : ""} aria-pressed={range === item} onClick={() => setRange(item)}>
                {item === "week" ? "This week" : "This month"}
              </button>
            ))}
          </div>
        ) : null}
        {loading ? <div className="leaderboard-skeleton"><span /><span /><span /></div> : null}
        {!loading && !error ? <LeaderboardRows rows={rankedRows} view={metric} consistencyRange={range} peerLabel="Group member" /> : null}
      </section>

      {isOwner ? (
        <div className="groups-manage-grid">
          <section className="journal-section requests-section" aria-labelledby="group-direct-invites-title">
            <div className="section-heading"><div><p className="section-label">Owner tools</p><h2 id="group-direct-invites-title">Direct invites</h2></div></div>
            {sentDirectInvites.length === 0 ? <p className="friend-empty">No direct invites are waiting.</p> : sentDirectInvites.map((invite) => (
              <div className="request-row" key={invite.id}>
                <MemberIdentity profile={invite.profile} />
                <span className="relationship-label">Sent</span>
              </div>
            ))}
          </section>

          <section className="journal-section requests-section" aria-labelledby="group-requests-title">
            <div className="section-heading"><div><p className="section-label">Owner tools</p><h2 id="group-requests-title">Join requests</h2></div></div>
            {requests.length === 0 ? <p className="friend-empty">No pending requests.</p> : requests.map((request) => (
              <div className="request-row" key={request.user_id}>
                <MemberIdentity profile={request.profile} />
                <div className="row-actions">
                  <button type="button" className="icon-text-button accept" disabled={busyId === request.user_id} onClick={() => void respond(request, "approved")}><Check size={15} />Approve</button>
                  <button type="button" className="icon-text-button" disabled={busyId === request.user_id} onClick={() => void respond(request, "declined")}><X size={15} />Decline</button>
                </div>
              </div>
            ))}
          </section>

          <section className="journal-section friends-list-section" aria-labelledby="group-members-title">
            <div className="section-heading"><div><p className="section-label">Roster</p><h2 id="group-members-title">Members</h2></div></div>
            {members.map((member) => (
              <div className="friend-list-row" key={member.user_id}>
                <MemberIdentity profile={member.profile} label={member.user_id === userId ? "Owner" : "Member"} />
                {member.user_id !== userId ? (
                  <button type="button" className="icon-text-button danger" disabled={busyId === member.user_id} onClick={() => void remove(member)}><UserMinus size={15} />Remove</button>
                ) : null}
              </div>
            ))}
          </section>
        </div>
      ) : null}

      {isOwner ? (
        <section className="group-danger-zone">
          <div><strong>Delete group</strong><p>Permanently remove the squad, memberships, and pending requests.</p></div>
          <button type="button" className="danger-button" disabled={busyId === "delete-group"} onClick={() => void removeGroup()}><Trash2 size={15} />Delete group</button>
        </section>
      ) : null}

      {renameOpen ? <RenameGroupModal group={group} onClose={() => setRenameOpen(false)} onRename={rename} /> : null}
      {directInviteOpen ? (
        <DirectInviteModal
          userId={userId}
          members={members}
          pendingInvites={sentDirectInvites}
          onClose={() => setDirectInviteOpen(false)}
          onInvite={sendDirectInvite}
        />
      ) : null}
    </>
  );
}

function MemberIdentity({
  profile,
  label,
}: {
  profile: { username: string; display_name: string | null };
  label?: string;
}) {
  const name = profile.display_name?.trim() || profile.username;
  return (
    <div className="friend-identity">
      <span className="friend-avatar">{initials(name)}</span>
      <span><strong>{name}</strong><small>{label ?? `@${profile.username}`}</small></span>
    </div>
  );
}

function RenameGroupModal({
  group,
  onClose,
  onRename,
}: {
  group: Group;
  onClose: () => void;
  onRename: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(group.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onRename(name);
    } catch (caught) {
      setError(messageFrom(caught, "Could not rename the group."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalFrame title="Rename group" subtitle="Choose a clear name for your squad." onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <label>
          Group name
          <input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={80} autoFocus required />
        </label>
        {error ? <div className="form-error" role="alert">{error}</div> : null}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button className="primary-button" disabled={busy}>{busy ? "Saving..." : "Save name"}</button>
        </div>
      </form>
    </ModalFrame>
  );
}

function DirectInviteModal({
  userId,
  members,
  pendingInvites,
  onClose,
  onInvite,
}: {
  userId: string;
  members: GroupMember[];
  pendingInvites: GroupDirectInvite[];
  onClose: () => void;
  onInvite: (friendId: string) => Promise<void>;
}) {
  const [friends, setFriends] = useState<GroupProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    fetchAcceptedFriends(userId)
      .then((nextFriends) => {
        if (!ignore) setFriends(nextFriends);
      })
      .catch((caught) => {
        if (!ignore) setError(messageFrom(caught, "Could not load your friends."));
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [userId]);

  const memberIds = new Set(members.map((member) => member.user_id));
  const pendingInviteIds = new Set(pendingInvites.map((invite) => invite.invited_user_id));
  const availableFriends = friends.filter((friend) => (
    !memberIds.has(friend.id) && !pendingInviteIds.has(friend.id)
  ));

  async function invite(friend: GroupProfile) {
    setBusyId(friend.id);
    setError("");
    try {
      await onInvite(friend.id);
    } catch (caught) {
      setError(messageFrom(caught, "Could not send the direct invite."));
      setBusyId("");
    }
  }

  return (
    <ModalFrame title="Direct invite" subtitle="Invite an accepted friend. They can join without waiting for approval." onClose={onClose}>
      <div className="direct-invite-picker">
        {loading ? <p className="friend-empty">Loading your friends...</p> : null}
        {!loading && error ? <div className="form-error" role="alert">{error}</div> : null}
        {!loading && !error && availableFriends.length === 0 ? (
          <p className="friend-empty">All of your accepted friends are already members or have an invite waiting.</p>
        ) : null}
        {!loading && availableFriends.map((friend) => (
          <div className="request-row" key={friend.id}>
            <MemberIdentity profile={friend} />
            <button type="button" className="icon-text-button accept" disabled={Boolean(busyId)} onClick={() => void invite(friend)}>
              <UserPlus size={15} />{busyId === friend.id ? "Sending..." : "Invite"}
            </button>
          </div>
        ))}
      </div>
    </ModalFrame>
  );
}

function CreateGroupModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onCreate(name);
      onClose();
    } catch (caught) {
      setError(messageFrom(caught, "Could not create the group."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalFrame title="Create group" subtitle="Start a private squad and share its invite link." onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <label>
          Group name
          <input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={80} placeholder="e.g. Morning crew" autoFocus required />
        </label>
        {error ? <div className="form-error" role="alert">{error}</div> : null}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button className="primary-button" disabled={busy}>{busy ? "Creating..." : "Create group"}</button>
        </div>
      </form>
    </ModalFrame>
  );
}

function ModalFrame({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    const rootStyle = document.documentElement.style;
    const previousKeyboardInset = rootStyle.getPropertyValue("--keyboard-inset");

    function updateKeyboardInset() {
      const viewport = window.visualViewport;
      const keyboardInset = viewport
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        : 0;
      rootStyle.setProperty("--keyboard-inset", `${keyboardInset}px`);
    }

    updateKeyboardInset();
    window.visualViewport?.addEventListener("resize", updateKeyboardInset);
    window.visualViewport?.addEventListener("scroll", updateKeyboardInset);

    return () => {
      if (previousKeyboardInset) {
        rootStyle.setProperty("--keyboard-inset", previousKeyboardInset);
      } else {
        rootStyle.removeProperty("--keyboard-inset");
      }
      window.visualViewport?.removeEventListener("resize", updateKeyboardInset);
      window.visualViewport?.removeEventListener("scroll", updateKeyboardInset);
    };
  }, []);

  return (
    <div
      className="modal-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-modal-title"
        aria-describedby="group-modal-description"
        onFocusCapture={scrollFocusedFieldIntoView}
      >
        <div className="modal-head">
          <div>
            <h2 id="group-modal-title">{title}</h2>
            <p id="group-modal-description">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog">
            <X size={19} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function messageFrom(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback;
}
