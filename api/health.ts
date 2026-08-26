import { getDatabaseReadiness } from "../server/db.js";

type VercelRequest = { method?: string };
type VercelResponse = {
  status: (code: number) => VercelResponse;
  setHeader: (name: string, value: string) => VercelResponse;
  json: (body: unknown) => void;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).setHeader("Allow", "GET").json({ error: "Method not allowed" });
  }

  try {
    const database = await getDatabaseReadiness();
    return res.status(database.status === "failed" ? 503 : 200).setHeader("Cache-Control", "no-store").json({ database });
  } catch {
    return res.status(503).setHeader("Cache-Control", "no-store").json({
      database: { configured: true, driver: "storage-postgres", source: null, configuredSources: [], attemptedSources: [], status: "failed", failureCategory: "unknown" },
    });
  }
}
