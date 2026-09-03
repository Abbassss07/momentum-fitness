export type ActivityDay = {
  activity_date: string;
  exercise_count: number;
  activity_level: number;
};

type ActivityGridProps = {
  activity: ActivityDay[];
};

const levelClassNames: Record<number, string> = {
  0: "border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900",
  1: "border-emerald-800 bg-emerald-950/40",
  2: "border-emerald-600 bg-emerald-700/60",
  3: "border-emerald-400 bg-emerald-500",
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

/**
 * A serializable, server-compatible display component. It can be rendered in
 * a Server Component with RPC data or directly within Momentum's client dashboard.
 */
export function ActivityGrid({ activity }: ActivityGridProps) {
  const activeDays = activity.filter((day) => day.exercise_count > 0).length;

  return (
    <section
      className="mb-[18px] border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950"
      aria-labelledby="activity-grid-title"
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="m-0 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-400">
            Training activity
          </p>
          <h2
            id="activity-grid-title"
            className="m-0 mt-1 text-base font-semibold tracking-tight text-neutral-950 dark:text-neutral-50"
          >
            Last 30 days
          </h2>
        </div>
        <p className="m-0 pt-1 text-right text-xs text-neutral-600 dark:text-neutral-400">
          <span className="font-semibold text-neutral-950 dark:text-neutral-100">{activeDays}</span>{" "}
          {activeDays === 1 ? "active day" : "active days"}
        </p>
      </div>

      <div className="overflow-x-auto pb-1" aria-label="30-day workout activity heatmap">
        <div className="grid min-w-[510px] grid-cols-[repeat(30,minmax(0,1fr))] gap-1.5">
          {activity.map((day) => {
            const count = Number(day.exercise_count);
            const level = Math.min(3, Math.max(0, Number(day.activity_level)));
            const tooltip = `${day.activity_date}: ${count} exercises logged`;

            return (
              <div className="group relative" key={day.activity_date}>
                <div
                  className={`aspect-square w-full border ${levelClassNames[level] ?? levelClassNames[0]}`}
                  aria-label={`${formatDate(day.activity_date)}: ${count} exercises logged`}
                  role="img"
                  title={tooltip}
                />
                <span
                  className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-10 w-max max-w-48 -translate-x-1/2 border border-neutral-200 bg-white px-2 py-1 text-center text-[11px] leading-4 text-neutral-700 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200"
                  role="tooltip"
                >
                  {tooltip}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
