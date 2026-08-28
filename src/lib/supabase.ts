import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://bfqdlggxzwdjxjqkdulk.supabase.co";
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_obceQdneHSi8Gw9Pgjvxhw_yevgws9d";

export const supabase = createClient(supabaseUrl, supabasePublishableKey);


