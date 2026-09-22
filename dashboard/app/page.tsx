import Link from "next/link";
import { getDb } from "@/src/db/client";
import { listClientsWithLatest } from "@/src/db/queries";
import { sortClients, statusClass, statusLabel } from "@/src/ui/status";
import { firstSentence, timeAgo } from "@/src/ui/time";
import { logout } from "./login/actions";

export const dynamic = "force-dynamic";

export default async function Home() {
  const rows = sortClients(await listClientsWithLatest(await getDb()));
  return (
    <main className="mx-auto max-w-5xl p-4">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Clientes</h1>
        <form action={logout}>
          <button type="submit" className="text-sm text-zinc-500 hover:underline">Salir</button>
        </form>
      </header>
      {rows.length === 0 && <p className="text-zinc-500">No hay clientes cargados.</p>}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((c) => {
          const status = c.latest?.status ?? null;
          const open = c.latest?.openPoints.length ?? 0;
          return (
            <li key={c.slug}>
              <Link
                href={`/clients/${c.slug}`}
                className="block h-full rounded-lg border border-zinc-200 bg-white p-4 hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className={`inline-block size-2.5 rounded-full ${statusClass(status)}`} aria-hidden />
                  <span className="font-medium">{c.name}</span>
                  <span className="ml-auto text-xs text-zinc-500">{statusLabel(status)}</span>
                </div>
                <p className="text-xs text-zinc-500">
                  {c.latest ? timeAgo(c.latest.generatedAt) : "Sin datos todavía"}
                  {open > 0 && ` · ${open} ${open === 1 ? "punto abierto" : "puntos abiertos"}`}
                </p>
                {c.latest && (
                  <p className="mt-2 line-clamp-3 text-sm text-zinc-700 dark:text-zinc-300">
                    {firstSentence(c.latest.summary)}
                  </p>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
