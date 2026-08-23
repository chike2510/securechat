import { appRouter } from "../server/routers";

export default function importCheck(_req: any, res: any) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ ok: Boolean(appRouter), service: "securechat-router" }));
}
