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
  Settings,
  Trophy,
  Trash2,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { Brand } from "@/components/AuthScreen";
import { ProgressChart, RangeSelect } from "@/components/ProgressChart";
import { FriendsPage } from "@/components/FriendsPage";
import { GroupsPage } from "@/components/GroupsPage";
import { LeaderboardPage } from "@/components/LeaderboardPage";
import { ProfileSettings } from "@/components/ProfileSettings";
import { scrollFocusedFieldIntoView } from "@/lib/scrollFocusedFieldIntoView";
import {
  BodyPart,
  BodyWeightLog,
  ChartPoint,
  currentStreak,
  Exercise,
  filterPoints,
  formatDate,
  initials,
  RangeKey,
  todayIso,
  WorkoutLog,
} from "@/lib/fitness";
import { supabase } from "@/lib/supabase";

type Section = "dashboard" | "workouts" | "friends" | "groups" | "leaderboard" | "settings";
type Theme = "light" | "dark";

type FitnessAppProps = {
  user: User;
  initialInviteCode?: string;
};

export function FitnessApp({ user, initialInviteCode }: FitnessAppProps) {
  const [section, setSection] = useState<Section>(initialInviteCode ? "groups" : "dashboard");
  const [bodyParts, setBodyParts] = useState<BodyPart[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutLog[]>([]);
  const [weights, setWeights] = useState<BodyWeightLog[]>([]);
  const [profileUsername, setProfileUsername] = useState(
    typeof user.user_metadata.username === "string"
      ? user.user_metadata.username
      : "momentum_member",
  );
  const [profileDisplayName, setProfileDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [weightModal, setWeightModal] = useState(false);
  const [workoutPicker, setWorkoutPicker] = useState(false);
  const [workoutModal, setWorkoutModal] = useState(false);
  const [customModal, setCustomModal] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<WorkoutLog | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    return window.localStorage.getItem("momentum-theme") === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("momentum-theme", theme);
  }, [theme]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [partsResult, exercisesResult, workoutsResult, weightsResult, profileResult] =
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
        supabase
          .from("profiles")
          .select("username,display_name")
          .eq("id", user.id)
          .single(),
      ]);

    const firstError =
      partsResult.error ||
      exercisesResult.error ||
      workoutsResult.error ||
      weightsResult.error ||
      profileResult.error;

    if (firstError) setNotice(firstError.message);
    setBodyParts((partsResult.data as BodyPart[]) ?? []);
    setExercises((exercisesResult.data as Exercise[]) ?? []);
    setWorkouts(
      ((workoutsResult.data as WorkoutLog[]) ?? []).map((item) => ({
        ...item,
        weight_kg: item.weight_kg === null ? null : Number(item.weight_kg),
      })),
    );
    setWeights(
      ((weightsResult.data as BodyWeightLog[]) ?? []).map((item) => ({
        ...item,
        weight_kg: Number(item.weight_kg),
      })),
    );
    if (profileResult.data?.username) setProfileUsername(profileResult.data.username);
    setProfileDisplayName(profileResult.data?.display_name ?? "");
    setLoading(false);
  }, [user.id]);

  useEffect(() => {
    // Initial Supabase synchronization is intentionally tied to the active user.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!selectedExerciseId && exercises.length) {
      // Default the picker after the asynchronous exercise list arrives.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  function openWorkoutPicker() {
    setEditingWorkout(null);
    setWorkoutPicker(true);
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
    weight: number | null;
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

  async function addExercise(
    bodyPartId: string,
    name: string,
    isBodyweight: boolean,
  ) {
    const { data, error } = await supabase
      .from("exercises")
      .insert({
        body_part_id: bodyPartId,
        name,
        user_id: user.id,
        is_bodyweight: isBodyweight,
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
        : section === "friends"
          ? "Friends"
          : section === "groups"
            ? "Groups"
            : section === "leaderboard"
              ? "Leaderboard"
              : "Profile";

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
          <NavButton
            active={section === "groups"}
            icon={<UsersRound size={18} />}
            label="Groups"
            onClick={() => navigate("groups")}
          />
          <NavButton
            active={section === "leaderboard"}
            icon={<Trophy size={18} />}
            label="Leaderboard"
            onClick={() => navigate("leaderboard")}
          />
          <NavButton
            active={section === "settings"}
            icon={<Settings size={18} />}
            label="Profile"
            onClick={() => navigate("settings")}
          />
        </nav>

        <div className="sidebar-bottom">
          <div className="user-card">
            <div className="avatar">{initials(profileUsername)}</div>
            <div>
              <strong>@{profileUsername}</strong>
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
          {section !== "friends" && section !== "groups" ? (
            <button
              type="button"
              className="primary-button topbar-action"
              onClick={openWorkoutPicker}
            >
              <Plus size={17} />
              <span>Log workout</span>
            </button>
          ) : null}
        </header>

        <div className={section === "dashboard" ? "content-wrap has-mobile-quick-log" : "content-wrap"}>
          {loading ? (
            <ContentSkeleton />
          ) : section === "dashboard" ? (
            <Dashboard
              weights={weights}
              workouts={workouts}
              exercises={exercises}
              onLogWeight={() => setWeightModal(true)}
              onLogWorkout={openWorkoutPicker}
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
          ) : section === "friends" ? (
            <FriendsPage user={user} exercises={exercises} onNotice={setNotice} />
          ) : section === "groups" ? (
            <GroupsPage userId={user.id} initialInviteCode={initialInviteCode} onNotice={setNotice} />
          ) : section === "leaderboard" ? (
            <LeaderboardPage userId={user.id} />
          ) : (
            <ProfileSettings
              userId={user.id}
              username={profileUsername}
              displayName={profileDisplayName}
              theme={theme}
              onThemeChange={setTheme}
              onSaved={(profile) => {
                setProfileUsername(profile.username);
                setProfileDisplayName(profile.displayName);
              }}
              onNotice={setNotice}
            />
          )}
        </div>
      </section>

      {section === "dashboard" ? (
        <div className="mobile-quick-log" role="group" aria-label="Quick logging actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => setWeightModal(true)}
          >
            <Scale size={17} />
            Body weight
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={openWorkoutPicker}
          >
            <Plus size={17} />
            Log workout
          </button>
        </div>
      ) : null}

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
        <NavButton
          active={section === "groups"}
          icon={<UsersRound size={19} />}
          label="Groups"
          onClick={() => navigate("groups")}
        />
        <NavButton
          active={section === "leaderboard"}
          icon={<Trophy size={19} />}
          label="Ranks"
          onClick={() => navigate("leaderboard")}
        />
        <NavButton
          active={section === "settings"}
          icon={<Settings size={19} />}
          label="Profile"
          onClick={() => navigate("settings")}
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
      {workoutPicker ? (
        <WorkoutPicker
          exercises={exercises}
          workouts={workouts}
          onClose={() => setWorkoutPicker(false)}
          onSelect={(exerciseId) => {
            setWorkoutPicker(false);
            beginWorkout(exerciseId);
          }}
          onBrowse={() => {
            setWorkoutPicker(false);
            navigate("workouts");
          }}
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
  const streak = currentStreak(workouts);
  const exerciseById = new Map(exercises.map((item) => [item.id, item]));

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

      <section className="streak-summary" aria-labelledby="streak-title">
        <div>
          <p className="section-label">Consistency</p>
          <h2 id="streak-title">Current streak</h2>
          <p className="streak-description">
            {streak.isAtRisk ? "Train today to keep it going." : "Keep building your routine."}
          </p>
        </div>
        <div className="streak-value" aria-label={`${streak.days} day current streak`}>
          <strong>{streak.days}</strong>
          <span>{streak.days === 1 ? "day" : "days"}</span>
        </div>
      </section>

      <div className="dashboard-primary dashboard-primary-solo">
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
              {latestWeight === undefined ? "-" : latestWeight.toFixed(1)}
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
      </div>

      <div className="dashboard-secondary dashboard-secondary-solo">
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
                    <small>{log.sets} sets x {log.reps} reps</small>
                  </span>
                  <span className="activity-weight">
                    {formatWorkoutLoad(log.weight_kg)}
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
      </div>
    </>
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
    if (selected?.body_part_id) {
      // Keep the visible category synchronized with selections made elsewhere.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPart(selected.body_part_id);
    }
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
  const isBodyweightExercise = selected?.is_bodyweight ?? false;
  const dailyProgress = new Map<string, number>();

  for (const log of exerciseLogs) {
    if (isBodyweightExercise) {
      const totalReps = log.sets * log.reps;
      dailyProgress.set(
        log.logged_at,
        (dailyProgress.get(log.logged_at) ?? 0) + totalReps,
      );
      continue;
    }

    if (log.weight_kg === null) continue;
    dailyProgress.set(
      log.logged_at,
      Math.max(dailyProgress.get(log.logged_at) ?? 0, log.weight_kg),
    );
  }

  const points: ChartPoint[] = [...dailyProgress].map(([date, value]) => ({
    date,
    value,
  }));
  const visible = filterPoints(points, range);
  const recordedLoads = exerciseLogs
    .map((item) => item.weight_kg)
    .filter((load): load is number => load !== null);
  const personalBest = recordedLoads.length
    ? Math.max(...recordedLoads)
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
                <div><dt>Personal best</dt><dd>{personalBest ? `${personalBest} kg` : "-"}</dd></div>
                <div><dt>Last session</dt><dd>{last ? formatDate(last.logged_at, true) : "-"}</dd></div>
                <div><dt>Total entries</dt><dd>{exerciseLogs.length}</dd></div>
              </dl>

              <section className="journal-section exercise-chart-card" aria-labelledby="lift-progress-title">
                <div className="section-heading">
                  <div>
                    <p className="section-label">Progress</p>
                    <h2 id="lift-progress-title">
                      {isBodyweightExercise ? "Reps" : "Weight (kg)"}
                    </h2>
                  </div>
                  <RangeSelect value={range} onChange={setRange} />
                </div>
                <ProgressChart
                  points={visible}
                  unit={isBodyweightExercise ? "reps" : "kg"}
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
                    <span>Date</span><span>Weight</span><span>Sets x reps</span><span />
                  </div>
                  {exerciseLogs.toReversed().map((log) => (
                    <div className="history-row" key={log.id}>
                      <span>{formatDate(log.logged_at)}</span>
                      <strong>{formatWorkoutLoad(log.weight_kg)}</strong>
                      <span>{log.sets} x {log.reps}</span>
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
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
        onFocusCapture={scrollFocusedFieldIntoView}
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
              enterKeyHint="done"
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

function WorkoutPicker({
  exercises,
  workouts,
  onClose,
  onSelect,
  onBrowse,
}: {
  exercises: Exercise[];
  workouts: WorkoutLog[];
  onClose: () => void;
  onSelect: (exerciseId: string) => void;
  onBrowse: () => void;
}) {
  const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const recentExercises: Exercise[] = [];
  const seenExerciseIds = new Set<string>();

  for (const workout of workouts) {
    if (seenExerciseIds.has(workout.exercise_id)) continue;
    const exercise = exerciseById.get(workout.exercise_id);
    if (!exercise) continue;
    seenExerciseIds.add(exercise.id);
    recentExercises.push(exercise);
    if (recentExercises.length === 4) break;
  }

  return (
    <ModalFrame
      title="Choose exercise"
      subtitle="Pick a recent movement, or browse your full library."
      onClose={onClose}
    >
      {recentExercises.length ? (
        <div className="workout-picker-list" aria-label="Recent exercises">
          <p className="section-label">Recent exercises</p>
          {recentExercises.map((exercise) => (
            <button
              type="button"
              key={exercise.id}
              className="workout-picker-option"
              onClick={() => onSelect(exercise.id)}
            >
              <Dumbbell size={17} aria-hidden="true" />
              <span>
                <strong>{exercise.name}</strong>
                <small>{exercise.is_bodyweight ? "Bodyweight" : "Weighted exercise"}</small>
              </span>
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : null}
      <div className="modal-actions standalone">
        <button type="button" className="secondary-button" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="primary-button" onClick={onBrowse}>
          Browse exercises
        </button>
      </div>
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
    weight: number | null;
    sets: number;
    reps: number;
    notes: string;
  }) => Promise<void>;
}) {
  const [date, setDate] = useState(existing?.logged_at ?? todayIso());
  const [weight, setWeight] = useState(
    existing?.weight_kg === null || existing?.weight_kg === undefined
      ? ""
      : String(existing.weight_kg),
  );
  const [sets, setSets] = useState(existing ? String(existing.sets) : "3");
  const [reps, setReps] = useState(existing ? String(existing.reps) : "8");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedWeight = weight.trim() === "" ? null : Number(weight);
    if (!exercise?.is_bodyweight && parsedWeight === null) {
      setError("Weight is required for this exercise.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave({
        date,
        weight: parsedWeight,
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
            {exercise.is_bodyweight ? "Added weight (kg)" : "Weight (kg)"}
            <input
              type="number"
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              min="0"
              max="1000"
              step="any"
              inputMode="decimal"
              enterKeyHint="next"
              placeholder={exercise.is_bodyweight ? "Optional" : "80"}
              autoFocus
              required={!exercise.is_bodyweight}
            />
            {exercise.is_bodyweight ? (
              <span className="field-hint">Leave blank for bodyweight only.</span>
            ) : null}
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
              enterKeyHint="next"
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
              enterKeyHint="next"
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
            enterKeyHint="done"
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
  onSave: (
    bodyPartId: string,
    name: string,
    isBodyweight: boolean,
  ) => Promise<void>;
}) {
  const [part, setPart] = useState(bodyParts[0]?.id ?? "");
  const [name, setName] = useState("");
  const [isBodyweight, setIsBodyweight] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave(part, name.trim(), isBodyweight);
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
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={isBodyweight}
            onChange={(event) => setIsBodyweight(event.target.checked)}
          />
          <span>
            Bodyweight exercise
            <small>Weight will be optional when logging this movement.</small>
          </span>
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

function formatWorkoutLoad(weight: number | null) {
  return weight === null ? "Bodyweight" : `${weight} kg`;
}

