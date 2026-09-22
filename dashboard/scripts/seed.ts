import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });
import { getDb } from "../src/db/client";
import { clients } from "../src/db/schema";

/** Lista canónica de clientes (spec). Idempotente: ignora los slugs ya cargados. */
const rows = [
  { slug: "cliente-a", name: "Cliente A", gmailLabelName: "clients/cliente-a", domains: ["cliente-a.example.com"], keywords: ["cliente-a"] },
  { slug: "cliente-b", name: "Cliente B", gmailLabelName: "clients/cliente-b", domains: ["cliente-b.example.com"], keywords: ["cliente-b"] },
  { slug: "cliente-c", name: "Cliente C", gmailLabelName: "clients/Cliente C", domains: ["cliente-c.example.com"], keywords: ["cliente-c", "cliente-c"] },
  { slug: "cliente-d", name: "Cliente D", gmailLabelName: "clients/cliente-d", domains: ["cliente-d.example.com"], keywords: ["cliente-d", "braze", "cliente-d"] },
  { slug: "cliente-e", name: "Cliente E", gmailLabelName: "clients/cliente-e", domains: ["cliente-e.example.com"], keywords: ["cliente-e"] },
  { slug: "cliente-f", name: "Cliente F", gmailLabelName: "clients/cliente-f", domains: ["cliente-f.example.com"], keywords: ["cliente-f"] },
  { slug: "cliente-g", name: "Cliente G", gmailLabelName: "clients/Cliente G", domains: [], keywords: ["cliente-g"] },
  { slug: "cliente-h", name: "Cliente H", gmailLabelName: "clients/cliente-h", domains: [], keywords: ["cliente-h"] },
  { slug: "cliente-i", name: "Cliente I", gmailLabelName: "clients/Cliente I", domains: [], keywords: ["cliente-i"] },
];

async function main() {
  const db = await getDb();
  const inserted = await db.insert(clients).values(rows).onConflictDoNothing().returning({ slug: clients.slug });
  console.log(`Insertados ${inserted.length} de ${rows.length}:`, inserted.map((r) => r.slug).join(", ") || "(ninguno)");
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
