import { Link } from "wouter";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { SecureChatLogo } from "@/components/SecureChatLogo";

export default function EmailConfirmed() {
  return (
    <main className="min-h-screen blueprint-bg flex items-center justify-center p-4 sm:p-6">
      <section className="w-full max-w-md bg-white/95 border border-slate-900/15 shadow-2xl p-7 sm:p-9">
        <div className="flex items-center gap-3 mb-8">
          <SecureChatLogo size={44} />
          <span className="font-black text-xl tracking-tight">SecureChat</span>
        </div>
        <CheckCircle2 className="h-9 w-9 text-[#ff4f87] mb-5" />
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-slate-400 mb-3">Email confirmed</p>
        <h1 className="text-3xl font-black tracking-tight">You’re ready to sign in.</h1>
        <p className="text-slate-600 mt-4 leading-relaxed">Your email has been confirmed. Continue to SecureChat and sign in with your email or matric number.</p>
        <Link href="/" className="mt-7 h-11 px-4 bg-[#101722] text-white flex items-center justify-center rounded-sm font-medium hover:bg-[#283342] transition-colors">
          Continue to SecureChat <ArrowUpRight className="ml-2 h-4 w-4" />
        </Link>
      </section>
    </main>
  );
}
