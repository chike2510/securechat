// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  signUp: vi.fn(),
  verifyOtp: vi.fn(),
  resend: vi.fn(),
  meInvalidate: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseConfigured: true,
  supabase: { auth: authMocks },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ auth: { me: { invalidate: authMocks.meInvalidate } } }),
    auth: { signInWithMatric: { useMutation: () => ({ mutateAsync: vi.fn() }) } },
  },
}));

vi.mock("sonner", () => ({
  toast: { success: authMocks.toastSuccess, error: authMocks.toastError },
}));

import AuthLanding from "./AuthLanding";

function completeRegistrationForm() {
  fireEvent.click(screen.getByRole("button", { name: "Create a new account" }));
  fireEvent.change(screen.getByPlaceholderText("Name"), { target: { value: "Ada FUPRE" } });
  fireEvent.change(screen.getByPlaceholderText("Username"), { target: { value: "ada.fupre" } });
  fireEvent.change(screen.getByPlaceholderText("Matric number"), { target: { value: "CSC/2024/001" } });
  fireEvent.change(screen.getByPlaceholderText("Email address"), { target: { value: "ada@example.com" } });
  fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: "password123" } });
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
}

describe("AuthLanding email OTP flow", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
    authMocks.verifyOtp.mockResolvedValue({ data: { session: null }, error: new Error("Invalid token") });
    authMocks.resend.mockResolvedValue({ error: null });
  });

  it("opens the OTP state only after signup succeeds", async () => {
    render(<AuthLanding />);
    completeRegistrationForm();

    expect(await screen.findByText("Confirm your email")).toBeTruthy();
    expect(screen.getByText(/ada@example.com/)).toBeTruthy();
    expect(authMocks.signUp).toHaveBeenCalledOnce();
    expect(authMocks.signUp).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ data: expect.objectContaining({ username: "ada.fupre" }) }) }));
    expect(screen.queryByText("Account created. Check your email")).toBeNull();
  });

  it("requires eight digits, sanitizes input, and supports resend", async () => {
    render(<AuthLanding />);
    completeRegistrationForm();
    await screen.findByText("Confirm your email");

    const codeInput = screen.getByPlaceholderText("8-digit confirmation code");
    const verifyButton = screen.getByRole("button", { name: "Verify email" }) as HTMLButtonElement;
    expect(verifyButton.disabled).toBe(true);

    fireEvent.change(codeInput, { target: { value: "12a 34567890" } });
    expect((codeInput as HTMLInputElement).value).toBe("12345678");
    expect(verifyButton.disabled).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Resend code" }));
    await waitFor(() => expect(authMocks.resend).toHaveBeenCalledWith({ type: "signup", email: "ada@example.com" }));
  });

  it("shows a verification error when Supabase rejects the code", async () => {
    render(<AuthLanding />);
    completeRegistrationForm();
    await screen.findByText("Confirm your email");
    fireEvent.change(screen.getByPlaceholderText("8-digit confirmation code"), { target: { value: "12345678" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify email" }));

    await waitFor(() => expect(authMocks.toastError).toHaveBeenCalledWith("Invalid token"));
    expect(authMocks.verifyOtp).toHaveBeenCalledWith({ email: "ada@example.com", token: "12345678", type: "signup" });
  });

  it("hands a verified session back to auth.me without reloading the page", async () => {
    authMocks.verifyOtp.mockResolvedValueOnce({ data: { session: { access_token: "access", refresh_token: "refresh" } }, error: null });
    render(<AuthLanding />);
    completeRegistrationForm();
    await screen.findByText("Confirm your email");
    fireEvent.change(screen.getByPlaceholderText("8-digit confirmation code"), { target: { value: "12345678" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify email" }));

    await waitFor(() => expect(authMocks.meInvalidate).toHaveBeenCalledOnce());
    expect(authMocks.toastSuccess).toHaveBeenCalledWith("Email confirmed. Welcome to SecureChat.");
  });
});
