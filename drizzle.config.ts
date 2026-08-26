import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL ?? process.env.STORAGE_POSTGRES_URL_NON_POOLING ?? process.env.STORAGE_POSTGRES_PRISMA_URL ?? process.env.STORAGE_POSTGRES_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});
