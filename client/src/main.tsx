import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import { initializeSupabase, supabase } from "./lib/supabase";
import App from "./App";
import "./index.css";

function BootstrapState({ failed = false }: { failed?: boolean }) {
  return (
    <main className="min-h-screen bg-background px-6 py-16 text-foreground">
      <section className="mx-auto max-w-lg border border-border bg-card p-8 shadow-sm">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">SecureChat</p>
        <h1 className="mt-5 text-3xl font-semibold">{failed ? "SecureChat needs one more setup step" : "Loading SecureChat"}</h1>
        <p className="mt-4 leading-7 text-muted-foreground">
          {failed
            ? "The app could not load its public authentication settings. Please refresh this page or ask the project owner to check the Vercel Supabase connection."
            : "Connecting to the secure sign-in service…"}
        </p>
        {failed && (
          <button className="mt-6 rounded-md bg-foreground px-4 py-2 text-sm text-background" onClick={() => window.location.reload()}>
            Refresh page
          </button>
        )}
      </section>
    </main>
  );
}

async function bootstrap() {
  const root = createRoot(document.getElementById("root")!);
  root.render(<BootstrapState />);
  const configured = await initializeSupabase();
  if (!configured) {
    root.render(<BootstrapState failed />);
    return;
  }

  const queryClient = new QueryClient();
  const trpcClient = trpc.createClient({
    links: [httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      async headers() {
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {};
      },
      fetch(input, init) {
        return globalThis.fetch(input, { ...(init ?? {}), credentials: "include" });
      },
    })],
  });

  root.render(
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}><App /></QueryClientProvider>
    </trpc.Provider>
  );
}

void bootstrap().catch(() => {
  createRoot(document.getElementById("root")!).render(<BootstrapState failed />);
});
