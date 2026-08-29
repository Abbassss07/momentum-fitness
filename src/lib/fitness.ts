export type RangeKey = "1W" | "1M" | "3M" | "6M" | "1Y" | "YTD" | "ALL";

export type BodyPart = {
  id: string;
  name: string;
  sort_order: number;
};

export type Exercise = {
  id: string;
  body_part_id: string;
  name: string;
  user_id: string | null;
};

export type WorkoutLog = {
  id: string;
  user_id: string;
  exercise_id: string;
  logged_at: string;
  weight_kg: number;
  sets: number;
  reps: number;
  notes: string | null;
};

export type BodyWeightLog = {
  id: string;
  user_id: string;
  logged_at: string;
  weight_kg: number;
};

export type ChartPoint = {
  date: string;
  value: number;
};

export const RANGE_OPTIONS: RangeKey[] = [
  "1W",
  "1M",
  "3M",
  "6M",
  "1Y",
  "YTD",
  "ALL",
];

export function todayIso() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function localDateIso(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getCalendarWeekBounds(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = start.getDay();
  start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day));

  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  return { start: localDateIso(start), end: localDateIso(end) };
}

export function getCalendarMonthBounds(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: localDateIso(start), end: localDateIso(end) };
}

export function trainingVolume(
  log: Pick<WorkoutLog, "weight_kg" | "sets" | "reps">,
) {
  return Number(log.weight_kg) * Number(log.sets) * Number(log.reps);
}

export function formatVolume(volume: number) {
  if (!volume) return "—";
  if (volume >= 1000) {
    return `${new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(volume / 1000)}k kg`;
  }
  return `${Math.round(volume)} kg`;
}

export function startForRange(range: RangeKey) {
  if (range === "ALL") return null;
  const now = new Date();
  const start = new Date(now);
  if (range === "YTD") start.setMonth(0, 1);
  if (range === "1W") start.setDate(now.getDate() - 7);
  if (range === "1M") start.setMonth(now.getMonth() - 1);
  if (range === "3M") start.setMonth(now.getMonth() - 3);
  if (range === "6M") start.setMonth(now.getMonth() - 6);
  if (range === "1Y") start.setFullYear(now.getFullYear() - 1);
  return start.toISOString().slice(0, 10);
}

export function filterPoints(points: ChartPoint[], range: RangeKey) {
  const start = startForRange(range);
  return start ? points.filter((point) => point.date >= start) : points;
}

export function formatDate(date: string, compact = false) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    ...(compact ? {} : { year: "numeric" }),
  }).format(new Date(`${date}T12:00:00`));
}

export function initials(email?: string) {
  return (email?.slice(0, 2) || "FT").toUpperCase();
}


