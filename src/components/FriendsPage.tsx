"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { Check, ChevronRight, Search, UserMinus, UserPlus, Users, X } from "lucide-react";
import {
  fetchFriendshipLists,
  fetchFriendSummary,
  findProfileByUsername,
  FriendProfile,
  FriendshipLists,
  removeFriendship,
  respondToRequest,
  sendFriendRequest,
} from "@/lib/friends";
import { formatDate, initials } from "@/lib/fitness";

const EMPTY_LISTS: FriendshipLists = { friends: [], incoming: [], outgoing: [], declined: [] };

export function FriendsPage({ user, onNotice }: { user: User; onNotice: (message: string) => void }) {
  const [lists, setLists] = useState(EMPTY_LISTS);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [username, setUsername] = useState("");
  const [result, setResult] = useState<FriendProfile | null>(null);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<FriendProfile | null>(null);
  const [summary, setSummary] = useState<{ workoutCount: number; latestWeight: { logged_at: string; weight_kg: number } | null } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLists(await fetchFriendshipLists(user.id));
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not load friends");
    } finally {
      setLoading(false);
    }
  }, [onNotice, user.id]);

  useEffect(() => { void load(); }, [load]);

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

  const relationship = result
    ? [...lists.friends, ...lists.incoming, ...lists.outgoing].find((item) => item.profile.id === result.id)
    : undefined;

  async function openFriend(profile: FriendProfile) {
    setSelected(profile);
    setSummary(null);
    try {
      setSummary(await fetchFriendSummary(profile.id));
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Could not load progress summary");
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="section-label">Your training circle</p>
          <h1>Friends</h1>
          <p>Connect privately and keep up with each other&apos;s progress.</p>
        </div>
      </header>

      <div className="friends-manage-grid">
        <section className="journal-section friend-search" aria-labelledby="find-friends-title">
          <div className="section-heading">
            <div><p className="section-label">Add a friend</p><h2 id="find-friends-title">Find by username</h2></div>
            <UserPlus size={19} />
          </div>
          <form onSubmit={search} className="friend-search-form">
            <label>
              <span className="sr-only">Friend&apos;s username</span>
              <Search size={16} aria-hidden="true" />
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value.toLowerCase())}
                placeholder="friend_username"
                minLength={3}
                maxLength={24}
                pattern="[a-z][a-z0-9_]{2,23}"
                autoCapitalize="none"
                spellCheck={false}
                required
                autoComplete="off"
              />
            </label>
            <button className="primary-button" disabled={busyId === "search"}>{busyId === "search" ? "Searching…" : "Search"}</button>
          </form>
          {result ? (
            <div className="friend-result">
              <FriendIdentity profile={result} />
              {relationship ? <span className="relationship-label">{relationship.friendship.status === "accepted" ? "Friends" : "Request pending"}</span> : (
                <button className="secondary-button" disabled={Boolean(busyId)} onClick={() => act(result.id, () => sendFriendRequest(user.id, result.id, lists.declined), "Friend request sent")}>Send request</button>
              )}
            </div>
          ) : searched ? <p className="friend-empty">No Momentum account matches that username.</p> : <p className="friend-hint">Enter their exact Momentum username.</p>}
        </section>

        <section className="journal-section requests-section" aria-labelledby="requests-title">
          <div className="section-heading">
            <div><p className="section-label">Pending</p><h2 id="requests-title">Friend requests</h2></div>
            {lists.incoming.length ? <span className="request-count">{lists.incoming.length}</span> : null}
          </div>
          {loading ? <p className="friend-empty">Checking for requests…</p> : null}
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
              <a href={`#friend-${profile.id}`} onClick={(event) => { event.preventDefault(); void openFriend(profile); }}><FriendIdentity profile={profile} /><ChevronRight size={17} /></a>
              <button className="icon-text-button" disabled={busyId === friendship.id} onClick={() => { if (window.confirm(`Remove @${profile.username} from your friends?`)) void act(friendship.id, () => removeFriendship(friendship.id), "Friend removed"); }}><UserMinus size={15} /> Unfriend</button>
            </div>
          ))}
        </div>
      </section>

      {selected ? <section id={`friend-${selected.id}`} className="journal-section friend-summary" aria-labelledby="friend-summary-title">
        <div className="section-heading"><div><p className="section-label">Read-only preview</p><h2 id="friend-summary-title">@{selected.username}&apos;s progress</h2></div><button className="icon-button" onClick={() => setSelected(null)} aria-label="Close friend summary"><X size={17} /></button></div>
        {!summary ? <p className="friend-empty">Loading their summary…</p> : <dl><div><dt>Workout entries</dt><dd>{summary.workoutCount}</dd></div><div><dt>Latest body weight</dt><dd>{summary.latestWeight ? `${summary.latestWeight.weight_kg} kg` : "No entries"}</dd>{summary.latestWeight ? <small>{formatDate(summary.latestWeight.logged_at)}</small> : null}</div></dl>}
        <p className="friend-summary-note">Full shared progress is coming in the next phase. Their data is read-only.</p>
      </section> : null}
    </>
  );
}

function FriendIdentity({ profile }: { profile: FriendProfile }) {
  return <span className="friend-identity"><span className="friend-avatar">{initials(profile.username)}</span><span><strong>@{profile.username}</strong><small>Momentum member</small></span></span>;
}
