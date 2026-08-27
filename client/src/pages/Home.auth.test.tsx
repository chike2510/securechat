// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  value: {
    user: { id: 1, name: "Ada FUPRE", email: "ada@example.com" },
    loading: false,
    isAuthenticated: true,
    databaseProfileReady: true,
    logout: vi.fn(),
  },
}));

const themeState = vi.hoisted(() => ({ theme: "light" as "light" | "dark", toggleTheme: vi.fn() }));
const directoryState = vi.hoisted(() => ({ people: [] as Array<{ id: number; name: string; username: string; friendRequestStatus: "pending" | "accepted" | null }>, requestResult: { requestId: 2, status: "pending" as const, alreadyPending: false } }));
const workspaceState = vi.hoisted(() => ({ conversations: [] as any[], messages: [] as any[] }));
const mutation = () => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue(1), isPending: false });
const query = () => ({ data: [], isLoading: false, error: null });

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => authState.value }));
vi.mock("@/contexts/ThemeContext", () => ({ useTheme: () => themeState }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      secureChat: {
        messages: { invalidate: vi.fn() },
        conversations: { invalidate: vi.fn() },
        notifications: { invalidate: vi.fn() },
      },
    }),
    secureChat: {
      setPublicKey: { useMutation: mutation },
      openConversation: { useMutation: mutation },
      requestMessage: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockImplementation(() => Promise.resolve(directoryState.requestResult)), isPending: false }) },
      sendEncryptedMessage: { useMutation: mutation },
      uploadEncryptedAttachment: { useMutation: mutation },
      updateMessageStatus: { useMutation: mutation },
      presence: { useMutation: mutation },
      updatePrivacy: { useMutation: mutation },
      respondToMessageRequest: { useMutation: mutation },
      unblockUser: { useMutation: mutation },
      blockUser: { useMutation: mutation },
      setConversationPreference: { useMutation: mutation },
      createGroup: { useMutation: mutation },
      conversations: { useQuery: () => ({ data: workspaceState.conversations, isLoading: false, error: null }) },
      searchUsers: { useQuery: () => ({ data: directoryState.people, isLoading: false, error: null }) },
      friendProfile: { useQuery: query },
      messages: { useQuery: () => ({ data: workspaceState.messages, isLoading: false, error: null }) },
      notifications: { useQuery: query },
      profileSettings: { useQuery: query },
      updateProfile: { useMutation: mutation },
      messageRequests: { useQuery: query },
      blockedUsers: { useQuery: query },
      downloadEncryptedAttachment: { useQuery: () => ({ ...query(), refetch: vi.fn() }) },
      readNotification: { useMutation: mutation },
    },
  },
}));
vi.mock("@/lib/crypto", () => ({
  decryptMessage: vi.fn(),
  encryptMessage: vi.fn(),
  ensureIdentity: vi.fn().mockResolvedValue("public-key"),
  isEncryptedPayload: vi.fn(),
}));
vi.mock("socket.io-client", () => ({
  io: () => ({ on: vi.fn(), disconnect: vi.fn(), emit: vi.fn() }),
}));

describe("Home authenticated handoff", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => {
    cleanup();
    authState.value = { user: { id: 1, name: "Ada FUPRE", email: "ada@example.com" }, loading: false, isAuthenticated: true, databaseProfileReady: true, logout: vi.fn() };
    directoryState.people = [];
    directoryState.requestResult = { requestId: 2, status: "pending", alreadyPending: false };
    workspaceState.conversations = [];
    workspaceState.messages = [];
  });

  it("renders the chat workspace when OTP verification has produced an authenticated user", async () => {
    const { default: Home } = await import("./Home");
    render(<Home />);
    expect(screen.getByRole("heading", { name: "Messages" })).toBeTruthy();
    expect(screen.queryByText("Welcome back")).toBeNull();
    expect(screen.queryByText("University communications / v1.0")).toBeNull();
    expect(screen.queryByText("Local key")).toBeNull();
    expect(screen.getByRole("button", { name: /new group/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Use dark mode" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Find friend" }));
    expect(screen.getByText("Other people on SecureChat")).toBeTruthy();
  });

  it("shows only the SecureChat logo while the authenticated workspace is loading", async () => {
    authState.value = { user: { id: 1, name: "Ada FUPRE", email: "ada@example.com" }, loading: true, isAuthenticated: true, databaseProfileReady: true, logout: vi.fn() };
    const { default: Home } = await import("./Home");
    render(<Home />);

    expect(screen.getByRole("status", { name: "Loading SecureChat" }).querySelector('img[alt="SecureChat"]')).toBeTruthy();
    expect(screen.queryByText("Loading SecureChat")).toBeNull();
  });

  it("opens a profile menu without signing out until sign out is explicitly chosen", async () => {
    const logout = vi.fn();
    authState.value = { user: { id: 1, name: "Ada FUPRE", email: "ada@example.com" }, loading: false, isAuthenticated: true, databaseProfileReady: true, logout };
    const { default: Home } = await import("./Home");
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Open profile menu" }));
    expect(logout).not.toHaveBeenCalled();
    expect(screen.getByText("ada@example.com")).toBeTruthy();
    expect(screen.getByText("Friend requests")).toBeTruthy();
    expect(screen.getByText("Profile & settings")).toBeTruthy();

    fireEvent.click(screen.getByText("Profile & settings"));
    expect(screen.getByRole("heading", { name: "Your profile" })).toBeTruthy();
    expect(screen.getByText("Illustrated avatar")).toBeTruthy();
    expect(screen.getByText(/upload picture/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Choose ink avatar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Choose mint avatar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Choose rose avatar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Choose violet avatar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back to chat" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("shows a public username instead of an email in Find friend", async () => {
    directoryState.people = [{ id: 2, name: "Elisha Onovo", username: "elisha", friendRequestStatus: null }];
    const { default: Home } = await import("./Home");
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: "Find friend" }));
    expect(screen.getByText("@elisha")).toBeTruthy();
    expect(screen.queryByText("elisha@example.com")).toBeNull();
  });

  it("renders the mockup-aligned direct-chat structure for a selected conversation", async () => {
    workspaceState.conversations = [{ conversationId: 7, kind: "direct", title: null, peer: { id: 2, name: "Elisha Onovo", username: "elisha", profileImageUrl: null, isOnline: true, publicKey: "peer-key" }, pinned: false, muted: false, hidden: false }];
    const { default: Home } = await import("./Home");
    render(<Home />);

    fireEvent.click(screen.getByRole("button", { name: /Elisha Onovo/ }));
    expect(screen.getAllByText("SecureChat").length).toBeGreaterThan(0);
    expect(screen.getByText("@elisha")).toBeTruthy();
    expect(screen.getAllByText("Private chat").length).toBe(2);
    expect(screen.getByPlaceholderText("Write a message")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Attach encrypted file" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Record voice note" })).toBeTruthy();
    expect(screen.getByText("Encrypted on this device before sending")).toBeTruthy();
  });

  it("keeps a verified user inside a truthful workspace state while the message database is unavailable", async () => {
    authState.value = { user: { id: -1, name: "Ada FUPRE", email: "ada@example.com" }, loading: false, isAuthenticated: true, databaseProfileReady: false, logout: vi.fn() };
    const { default: Home } = await import("./Home");
    render(<Home />);
    expect(screen.getByText("You are signed in.")).toBeTruthy();
    expect(screen.queryByText("Welcome back")).toBeNull();
  });
});
