import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { GroupWeeklyCompetition } from "@/lib/groupWeeklyCompetition";

export async function getGroupWeeklyCompetition(
  groupId: string,
  authorization: string,
): Promise<GroupWeeklyCompetition> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    ?? "https://bfqdlggxzwdjxjqkdulk.supabase.co";
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? "sb_publishable_obceQdneHSi8Gw9Pgjvxhw_yevgws9d";

  const token = authorization.slice("Bearer ".length).trim();
  const client = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  const { data: userData, error: userError } = await client.auth.getUser(token);
  if (userError || !userData.user) throw new CompetitionAccessError("Unauthorized", 401);

  const { data, error } = await client.rpc("get_group_weekly_competition", {
    target_group_id: groupId,
    reference_date: new Date().toISOString().slice(0, 10),
  });

  if (error) {
    const forbidden = /membership required/i.test(error.message);
    throw new CompetitionAccessError(
      forbidden ? "You must be a group member to view this competition." : "Could not load the weekly competition.",
      forbidden ? 403 : 500,
    );
  }

  return data as GroupWeeklyCompetition;
}

export class CompetitionAccessError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "CompetitionAccessError";
  }
}

