import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedReadiness = vi.hoisted(() => vi.fn());

vi.mock("../server/db.js", () => ({
  getDatabaseReadiness: mockedReadiness,
}));

import healthHandler from "../api/health.js";

describe("database health endpoint", () => {
  beforeEach(() => mockedReadiness.mockReset());

  it("returns a safe 503 readiness payload when database initialization fails", async () => {
    mockedReadiness.mockRejectedValueOnce(new Error("connection URL must not be exposed"));
    const response = {
      status: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await healthHandler({ method: "GET" }, response);

    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith({
      database: { configured: true, driver: "storage-postgres", source: null, configuredSources: [], attemptedSources: [], status: "failed", failureCategory: "unknown" },
    });
    expect(JSON.stringify(response.json.mock.calls[0]?.[0])).not.toContain("connection URL");
  });
});
