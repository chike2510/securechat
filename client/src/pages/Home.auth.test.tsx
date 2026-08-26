// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  value: {
    user: { id: 1, name: "Ada FUPRE", email: "ada@example.com" },
    loading: false,
    isAuthenticated: true,
    logout: vi.fn(),
  },
}));

const mutation = () => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue(1), isPending: false });
const query = () => ({ data: [], isLoading: false, error: null });

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => authState.value }));
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
      sendEncryptedMessage: { useMutation: mutation },
      updateMessageStatus: { useMutation: mutation },
      presence: { useMutation: mutation },
      conversations: { useQuery: query },
      searchUsers: { useQuery: query },
      messages: { useQuery: query },
      notifications: { useQuery: query },
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

  it("renders the chat workspace when OTP verification has produced an authenticated user", async () => {
    const { default: Home } = await import("./Home");
    render(<Home />);
    expect(screen.getByRole("heading", { name: "Messages" })).toBeTruthy();
    expect(screen.queryByText("Welcome back")).toBeNull();
  });
});
