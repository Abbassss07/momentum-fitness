import { useEffect, useMemo, useState } from "react";
import { BarChart3, Dumbbell, Flame, RefreshCw, TrendingUp, Trophy, Users } from "lucide-react";
import { formatVolume, initials } from "@/lib/fitness";
import {
  fetchLeaderboardData,
  LeaderboardData,
  LeaderboardEntry,
} from "@/lib/leaderboard";

type LeaderboardView = "volume" | "consistency" | "streak" | "improvement";
type ConsistencyRange = "week" | "month";

const VIEW_DETAILS: Record<
  LeaderboardView,
  { label: string; title: string; description: string; icon: typeof Dumbbell }
> = {
  volume: {
    label: "Volume",
    title: "Weekly training volume",
    description: "One recorded load per exercise per day, Monday through Sunday.",
    icon: Dumbbell,
  },
  consistency: {
    label: "Days",
    title: "Training consistency",
    description: "Distinct calendar days with at least one logged workout.",
    icon: BarChart3,
  },
  streak: {
    label: "Streak",
    title: "Current training streak",
    description: "Two rest days are allowed between logged workout days.",
    icon: Flame,
  },
  improvement: {
    label: "Progress",
    title: "Training improvement",
    description: "This week compared with your own prior four-week average.",
    icon: TrendingUp,
  },
};

export function LeaderboardPage({ userId }: { userId: string }) {
  const [view, setView] = useState<LeaderboardView>("volume");
  const [consistencyRange, setConsistencyRange] =
    useState<ConsistencyRange>("week");
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

  const rows = useMemo(
    () => rankEntries(data?.entries ?? [], view, consistencyRange),
    [consistencyRange, data, view],
  );
  const hasData = rows.some((row) => hasScore(row, view, consistencyRange));
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

        {view === "consistency" ? (
          <div
            className="consistency-range-toggle"
            role="group"
            aria-label="Consistency period"
          >
            {(["week", "month"] as ConsistencyRange[]).map((range) => (
              <button
                type="button"
                key={range}
                className={consistencyRange === range ? "active" : ""}
                aria-pressed={consistencyRange === range}
                onClick={() => setConsistencyRange(range)}
              >
                {range === "week" ? "This week" : "This month"}
              </button>
            ))}
          </div>
        ) : null}

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
            <strong>{emptyTitle(view, consistencyRange)}</strong>
            <p>{emptyDescription(view, consistencyRange)}</p>
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
                <span className="leaderboard-score">
                  {formatScore(row, view, consistencyRange)}
                </span>
              </li>
            ))}
          </ol>
        ) : null}
      </section>
    </>
  );
}

function rankEntries(
  entries: LeaderboardEntry[],
  view: LeaderboardView,
  consistencyRange: ConsistencyRange,
) {
  return entries.toSorted(
    (a, b) =>
      scoreFor(b, view, consistencyRange) -
      scoreFor(a, view, consistencyRange),
  );
}

function scoreFor(
  entry: LeaderboardEntry,
  view: LeaderboardView,
  consistencyRange: ConsistencyRange,
) {
  if (view === "volume") return entry.weeklyVolume;
  if (view === "consistency") {
    return consistencyRange === "week"
      ? entry.weeklyTrainingDays
      : entry.monthlyTrainingDays;
  }
  if (view === "streak") return entry.currentStreak;
  return entry.improvementPercent === null
    ? Number.NEGATIVE_INFINITY
    : entry.improvementPercent;
}

function hasScore(
  entry: LeaderboardEntry,
  view: LeaderboardView,
  consistencyRange: ConsistencyRange,
) {
  if (view === "volume") return entry.weeklyVolume > 0;
  if (view === "consistency") {
    return scoreFor(entry, view, consistencyRange) > 0;
  }
  if (view === "streak") return entry.currentStreak > 0;
  return true;
}

function formatScore(
  entry: LeaderboardEntry,
  view: LeaderboardView,
  consistencyRange: ConsistencyRange,
) {
  if (view === "volume") {
    return entry.weeklyVolume > 0 ? formatVolume(entry.weeklyVolume) : "0 kg";
  }
  if (view === "consistency") {
    const count = scoreFor(entry, view, consistencyRange);
    return `${count} ${count === 1 ? "day" : "days"}`;
  }
  if (view === "streak") {
    const count = entry.currentStreak;
    return `${count} ${count === 1 ? "day" : "days"}`;
  }
  if (entry.improvementPercent === null) return "Not enough data yet";
  const improvement = Math.abs(entry.improvementPercent) < 0.05
    ? 0
    : entry.improvementPercent;
  return `${improvement > 0 ? "+" : ""}${new Intl.NumberFormat("en", {
    maximumFractionDigits: 1,
  }).format(improvement)}%`;
}

function emptyTitle(view: LeaderboardView, consistencyRange: ConsistencyRange) {
  if (view === "streak") return "No active streaks yet";
  if (view === "consistency" && consistencyRange === "month") {
    return "No workouts this month";
  }
  return "No workouts this week";
}

function emptyDescription(
  view: LeaderboardView,
  consistencyRange: ConsistencyRange,
) {
  if (view === "streak") {
    return "Log a workout today to begin a training streak.";
  }
  if (view === "consistency" && consistencyRange === "month") {
    return "The leaderboard will fill in when someone logs a workout this month.";
  }
  return "The leaderboard will fill in when someone logs a workout this week.";
}

function LeaderboardSkeleton() {
  return (
    <div className="leaderboard-skeleton" aria-busy="true" aria-label="Loading leaderboard">
      {[0, 1, 2].map((item) => <span key={item} />)}
    </div>
  );
}

