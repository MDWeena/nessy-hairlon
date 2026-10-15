import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "supabase", "migrations");

/**
 * A real Postgres (PGlite — Postgres compiled to WASM) with every migration in
 * supabase/migrations applied in order, so SQL functions are tested against the actual
 * schema rather than a mock. Only two Supabase-isms need shimming: the anon/authenticated/
 * service_role roles, and pgcrypto (gen_random_uuid is built into Postgres 13+ anyway).
 * The session timezone is forced to UTC to match Supabase — PGlite defaults to UTC+1, which
 * would let Africa/Lagos handling pass by accident.
 * `upTo` (e.g. "022") stops after that migration — used to test the state production sits in
 * between applying 022 and 023, where the legacy functions and the new ones coexist.
 */
export async function createMigratedDb(options: { upTo?: string } = {}): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    set timezone = 'UTC';
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
  `);
  const files = readdirSync(migrationsDir).filter(f => f.endsWith(".sql")).sort()
    .filter(f => options.upTo === undefined || f.slice(0, 3) <= options.upTo);
  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf8").replace(/create extension if not exists pgcrypto;/i, "");
    try {
      await db.exec(sql);
    } catch (err) {
      throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
    }
  }
  return db;
}

/** Today's date in Africa/Lagos, offset by `days`, as YYYY-MM-DD. */
export function watDate(days: number): string {
  const lagosNow = new Date(Date.now() + 60 * 60 * 1000);
  lagosNow.setUTCDate(lagosNow.getUTCDate() + days);
  return lagosNow.toISOString().slice(0, 10);
}
