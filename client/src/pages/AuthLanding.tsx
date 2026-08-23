import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useState } from "react";
import { ArrowUpRight, LockKeyhole } from "lucide-react";

export default function AuthLanding() {
  const [registering, setRegistering] = useState(false);
  const [matricNumber, setMatricNumber] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const utils = trpc.useUtils();
  const loginMutation = trpc.auth.login.useMutation({ onSuccess: () => utils.auth.me.invalidate() });
  const registerMutation = trpc.auth.register.useMutation({ onSuccess: () => utils.auth.me.invalidate() });
  const busy = loginMutation.isPending || registerMutation.isPending;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (registering) {
        await registerMutation.mutateAsync({ matricNumber, universityEmail: email, name, password });
      } else {
        await loginMutation.mutateAsync({ matricNumber, password });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sign you in");
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
              <h2 className="text-2xl font-black tracking-tight mt-2">{registering ? "Create your account" : "Welcome back"}</h2>
            </div>
            <LockKeyhole className="h-5 w-5 text-slate-400" />
          </div>

          <form onSubmit={submit} className="space-y-3.5">
            {registering && (
              <>
                <Input required value={name} onChange={event => setName(event.target.value)} placeholder="Name" className="rounded-sm h-11" />
                <Input required type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="Email address" className="rounded-sm h-11" />
              </>
            )}
            <Input required value={matricNumber} onChange={event => setMatricNumber(event.target.value)} placeholder="Matric number" className="rounded-sm h-11 font-mono" />
            <Input required minLength={8} type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Password" className="rounded-sm h-11" />
            <Button disabled={busy} className="w-full rounded-sm h-11 bg-[#101722] hover:bg-[#283342]">
              {busy ? "Please wait..." : registering ? "Create account" : "Sign in"}
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          <button type="button" onClick={() => setRegistering(value => !value)} className="w-full mt-5 text-sm text-slate-500 hover:text-[#101722]">
            {registering ? "Already have an account? Sign in" : "Create a new account"}
          </button>
          <p className="mt-6 pt-4 border-t border-slate-900/10 text-xs text-slate-400">Use your matric number to sign in.</p>
        </section>
      </div>
    </main>
  );
}
