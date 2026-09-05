import type { ReactNode } from "react";
import { CalendarDays, Crown, Dumbbell, Scale, Trophy } from "lucide-react";
import type {
  CompetitionTieBreaker,
  CompetitionWeekHistory,
  GroupWeeklyCompetition as GroupWeeklyCompetitionData,
} from "@/lib/groupWeeklyCompetition";

export function GroupWeeklyCompetition({
  competition,
}: {
  competition: GroupWeeklyCompetitionData;
}) {
  const leader = competition.frontrunner;

  return (
    <div className="grid gap-4" aria-label="Four-week group competition">
      <section className="overflow-hidden border border-[var(--border)] bg-[var(--surface)]">
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(260px,.7fr)] lg:items-end">
          <div>
            <div className="mb-5 flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">
                <Crown size={15} aria-hidden="true" />
                Week {competition.currentWeek.number} frontrunner
              </span>
              <span className="text-right text-[10px] text-[var(--muted)]">
                {formatDateRange(competition.currentWeek.start, competition.currentWeek.end)}
              </span>
            </div>

            {leader ? (
              <>
                <div className="flex items-center gap-4">
                  <span className="grid size-12 shrink-0 place-items-center border border-[var(--border)] bg-[var(--accent-soft)] text-sm font-bold text-[var(--accent)]" aria-hidden="true">
                    {initials(leader.displayName)}
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-2xl font-bold tracking-[-0.035em] text-[var(--ink)] sm:text-3xl">
                      {leader.displayName}
                    </h2>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {leader.isCurrentUser ? "You are leading this week" : "Currently leading the group"}
                    </p>
                  </div>
                </div>
                <TieBreakStatus
                  decidedBy={competition.tieBreak.decidedBy}
                  isActive={competition.tieBreak.isActive}
                  tiedCount={competition.tieBreak.tiedCount}
                />
              </>
            ) : (
              <div className="py-3">
                <h2 className="text-xl font-bold tracking-[-0.025em] text-[var(--ink)]">The week is open</h2>
                <p className="mt-2 max-w-lg text-xs leading-5 text-[var(--muted)]">
                  The first member to log a workout becomes the Week {competition.currentWeek.number} frontrunner.
                </p>
              </div>
            )}
          </div>

          <dl className="grid grid-cols-3 border border-[var(--border)] bg-[var(--surface-muted)]">
            <ScoreStat label="Active days" value={leader ? `${leader.activeDays}/7` : "0/7"} icon={<CalendarDays size={14} />} />
            <ScoreStat label="Volume" value={leader ? formatVolume(leader.totalVolume) : "0 kg"} icon={<Scale size={14} />} />
            <ScoreStat label="Workouts" value={String(leader?.totalWorkouts ?? 0)} icon={<Dumbbell size={14} />} />
          </dl>
        </div>

        <div className="border-t border-[var(--border)] px-5 py-4 sm:px-6">
          <div className="mb-3 flex items-center justify-between gap-4">
            <h3 className="text-xs font-bold text-[var(--ink)]">This week</h3>
            <span className="text-[10px] text-[var(--muted)]">Active days · volume · workouts</span>
          </div>
          <ol className="divide-y divide-[var(--border)]">
            {competition.leaderboard.map((member) => (
              <li
                key={member.userId}
                className={`grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 py-3 ${member.isCurrentUser ? "text-[var(--accent)]" : "text-[var(--ink)]"}`}
              >
                <span className="text-[11px] font-bold text-[var(--muted)]" aria-label={`Rank ${member.rank}`}>{member.rank}</span>
                <span className="min-w-0">
                  <strong className="block truncate text-xs">{member.displayName}</strong>
                  <small className="mt-0.5 block text-[10px] text-[var(--muted)]">
                    {member.activeDays} {member.activeDays === 1 ? "day" : "days"} · {member.totalWorkouts} {member.totalWorkouts === 1 ? "workout" : "workouts"}
                  </small>
                </span>
                <strong className="text-right text-[11px]">{formatVolume(member.totalVolume)}</strong>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6" aria-labelledby="competition-history-title">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--accent)]">Four-week podium</p>
            <h2 id="competition-history-title" className="mt-1 text-lg font-bold tracking-[-0.025em] text-[var(--ink)]">
              Cycle {competition.cycle.number} winners
            </h2>
          </div>
          <span className="text-right text-[10px] leading-4 text-[var(--muted)]">
            {formatDateRange(competition.cycle.start, competition.cycle.end)}
          </span>
        </div>

        <div className="grid gap-px border border-[var(--border)] bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-4">
          {competition.history.map((week) => <HistoryWeek key={week.weekNumber} week={week} />)}
        </div>
      </section>
    </div>
  );
}

function ScoreStat({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="min-w-0 border-l border-[var(--border)] p-3 first:border-l-0">
      <dt className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.08em] text-[var(--muted)]">{icon}{label}</dt>
      <dd className="mt-2 truncate text-sm font-bold text-[var(--ink)]">{value}</dd>
    </div>
  );
}

function TieBreakStatus({
  decidedBy,
  isActive,
  tiedCount,
}: {
  decidedBy: CompetitionTieBreaker;
  isActive: boolean;
  tiedCount: number;
}) {
  const copy = tieBreakCopy(decidedBy, isActive, tiedCount);
  return (
    <p className="mt-5 inline-flex items-center gap-2 border-l-2 border-[var(--accent)] pl-3 text-[11px] leading-5 text-[var(--muted)]">
      <Trophy size={14} className="shrink-0 text-[var(--accent)]" aria-hidden="true" />
      {copy}
    </p>
  );
}

function HistoryWeek({ week }: { week: CompetitionWeekHistory }) {
  const finalized = week.status === "finalized";
  const title = finalized
    ? week.winnerDisplayName ?? "No activity"
    : week.status === "in_progress"
      ? "In progress"
      : week.status === "upcoming"
        ? "Upcoming"
        : "Finalizing";

  return (
    <article className={`min-h-36 bg-[var(--surface)] p-4 ${week.status === "in_progress" ? "outline outline-1 -outline-offset-1 outline-[var(--accent)]" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--accent)]">Week {week.weekNumber}</span>
        {finalized && week.winnerId ? <Trophy size={14} className="text-[var(--accent)]" aria-label="Winner" /> : null}
      </div>
      <strong className="mt-5 block truncate text-sm text-[var(--ink)]">{title}</strong>
      <span className="mt-1 block text-[10px] text-[var(--muted)]">{formatDateRange(week.weekStart, week.weekEnd)}</span>
      {finalized ? (
        <p className="mt-4 text-[10px] leading-4 text-[var(--muted)]">
          {week.winnerId
            ? `${week.activeDays ?? 0} active days · ${tieBreakerLabel(week.tieBreaker)}`
            : "No qualifying workouts"}
        </p>
      ) : null}
    </article>
  );
}

function tieBreakCopy(decidedBy: CompetitionTieBreaker, isActive: boolean, tiedCount: number) {
  if (!isActive) return "Active workout days currently decide first place.";
  if (decidedBy === "volume") return `${tiedCount} members share the day count; total lifted volume breaks the tie.`;
  if (decidedBy === "workouts") return `${tiedCount} members share the day count with zero volume; workout count breaks the tie.`;
  return `${tiedCount} members are level on days and tie-break metrics; membership order is the final fallback.`;
}

function tieBreakerLabel(value: CompetitionTieBreaker | null) {
  if (value === "volume") return "won on volume";
  if (value === "workouts") return "won on workout count";
  if (value === "member_since") return "exact-tie fallback";
  return "won on active days";
}

function formatVolume(value: number) {
  return `${new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(value)} kg`;
}

function formatDateRange(start: string, end: string) {
  const formatter = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${formatter.format(new Date(`${start}T00:00:00Z`))} – ${formatter.format(new Date(`${end}T00:00:00Z`))}`;
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

