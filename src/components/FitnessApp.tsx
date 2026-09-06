"use client";

import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import {
  Check,
  ChartNoAxesCombined,
  ChevronRight,
  Dumbbell,
  LogOut,
  Pencil,
  Plus,
  Scale,
  Search,
  Settings,
  Trophy,
  Trash2,
  Users,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { ActivityGrid, type ActivityDay } from "@/components/ActivityGrid";
import { ProgressChart, RangeSelect } from "@/components/ProgressChart";
import { GroupsPage } from "@/components/GroupsPage";
import { InstallOnboarding, isMobileInstallCandidate } from "@/components/InstallOnboarding";
import {
  BodyPart,
  BodyWeightLog,
  ChartPoint,
  currentStreak,
  Exercise,
  filterPoints,
  formatDate,
  RangeKey,
  todayIso,
  getCalendarMonthBounds,
  localDateIso,
  WorkoutLog,
} from "@/lib/fitness";
import { readAllPages } from "@/lib/readAllPages";
import { scrollFocusedFieldIntoView } from "@/lib/scrollFocusedFieldIntoView";
import { supabase } from "@/lib/supabase";

const FriendsPage = dynamic(
  () => import("@/components/FriendsPage").then((module) => module.FriendsPage),
  { loading: () => <ContentSkeleton /> },
);
const LeaderboardPage = dynamic(
  () =>
    import("@/components/LeaderboardPage").then(
      (module) => module.LeaderboardPage,
    ),
  { loading: () => <ContentSkeleton /> },
);
const ProfileSettings = dynamic(
  () =>
    import("@/components/ProfileSettings").then(
      (module) => module.ProfileSettings,
    ),
  { loading: () => <ContentSkeleton /> },
);

type Section =
  | "dashboard"
  | "progress"
  | "workouts"
  | "friends"
  | "groups"
  | "leaderboard"
  | "settings";
type Theme = "light" | "dark";

type FitnessAppProps = {
  user: User;
  initialInviteCode?: string;
};

export function FitnessApp({ user, initialInviteCode }: FitnessAppProps) {
  const [section, setSection] = useState<Section>(initialInviteCode ? "groups" : "dashboard");
  const [bodyParts, setBodyParts] = useState<BodyPart[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [hiddenExerciseIds, setHiddenExerciseIds] = useState<Set<string>>(new Set());
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
  const [loadError, setLoadError] = useState("");
  const [weightModal, setWeightModal] = useState(false);
  const [workoutPicker, setWorkoutPicker] = useState(false);
  const [workoutModal, setWorkoutModal] = useState(false);
  const [customModal, setCustomModal] = useState(false);
  const [installPromptEligible, setInstallPromptEligible] = useState(false);
  const [installOnboardingOpen, setInstallOnboardingOpen] = useState(false);
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
    setLoadError("");
    const [
      partsResult,
      exercisesResult,
      workoutsResult,
      weightsResult,
      profileResult,
      hiddenExercisesResult,
    ] = await Promise.all([
        supabase.from("body_parts").select("*").order("sort_order"),
        supabase.from("exercises").select("*").order("name"),
        readAllPages<WorkoutLog>((from, to) =>
          supabase
            .from("workout_logs")
            .select("*")
            .eq("user_id", user.id)
            .order("logged_at", { ascending: false })
            .order("id")
            .range(from, to),
        ),
        readAllPages<BodyWeightLog>((from, to) =>
          supabase
            .from("body_weight_logs")
            .select("*")
            .eq("user_id", user.id)
            .order("logged_at")
            .order("id")
            .range(from, to),
        ),
        supabase
          .from("profiles")
          .select("username,display_name,has_seen_install_prompt,install_prompt_eligible")
          .eq("id", user.id)
          .single(),
        supabase
          .from("hidden_exercises")
          .select("exercise_id")
          .eq("user_id", user.id),
      ]);

    const firstError =
      partsResult.error ||
      exercisesResult.error ||
      workoutsResult.error ||
      weightsResult.error ||
      profileResult.error ||
      hiddenExercisesResult.error;

    if (firstError) {
      setLoadError(firstError.message);
      setLoading(false);
      return;
    }
    setBodyParts((partsResult.data as BodyPart[]) ?? []);
    setExercises((exercisesResult.data as Exercise[]) ?? []);
    setHiddenExerciseIds(
      new Set((hiddenExercisesResult.data ?? []).map((item) => item.exercise_id)),
    );
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
    setInstallPromptEligible(Boolean(
      profileResult.data?.install_prompt_eligible && !profileResult.data?.has_seen_install_prompt,
    ));
    setLoading(false);
  }, [user.id]);

  useEffect(() => {
    // Initial Supabase synchronization is intentionally tied to the active user.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!installPromptEligible) return;

    let cancelled = false;
    async function claimInstallOnboarding() {
      // This conditional update lets only one device claim the one-time prompt.
      const { data } = await supabase
        .from("profiles")
        .update({ has_seen_install_prompt: true, install_prompt_eligible: false })
        .eq("id", user.id)
        .eq("has_seen_install_prompt", false)
        .eq("install_prompt_eligible", true)
        .select("id")
        .maybeSingle();

      if (data && !cancelled && isMobileInstallCandidate()) {
        setInstallOnboardingOpen(true);
      }
      if (!cancelled) setInstallPromptEligible(false);
    }

    void claimInstallOnboarding();
    return () => {
      cancelled = true;
    };
  }, [installPromptEligible, user.id]);

  const visibleExercises = useMemo(
    () => exercises.filter((exercise) => !hiddenExerciseIds.has(exercise.id)),
    [exercises, hiddenExerciseIds],
  );

  useEffect(() => {
    if (!selectedExerciseId && visibleExercises.length) {
      // Default the picker after the asynchronous exercise list arrives.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedExerciseId(visibleExercises[0].id);
    }
  }, [visibleExercises, selectedExerciseId]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 3500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  function navigate(next: Section) {
    setSection(next);
    window.scrollTo({ top: 0 });
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
    const { data, error } = await supabase.from("body_weight_logs").upsert(
      {
        user_id: user.id,
        logged_at: date,
        weight_kg: weight,
      },
      { onConflict: "user_id,logged_at" },
    ).select().single();

    if (error) throw error;
    setWeights((current) =>
      [
        ...current.filter((item) => item.logged_at !== date),
        { ...data, weight_kg: Number(data.weight_kg) },
      ].toSorted((a, b) => a.logged_at.localeCompare(b.logged_at)),
    );
    setNotice("Body weight saved");
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
          .eq("user_id", user.id)
          .select()
          .single()
      : await supabase.from("workout_logs").insert(payload).select().single();

    if (result.error) throw result.error;
    const saved = {
      ...result.data,
      weight_kg:
        result.data.weight_kg === null ? null : Number(result.data.weight_kg),
    } as WorkoutLog;
    setWorkouts((current) =>
      [saved, ...current.filter((item) => item.id !== saved.id)].toSorted(
        (a, b) => b.logged_at.localeCompare(a.logged_at),
      ),
    );
    setNotice(editingWorkout ? "Workout updated" : "Workout logged");
    setEditingWorkout(null);
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
    setExercises((current) =>
      [...current, data].toSorted((a, b) => a.name.localeCompare(b.name)),
    );
    setSelectedExerciseId(data.id);
  }

  async function hideExercise(exercise: Exercise) {
    if (!window.confirm(`Remove ${exercise.name} from your exercise library? Your logged workouts will be kept.`)) {
      return;
    }

    const { error } = await supabase.from("hidden_exercises").insert({
      user_id: user.id,
      exercise_id: exercise.id,
    });

    if (error) {
      setNotice(error.message);
      return;
    }

    setHiddenExerciseIds((current) => new Set([...current, exercise.id]));
    if (selectedExerciseId === exercise.id) {
      setSelectedExerciseId(
        visibleExercises.find((item) => item.id !== exercise.id)?.id ?? "",
      );
    }
    setNotice("Exercise removed from your library");
  }

  async function restoreExercise(exerciseId: string) {
    const { error } = await supabase
      .from("hidden_exercises")
      .delete()
      .eq("user_id", user.id)
      .eq("exercise_id", exerciseId);

    if (error) {
      setNotice(error.message);
      return;
    }

    setHiddenExerciseIds((current) => {
      const next = new Set(current);
      next.delete(exerciseId);
      return next;
    });
    setSelectedExerciseId(exerciseId);
    setNotice("Exercise restored to your library");
  }

  async function deleteWorkout(id: string) {
    if (!window.confirm("Delete this workout entry?")) return;
    const { error } = await supabase
      .from("workout_logs")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      setNotice(error.message);
    } else {
      setNotice("Workout removed");
      setWorkouts((current) => current.filter((item) => item.id !== id));
    }
  }

  const sectionTitle =
    section === "dashboard"
      ? "Log"
      : section === "progress"
        ? "Progress"
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
      <section className="main-panel">
        <header className="topbar">
          <div className="topbar-title">
            <span>{sectionTitle}</span>
            <small>Momentum</small>
          </div>
        </header>

        <div className="content-wrap">
          {loading ? (
            <ContentSkeleton />
          ) : loadError ? (
            <div className="quiet-empty" role="alert">
              <strong>Could not load your journal</strong>
              <p>{loadError}</p>
              <button
                type="button"
                className="primary-button"
                onClick={() => void loadData()}
              >
                Try again
              </button>
            </div>
          ) : section === "dashboard" ? (
            <LogPage
              workouts={workouts}
              exercises={exercises}
              onLog={openWorkoutPicker}
              onWeight={() => setWeightModal(true)}
              onOpen={(id) => {
                setSelectedExerciseId(id);
                navigate("workouts");
              }}
            />
          ) : section === "progress" ? (
            <Dashboard
              weights={weights}
              workouts={workouts}
              activity={activityForMonth(workouts)}
              onLogWeight={() => setWeightModal(true)}
              onExercises={() => navigate("workouts")}
            />
          ) : section === "workouts" ? (
            <ExercisesPage
              bodyParts={bodyParts}
              exercises={visibleExercises}
              allExercises={exercises}
              hiddenExercises={exercises.filter((exercise) => hiddenExerciseIds.has(exercise.id))}
              workouts={workouts}
              selectedExerciseId={selectedExerciseId}
              onSelect={setSelectedExerciseId}
              onLog={(id) => beginWorkout(id)}
              onEdit={(log) => beginWorkout(log.exercise_id, log)}
              onDelete={deleteWorkout}
              onCustom={() => setCustomModal(true)}
              onRemove={hideExercise}
              onRestore={restoreExercise}
            />
          ) : section === "friends" ? (
            <FriendsPage user={user} exercises={exercises} onNotice={setNotice} />
          ) : section === "groups" ? (
            <GroupsPage userId={user.id} initialInviteCode={initialInviteCode} onNotice={setNotice} />
          ) : section === "leaderboard" ? (
            <LeaderboardPage userId={user.id} />
          ) : (
            <><ProfileSettings
              userId={user.id}
              email={user.email ?? ""}
              username={profileUsername}
              displayName={profileDisplayName}
              theme={theme}
              onThemeChange={setTheme}
              onSaved={(profile) => {
                setProfileUsername(profile.username);
                setProfileDisplayName(profile.displayName);
              }}
              onNotice={setNotice}
            /><div className="profile-secondary-actions"><button type="button" className="text-button" onClick={() => navigate("groups")}>Groups</button><button type="button" className="text-button" onClick={() => void supabase.auth.signOut()}><LogOut size={16} /> Sign out</button></div></>
          )}
        </div>
      </section>

      <nav className="mobile-nav" aria-label="Primary navigation">
        <NavButton
          active={section === "dashboard"}
          icon={<Dumbbell size={19} />}
          label="Log"
          onClick={() => navigate("dashboard")}
        />
        <NavButton
          active={section === "progress" || section === "workouts"}
          icon={<ChartNoAxesCombined size={19} />}
          label="Progress"
          onClick={() => navigate("progress")}
        />
        <NavButton
          active={section === "leaderboard"}
          icon={<Trophy size={19} />}
          label="Leaderboard"
          onClick={() => navigate("leaderboard")}
        />
        <NavButton
          active={section === "friends"}
          icon={<Users size={19} />}
          label="Friends"
          onClick={() => navigate("friends")}
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
          exercises={visibleExercises}
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
      {installOnboardingOpen ? (
        <InstallOnboarding onClose={() => setInstallOnboardingOpen(false)} />
      ) : null}
    </main>
  );
}


function activityForMonth(workouts: WorkoutLog[]): ActivityDay[] {
  const { start, end } = getCalendarMonthBounds();
  const byDate = new Map<string, Set<string>>();
  for (const log of workouts) {
    if (log.logged_at < start || log.logged_at > end) continue;
    const exercises = byDate.get(log.logged_at) ?? new Set<string>();
    exercises.add(log.exercise_id);
    byDate.set(log.logged_at, exercises);
  }
  const days: ActivityDay[] = [];
  const date = new Date(start + "T12:00:00");
  while (localDateIso(date) <= end) {
    const key = localDateIso(date);
    const count = byDate.get(key)?.size ?? 0;
    days.push({ activity_date: key, exercise_count: count, activity_level: count === 0 ? 0 : count <= 3 ? 1 : count <= 5 ? 2 : 3 });
    date.setDate(date.getDate() + 1);
  }
  return days;
}

function LogPage({ workouts, exercises, onLog, onWeight, onOpen }: {
  workouts: WorkoutLog[]; exercises: Exercise[]; onLog: () => void;
  onWeight: () => void; onOpen: (id: string) => void;
}) {
  const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const todayCount = workouts.filter((log) => log.logged_at === todayIso()).length;
  return <div className="log-page">
    <header className="page-header"><div>
      <p className="section-label">{formatDate(todayIso(), true)}</p>
      <h1>{workouts.length ? "Make time for you." : "Your first workout starts here."}</h1>
      <p>{todayCount ? `${todayCount} ${todayCount === 1 ? "entry" : "entries"} logged today. Keep it going.` : "Choose an exercise. Add your sets. Done."}</p>
    </div></header>
    <button type="button" className="primary-button log-primary" onClick={onLog}><Plus size={20} />{workouts.length ? "Log workout" : "Log your first workout"}</button>
    <button type="button" className="text-button log-weight" onClick={onWeight}><Scale size={16} /> Log body weight</button>
    {workouts.length ? <section className="log-recent" aria-labelledby="recent-log-title">
      <h2 id="recent-log-title">Recent workouts</h2>
      {workouts.slice(0, 3).map((log) => <button type="button" className="activity-row" key={log.id} onClick={() => onOpen(log.exercise_id)}>
        <span className="activity-name"><strong>{exerciseById.get(log.exercise_id)?.name ?? "Exercise"}</strong><small>{formatDate(log.logged_at, true)} · {log.sets} × {log.reps}</small></span>
        <span className="activity-weight">{formatWorkoutLoad(log.weight_kg)}</span><ChevronRight size={16} />
      </button>)}
    </section> : <p className="log-first-note">Start with one exercise. You can add the rest as you train.</p>}
  </div>;
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
  activity,
  onLogWeight,
  onExercises,
}: {
  weights: BodyWeightLog[];
  workouts: WorkoutLog[];
  activity: ActivityDay[];
  onLogWeight: () => void;
  onExercises: () => void;
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
    visibleWeights.length > 1 && firstVisibleWeight !== undefined
      ? visibleWeights.at(-1)!.value - firstVisibleWeight
      : null;
  const streak = currentStreak(workouts);

  return (
    <>
      <header className="page-header dashboard-header">
        <div>
          <h1>Your progress</h1><p>A little work, adding up.</p>
        </div>
        <div className="page-actions">
          <button type="button" className="secondary-button" onClick={onLogWeight}>
            <Scale size={16} />
            Log weight
          </button>
          <button type="button" className="text-button" onClick={onExercises}>Exercise history <ChevronRight size={16} /></button>
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

      <details className="progress-disclosure"><summary>Training calendar</summary><ActivityGrid activity={activity} /></details>

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


    </>
  );
}

function ExercisesPage({
  bodyParts,
  exercises,
  allExercises,
  hiddenExercises,
  workouts,
  selectedExerciseId,
  onSelect,
  onLog,
  onEdit,
  onDelete,
  onCustom,
  onRemove,
  onRestore,
}: {
  bodyParts: BodyPart[];
  exercises: Exercise[];
  allExercises: Exercise[];
  hiddenExercises: Exercise[];
  workouts: WorkoutLog[];
  selectedExerciseId: string;
  onSelect: (id: string) => void;
  onLog: (id: string) => void;
  onEdit: (log: WorkoutLog) => void;
  onDelete: (id: string) => void;
  onCustom: () => void;
  onRemove: (exercise: Exercise) => Promise<void>;
  onRestore: (exerciseId: string) => Promise<void>;
}) {
  const selected = allExercises.find((item) => item.id === selectedExerciseId);
  const selectedIsHidden = Boolean(
    selected && hiddenExercises.some((exercise) => exercise.id === selected.id),
  );
  const [part, setPart] = useState(
    selected?.body_part_id ?? bodyParts[0]?.id ?? "",
  );
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<RangeKey>("3M");
  const [removedOpen, setRemovedOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(!selected);

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
        <div className="page-actions">
          {hiddenExercises.length ? (
            <button type="button" className="secondary-button" onClick={() => setRemovedOpen(true)}>
              Removed ({hiddenExercises.length})
            </button>
          ) : null}
          <button type="button" className="secondary-button" onClick={onCustom}>
            <Plus size={16} />
            Custom exercise
          </button>
        </div>
      </header>

      <div className="exercise-layout">
        <details className="exercise-browser" open={browserOpen} onToggle={(event) => setBrowserOpen(event.currentTarget.open)}><summary>Change exercise</summary>
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
                  onClick={() => { onSelect(item.id); setBrowserOpen(false); }}
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
        </details>

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
                <div className="detail-actions">
                  {selectedIsHidden ? (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => void onRestore(selected.id)}
                    >
                      Restore
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="secondary-button exercise-remove-button"
                      onClick={() => void onRemove(selected)}
                    >
                      <Trash2 size={15} />
                      Remove
                    </button>
                  )}
                  {!selectedIsHidden ? (
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => onLog(selected.id)}
                    >
                      <Plus size={16} />
                      Log set
                    </button>
                  ) : null}
                </div>
              </div>

              <dl className="detail-stats">
                <div><dt>Personal best</dt><dd>{personalBest !== null ? `${personalBest} kg` : "-"}</dd></div>
                <div><dt>Last session</dt><dd>{last ? formatDate(last.logged_at, true) : "-"}</dd></div>
                <div><dt>Total entries</dt><dd>{exerciseLogs.length}</dd></div>
              </dl>

              <details className="journal-section exercise-chart-card"><summary>Progress chart</summary>
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
              </details>

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
      {removedOpen ? (
        <RemovedExercisesModal
          exercises={hiddenExercises}
          onClose={() => setRemovedOpen(false)}
          onRestore={onRestore}
        />
      ) : null}
    </>
  );
}

function RemovedExercisesModal({
  exercises,
  onClose,
  onRestore,
}: {
  exercises: Exercise[];
  onClose: () => void;
  onRestore: (exerciseId: string) => Promise<void>;
}) {
  const [busyId, setBusyId] = useState("");

  async function restore(exerciseId: string) {
    setBusyId(exerciseId);
    await onRestore(exerciseId);
    setBusyId("");
  }

  return (
    <ModalFrame
      title="Removed exercises"
      subtitle="Restore an exercise whenever you want it back in your library."
      onClose={onClose}
    >
      <div className="removed-exercise-list">
        {exercises.map((exercise) => (
          <div className="request-row" key={exercise.id}>
            <span>
              <strong>{exercise.name}</strong>
              <small>{exercise.is_bodyweight ? "Bodyweight" : "Weighted exercise"}</small>
            </span>
            <button
              type="button"
              className="icon-text-button accept"
              disabled={Boolean(busyId)}
              onClick={() => void restore(exercise.id)}
            >
              {busyId === exercise.id ? "Restoring..." : "Restore"}
            </button>
          </div>
        ))}
      </div>
    </ModalFrame>
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
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    if (dialog && !dialog.contains(document.activeElement)) dialog.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeRef.current();
      if (event.key === "Tab" && dialog) {
        const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex="0"]')].filter((element) => element.getClientRects().length > 0);
        const first = focusable[0]; const last = focusable.at(-1);
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) { event.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      previouslyFocused?.focus();
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

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
        ref={dialogRef}
        tabIndex={-1}
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
  const [query, setQuery] = useState("");
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

  const options = query.trim() ? exercises.filter((exercise) => exercise.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8) : recentExercises.length ? recentExercises : exercises.slice(0, 6);

  return (
    <ModalFrame
      title="Choose exercise"
      subtitle="Search for the movement you are doing."
      onClose={onClose}
    >
      <label className="picker-search"><span className="sr-only">Search exercises</span><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search exercises" autoComplete="off" /></label>
      {options.length ? (
        <div className="workout-picker-list" aria-label="Recent exercises">
          <p className="section-label">{query ? "Matching exercises" : recentExercises.length ? "Recent exercises" : "Exercise library"}</p>
          {options.map((exercise) => (
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
      {!options.length ? <p className="friend-empty">No matching exercises. Open the library to add your own.</p> : null}
      <div className="modal-actions standalone">
        <button type="button" className="secondary-button" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="text-button" onClick={onBrowse}>
          Manage exercise library
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
        <details className="entry-options" open={Boolean(existing?.notes)}><summary>Add notes</summary><label>
          <span className="sr-only">Notes (optional)</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={500}
            enterKeyHint="done"
            placeholder="Anything worth remembering?"
          />
        </label></details>
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

