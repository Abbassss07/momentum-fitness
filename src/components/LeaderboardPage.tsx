import { useEffect, useMemo, useState } from "react";
import { BarChart3, Dumbbell, RefreshCw, Scale, Trophy, Users } from "lucide-react";
import { formatVolume, initials } from "@/lib/fitness";
import {
  fetchLeaderboardData,
  LeaderboardData,
  LeaderboardEntry,
} from "@/lib/leaderboard";

type LeaderboardView = "volume" | "consistency" | "weight";

const VIEW_DETAILS: Record<
  LeaderboardView,
  { label: string; title: string; description: string; icon: typeof Dumbbell }
> = {
  volume: {
    label: "Weekly volume",
    title: "Weekly training volume",
    description: "Total kilograms lifted from Monday through Sunday.",
    icon: Dumbbell,
  },
  consistency: {
    label: "Consistency",
    title: "Weekly consistency",
    description: "Workout entries logged from Monday through Sunday.",
    icon: BarChart3,
  },
  weight: {
    label: "Weight change",
    title: "Monthly weight change",
    description: "Absolute change between the first and latest logs this month.",
    icon: Scale,
  },
};

export function LeaderboardPage({ userId }: { userId: string }) {
  const [view, setView] = useState<LeaderboardView>("volume");
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const nextData = await fetchLeaderboardData(userId);
        if (!ignore) {
          setData(nextData);
          setError("");
        }
      } catch (caught) {
        if (!ignore) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Could not load the leaderboard.",
          );
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    void load();
    return () => {
      ignore = true;
    };
  }, [reloadKey, userId]);

  const rows = useMemo(() => rankEntries(data?.entries ?? [], view), [data, view]);
  const hasData = rows.some((row) => hasScore(row, view));
  const details = VIEW_DETAILS[view];
  const ViewIcon = details.icon;

  function retry() {
    setLoading(true);
    setError("");
    setReloadKey((key) => key + 1);
  }

  return (
    <>
      <header className="page-header compact">
        <div>
          <p className="section-label">Your circle</p>
          <h1>Leaderboard</h1>
          <p>Compare this week and month with the friends you train alongside.</p>
        </div>
      </header>

      <div className="leaderboard-tabs" role="tablist" aria-label="Leaderboard metric">
        {(Object.keys(VIEW_DETAILS) as LeaderboardView[]).map((key) => (
          <button
            type="button"
            key={key}
            role="tab"
            aria-selected={view === key}
            className={view === key ? "active" : ""}
            onClick={() => setView(key)}
          >
            {VIEW_DETAILS[key].label}
          </button>
        ))}
      </div>

      <section className="journal-section leaderboard-page" aria-labelledby="leaderboard-view-title">
        <div className="leaderboard-page-heading">
          <span className="leaderboard-page-icon" aria-hidden="true">
            <ViewIcon size={19} />
          </span>
          <div>
            <h2 id="leaderboard-view-title">{details.title}</h2>
            <p>{details.description}</p>
          </div>
        </div>

        {loading ? <LeaderboardSkeleton /> : null}

        {!loading && error ? (
          <div className="leaderboard-empty" role="alert">
            <RefreshCw size={21} aria-hidden="true" />
            <strong>Leaderboard unavailable</strong>
            <p>{error}</p>
            <button type="button" className="secondary-button" onClick={retry}>
              Try again
            </button>
          </div>
        ) : null}

        {!loading && !error && data?.friendCount === 0 ? (
          <div className="leaderboard-solo-note">
            <Users size={16} aria-hidden="true" />
            No accepted friends yet. Your results are shown solo.
          </div>
        ) : null}

        {!loading && !error && !hasData ? (
          <div className="leaderboard-empty">
            <Trophy size={22} aria-hidden="true" />
            <strong>{emptyTitle(view)}</strong>
            <p>{emptyDescription(view)}</p>
          </div>
        ) : null}

        {!loading && !error && hasData ? (
          <ol className="leaderboard-table">
            {rows.map((row, index) => (
              <li
                key={row.userId}
                className={row.isCurrentUser ? "current" : ""}
              >
                <span className="leaderboard-rank" aria-label={`Rank ${index + 1}`}>
                  {index + 1}
                </span>
                <span className="friend-avatar" aria-hidden="true">
                  {initials(row.displayName)}
                </span>
                <span className="leaderboard-person">
                  <strong>{row.displayName}</strong>
                  <small>{row.isCurrentUser ? "You" : "Friend"}</small>
                </span>
                <span className="leaderboard-score">{formatScore(row, view)}</span>
              </li>
            ))}
          </ol>
        ) : null}
      </section>
    </>
  );
}

function rankEntries(entries: LeaderboardEntry[], view: LeaderboardView) {
  return entries.toSorted((a, b) => scoreFor(b, view) - scoreFor(a, view));
}

function scoreFor(entry: LeaderboardEntry, view: LeaderboardView) {
  if (view === "volume") return entry.weeklyVolume;
  if (view === "consistency") return entry.weeklyWorkoutCount;
  return entry.monthlyWeightChange === null
    ? Number.NEGATIVE_INFINITY
    : Math.abs(entry.monthlyWeightChange);
}

function hasScore(entry: LeaderboardEntry, view: LeaderboardView) {
  if (view === "volume") return entry.weeklyVolume > 0;
  if (view === "consistency") return entry.weeklyWorkoutCount > 0;
  return entry.monthlyWeightChange !== null;
}

function formatScore(entry: LeaderboardEntry, view: LeaderboardView) {
  if (view === "volume") {
    return entry.weeklyVolume > 0 ? formatVolume(entry.weeklyVolume) : "0 kg";
  }
  if (view === "consistency") {
    const count = entry.weeklyWorkoutCount;
    return `${count} ${count === 1 ? "entry" : "entries"}`;
  }
  if (entry.monthlyWeightChange === null) return "—";
  const change = Math.abs(entry.monthlyWeightChange) < 0.05 ? 0 : entry.monthlyWeightChange;
  return `${change > 0 ? "+" : ""}${change.toFixed(1)} kg`;
}

function emptyTitle(view: LeaderboardView) {
  return view === "weight" ? "No monthly comparison yet" : "No workouts this week";
}

function emptyDescription(view: LeaderboardView) {
  return view === "weight"
    ? "Two body-weight logs in the current month are needed to calculate a change."
    : "The leaderboard will fill in when someone logs a workout this week.";
}

function LeaderboardSkeleton() {
  return (
    <div className="leaderboard-skeleton" aria-busy="true" aria-label="Loading leaderboard">
      {[0, 1, 2].map((item) => <span key={item} />)}
    </div>
  );
}
