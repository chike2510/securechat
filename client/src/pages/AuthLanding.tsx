import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useState } from "react";
import { ArrowUpRight, LockKeyhole, ShieldCheck } from "lucide-react";

export default function AuthLanding() {
  const [registering, setRegistering] = useState(false);
  const [matricNumber, setMatricNumber] = useState("");
  const [universityEmail, setUniversityEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const utils = trpc.useUtils();
  const loginMutation = trpc.auth.login.useMutation({ onSuccess: () => utils.auth.me.invalidate() });
  const registerMutation = trpc.auth.register.useMutation({ onSuccess: () => utils.auth.me.invalidate() });
  const busy = loginMutation.isPending || registerMutation.isPending;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (registering) await registerMutation.mutateAsync({ matricNumber, universityEmail, name, password });
      else await loginMutation.mutateAsync({ matricNumber, password });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Authentication failed"); }
  };
  return <main className="min-h-screen blueprint-bg flex items-center justify-center p-6"><div className="max-w-6xl w-full grid lg:grid-cols-[1fr_420px] gap-12 items-center"><div><div className="flex items-center gap-3 mb-12"><div className="h-10 w-10 bg-[#101722] text-white grid place-items-center font-mono font-bold">SC</div><span className="font-black text-xl tracking-tight">SecureChat</span></div><p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500 mb-5">Protected academic communications</p><h1 className="text-6xl md:text-8xl font-black tracking-[-0.08em] leading-[.86]">Messages.<br /><span className="text-[#ff4f87]">Not</span> surveillance.</h1><p className="max-w-lg text-slate-600 mt-8 text-lg leading-relaxed">A focused prototype for private university messaging. Sign in with your matric-based student account; messages are encrypted in your browser before transmission.</p><div className="mt-8 flex flex-wrap gap-3 font-mono text-[10px] uppercase tracking-widest text-slate-500"><span className="bg-[#c8f7f1] px-3 py-2">AES-GCM</span><span className="bg-[#ffd7e5] px-3 py-2">participant scoped</span><span className="bg-white border border-slate-900/10 px-3 py-2">ciphertext only</span></div></div><div className="bg-white/90 border border-slate-900/15 shadow-2xl p-6 md:p-8"><div className="flex items-center justify-between mb-7"><div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">Identity gate / 01</p><h2 className="text-2xl font-black tracking-tight mt-2">{registering ? "Create account" : "Welcome back"}</h2></div><LockKeyhole className="h-5 w-5 text-slate-400" /></div><form onSubmit={submit} className="space-y-4">{registering && <><Input required value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className="rounded-sm h-11" /><Input required type="email" value={universityEmail} onChange={e => setUniversityEmail(e.target.value)} placeholder="Your normal student email" className="rounded-sm h-11" /></>}<Input required value={matricNumber} onChange={e => setMatricNumber(e.target.value)} placeholder="Matric number" className="rounded-sm h-11 font-mono" /><Input required minLength={8} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password (8+ characters)" className="rounded-sm h-11" /><Button disabled={busy} className="w-full rounded-sm h-11 bg-[#101722] hover:bg-[#283342]">{busy ? "Verifying..." : registering ? "Create secure account" : "Sign in securely"}<ArrowUpRight className="ml-2 h-4 w-4" /></Button></form><button onClick={() => setRegistering(value => !value)} className="w-full mt-5 text-sm text-slate-500 hover:text-[#101722]">{registering ? "Already registered? Sign in" : "New university user? Create an account"}</button><div className="mt-7 pt-5 border-t border-slate-900/10 flex gap-2 text-[11px] text-slate-500 leading-relaxed"><ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" /><span>Matric number identity and signed HTTP-only sessions are enforced on the server.</span></div></div></div></main>;
}
