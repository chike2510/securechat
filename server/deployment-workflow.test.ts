import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workflowPath = resolve(process.cwd(), ".github/workflows/vercel-deploy.yml");

describe("Vercel deployment workflow", () => {
  it("keeps CI validation separate from token-dependent Vercel CLI deployment", () => {
    const workflow = readFileSync(workflowPath, "utf8");

    expect(workflow).toContain("run: pnpm check");
    expect(workflow).toContain("run: pnpm test");
    expect(workflow).toContain("Vercel's GitHub integration performs the production deployment");
    expect(workflow).not.toContain("vercel@latest pull");
    expect(workflow).not.toContain("vercel@latest build");
    expect(workflow).not.toContain("vercel@latest deploy");
    expect(workflow).not.toContain("VERCEL_TOKEN");
  });
});
