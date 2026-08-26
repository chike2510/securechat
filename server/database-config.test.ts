import { describe, expect, it } from "vitest";
import { databaseFailureCategory, resolveDatabaseConnection, resolveDatabaseUrl, storagePostgresSchemaStatements } from "./db.js";

describe("Storage Postgres database configuration", () => {
  it("uses the Vercel Storage Postgres application/Prisma URL when available", () => {
    expect(resolveDatabaseUrl({
      STORAGE_POSTGRES_URL_NON_POOLING: "postgresql://non-pooling.example/securechat",
      STORAGE_POSTGRES_PRISMA_URL: "postgresql://prisma.example/securechat",
    })).toBe("postgresql://prisma.example/securechat");
    expect(resolveDatabaseConnection({
      STORAGE_POSTGRES_PRISMA_URL: "postgresql://prisma.example/securechat",
    })?.source).toBe("storage-postgres-prisma");
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

  it("maps database failures to safe public diagnostic categories", () => {
    expect(databaseFailureCategory(new Error("SSL connection failed"))).toBe("connection");
    expect(databaseFailureCategory(new Error("password authentication failed"))).toBe("authentication");
    expect(databaseFailureCategory(new Error("relation users does not exist"))).toBe("schema");
  });
});
