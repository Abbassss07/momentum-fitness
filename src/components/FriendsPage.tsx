"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ArrowLeft, CalendarDays, Check, ChevronRight, Dumbbell, Scale, Search, UserMinus, UserPlus, Users, X } from "lucide-react";
import { ProgressChart, RangeSelect } from "@/components/ProgressChart";
import {
  fetchFriendProgress,
  fetchFriendshipLists,
  findProfileByUsername,
  removeFriendship,
  respondToRequest,
  sendFriendRequest,
} from "@/lib/friends";
import type { FriendProfile, FriendProgress, FriendshipLists } from "@/lib/friends";
import { filterPoints, formatDate, formatVolume, getCalendarWeekBounds, initials, totalTrainingVolume } from "@/lib/fitness";
import type { Exercise, RangeKey } from "@/lib/fitness";

const EMPTY_LISTS: FriendshipLists = { friends: [], incoming: [], outgoing: [], declined: [] };
type FriendSelection = { friendshipId: string; profile: FriendProfile };

export function FriendsPage({ user, exercises, onNotice }: { user: User; exercises: Exercise[]; onNotice: (message: string) => void }) {
  const [lists, setLists] = useState(EMPTY_LISTS);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [username, setUsername] = useState("");
  const [result, setResult] = useState<FriendProfile | null>(null);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<FriendSelection | null>(null);
  const [progress, setProgress] = useState<FriendProgress | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState("");

  const load = useCallback(async () => {
    try {
      setLists(await fetchFriendshipLists(user.id));
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not load friends");
    }
  }, [onNotice, user.id]);

  useEffect(() => {
    let active = true;
    void fetchFriendshipLists(user.id)
      .then((data) => { if (active) setLists(data); })
      .catch((error: unknown) => {
        if (active) onNotice(error instanceof Error ? error.message : "Could not load friends");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [onNotice, user.id]);

  useEffect(() => {
    if (!selected) return;
    let active = true;
    void fetchFriendProgress(selected.profile.id)
      .then((data) => { if (active) setProgress(data); })
      .catch((error: unknown) => {
        if (active) setProgressError(error instanceof Error ? error.message : "Could not load friend progress");
      })
      .finally(() => { if (active) setProgressLoading(false); });
    return () => { active = false; };
  }, [selected]);

  async function act(id: string, action: () => Promise<void>, message: string) {
    setBusyId(id);
    try {
      await action();
      onNotice(message);
      await load();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "That action did not complete");
    } finally {
      setBusyId("");
    }
  }

  async function search(event: FormEvent) {
    event.preventDefault();
    setBusyId("search");
    setSearched(false);
    try {
      setResult(await findProfileByUsername(username));
      setSearched(true);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Search failed");
    } finally {
      setBusyId("");
    }
  }

  function unfriend(friendshipId: string, profile: FriendProfile) {
    if (!window.confirm(`Remove @${profile.username} from your friends?`)) return;
    void act(friendshipId, async () => {
      await removeFriendship(friendshipId);
      setSelected(null);
    }, "Friend removed");
  }

  function openFriend(friendshipId: string, profile: FriendProfile) {
    setProgressLoading(true);
    setProgressError("");
    setProgress(null);
    setSelected({ friendshipId, profile });
  }

  const relationship = result
    ? [...lists.friends, ...lists.incoming, ...lists.outgoing].find((item) => item.profile.id === result.id)
    : undefined;

  if (selected) {
    return <FriendProgressView selection={selected} progress={progress} loading={progressLoading} error={progressError} exercises={exercises} busy={busyId === selected.friendshipId} onBack={() => setSelected(null)} onUnfriend={() => unfriend(selected.friendshipId, selected.profile)} />;
  }

  return (
    <>
      <header className="page-header">
        <div><p className="section-label">Your training circle</p><h1>Friends</h1><p>Connect privately and keep up with each other&apos;s progress.</p></div>
      </header>

      <div className="friends-manage-grid">
        <section className="journal-section friend-search" aria-labelledby="find-friends-title">
          <div className="section-heading"><div><p className="section-label">Add a friend</p><h2 id="find-friends-title">Find by username</h2></div><UserPlus size={19} /></div>
          <form onSubmit={search} className="friend-search-form">
            <label>
              <span className="sr-only">Friend&apos;s username</span><Search size={16} aria-hidden="true" />
              <input type="text" value={username} onChange={(event) => setUsername(event.target.value.toLowerCase())} placeholder="friend_username" minLength={3} maxLength={24} pattern="[a-z][a-z0-9_]{2,23}" autoCapitalize="none" spellCheck={false} required autoComplete="off" />
            </label>
            <button className="primary-button" disabled={busyId === "search"}>{busyId === "search" ? "Searching..." : "Search"}</button>
          </form>
          {result ? (
            <div className="friend-result">
              <FriendIdentity profile={result} />
              {relationship ? <span className="relationship-label">{relationship.friendship.status === "accepted" ? "Friends" : "Request pending"}</span> : <button className="secondary-button" disabled={Boolean(busyId)} onClick={() => act(result.id, () => sendFriendRequest(user.id, result.id, lists.declined), "Friend request sent")}>Send request</button>}
            </div>
          ) : searched ? <p className="friend-empty">No Momentum account matches that username.</p> : <p className="friend-hint">Enter their exact Momentum username.</p>}
        </section>

        <section className="journal-section requests-section" aria-labelledby="requests-title">
          <div className="section-heading"><div><p className="section-label">Pending</p><h2 id="requests-title">Friend requests</h2></div>{lists.incoming.length ? <span className="request-count">{lists.incoming.length}</span> : null}</div>
          {loading ? <p className="friend-empty">Checking for requests...</p> : null}
          {!loading && !lists.incoming.length && !lists.outgoing.length ? <p className="friend-empty">No pending requests.</p> : null}
          <div className="request-groups">
            {lists.incoming.length ? <div><h3>Incoming</h3>{lists.incoming.map(({ friendship, profile }) => (
              <div className="request-row" key={friendship.id}><FriendIdentity profile={profile} /><div className="row-actions"><button className="icon-text-button positive-action" disabled={busyId === friendship.id} onClick={() => act(friendship.id, () => respondToRequest(friendship.id, "accepted"), "Friend request accepted")}><Check size={15} /> Accept</button><button className="icon-text-button" disabled={busyId === friendship.id} onClick={() => act(friendship.id, () => respondToRequest(friendship.id, "declined"), "Friend request declined")}><X size={15} /> Decline</button></div></div>
            ))}</div> : null}
            {lists.outgoing.length ? <div><h3>Sent</h3>{lists.outgoing.map(({ friendship, profile }) => (
              <div className="request-row" key={friendship.id}><FriendIdentity profile={profile} /><button className="icon-text-button" disabled={busyId === friendship.id} onClick={() => act(friendship.id, () => removeFriendship(friendship.id), "Friend request cancelled")}><X size={15} /> Cancel</button></div>
            ))}</div> : null}
          </div>
        </section>
      </div>

      <section className="journal-section friends-list-section" aria-labelledby="friends-list-title">
        <div className="section-heading"><div><p className="section-label">Connected</p><h2 id="friends-list-title">Your friends</h2></div><span className="friends-total">{lists.friends.length} {lists.friends.length === 1 ? "friend" : "friends"}</span></div>
        {!loading && !lists.friends.length ? <div className="friends-zero"><Users size={20} /><strong>Your circle is quiet for now.</strong><p>Search by username above to add your first friend.</p></div> : null}
        <div className="friends-list">
          {lists.friends.map(({ friendship, profile }) => (
            <div className="friend-list-row" key={friendship.id}>
              <a href={`#friend-${profile.id}`} onClick={(event) => { event.preventDefault(); openFriend(friendship.id, profile); }}><FriendIdentity profile={profile} /><ChevronRight size={17} /></a>
              <button className="icon-text-button" disabled={busyId === friendship.id} onClick={() => unfriend(friendship.id, profile)}><UserMinus size={15} /> Unfriend</button>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function FriendIdentity({ profile }: { profile: FriendProfile }) {
  const name = profile.display_name || `@${profile.username}`;
  return <span className="friend-identity"><span className="friend-avatar">{initials(name)}</span><span><strong>{name}</strong><small>@{profile.username}</small></span></span>;
}

function FriendProgressView({ selection, progress, loading, error, exercises, busy, onBack, onUnfriend }: { selection: FriendSelection; progress: FriendProgress | null; loading: boolean; error: string; exercises: Exercise[]; busy: boolean; onBack: () => void; onUnfriend: () => void }) {
  const [range, setRange] = useState<RangeKey>("3M");
  const { profile } = selection;
  const workouts = useMemo(() => progress?.workouts ?? [], [progress?.workouts]);
  const weights = useMemo(() => progress?.weights ?? [], [progress?.weights]);
  const exerciseById = useMemo(() => new Map(exercises.map((exercise) => [exercise.id, exercise.name])), [exercises]);
  const weightPoints = useMemo(() => weights.map((entry) => ({ date: entry.logged_at, value: entry.weight_kg })), [weights]);
  const visibleWeights = filterPoints(weightPoints, range);
  const latestWeight = weights.at(-1)?.weight_kg;
  const firstVisibleWeight = visibleWeights[0]?.value;
  const weightChange = latestWeight !== undefined && firstVisibleWeight !== undefined ? latestWeight - firstVisibleWeight : null;
  const { start: weekStart, end: weekEnd } = getCalendarWeekBounds();
  const weeklyVolume = totalTrainingVolume(workouts.filter((workout) => workout.logged_at >= weekStart && workout.logged_at <= weekEnd));
  const displayName = profile.display_name || `@${profile.username}`;

  return (
    <div className="friend-progress-page">
      <button type="button" className="text-button friend-back-button" onClick={onBack}><ArrowLeft size={15} /> Back to friends</button>
      <header className="page-header friend-progress-header">
        <div><p className="section-label">Friend progress - Read-only</p><h1>{displayName}</h1><p>@{profile.username}</p></div>
        <button type="button" className="secondary-button danger-action" disabled={busy} onClick={onUnfriend}><UserMinus size={16} /> {busy ? "Removing..." : "Unfriend"}</button>
      </header>

      {loading ? <div className="friend-progress-loading" aria-live="polite"><div className="skeleton skeleton-line" /><div className="skeleton skeleton-chart" /></div> : error ? (
        <section className="journal-section friend-progress-error" role="alert"><strong>Could not load this progress.</strong><p>{error}</p></section>
      ) : progress ? (
        <>
          <section className="weekly-snapshot friend-progress-stats" aria-labelledby="friend-stats-title">
            <div className="snapshot-heading"><CalendarDays size={18} aria-hidden="true" /><div><h2 id="friend-stats-title">Progress summary</h2><p>Shared with friends</p></div></div>
            <dl><div><dt>Total workouts</dt><dd>{workouts.length}</dd></div><div><dt>Current weight</dt><dd>{latestWeight === undefined ? "-" : `${latestWeight.toFixed(1)} kg`}</dd></div><div><dt>This week&apos;s volume</dt><dd>{formatVolume(weeklyVolume)}</dd></div></dl>
          </section>

          <section className="journal-section weight-section friend-weight-section" aria-labelledby="friend-weight-title">
            <div className="section-heading"><div><p className="section-label">Body weight</p><h2 id="friend-weight-title">Progress over time</h2></div><RangeSelect value={range} onChange={setRange} /></div>
            <div className="chart-summary"><strong>{latestWeight === undefined ? "-" : latestWeight.toFixed(1)}{latestWeight !== undefined ? <small> kg</small> : null}</strong>{weightChange !== null ? <span>{weightChange > 0 ? "+" : ""}{weightChange.toFixed(1)} kg over {range.toLowerCase()}</span> : <span>No change available for this range.</span>}</div>
            <ProgressChart points={visibleWeights} emptyLabel={`${displayName} has no body-weight entries in this range yet.`} />
          </section>

          <section className="journal-section history-card friend-workout-history" aria-labelledby="friend-history-title">
            <div className="section-heading"><div><p className="section-label">Workout history</p><h2 id="friend-history-title">Recent workouts</h2></div><Dumbbell size={18} aria-hidden="true" /></div>
            <div className="history-table friend-history-table">
              <div className="history-head" aria-hidden="true"><span>Date</span><span>Exercise</span><span>Weight</span><span>Sets x reps</span><span>Notes</span></div>
              {workouts.slice(0, 12).map((workout) => <div className="history-row" key={workout.id}><span>{formatDate(workout.logged_at)}</span><strong>{exerciseById.get(workout.exercise_id) ?? "Custom exercise"}</strong><span>{workout.weight_kg === null ? "Bodyweight" : `${workout.weight_kg} kg`}</span><span>{workout.sets} x {workout.reps}</span><span className="friend-workout-notes">{workout.notes || "-"}</span></div>)}
              {!workouts.length ? <p className="history-empty">No workouts have been logged yet.</p> : null}
            </div>
          </section>

          {!weights.length && !workouts.length ? <div className="friends-zero friend-progress-zero"><Scale size={20} /><strong>No progress entries yet.</strong><p>Workouts and body-weight trends will appear here when they start logging.</p></div> : null}
        </>
      ) : null}
    </div>
  );
}
