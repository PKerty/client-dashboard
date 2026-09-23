import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });
import { readFileSync } from "node:fs";
import { getDb } from "../src/db/client";
import { clients } from "../src/db/schema";

type Row = { slug: string; name: string; gmailLabelName: string; domains?: string[]; keywords?: string[] };

/** Lee dashboard/clients.json (ignorado por git; ver README) e inserta los slugs que falten. */
async function main() {
  const file = process.argv[2] ?? "clients.json";
  const rows = JSON.parse(readFileSync(file, "utf8")) as Row[];
  if (!Array.isArray(rows) || rows.length === 0) throw new Error(`${file} está vacío`);
  const db = await getDb();
  const inserted = await db
    .insert(clients)
    .values(rows.map((r) => ({ ...r, domains: r.domains ?? [], keywords: r.keywords ?? [] })))
    .onConflictDoNothing()
    .returning({ slug: clients.slug });
  console.log(`Insertados ${inserted.length} de ${rows.length}:`, inserted.map((r) => r.slug).join(", ") || "(ninguno)");
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
