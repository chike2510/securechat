// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  openConversation: vi.fn().mockResolvedValue(77),
  requestMessage: vi.fn(),
  onConversationOpen: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    secureChat: {
      friendProfile: { useQuery: () => ({ data: { id: 2, name: "Adaeze Okafor", username: "adaeze", avatarStyle: "violet", isOnline: true, relationship: "friends" }, isLoading: false, refetch: vi.fn() }) },
      requestMessage: { useMutation: () => ({ mutateAsync: mocks.requestMessage, isPending: false }) },
      openConversation: { useMutation: () => ({ mutateAsync: mocks.openConversation, isPending: false }) },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { FriendProfileDialog } from "./FriendProfileDialog";

describe("FriendProfileDialog", () => {
  it("shows a username without an email and opens an accepted friend chat from Message", async () => {
    render(<FriendProfileDialog userId={2} open onOpenChange={vi.fn()} onConversationOpen={mocks.onConversationOpen} />);
    expect(screen.getByText("@adaeze")).toBeTruthy();
    expect(screen.queryByText(/@.*gmail|@.*yahoo/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Message" }));
    await waitFor(() => expect(mocks.openConversation).toHaveBeenCalledWith({ userId: 2 }));
    expect(mocks.onConversationOpen).toHaveBeenCalledWith(77);
  });
});
