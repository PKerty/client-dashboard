import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "./setup";
import { clients } from "../src/db/schema";
import type { Db } from "../src/db/client";
import {
  listClientsWithLatest,
  getClientDetail,
  patchClient,
  createSnapshot,
  createNote,
  updateNote,
  deleteNote,
} from "../src/db/queries";

const base = { nextSteps: [], openPoints: [], sources: { threads: [], meetings: [] }, hasChanges: true };
let db: Db;

beforeEach(async () => {
  db = await makeTestDb();
  await db.insert(clients).values([
    { slug: "cliente-a", name: "Cliente A", gmailLabelName: "clients/cliente-a" },
    { slug: "old", name: "Old", gmailLabelName: "clients/old", active: false },
  ]);
});

describe("queries", () => {
  it("lista solo activos, con latest null si no hay snapshot", async () => {
    const rows = await listClientsWithLatest(db);
    expect(rows.map((r) => r.slug)).toEqual(["cliente-a"]);
    expect(rows[0].latest).toBeNull();
    expect(rows[0].notes).toEqual([]);
  });

  it("createSnapshot y latest es el más reciente", async () => {
    await createSnapshot(db, "cliente-a", { ...base, status: "green", summary: "v1" });
    const s2 = await createSnapshot(db, "cliente-a", { ...base, status: "red", summary: "v2", nextSteps: [{ text: "x" }] });
    const [row] = await listClientsWithLatest(db);
    expect(row.latest?.id).toBe(s2!.id);
    expect(row.latest?.status).toBe("red");
    expect(row.latest?.nextSteps).toEqual([{ text: "x" }]);
  });

  it("createSnapshot con slug desconocido devuelve null", async () => {
    expect(await createSnapshot(db, "nope", { ...base, status: "green", summary: "x" })).toBeNull();
  });

  it("detalle trae snapshots desc y notas", async () => {
    await createSnapshot(db, "cliente-a", { ...base, status: "green", summary: "v1" });
    await createSnapshot(db, "cliente-a", { ...base, status: "yellow", summary: "v2" });
    await createNote(db, "cliente-a", "nota 1");
    const d = await getClientDetail(db, "cliente-a");
    expect(d?.snapshots.map((s) => s.summary)).toEqual(["v2", "v1"]);
    expect(d?.notes[0].body).toBe("nota 1");
    expect(await getClientDetail(db, "nope")).toBeNull();
  });

  it("patchClient", async () => {
    const c = await patchClient(db, "cliente-a", { domains: ["cliente-a.example.com"], gmailLabelId: "L1" });
    expect(c?.domains).toEqual(["cliente-a.example.com"]);
    expect(c?.gmailLabelId).toBe("L1");
    expect(await patchClient(db, "nope", { domains: [] })).toBeNull();
  });

  it("nota con slug desconocido devuelve null", async () => {
    expect(await createNote(db, "nope", "a")).toBeNull();
  });

  it("update y delete de nota", async () => {
    const n = await createNote(db, "cliente-a", "a");
    expect((await updateNote(db, n!.id, "b"))?.body).toBe("b");
    expect(await updateNote(db, 999, "b")).toBeNull();
    expect(await deleteNote(db, n!.id)).toBe(true);
    expect(await deleteNote(db, n!.id)).toBe(false);
  });
});
