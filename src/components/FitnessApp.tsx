"use client";

import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Dumbbell,
  Home,
  LogOut,
  Menu,
  Pencil,
  Plus,
  Scale,
  Search,
  Trophy,
  Trash2,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { Brand } from "@/components/AuthScreen";
import { ProgressChart } from "@/components/ProgressChart";
import { FriendsPage } from "@/components/FriendsPage";
import {
  BodyPart,
  BodyWeightLog,
  ChartPoint,
  Exercise,
  filterPoints,
  formatDate,
  initials,
  RANGE_OPTIONS,
  RangeKey,
  todayIso,
  WorkoutLog,
} from "@/lib/fitness";
import { supabase } from "@/lib/supabase";

type Section = "dashboard" | "workouts" | "friends";

type FitnessAppProps = {
  user: User;
};

export function FitnessApp({ user }: FitnessAppProps) {
  const [section, setSection] = useState<Section>("dashboard");
  const [bodyParts, setBodyParts] = useState<BodyPart[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutLog[]>([]);
  const [weights, setWeights] = useState<BodyWeightLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [weightModal, setWeightModal] = useState(false);
  const [workoutModal, setWorkoutModal] = useState(false);
  const [customModal, setCustomModal] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<WorkoutLog | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    const [partsResult, exercisesResult, workoutsResult, weightsResult] =
      await Promise.all([
        supabase.from("body_parts").select("*").order("sort_order"),
        supabase.from("exercises").select("*").order("name"),
        supabase
          .from("workout_logs")
          .select("*")
          .eq("user_id", user.id)
          .order("logged_at", { ascending: false }),
        supabase
          .from("body_weight_logs")
          .select("*")
          .eq("user_id", user.id)
          .order("logged_at", { ascending: true }),
      ]);

    const firstError =
      partsResult.error ||
      exercisesResult.error ||
      workoutsResult.error ||
      weightsResult.error;

    if (firstError) setNotice(firstError.message);
    setBodyParts((partsResult.data as BodyPart[]) ?? []);
    setExercises((exercisesResult.data as Exercise[]) ?? []);
    setWorkouts(
      ((workoutsResult.data as WorkoutLog[]) ?? []).map((item) => ({
        ...item,
        weight_kg: Number(item.weight_kg),
      })),
    );
    setWeights(
      ((weightsResult.data as BodyWeightLog[]) ?? []).map((item) => ({
        ...item,
        weight_kg: Number(item.weight_kg),
      })),
    );
    setLoading(false);
  }, [user.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!selectedExerciseId && exercises.length) {
      setSelectedExerciseId(exercises[0].id);
    }
  }, [exercises, selectedExerciseId]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  function navigate(next: Section) {
    setSection(next);
    setMobileMenu(false);
  }

  function beginWorkout(exerciseId?: string, existing?: WorkoutLog) {
    if (exerciseId) setSelectedExerciseId(exerciseId);
    setEditingWorkout(existing ?? null);
    setWorkoutModal(true);
  }

  async function saveWeight(date: string, weight: number) {
    const { error } = await supabase.from("body_weight_logs").upsert(
      {
        user_id: user.id,
        logged_at: date,
        weight_kg: weight,
      },
      { onConflict: "user_id,logged_at" },
    );

    if (error) throw error;
    setNotice("Body weight saved");
    await loadData();
  }

  async function saveWorkout(values: {
    date: string;
    weight: number;
    sets: number;
    reps: number;
    notes: string;
  }) {
    const payload = {
      user_id: user.id,
      exercise_id: selectedExerciseId,
      logged_at: values.date,
      weight_kg: values.weight,
      sets: values.sets,
      reps: values.reps,
      notes: values.notes || null,
    };

    const result = editingWorkout
      ? await supabase
          .from("workout_logs")
          .update(payload)
          .eq("id", editingWorkout.id)
      : await supabase.from("workout_logs").insert(payload);

    if (result.error) throw result.error;
    setNotice(editingWorkout ? "Workout updated" : "Workout logged");
    setEditingWorkout(null);
    await loadData();
  }

  async function addExercise(bodyPartId: string, name: string) {
    const { data, error } = await supabase
      .from("exercises")
      .insert({
        body_part_id: bodyPartId,
        name,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) throw error;
    setNotice("Custom exercise added");
    await loadData();
    setSelectedExerciseId(data.id);
  }

  async function deleteWorkout(id: string) {
    if (!window.confirm("Delete this workout entry?")) return;
    const { error } = await supabase.from("workout_logs").delete().eq("id", id);

    if (error) {
      setNotice(error.message);
    } else {
      setNotice("Workout removed");
      await loadData();
    }
  }

  const sectionTitle =
    section === "dashboard"
      ? "Journal"
      : section === "workouts"
        ? "Exercises"
        : "Friends";

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "open" : ""}`}>
        <div className="sidebar-top">
          <Brand />
          <button
            type="button"
            className="mobile-close"
            onClick={() => setMobileMenu(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav aria-label="Primary navigation">
          <NavButton
            active={section === "dashboard"}
            icon={<Home size={18} />}
            label="Journal"
            onClick={() => navigate("dashboard")}
          />
          <NavButton
            active={section === "workouts"}
            icon={<Dumbbell size={18} />}
            label="Exercises"
            onClick={() => navigate("workouts")}
          />
          <NavButton
            active={section === "friends"}
            icon={<Users size={18} />}
            label="Friends"
            onClick={() => navigate("friends")}
          />
        </nav>

        <div className="sidebar-bottom">
          <div className="user-card">
            <div className="avatar">{initials(user.email)}</div>
            <div>
              <strong>{user.email?.split("@")[0]}</strong>
              <span>Personal journal</span>
            </div>
          </div>
          <button
            type="button"
            className="logout-button"
            onClick={() => supabase.auth.signOut()}
          >
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>

      {mobileMenu ? (
        <button
          type="button"
          className="sidebar-scrim"
          onClick={() => setMobileMenu(false)}
          aria-label="Close menu"
        />
      ) : null}

      <section className="main-panel">
        <header className="topbar">
          <button
            type="button"
            className="menu-button"
            onClick={() => setMobileMenu(true)}
            aria-label="Open menu"
          >
            <Menu size={21} />
          </button>
          <div className="topbar-title">
            <span>{sectionTitle}</span>
            <small>Momentum</small>
          </div>
          <button
            type="button"
            className="primary-button topbar-action"
            onClick={() => beginWorkout()}
          >
            <Plus size={17} />
            <span>Log workout</span>
          </button>
        </header>

        <div className="content-wrap">
          {loading ? (
            <ContentSkeleton />
          ) : section === "dashboard" ? (
            <Dashboard
              weights={weights}
              workouts={workouts}
              exercises={exercises}
              onLogWeight={() => setWeightModal(true)}
              onLogWorkout={() => beginWorkout()}
              onOpenExercise={(id) => {
                setSelectedExerciseId(id);
                setSection("workouts");
              }}
            />
          ) : section === "workouts" ? (
            <ExercisesPage
              bodyParts={bodyParts}
              exercises={exercises}
              workouts={workouts}
              selectedExerciseId={selectedExerciseId}
              onSelect={setSelectedExerciseId}
              onLog={(id) => beginWorkout(id)}
              onEdit={(log) => beginWorkout(log.exercise_id, log)}
              onDelete={deleteWorkout}
              onCustom={() => setCustomModal(true)}
            />
          ) : (
            <FriendsPage user={user} onNotice={setNotice} />
          )}
        </div>
      </section>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <NavButton
          active={section === "dashboard"}
          icon={<Home size={19} />}
          label="Journal"
          onClick={() => navigate("dashboard")}
        />
        <NavButton
          active={section === "workouts"}
          icon={<Dumbbell size={19} />}
          label="Exercises"
          onClick={() => navigate("workouts")}
        />
        <NavButton
          active={section === "friends"}
          icon={<Users size={19} />}
          label="Friends"
          onClick={() => navigate("friends")}
        />
      </nav>

      <div className="toast-region" aria-live="polite">
        {notice ? (
          <div className="toast">
            <Check size={15} />
            {notice}
          </div>
        ) : null}
      </div>

      {weightModal ? (
        <WeightModal
          onClose={() => setWeightModal(false)}
          onSave={saveWeight}
        />
      ) : null}
      {workoutModal ? (
        <WorkoutModal
          exercise={exercises.find((item) => item.id === selectedExerciseId)}
          existing={editingWorkout}
          onClose={() => {
            setWorkoutModal(false);
            setEditingWorkout(null);
          }}
          onSave={saveWorkout}
        />
      ) : null}
      {customModal ? (
        <CustomExerciseModal
          bodyParts={bodyParts}
          onClose={() => setCustomModal(false)}
          onSave={addExercise}
        />
      ) : null}
    </main>
  );
}

function NavButton({
  active,
  icon,
  label,
  meta,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  meta?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={active ? "active" : ""}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
      {meta ? <small>{meta}</small> : null}
    </button>
  );
}

function Dashboard({
  weights,
  workouts,
  exercises,
  onLogWeight,
  onLogWorkout,
  onOpenExercise,
}: {
  weights: BodyWeightLog[];
  workouts: WorkoutLog[];
  exercises: Exercise[];
  onLogWeight: () => void;
  onLogWorkout: () => void;
  onOpenExercise: (id: string) => void;
}) {
  const [range, setRange] = useState<RangeKey>("3M");
  const weightPoints = useMemo(
    () =>
      weights.map((item) => ({
        date: item.logged_at,
        value: item.weight_kg,
      })),
    [weights],
  );

  const visibleWeights = filterPoints(weightPoints, range);
  const latestWeight = weights.at(-1)?.weight_kg;
  const firstVisibleWeight = visibleWeights[0]?.value;
  const weightChange =
    latestWeight !== undefined && firstVisibleWeight !== undefined
      ? latestWeight - firstVisibleWeight
      : null;
  const monday = getMondayStartIso();
  const weeklyWorkouts = workouts.filter((item) => item.logged_at >= monday);
  const weeklySessions = new Set(weeklyWorkouts.map((item) => item.logged_at)).size;
  const weeklyVolume = weeklyWorkouts.reduce(
    (total, item) => total + item.weight_kg * item.sets * item.reps,
    0,
  );
  const exerciseById = new Map(exercises.map((item) => [item.id, item]));
  const recentPrs = getRecentPrs(workouts).slice(0, 3);
  const recentExercises = getRecentExerciseProgress(workouts).slice(0, 3);

  return (
    <>
      <header className="page-header">
        <div>
          <p className="section-label">Training journal</p>
          <h1>Your week at a glance</h1>
          <p>Week begins Monday. Keep the record honest and useful.</p>
        </div>
        <div className="page-actions">
          <button type="button" className="secondary-button" onClick={onLogWeight}>
            <Scale size={16} />
            Log weight
          </button>
          <button type="button" className="primary-button" onClick={onLogWorkout}>
            <Plus size={16} />
            Log workout
          </button>
        </div>
      </header>

      <section className="weekly-snapshot" aria-labelledby="weekly-summary-title">
        <div className="snapshot-heading">
          <CalendarDays size={18} aria-hidden="true" />
          <div>
            <h2 id="weekly-summary-title">Weekly snapshot</h2>
            <p>Since Monday</p>
          </div>
        </div>
        <dl>
          <SnapshotItem
            term="Body weight"
            value={latestWeight === undefined ? "â€”" : `${latestWeight.toFixed(1)} kg`}
          />
          <SnapshotItem
            term={`Change Â· ${range}`}
            value={
              weightChange === null
                ? "â€”"
                : `${weightChange > 0 ? "+" : ""}${weightChange.toFixed(1)} kg`
            }
            tone={weightChange === null ? undefined : weightChange <= 0 ? "positive" : undefined}
          />
          <SnapshotItem term="Workouts" value={String(weeklySessions)} />
          <SnapshotItem term="Training volume" value={formatVolume(weeklyVolume)} />
        </dl>
      </section>

      <div className="dashboard-primary">
        <section className="journal-section weight-section" aria-labelledby="weight-title">
          <div className="section-heading">
            <div>
              <p className="section-label">Body weight</p>
              <h2 id="weight-title">Progress over time</h2>
            </div>
            <RangeSelect value={range} onChange={setRange} />
          </div>

          <div className="chart-summary">
            <strong>
              {latestWeight === undefined ? "â€”" : latestWeight.toFixed(1)}
              {latestWeight !== undefined ? <small> kg</small> : null}
            </strong>
            {weightChange !== null ? (
              <span>
                {weightChange > 0 ? "+" : ""}
                {weightChange.toFixed(1)} kg over {range.toLowerCase()}
              </span>
            ) : (
              <span>Add another entry to see the change.</span>
            )}
          </div>

          <ProgressChart
            points={visibleWeights}
            emptyLabel="Your weight trend will appear after your first entry."
          />
        </section>

        <LeaderboardPreview currentSessions={weeklySessions} />
      </div>

      <div className="dashboard-secondary">
        <section className="journal-section" aria-labelledby="activity-title">
          <div className="section-heading">
            <div>
              <p className="section-label">Recent activity</p>
              <h2 id="activity-title">Latest workouts</h2>
            </div>
            <button type="button" className="text-button" onClick={onLogWorkout}>
              Add entry
            </button>
          </div>

          <div className="activity-list">
            {workouts.slice(0, 5).map((log) => {
              const exercise = exerciseById.get(log.exercise_id);
              return (
                <button
                  type="button"
                  key={log.id}
                  className="activity-row"
                  onClick={() => onOpenExercise(log.exercise_id)}
                >
                  <span className="activity-date">
                    <strong>{new Date(`${log.logged_at}T12:00:00`).getDate()}</strong>
                    <small>
                      {new Intl.DateTimeFormat("en", { month: "short" }).format(
                        new Date(`${log.logged_at}T12:00:00`),
                      )}
                    </small>
                  </span>
                  <span className="activity-name">
                    <strong>{exercise?.name ?? "Exercise"}</strong>
                    <small>{log.sets} sets Ã— {log.reps} reps</small>
                  </span>
                  <span className="activity-weight">
                    {log.weight_kg}
                    <small> kg</small>
                  </span>
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              );
            })}
            {!workouts.length ? (
              <QuietEmpty
                title="No workouts recorded yet."
                text="Log a session when you are ready; it will appear here."
                action="Log a workout"
                onAction={onLogWorkout}
              />
            ) : null}
          </div>
        </section>

        <section className="journal-section" aria-labelledby="prs-title">
          <div className="section-heading">
            <div>
              <p className="section-label">Personal records</p>
              <h2 id="prs-title">Recent PRs</h2>
            </div>
          </div>
          <div className="pr-list">
            {recentPrs.map((log) => (
              <button
                type="button"
                key={log.id}
                className="pr-row"
                onClick={() => onOpenExercise(log.exercise_id)}
              >
                <span className="pr-icon"><Trophy size={15} /></span>
                <span>
                  <strong>{exerciseById.get(log.exercise_id)?.name ?? "Exercise"}</strong>
                  <small>{formatDate(log.logged_at)}</small>
                </span>
                <b>{log.weight_kg} kg</b>
              </button>
            ))}
            {!recentPrs.length ? (
              <QuietEmpty
                title="No personal records yet."
                text="Your first logged best will start this list."
              />
            ) : null}
          </div>
        </section>
      </div>

      <section className="journal-section exercise-progress-section" aria-labelledby="exercise-progress-title">
        <div className="section-heading">
          <div>
            <p className="section-label">Exercise progress</p>
            <h2 id="exercise-progress-title">Movements you are tracking</h2>
          </div>
          <button
            type="button"
            className="text-button"
            onClick={() => recentExercises[0] && onOpenExercise(recentExercises[0].exerciseId)}
            disabled={!recentExercises.length}
          >
            View details
          </button>
        </div>
        <div className="progress-list">
          {recentExercises.map((item) => (
            <button
              type="button"
              key={item.exerciseId}
              className="progress-row"
              onClick={() => onOpenExercise(item.exerciseId)}
            >
              <span className="progress-name">
                <strong>{exerciseById.get(item.exerciseId)?.name ?? "Exercise"}</strong>
                <small>{item.entries} logged {item.entries === 1 ? "entry" : "entries"}</small>
              </span>
              <MiniTrend points={item.points} />
              <span className="progress-best">
                <small>Best</small>
                <strong>{item.best} kg</strong>
              </span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          ))}
          {!recentExercises.length ? (
            <QuietEmpty
              title="No exercise trends yet."
              text="Progress becomes useful once you have a few sessions recorded."
              action="Browse exercises"
              onAction={() => onOpenExercise(exercises[0]?.id ?? "")}
            />
          ) : null}
        </div>
      </section>
    </>
  );
}

function SnapshotItem({
  term,
  value,
  tone,
}: {
  term: string;
  value: string;
  tone?: "positive";
}) {
  return (
    <div>
      <dt>{term}</dt>
      <dd className={tone === "positive" ? "positive" : ""}>{value}</dd>
    </div>
  );
}

function LeaderboardPreview({ currentSessions }: { currentSessions: number }) {
  const rows = [
    { name: "Maya Chen", initials: "MC", sessions: 5 },
    { name: "Noah Williams", initials: "NW", sessions: 4 },
    { name: "You", initials: "YO", sessions: currentSessions, current: true },
    { name: "Leila Ahmed", initials: "LA", sessions: 3 },
  ]
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 4);

  return (
    <aside className="journal-section leaderboard" aria-labelledby="leaderboard-title">
      <div className="section-heading">
        <div>
          <p className="section-label">Friends preview</p>
          <h2 id="leaderboard-title">Weekly consistency</h2>
        </div>
        <span className="preview-label">Preview</span>
      </div>
      <ol>
        {rows.map((row, index) => (
          <li key={row.name} className={row.current ? "current" : ""}>
            <span className="rank">{index + 1}</span>
            <span className="friend-avatar">{row.initials}</span>
            <span className="friend-name">{row.name}</span>
            <strong>{row.sessions}</strong>
            <small>{row.sessions === 1 ? "session" : "sessions"}</small>
          </li>
        ))}
      </ol>
      <p className="leaderboard-note">
        Ranked by training days. Week begins Monday. Friend data is illustrative.
      </p>
    </aside>
  );
}

function ExercisesPage({
  bodyParts,
  exercises,
  workouts,
  selectedExerciseId,
  onSelect,
  onLog,
  onEdit,
  onDelete,
  onCustom,
}: {
  bodyParts: BodyPart[];
  exercises: Exercise[];
  workouts: WorkoutLog[];
  selectedExerciseId: string;
  onSelect: (id: string) => void;
  onLog: (id: string) => void;
  onEdit: (log: WorkoutLog) => void;
  onDelete: (id: string) => void;
  onCustom: () => void;
}) {
  const selected = exercises.find((item) => item.id === selectedExerciseId);
  const [part, setPart] = useState(
    selected?.body_part_id ?? bodyParts[0]?.id ?? "",
  );
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<RangeKey>("3M");

  useEffect(() => {
    if (selected?.body_part_id) setPart(selected.body_part_id);
  }, [selected?.body_part_id]);

  const sessionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const log of workouts) {
      counts.set(log.exercise_id, (counts.get(log.exercise_id) ?? 0) + 1);
    }
    return counts;
  }, [workouts]);

  const partExercises = exercises.filter(
    (item) =>
      item.body_part_id === part &&
      item.name.toLowerCase().includes(query.toLowerCase()),
  );
  const exerciseLogs = workouts
    .filter((item) => item.exercise_id === selectedExerciseId)
    .toSorted((a, b) => a.logged_at.localeCompare(b.logged_at));
  const dailyBest = new Map<string, number>();

  for (const log of exerciseLogs) {
    dailyBest.set(
      log.logged_at,
      Math.max(dailyBest.get(log.logged_at) ?? 0, log.weight_kg),
    );
  }

  const points: ChartPoint[] = [...dailyBest].map(([date, value]) => ({
    date,
    value,
  }));
  const visible = filterPoints(points, range);
  const personalBest = exerciseLogs.length
    ? Math.max(...exerciseLogs.map((item) => item.weight_kg))
    : null;
  const last = exerciseLogs.at(-1);

  return (
    <>
      <header className="page-header compact">
        <div>
          <p className="section-label">Exercise library</p>
          <h1>Exercise progress</h1>
          <p>Choose a movement to review its history and log your next set.</p>
        </div>
        <button type="button" className="secondary-button" onClick={onCustom}>
          <Plus size={16} />
          Custom exercise
        </button>
      </header>

      <div className="exercise-layout">
        <section className="exercise-browser" aria-label="Exercise browser">
          <div className="body-tabs" role="tablist" aria-label="Body parts">
            {bodyParts.map((item) => (
              <button
                type="button"
                role="tab"
                aria-selected={part === item.id}
                key={item.id}
                className={part === item.id ? "active" : ""}
                onClick={() => setPart(item.id)}
              >
                {item.name}
              </button>
            ))}
          </div>

          <div className="exercise-toolbar">
            <label>
              <span className="sr-only">Find an exercise</span>
              <Search size={16} aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find an exercise"
              />
            </label>
            <button
              type="button"
              className="mobile-custom"
              onClick={onCustom}
              aria-label="Add custom exercise"
            >
              <Plus size={18} />
            </button>
          </div>

          <div className="exercise-list">
            {partExercises.map((item) => {
              const count = sessionCounts.get(item.id) ?? 0;
              return (
                <button
                  type="button"
                  key={item.id}
                  className={selectedExerciseId === item.id ? "active" : ""}
                  aria-pressed={selectedExerciseId === item.id}
                  onClick={() => onSelect(item.id)}
                >
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      {count
                        ? `${count} logged ${count === 1 ? "session" : "sessions"}`
                        : "No entries yet"}
                    </small>
                  </span>
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              );
            })}
            {!partExercises.length ? (
              <p className="no-results">No exercises match that search.</p>
            ) : null}
          </div>
        </section>

        <section className="exercise-detail">
          {selected ? (
            <>
              <div className="detail-heading">
                <div>
                  <p className="section-label">
                    {bodyParts.find((item) => item.id === selected.body_part_id)?.name}
                  </p>
                  <h2>{selected.name}</h2>
                </div>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => onLog(selected.id)}
                >
                  <Plus size={16} />
                  Log set
                </button>
              </div>

              <dl className="detail-stats">
                <div><dt>Personal best</dt><dd>{personalBest ? `${personalBest} kg` : "â€”"}</dd></div>
                <div><dt>Last session</dt><dd>{last ? formatDate(last.logged_at, true) : "â€”"}</dd></div>
                <div><dt>Total entries</dt><dd>{exerciseLogs.length}</dd></div>
              </dl>

              <section className="journal-section exercise-chart-card" aria-labelledby="lift-progress-title">
                <div className="section-heading">
                  <div>
                    <p className="section-label">Progress</p>
                    <h2 id="lift-progress-title">Weight lifted</h2>
                  </div>
                  <RangeSelect value={range} onChange={setRange} />
                </div>
                <ProgressChart
                  points={visible}
                  emptyLabel={`Log ${selected.name} to start its progress chart.`}
                />
              </section>

              <section className="journal-section history-card" aria-labelledby="history-title">
                <div className="section-heading">
                  <div>
                    <p className="section-label">History</p>
                    <h2 id="history-title">Previous entries</h2>
                  </div>
                </div>
                <div className="history-table">
                  <div className="history-head" aria-hidden="true">
                    <span>Date</span><span>Weight</span><span>Sets Ã— reps</span><span />
                  </div>
                  {exerciseLogs.toReversed().map((log) => (
                    <div className="history-row" key={log.id}>
                      <span>{formatDate(log.logged_at)}</span>
                      <strong>{log.weight_kg} kg</strong>
                      <span>{log.sets} Ã— {log.reps}</span>
                      <span className="row-actions">
                        <button type="button" onClick={() => onEdit(log)} aria-label="Edit entry">
                          <Pencil size={15} />
                        </button>
                        <button type="button" onClick={() => onDelete(log.id)} aria-label="Delete entry">
                          <Trash2 size={15} />
                        </button>
                      </span>
                    </div>
                  ))}
                  {!exerciseLogs.length ? (
                    <p className="history-empty">
                      Nothing recorded for this exercise yet.
                    </p>
                  ) : null}
                </div>
              </section>
            </>
          ) : (
            <div className="select-prompt">
              <Dumbbell size={22} />
              <h2>Choose an exercise</h2>
              <p>Select a movement to see its history and progress.</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function RangeSelect({
  value,
  onChange,
}: {
  value: RangeKey;
  onChange: (range: RangeKey) => void;
}) {
  return (
    <label className="range-select">
      <span className="sr-only">Chart date range</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as RangeKey)}
      >
        {RANGE_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option === "ALL" ? "All time" : option}
          </option>
        ))}
      </select>
    </label>
  );
}

function QuietEmpty({
  title,
  text,
  action,
  onAction,
}: {
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="quiet-empty">
      <strong>{title}</strong>
      <p>{text}</p>
      {action && onAction ? (
        <button type="button" className="text-button" onClick={onAction}>
          {action}
        </button>
      ) : null}
    </div>
  );
}

function MiniTrend({ points }: { points: ChartPoint[] }) {
  const lastPoints = points.slice(-8);
  if (lastPoints.length < 2) return <span className="mini-trend-empty">Not enough data</span>;

  const values = lastPoints.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 1);
  const line = lastPoints
    .map((point, index) => {
      const x = (index / (lastPoints.length - 1)) * 92 + 4;
      const y = 25 - ((point.value - min) / spread) * 20;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg className="mini-trend" viewBox="0 0 100 30" aria-label="Recent exercise trend">
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function ContentSkeleton() {
  return (
    <div className="skeleton-page" aria-busy="true" aria-label="Loading your journal">
      <div className="skeleton skeleton-heading" />
      <div className="skeleton skeleton-summary" />
      <div className="skeleton skeleton-chart" />
    </div>
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
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
      >
        <div className="modal-head">
          <div>
            <p className="section-label">Quick entry</p>
            <h2 id="modal-title">{title}</h2>
            <p id="modal-description">{subtitle}</p>
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

function WeightModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (date: string, weight: number) => Promise<void>;
}) {
  const [date, setDate] = useState(todayIso());
  const [weight, setWeight] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave(date, Number(weight));
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save weight");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalFrame
      title="Log body weight"
      subtitle="One entry per day keeps the trend clear."
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={submit}>
        <div className="form-grid">
          <label>
            Date
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </label>
          <label>
            Weight (kg)
            <input
              type="number"
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              min="20"
              max="500"
              step="0.1"
              inputMode="decimal"
              placeholder="72.5"
              autoFocus
              required
            />
          </label>
        </div>
        {error ? <div className="form-error" role="alert">{error}</div> : null}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button className="primary-button" disabled={busy}>
            {busy ? "Saving..." : "Save weight"}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}

function WorkoutModal({
  exercise,
  existing,
  onClose,
  onSave,
}: {
  exercise?: Exercise;
  existing: WorkoutLog | null;
  onClose: () => void;
  onSave: (values: {
    date: string;
    weight: number;
    sets: number;
    reps: number;
    notes: string;
  }) => Promise<void>;
}) {
  const [date, setDate] = useState(existing?.logged_at ?? todayIso());
  const [weight, setWeight] = useState(existing ? String(existing.weight_kg) : "");
  const [sets, setSets] = useState(existing ? String(existing.sets) : "3");
  const [reps, setReps] = useState(existing ? String(existing.reps) : "8");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave({
        date,
        weight: Number(weight),
        sets: Number(sets),
        reps: Number(reps),
        notes,
      });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save workout");
    } finally {
      setBusy(false);
    }
  }

  if (!exercise) {
    return (
      <ModalFrame
        title="Choose an exercise first"
        subtitle="Open the exercise library and select a movement."
        onClose={onClose}
      >
        <div className="modal-actions standalone">
          <button type="button" className="primary-button" onClick={onClose}>Got it</button>
        </div>
      </ModalFrame>
    );
  }

  return (
    <ModalFrame
      title={existing ? `Edit ${exercise.name}` : exercise.name}
      subtitle="Record the working load for this session."
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={submit}>
        <label>
          Date
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </label>
        <div className="form-grid three">
          <label>
            Weight (kg)
            <input
              type="number"
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              min="0"
              max="1000"
              step="0.25"
              inputMode="decimal"
              placeholder="80"
              autoFocus
              required
            />
          </label>
          <label>
            Sets
            <input
              type="number"
              value={sets}
              onChange={(event) => setSets(event.target.value)}
              min="1"
              max="50"
              inputMode="numeric"
              required
            />
          </label>
          <label>
            Reps
            <input
              type="number"
              value={reps}
              onChange={(event) => setReps(event.target.value)}
              min="1"
              max="1000"
              inputMode="numeric"
              required
            />
          </label>
        </div>
        <label>
          Notes <span>(optional)</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={500}
            placeholder="Anything worth remembering?"
          />
        </label>
        {error ? <div className="form-error" role="alert">{error}</div> : null}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button className="primary-button" disabled={busy}>
            {busy ? "Saving..." : existing ? "Update entry" : "Log workout"}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}

function CustomExerciseModal({
  bodyParts,
  onClose,
  onSave,
}: {
  bodyParts: BodyPart[];
  onClose: () => void;
  onSave: (bodyPartId: string, name: string) => Promise<void>;
}) {
  const [part, setPart] = useState(bodyParts[0]?.id ?? "");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave(part, name.trim());
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add exercise");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalFrame
      title="Add custom exercise"
      subtitle="This movement will be private to your account."
      onClose={onClose}
    >
      <form className="modal-form" onSubmit={submit}>
        <label>
          Exercise name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            minLength={2}
            maxLength={80}
            placeholder="e.g. Machine incline press"
            autoFocus
            required
          />
        </label>
        <label>
          Body part
          <select value={part} onChange={(event) => setPart(event.target.value)}>
            {bodyParts.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>
        {error ? <div className="form-error" role="alert">{error}</div> : null}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button className="primary-button" disabled={busy}>
            {busy ? "Adding..." : "Add exercise"}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}

function getMondayStartIso() {
  const today = new Date();
  const day = today.getDay();
  const difference = day === 0 ? -6 : 1 - day;
  today.setDate(today.getDate() + difference);
  const offset = today.getTimezoneOffset();
  return new Date(today.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function formatVolume(volume: number) {
  if (!volume) return "â€”";
  if (volume >= 1000) return `${new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(volume / 1000)}k kg`;
  return `${Math.round(volume)} kg`;
}

function getRecentPrs(workouts: WorkoutLog[]) {
  const bestByExercise = new Map<string, number>();
  const prs: WorkoutLog[] = [];
  const chronological = workouts.toSorted((a, b) =>
    a.logged_at.localeCompare(b.logged_at),
  );

  for (const log of chronological) {
    const previousBest = bestByExercise.get(log.exercise_id);
    if (previousBest === undefined || log.weight_kg > previousBest) {
      prs.push(log);
      bestByExercise.set(log.exercise_id, log.weight_kg);
    }
  }

  return prs.toReversed();
}

function getRecentExerciseProgress(workouts: WorkoutLog[]) {
  const byExercise = new Map<string, WorkoutLog[]>();
  for (const log of workouts) {
    const existing = byExercise.get(log.exercise_id) ?? [];
    existing.push(log);
    byExercise.set(log.exercise_id, existing);
  }

  return [...byExercise.entries()]
    .map(([exerciseId, logs]) => {
      const ordered = logs.toSorted((a, b) => a.logged_at.localeCompare(b.logged_at));
      return {
        exerciseId,
        entries: logs.length,
        best: Math.max(...logs.map((log) => log.weight_kg)),
        latestDate: ordered.at(-1)?.logged_at ?? "",
        points: ordered.map((log) => ({
          date: log.logged_at,
          value: log.weight_kg,
        })),
      };
    })
    .toSorted((a, b) => b.latestDate.localeCompare(a.latestDate));
}

