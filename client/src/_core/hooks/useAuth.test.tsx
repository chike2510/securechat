// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
  refetch: vi.fn(),
  useQuery: vi.fn(),
  setData: vi.fn(),
  invalidate: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: authMocks },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ auth: { me: { setData: authMocks.setData, invalidate: authMocks.invalidate } } }),
    auth: { me: { useQuery: authMocks.useQuery } },
  },
}));

import { useAuth } from "./useAuth";

describe("useAuth session hydration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.useQuery.mockReturnValue({ data: null, isLoading: false, error: null, refetch: authMocks.refetch });
    authMocks.refetch.mockResolvedValue({ data: null });
    authMocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  });

  it("does not query auth.me before Supabase restores the session", async () => {
    let resolveSession!: (value: unknown) => void;
    authMocks.getSession.mockReturnValue(new Promise(resolve => { resolveSession = resolve; }));

    renderHook(() => useAuth());
    expect(authMocks.useQuery).toHaveBeenCalledWith(undefined, expect.objectContaining({ enabled: false }));

    const restoredSession = { data: { session: { access_token: "token", user: { id: "user-id", email: "ada@example.com", user_metadata: {} } } } };
    await act(async () => resolveSession(restoredSession));
    await waitFor(() => expect(authMocks.useQuery).toHaveBeenLastCalledWith(undefined, expect.objectContaining({ enabled: true })));
  });

  it("refetches auth.me when Supabase reports an auth-state change", async () => {
    let authStateListener!: () => void;
    authMocks.getSession.mockResolvedValue({ data: { session: null } });
    authMocks.onAuthStateChange.mockImplementation((_callback: () => void) => {
      authStateListener = _callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    renderHook(() => useAuth());
    await waitFor(() => expect(authMocks.useQuery).toHaveBeenLastCalledWith(undefined, expect.objectContaining({ enabled: true })));

    await act(async () => authStateListener());
    expect(authMocks.refetch).toHaveBeenCalledOnce();
  });

  it("keeps a verified Supabase session authenticated while the database profile is unavailable", async () => {
    authMocks.getSession.mockResolvedValue({ data: { session: { access_token: "token", user: { id: "user-id", email: "ada@example.com", user_metadata: { name: "Ada FUPRE", matricNumber: "FUPRE/2020/001" } } } } });
    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.databaseProfileReady).toBe(false);
    expect(result.current.user).toMatchObject({ id: -1, name: "Ada FUPRE", email: "ada@example.com", isProfilePending: true });
  });
});
