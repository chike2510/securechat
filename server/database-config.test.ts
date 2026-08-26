import { describe, expect, it } from "vitest";
import { resolveDatabaseUrl, storagePostgresSchemaStatements } from "./db.js";

describe("Storage Postgres database configuration", () => {
  it("uses the Vercel Storage Postgres non-pooling URL when DATABASE_URL is absent", () => {
    expect(resolveDatabaseUrl({
      STORAGE_POSTGRES_URL_NON_POOLING: "postgresql://non-pooling.example/securechat",
      STORAGE_POSTGRES_PRISMA_URL: "postgresql://prisma.example/securechat",
    })).toBe("postgresql://non-pooling.example/securechat");
  });

  it("prefers the connected Storage Postgres URL over a generic database URL", () => {
    expect(resolveDatabaseUrl({
      DATABASE_URL: "postgresql://explicit.example/securechat",
      STORAGE_POSTGRES_URL_NON_POOLING: "postgresql://non-pooling.example/securechat",
    })).toBe("postgresql://non-pooling.example/securechat");
  });

  it("rejects a MySQL DATABASE_URL instead of passing it to the Postgres driver", () => {
    expect(resolveDatabaseUrl({
      DATABASE_URL: "mysql://tidb.example/securechat",
    })).toBe("");
  });

  it("bootstraps all SecureChat profile and ciphertext-only message tables", () => {
    const schemaSql = storagePostgresSchemaStatements.join("\n");
    expect(schemaSql).toContain('CREATE TABLE IF NOT EXISTS "users"');
    expect(schemaSql).toContain('CREATE TABLE IF NOT EXISTS "encryptedMessages"');
    expect(schemaSql).toContain('"ciphertext" text NOT NULL');
    expect(schemaSql).toContain('"matricNumber" varchar(40) NOT NULL UNIQUE');
  });
});
