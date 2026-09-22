"use client";

import { useState, useTransition } from "react";
import type { Note } from "@/src/db/schema";
import { formatDate } from "@/src/ui/time";
import { addNote, editNote, removeNote } from "./actions";

const box =
  "w-full rounded-md border border-zinc-300 bg-white p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const btn = "rounded-md px-3 py-1.5 text-sm";
const primary = `${btn} bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 disabled:opacity-50`;
const quiet = `${btn} text-zinc-500 hover:underline`;

export function Notes({ slug, notes }: { slug: string; notes: Note[] }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <form
        action={(fd) => start(() => addNote(slug, fd))}
        className="flex flex-col gap-2"
      >
        <textarea name="body" rows={3} required placeholder="Nueva nota" className={box} />
        <div>
          <button type="submit" disabled={pending} className={primary}>Agregar</button>
        </div>
      </form>
      {notes.length === 0 && <p className="text-sm text-zinc-500">Todavía no hay notas.</p>}
      <ul className="flex flex-col gap-2">
        {notes.map((n) => (
          <NoteItem key={n.id} slug={slug} note={n} />
        ))}
      </ul>
    </div>
  );
}

function NoteItem({ slug, note }: { slug: string; note: Note }) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(note.body);
  const [pending, start] = useTransition();
  const created = new Date(note.createdAt);
  const updated = new Date(note.updatedAt);
  return (
    <li className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="mb-1 text-xs text-zinc-500">
        {formatDate(created)}
        {updated.getTime() - created.getTime() > 1000 && ` · editada ${formatDate(updated)}`}
      </p>
      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className={box} />
          <div className="flex gap-2">
            <button
              disabled={pending || !body.trim()}
              className={primary}
              onClick={() => start(async () => { await editNote(slug, note.id, body); setEditing(false); })}
            >
              Guardar
            </button>
            <button className={quiet} onClick={() => { setBody(note.body); setEditing(false); }}>Cancelar</button>
          </div>
        </div>
      ) : (
        <>
          <p className="whitespace-pre-wrap text-sm">{note.body}</p>
          <div className="mt-2 flex gap-2">
            <button className={quiet} onClick={() => setEditing(true)}>Editar</button>
            <button
              disabled={pending}
              className={quiet}
              onClick={() => { if (confirm("¿Borrar esta nota?")) start(() => removeNote(slug, note.id)); }}
            >
              Borrar
            </button>
          </div>
        </>
      )}
    </li>
  );
}
