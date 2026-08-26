import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { isEightDigitOtp, normalizeOtp } from "../../../shared/auth";
import { toast } from "sonner";
import { ArrowUpRight, LockKeyhole, MailCheck } from "lucide-react";

function friendlyAuthError(message: string) {
  if (message.toLowerCase().includes("already registered")) return "That email is already registered. Try signing in.";
  if (message.toLowerCase().includes("invalid login credentials")) return "Email or password is incorrect.";
  if (message.toLowerCase().includes("email not confirmed")) return "Confirm your email before signing in.";
  if (message.toLowerCase().includes("failed to fetch")) return "SecureChat cannot reach the authentication service right now.";
  return message || "Could not complete that request.";
}

export default function AuthLanding() {
  const [registering, setRegistering] = useState(false);
  const [matricNumber, setMatricNumber] = useState("");
  const [email, setEmail] = useState("");
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState("");
  const utils = trpc.useUtils();
  const signInWithMatric = trpc.auth.signInWithMatric.useMutation();

  const verifyEmailCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: pendingVerificationEmail,
        token: verificationCode,
        type: "signup",
      });
      if (error) throw error;
      if (!data.session) throw new Error("That code was accepted, but no SecureChat session was returned.");
      await utils.auth.me.invalidate();
      toast.success("Email confirmed. Welcome to SecureChat.");
    } catch (error) {
      toast.error(friendlyAuthError(error instanceof Error ? error.message : ""));
    } finally {
      setBusy(false);
    }
  };

  const resendEmailCode = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: pendingVerificationEmail });
      if (error) throw error;
      toast.success("A new confirmation code has been sent.");
    } catch (error) {
      toast.error(friendlyAuthError(error instanceof Error ? error.message : ""));
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabaseConfigured) {
      toast.error("Authentication is not configured for this deployment yet.");
      return;
    }
    setBusy(true);
    try {
      if (registering) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/confirmed`,
            data: { name: name.trim(), matricNumber: matricNumber.trim().toUpperCase() },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setPendingVerificationEmail(email.trim().toLowerCase());
          setVerificationCode("");
          setVerificationOpen(true);
          setPassword("");
        } else {
          await utils.auth.me.invalidate();
          toast.success("Account created.");
        }
      } else {
        const identifier = loginIdentifier.trim();
        if (identifier.includes("@")) {
          const { error } = await supabase.auth.signInWithPassword({ email: identifier.toLowerCase(), password });
          if (error) throw error;
        } else {
          const result = await signInWithMatric.mutateAsync({ matricNumber: identifier, password });
          if ("error" in result) throw new Error(friendlyAuthError(result.error ?? "Email or password is incorrect."));
          const { error } = await supabase.auth.setSession(result.session);
          if (error) throw error;
        }
        window.location.reload();
      }
    } catch (error) {
      toast.error(friendlyAuthError(error instanceof Error ? error.message : ""));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen blueprint-bg flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-5xl w-full grid lg:grid-cols-[1fr_410px] gap-8 lg:gap-16 items-center">
        <section className="order-2 lg:order-1 px-1 sm:px-4">
          <div className="flex items-center gap-3 mb-8 lg:mb-14">
            <div className="h-10 w-10 bg-[#101722] text-white grid place-items-center font-mono font-bold">SC</div>
            <span className="font-black text-xl tracking-tight">SecureChat</span>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-slate-500 mb-4">Private campus chat</p>
          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-[-0.08em] leading-[.88] max-w-2xl">
            Stay in<br /><span className="text-[#ff4f87]">touch.</span>
          </h1>
          <p className="max-w-md text-slate-600 mt-6 text-base sm:text-lg leading-relaxed">A simple place to chat with people you know at school.</p>
        </section>

        <section className="order-1 lg:order-2 bg-white/95 border border-slate-900/15 shadow-2xl p-5 sm:p-7">
          <div className="flex items-start justify-between mb-7">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">SecureChat</p>
              <h2 className="text-2xl font-black tracking-tight mt-2">{verificationOpen ? "Confirm your email" : registering ? "Create your account" : "Welcome back"}</h2>
            </div>
            <LockKeyhole className="h-5 w-5 text-slate-400" />
          </div>

          {verificationOpen ? (
            <form onSubmit={verifyEmailCode} className="space-y-4">
              <div className="rounded-sm bg-slate-50 border border-slate-900/10 p-4">
                <MailCheck className="h-5 w-5 text-[#ff4f87] mb-3" />
                <p className="text-sm text-slate-700">Enter the 8-digit code sent to <strong>{pendingVerificationEmail}</strong>.</p>
              </div>
              <Input required inputMode="numeric" pattern="[0-9]{8}" maxLength={8} value={verificationCode} onChange={event => setVerificationCode(normalizeOtp(event.target.value))} placeholder="8-digit confirmation code" className="rounded-sm h-11 font-mono tracking-[0.35em]" />
              <Button disabled={busy || !isEightDigitOtp(verificationCode)} className="w-full rounded-sm h-11 bg-[#101722] hover:bg-[#283342]">
                {busy ? "Verifying..." : "Verify email"}
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Button>
              <button type="button" disabled={busy} onClick={resendEmailCode} className="w-full text-sm text-slate-500 hover:text-[#101722]">Resend code</button>
              <button type="button" disabled={busy} onClick={() => setVerificationOpen(false)} className="w-full text-sm text-slate-400 hover:text-[#101722]">Use a different email</button>
            </form>
          ) : (
          <form onSubmit={submit} className="space-y-3.5">
            {registering && (
              <>
                <Input required value={name} onChange={event => setName(event.target.value)} placeholder="Name" className="rounded-sm h-11" />
                <Input required value={matricNumber} onChange={event => setMatricNumber(event.target.value)} placeholder="Matric number" className="rounded-sm h-11 font-mono" />
              </>
            )}
            {registering ? (
              <Input required type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Email address" className="rounded-sm h-11" />
            ) : (
              <Input required value={loginIdentifier} onChange={event => setLoginIdentifier(event.target.value)} placeholder="Matric number or email" className="rounded-sm h-11" />
            )}
            <Input required minLength={8} type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Password" className="rounded-sm h-11" />
            <Button disabled={busy} className="w-full rounded-sm h-11 bg-[#101722] hover:bg-[#283342]">
              {busy ? "Please wait..." : registering ? "Create account" : "Sign in"}
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
          )}

          {!verificationOpen && <button type="button" onClick={() => setRegistering(value => !value)} className="w-full mt-5 text-sm text-slate-500 hover:text-[#101722]">
            {registering ? "Already have an account? Sign in" : "Create a new account"}
          </button>}
          {!verificationOpen && <p className="mt-6 pt-4 border-t border-slate-900/10 text-xs text-slate-400">Sign in with your email or matric number.</p>}
        </section>
      </div>
    </main>
  );
}
