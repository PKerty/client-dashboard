import { desc, eq } from "drizzle-orm";
import type { Db } from "./client";
import { clients, notes, snapshots, type Client, type Note, type Snapshot } from "./schema";
import type { ClientPatch, SnapshotInput } from "../api/validators";

export type ClientWithLatest = Client & { latest: Snapshot | null; notes: Note[] };
export type ClientDetail = Client & { snapshots: Snapshot[]; notes: Note[] };

async function findClient(db: Db, slug: string): Promise<Client | null> {
  const [c] = await db.select().from(clients).where(eq(clients.slug, slug)).limit(1);
  return c ?? null;
}

function notesOf(db: Db, clientId: number) {
  return db.select().from(notes).where(eq(notes.clientId, clientId)).orderBy(desc(notes.createdAt));
}

function snapshotsOf(db: Db, clientId: number, limit: number) {
  return db
    .select()
    .from(snapshots)
    .where(eq(snapshots.clientId, clientId))
    .orderBy(desc(snapshots.generatedAt), desc(snapshots.id))
    .limit(limit);
}

export async function listClientsWithLatest(db: Db): Promise<ClientWithLatest[]> {
  const active = await db.select().from(clients).where(eq(clients.active, true)).orderBy(clients.name);
  return Promise.all(
    active.map(async (c) => {
      const [latest] = await snapshotsOf(db, c.id, 1);
      return { ...c, latest: latest ?? null, notes: await notesOf(db, c.id) };
    }),
  );
}

export async function getClientDetail(db: Db, slug: string): Promise<ClientDetail | null> {
  const c = await findClient(db, slug);
  if (!c) return null;
  return { ...c, snapshots: await snapshotsOf(db, c.id, 10), notes: await notesOf(db, c.id) };
}

export async function patchClient(db: Db, slug: string, patch: ClientPatch): Promise<Client | null> {
  const c = await findClient(db, slug);
  if (!c) return null;
  const [updated] = await db.update(clients).set(patch).where(eq(clients.id, c.id)).returning();
  return updated ?? null;
}

export async function createSnapshot(db: Db, slug: string, input: SnapshotInput): Promise<Snapshot | null> {
  const c = await findClient(db, slug);
  if (!c) return null;
  const [created] = await db.insert(snapshots).values({ ...input, clientId: c.id }).returning();
  return created ?? null;
}

export async function createNote(db: Db, slug: string, body: string): Promise<Note | null> {
  const c = await findClient(db, slug);
  if (!c) return null;
  const [created] = await db.insert(notes).values({ clientId: c.id, body }).returning();
  return created ?? null;
}

export async function updateNote(db: Db, id: number, body: string): Promise<Note | null> {
  const [updated] = await db
    .update(notes)
    .set({ body, updatedAt: new Date() })
    .where(eq(notes.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteNote(db: Db, id: number): Promise<boolean> {
  const deleted = await db.delete(notes).where(eq(notes.id, id)).returning({ id: notes.id });
  return deleted.length > 0;
}
