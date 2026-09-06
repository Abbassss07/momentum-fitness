"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { TrendingUp } from "lucide-react";
import { AuthScreen } from "@/components/AuthScreen";
import { FitnessApp } from "@/components/FitnessApp";
import { supabase } from "@/lib/supabase";

export function MomentumHome({ initialInviteCode }: { initialInviteCode?: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setAuthLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  if (authLoading) {
    return (
      <main className="loading-screen" aria-busy="true" aria-label="Loading Momentum">
        <span className="brand-mark" aria-hidden="true">
          <TrendingUp size={20} />
        </span>
        <span>Opening your journal...</span>
      </main>
    );
  }

  if (!user) return <AuthScreen onAuthenticated={setUser} />;
  return <FitnessApp key={user.id} user={user} initialInviteCode={initialInviteCode} />;
}

export default function Home() {
  return <MomentumHome />;
}



