import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";
import { useCallback, useEffect, useState } from "react";

export function useAuth() {
  const utils = trpc.useUtils();
  const [sessionReady, setSessionReady] = useState(false);
  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: sessionReady,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().finally(() => {
      if (active) setSessionReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      if (active) void meQuery.refetch();
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [meQuery.refetch]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    utils.auth.me.setData(undefined, null);
    await utils.auth.me.invalidate();
  }, [utils]);

  return {
    user: meQuery.data ?? null,
    loading: !sessionReady || meQuery.isLoading,
    error: meQuery.error ?? null,
    isAuthenticated: Boolean(meQuery.data),
    refresh: () => meQuery.refetch(),
    logout,
  };
}
