import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";
import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

function sessionWorkspaceUser(session: Session | null) {
  if (!session) return null;
  const metadata = session.user.user_metadata as { name?: unknown; username?: unknown; matricNumber?: unknown; matric_number?: unknown };
  return {
    id: -1,
    openId: session.user.id,
    name: typeof metadata.name === "string" ? metadata.name : session.user.email ?? "University user",
    username: typeof metadata.username === "string" ? metadata.username : null,
    email: session.user.email ?? null,
    universityEmail: session.user.email ?? null,
    matricNumber: typeof metadata.matricNumber === "string" ? metadata.matricNumber : typeof metadata.matric_number === "string" ? metadata.matric_number : "PENDING",
    role: "user" as const,
    isProfilePending: true as const,
  };
}

export function useAuth() {
  const utils = trpc.useUtils();
  const [sessionReady, setSessionReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: sessionReady,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session ?? null);
    }).finally(() => {
      if (active) setSessionReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        setSession(nextSession ?? null);
        void meQuery.refetch();
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [meQuery.refetch]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    utils.auth.me.setData(undefined, null);
    await utils.auth.me.invalidate();
  }, [utils]);

  const profileUser = meQuery.data ?? null;
  const workspaceUser = profileUser ?? sessionWorkspaceUser(session);
  const profileLoading = Boolean(session) && Boolean(meQuery.isPending);

  return {
    user: workspaceUser,
    loading: !sessionReady || (!session && meQuery.isLoading) || profileLoading,
    error: meQuery.error ?? null,
    isAuthenticated: Boolean(session),
    databaseProfileReady: Boolean(profileUser),
    refresh: () => meQuery.refetch(),
    logout,
  };
}
