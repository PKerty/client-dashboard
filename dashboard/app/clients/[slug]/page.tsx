import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/src/db/client";
import { getClientDetail } from "@/src/db/queries";
import { statusClass, statusLabel } from "@/src/ui/status";
import { formatDate, timeAgo } from "@/src/ui/time";
import { Notes } from "./notes";

export const dynamic = "force-dynamic";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-500">{title}</h2>
      {children}
    </section>
  );
}

const muted = "text-xs text-zinc-500";

export default async function ClientPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await getClientDetail(await getDb(), slug);
  if (!c) notFound();
  const latest = c.snapshots[0] ?? null;
  const status = latest?.status ?? null;

  return (
    <main className="mx-auto max-w-3xl p-4">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">← Clientes</Link>
      <header className="mb-6 mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <span className={`inline-block size-3 rounded-full ${statusClass(status)}`} aria-hidden />
          {c.name}
        </h1>
        <span className="text-sm text-zinc-500">
          {statusLabel(status)}
          {latest && ` · actualizado ${timeAgo(latest.generatedAt)}`}
          {latest && !latest.hasChanges && " · sin novedades"}
        </span>
      </header>

      {!latest && <p className="mb-6 text-zinc-500">Todavía no hay un resumen de este cliente.</p>}

      {latest && (
        <>
          <Section title="Situación">
            {latest.summary.split(/\n+/).map((p, i) => <p key={i} className="mb-2 text-sm leading-relaxed">{p}</p>)}
          </Section>
          <Section title="Próximos pasos">
            {latest.nextSteps.length === 0 && <p className={muted}>Ninguno.</p>}
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {latest.nextSteps.map((s, i) => (
                <li key={i}>
                  {s.text}
                  {(s.owner || s.due) && <span className={` ${muted}`}> · {[s.owner, s.due].filter(Boolean).join(" · ")}</span>}
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Puntos abiertos">
            {latest.openPoints.length === 0 && <p className={muted}>Ninguno.</p>}
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {latest.openPoints.map((p, i) => (
                <li key={i}>
                  {p.text}
                  {p.since && <span className={` ${muted}`}> · desde {p.since}</span>}
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}

      <Section title="Notas">
        <Notes slug={c.slug} notes={c.notes} />
      </Section>

      {latest && (latest.sources.threads.length > 0 || latest.sources.meetings.length > 0) && (
        <details className="mb-4">
          <summary className="cursor-pointer text-sm text-zinc-500">Fuentes del último resumen</summary>
          <ul className="mt-2 space-y-1 pl-2 text-sm">
            {latest.sources.meetings.map((m) => (
              <li key={m.id}>
                <a href={`https://notes.granola.ai/d/${m.id}`} target="_blank" rel="noreferrer" className="underline">
                  {m.title}
                </a>
                <span className={` ${muted}`}> · reunión · {m.date}</span>
              </li>
            ))}
            {latest.sources.threads.map((t) => (
              <li key={t.id}>
                <a href={`https://mail.google.com/mail/u/0/#all/${t.id}`} target="_blank" rel="noreferrer" className="underline">
                  {t.subject}
                </a>
                <span className={` ${muted}`}> · mail</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {c.snapshots.length > 1 && (
        <details>
          <summary className="cursor-pointer text-sm text-zinc-500">Historial ({c.snapshots.length})</summary>
          <ul className="mt-2 space-y-3">
            {c.snapshots.map((s) => (
              <li key={s.id} className="text-sm">
                <p className={muted}>
                  <span className={`mr-1 inline-block size-2 rounded-full ${statusClass(s.status)}`} aria-hidden />
                  {formatDate(s.generatedAt)}{!s.hasChanges && " · sin novedades"}
                </p>
                <p className="line-clamp-3">{s.summary}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </main>
  );
}
