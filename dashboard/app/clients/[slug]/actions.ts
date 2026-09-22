"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { SESSION_COOKIE, verifySessionValue } from "@/src/auth/session";
import { noteInput } from "@/src/api/validators";
import { getDb } from "@/src/db/client";
import { createNote, deleteNote, updateNote } from "@/src/db/queries";

async function requireSession(): Promise<void> {
  const store = await cookies();
  const ok = await verifySessionValue(process.env.AUTH_SECRET ?? "", store.get(SESSION_COOKIE)?.value);
  if (!ok) throw new Error("No autorizado");
}

export async function addNote(slug: string, formData: FormData): Promise<void> {
  await requireSession();
  const parsed = noteInput.safeParse({ body: formData.get("body") });
  if (!parsed.success) return;
  await createNote(await getDb(), slug, parsed.data.body);
  revalidatePath(`/clients/${slug}`);
}

export async function editNote(slug: string, id: number, body: string): Promise<void> {
  await requireSession();
  const parsed = noteInput.safeParse({ body });
  if (!parsed.success) return;
  await updateNote(await getDb(), id, parsed.data.body);
  revalidatePath(`/clients/${slug}`);
}

export async function removeNote(slug: string, id: number): Promise<void> {
  await requireSession();
  await deleteNote(await getDb(), id);
  revalidatePath(`/clients/${slug}`);
}
