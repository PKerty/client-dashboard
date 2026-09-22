import * as schema from "./schema";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let db: Db | undefined;
let pending: Promise<Db> | undefined;

async function connect(url: string): Promise<Db> {
  if (url.startsWith("pglite:")) {
    // Modo dev sin Postgres: `DATABASE_URL=pglite:./.pglite` guarda en disco.
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const local = drizzle(new PGlite(url.slice("pglite:".length)), { schema });
    await migrate(local, { migrationsFolder: "./drizzle" });
    return local as unknown as Db;
  }
  const { drizzle } = await import("drizzle-orm/neon-http");
  return drizzle(url, { schema }) as unknown as Db;
}

export function getDb(): Promise<Db> {
  if (db) return Promise.resolve(db);
  if (!pending) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL no está definida");
    pending = connect(url).then((d) => (db = d));
  }
  return pending;
}
