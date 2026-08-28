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


