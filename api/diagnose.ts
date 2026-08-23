export default async function diagnose(_req: any, res: any) {
  try {
    const mod = await import("../server/routers");
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: Boolean(mod.appRouter) }));
  } catch (error) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.stack : String(error) }));
  }
}
