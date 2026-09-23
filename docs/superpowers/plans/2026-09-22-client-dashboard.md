# Client Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dashboard privado en Vercel con la situación de cada cliente, alimentado por una tarea programada de Claude que lee Gmail y Granola, con notas propias del usuario.

**Architecture:** App Next.js 16 (App Router) en `dashboard/` que solo guarda y muestra, con Neon Postgres + Drizzle. Un API con bearer token recibe snapshots desde la tarea programada y expone el estado a Claude. Login por clave única con cookie HMAC verificada en `proxy.ts`.

**Tech Stack:** Next 16, React 19, TypeScript, Tailwind 4, Drizzle ORM 0.45 + drizzle-kit, @neondatabase/serverless (prod), @electric-sql/pglite (tests), zod 4, vitest 5.

**Spec:** `docs/superpowers/specs/2026-09-22-client-dashboard-design.md`

## Global Constraints

- Cada commit ≤ 300 líneas contables (hook `commit-guard.sh`). No cuentan lockfiles ni `drizzle/`.
- Un tema por commit; specs/planes nunca junto con código.
- Cada commit compila (`npm run build` o al menos `tsc --noEmit`) y pasa `npm test`.
- Node 24, npm 11. Sin pnpm ni bun.
- Next 16: `proxy.ts` (no `middleware.ts`), `params` es `Promise`, `cookies()` es async.
- `.env.local` nunca se commitea. Variables: `DATABASE_URL`, `DASHBOARD_PASSWORD`, `AUTH_SECRET`, `INGEST_TOKEN`.
- Textos de UI en español rioplatense, sin emojis.
- Módulos que tocan DB reciben `db` como parámetro para poder testearlos con PGlite.

## File Structure

```
dashboard/
  package.json  tsconfig.json  next.config.ts  postcss.config.mjs
  drizzle.config.ts  vitest.config.ts  .env.example  .gitignore  README.md
  proxy.ts                         # protege páginas con la cookie de sesión
  app/
    layout.tsx  globals.css
    page.tsx                       # grilla de clientes
    login/page.tsx  login/actions.ts
    clients/[slug]/page.tsx        # detalle
    clients/[slug]/notes.tsx       # client component: form + lista editable
    clients/[slug]/actions.ts      # server actions de notas
    api/clients/route.ts
    api/clients/[slug]/route.ts
    api/clients/[slug]/snapshots/route.ts
    api/clients/[slug]/notes/route.ts
  src/
    db/schema.ts                   # tablas Drizzle
    db/client.ts                   # getDb() con Neon
    db/queries.ts                  # todas las queries, reciben db
    auth/session.ts                # sign/verify cookie (Web Crypto)
    auth/api-token.ts              # requireApiToken(request)
    auth/compare.ts                # timingSafeEqual de strings
    api/validators.ts              # zod schemas
    api/respond.ts                 # helpers json()/error()
    ui/status.ts                   # colores, orden y etiquetas del semáforo
    ui/time.ts                     # "hace X"
  drizzle/                         # migraciones generadas
  test/
    setup.ts                       # crea db PGlite con migraciones
    session.test.ts  compare.test.ts  validators.test.ts  queries.test.ts
automation/
  daily-brief.md                   # prompt de la tarea programada
  scripts/api.sh                   # curl con token desde dashboard/.env.local
  scripts/seed-clients.sql         # (no: el seed va por migración de datos) → seed.ts
```

---

### Task 1: Scaffold Next.js + Drizzle schema + migración

**Files:**
- Create: `dashboard/package.json`, `dashboard/tsconfig.json`, `dashboard/next.config.ts`, `dashboard/postcss.config.mjs`, `dashboard/.gitignore`, `dashboard/.env.example`, `dashboard/app/layout.tsx`, `dashboard/app/globals.css`, `dashboard/app/page.tsx`, `dashboard/drizzle.config.ts`, `dashboard/vitest.config.ts`, `dashboard/src/db/schema.ts`, `dashboard/src/db/client.ts`, `dashboard/test/setup.ts`, `dashboard/test/schema.test.ts`, `dashboard/drizzle/*` (generado)

**Interfaces:**
- Produces: `schema.ts` exporta `clients`, `snapshots`, `notes`, `statusEnum`, tipos `Client`, `Snapshot`, `Note`, `NewSnapshot`, `NewNote`. `test/setup.ts` exporta `makeTestDb(): Promise<Db>`. `client.ts` exporta `getDb(): Db` y tipo `Db`.

- [ ] **Step 1: package.json y configs**

```json
{
  "name": "client-dashboard",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  }
}
```
Instalar: `npm i next@16 react@19 react-dom@19 drizzle-orm @neondatabase/serverless zod` y `npm i -D typescript @types/node @types/react @types/react-dom drizzle-kit @electric-sql/pglite vitest tailwindcss @tailwindcss/postcss tsx dotenv`.

`drizzle.config.ts`:
```ts
import { defineConfig } from "drizzle-kit";
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://localhost/unused" },
});
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["test/**/*.test.ts"] } });
```

- [ ] **Step 2: schema**

```ts
// src/db/schema.ts
import { pgTable, pgEnum, serial, text, boolean, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

export const statusEnum = pgEnum("status", ["green", "yellow", "red"]);

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  gmailLabelId: text("gmail_label_id"),
  gmailLabelName: text("gmail_label_name").notNull(),
  domains: text("domains").array().notNull().default([]),
  keywords: text("keywords").array().notNull().default([]),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type NextStep = { text: string; owner?: string; due?: string };
export type OpenPoint = { text: string; since?: string };
export type Sources = {
  threads: { id: string; subject: string }[];
  meetings: { id: string; title: string; date: string }[];
};

export const snapshots = pgTable("snapshots", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  status: statusEnum("status").notNull(),
  summary: text("summary").notNull(),
  nextSteps: jsonb("next_steps").$type<NextStep[]>().notNull().default([]),
  openPoints: jsonb("open_points").$type<OpenPoint[]>().notNull().default([]),
  sources: jsonb("sources").$type<Sources>().notNull().default({ threads: [], meetings: [] }),
  hasChanges: boolean("has_changes").notNull().default(true),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Client = typeof clients.$inferSelect;
export type Snapshot = typeof snapshots.$inferSelect;
export type NewSnapshot = typeof snapshots.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
```

```ts
// src/db/client.ts
import { drizzle } from "drizzle-orm/neon-http";
import type { PgDatabase } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<any, typeof schema>;

let db: Db | undefined;
export function getDb(): Db {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL no está definida");
    db = drizzle(url, { schema }) as unknown as Db;
  }
  return db;
}
```

- [ ] **Step 3: generar migración** — `npx drizzle-kit generate` crea `drizzle/0000_*.sql`.

- [ ] **Step 4: test setup + test de humo**

```ts
// test/setup.ts
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../src/db/schema";
import type { Db } from "../src/db/client";

export async function makeTestDb(): Promise<Db> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db as unknown as Db;
}
```

```ts
// test/schema.test.ts
import { describe, it, expect } from "vitest";
import { makeTestDb } from "./setup";
import { clients } from "../src/db/schema";

describe("schema", () => {
  it("aplica las migraciones y permite insertar un cliente", async () => {
    const db = await makeTestDb();
    const [row] = await db.insert(clients).values({ slug: "cliente-a", name: "Cliente A", gmailLabelName: "clients/cliente-a" }).returning();
    expect(row.slug).toBe("cliente-a");
    expect(row.domains).toEqual([]);
  });
});
```

- [ ] **Step 5: layout + page mínimos, `npm test`, `npm run typecheck`, `npm run build`** — page.tsx renderiza "Clientes" y nada más.
- [ ] **Step 6: Commit** `feat(dashboard): scaffold next + esquema drizzle`

---

### Task 2: Login con clave, cookie firmada y proxy

**Files:**
- Create: `dashboard/src/auth/compare.ts`, `dashboard/src/auth/session.ts`, `dashboard/app/login/page.tsx`, `dashboard/app/login/actions.ts`, `dashboard/proxy.ts`, `dashboard/test/compare.test.ts`, `dashboard/test/session.test.ts`

**Interfaces:**
- Produces: `timingSafeEqual(a: string, b: string): boolean`; `createSessionValue(secret: string, now?: number): Promise<string>`; `verifySessionValue(secret: string, value: string | undefined, now?: number): Promise<boolean>`; `SESSION_COOKIE = "session"`; `SESSION_TTL_MS = 30 días`.

- [ ] **Step 1: tests**

```ts
// test/compare.test.ts
import { it, expect } from "vitest";
import { timingSafeEqual } from "../src/auth/compare";
it("iguales", () => expect(timingSafeEqual("abc", "abc")).toBe(true));
it("distintos mismo largo", () => expect(timingSafeEqual("abc", "abd")).toBe(false));
it("distinto largo", () => expect(timingSafeEqual("abc", "ab")).toBe(false));
```

```ts
// test/session.test.ts
import { it, expect } from "vitest";
import { createSessionValue, verifySessionValue, SESSION_TTL_MS } from "../src/auth/session";
const secret = "s3cret";
it("firma y verifica", async () => {
  const v = await createSessionValue(secret, 1000);
  expect(await verifySessionValue(secret, v, 2000)).toBe(true);
});
it("rechaza vencida", async () => {
  const v = await createSessionValue(secret, 1000);
  expect(await verifySessionValue(secret, v, 1000 + SESSION_TTL_MS + 1)).toBe(false);
});
it("rechaza firma ajena", async () => {
  const v = await createSessionValue("otro", 1000);
  expect(await verifySessionValue(secret, v, 2000)).toBe(false);
});
it("rechaza basura", async () => {
  expect(await verifySessionValue(secret, "x", 2000)).toBe(false);
  expect(await verifySessionValue(secret, undefined, 2000)).toBe(false);
});
```

- [ ] **Step 2: implementación (solo Web Crypto, corre en Edge y Node)**

```ts
// src/auth/compare.ts
export function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a), eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}
```

```ts
// src/auth/session.ts
import { timingSafeEqual } from "./compare";
export const SESSION_COOKIE = "session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

async function hmac(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
export async function createSessionValue(secret: string, now = Date.now()): Promise<string> {
  const exp = String(now + SESSION_TTL_MS);
  return `${exp}.${await hmac(secret, exp)}`;
}
export async function verifySessionValue(secret: string, value: string | undefined, now = Date.now()): Promise<boolean> {
  if (!value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp)) return false;
  if (Number(exp) < now) return false;
  return timingSafeEqual(sig, await hmac(secret, exp));
}
```

`app/login/actions.ts`: server action `login(prev, formData)` que compara `formData.get("password")` con `process.env.DASHBOARD_PASSWORD` usando `timingSafeEqual`, setea la cookie (`httpOnly, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_TTL_MS/1000`) y `redirect("/")`; si falla devuelve `{ error: "Clave incorrecta" }`.

`app/login/page.tsx`: client component con `useActionState(login, {})`, un input password y un botón "Entrar".

`proxy.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionValue } from "./src/auth/session";
export async function proxy(request: NextRequest) {
  const ok = await verifySessionValue(process.env.AUTH_SECRET ?? "", request.cookies.get(SESSION_COOKIE)?.value);
  if (ok) return NextResponse.next();
  const url = request.nextUrl.clone(); url.pathname = "/login"; url.search = "";
  return NextResponse.redirect(url);
}
export const config = { matcher: ["/((?!login|api|_next|favicon.ico).*)"] };
```

- [ ] **Step 3: `npm test`, `npm run build`. Smoke en el navegador con `.env.local` local: sin cookie redirige a /login; clave mala muestra error; clave buena entra.**
- [ ] **Step 4: Commit** `feat(dashboard): login con clave y cookie firmada`

---

### Task 3: API con token: lectura, PATCH, snapshots, notas

**Files:**
- Create: `dashboard/src/auth/api-token.ts`, `dashboard/src/api/validators.ts`, `dashboard/src/api/respond.ts`, `dashboard/src/db/queries.ts`, `dashboard/app/api/clients/route.ts`, `dashboard/app/api/clients/[slug]/route.ts`, `dashboard/app/api/clients/[slug]/snapshots/route.ts`, `dashboard/app/api/clients/[slug]/notes/route.ts`, `dashboard/test/validators.test.ts`, `dashboard/test/queries.test.ts`

**Interfaces:**
- Produces (queries.ts, todas reciben `db: Db`):
  - `listClientsWithLatest(db): Promise<(Client & { latest: Snapshot | null; notes: Note[] })[]>` — solo activos.
  - `getClientDetail(db, slug): Promise<(Client & { snapshots: Snapshot[]; notes: Note[] }) | null>` — últimos 10 snapshots desc.
  - `patchClient(db, slug, patch: { gmailLabelId?: string; domains?: string[]; keywords?: string[] }): Promise<Client | null>`
  - `createSnapshot(db, slug, input: SnapshotInput): Promise<Snapshot | null>`
  - `createNote(db, slug, body): Promise<Note | null>`; `updateNote(db, id, body): Promise<Note | null>`; `deleteNote(db, id): Promise<boolean>`
- Produces (validators.ts): `snapshotInput` (zod), `SnapshotInput`, `clientPatch`, `noteInput`.
- Produces (api-token.ts): `requireApiToken(request: Request): Response | null` — devuelve 401 si falta/mal token.
- Produces (respond.ts): `json(data, status = 200)`, `error(message, status)`.

- [ ] **Step 1: tests de validadores**

```ts
// test/validators.test.ts
import { it, expect } from "vitest";
import { snapshotInput, clientPatch, noteInput } from "../src/api/validators";
it("snapshot válido", () => {
  const r = snapshotInput.safeParse({ status: "red", summary: "x", nextSteps: [{ text: "a" }], openPoints: [], sources: { threads: [], meetings: [] } });
  expect(r.success).toBe(true);
});
it("snapshot sin status falla", () => {
  expect(snapshotInput.safeParse({ summary: "x" }).success).toBe(false);
});
it("defaults de arrays", () => {
  const r = snapshotInput.parse({ status: "green", summary: "ok" });
  expect(r.nextSteps).toEqual([]); expect(r.hasChanges).toBe(true);
});
it("patch rechaza campos desconocidos", () => {
  expect(clientPatch.safeParse({ name: "no" }).success).toBe(false);
});
it("nota vacía falla", () => expect(noteInput.safeParse({ body: "  " }).success).toBe(false));
```

- [ ] **Step 2: validators**

```ts
// src/api/validators.ts
import { z } from "zod";
export const snapshotInput = z.object({
  status: z.enum(["green", "yellow", "red"]),
  summary: z.string().min(1),
  nextSteps: z.array(z.object({ text: z.string().min(1), owner: z.string().optional(), due: z.string().optional() })).default([]),
  openPoints: z.array(z.object({ text: z.string().min(1), since: z.string().optional() })).default([]),
  sources: z.object({
    threads: z.array(z.object({ id: z.string(), subject: z.string() })).default([]),
    meetings: z.array(z.object({ id: z.string(), title: z.string(), date: z.string() })).default([]),
  }).default({ threads: [], meetings: [] }),
  hasChanges: z.boolean().default(true),
});
export type SnapshotInput = z.infer<typeof snapshotInput>;
export const clientPatch = z.object({
  gmailLabelId: z.string().optional(),
  domains: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
}).strict();
export const noteInput = z.object({ body: z.string().trim().min(1) });
```

- [ ] **Step 3: tests de queries contra PGlite**

```ts
// test/queries.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { makeTestDb } from "./setup";
import { clients } from "../src/db/schema";
import type { Db } from "../src/db/client";
import { listClientsWithLatest, getClientDetail, patchClient, createSnapshot, createNote, updateNote, deleteNote } from "../src/db/queries";

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
  });
  it("createSnapshot y latest", async () => {
    await createSnapshot(db, "cliente-a", { status: "green", summary: "v1", nextSteps: [], openPoints: [], sources: { threads: [], meetings: [] }, hasChanges: true });
    const s2 = await createSnapshot(db, "cliente-a", { status: "red", summary: "v2", nextSteps: [{ text: "x" }], openPoints: [], sources: { threads: [], meetings: [] }, hasChanges: true });
    const [row] = await listClientsWithLatest(db);
    expect(row.latest?.id).toBe(s2!.id);
    expect(row.latest?.status).toBe("red");
  });
  it("createSnapshot con slug desconocido devuelve null", async () => {
    expect(await createSnapshot(db, "nope", { status: "green", summary: "x", nextSteps: [], openPoints: [], sources: { threads: [], meetings: [] }, hasChanges: true })).toBeNull();
  });
  it("detalle trae snapshots desc y notas", async () => {
    await createSnapshot(db, "cliente-a", { status: "green", summary: "v1", nextSteps: [], openPoints: [], sources: { threads: [], meetings: [] }, hasChanges: true });
    await createNote(db, "cliente-a", "nota 1");
    const d = await getClientDetail(db, "cliente-a");
    expect(d?.snapshots).toHaveLength(1);
    expect(d?.notes[0].body).toBe("nota 1");
    expect(await getClientDetail(db, "nope")).toBeNull();
  });
  it("patchClient", async () => {
    const c = await patchClient(db, "cliente-a", { domains: ["cliente-a.com"], gmailLabelId: "L1" });
    expect(c?.domains).toEqual(["cliente-a.com"]); expect(c?.gmailLabelId).toBe("L1");
  });
  it("update y delete de nota", async () => {
    const n = await createNote(db, "cliente-a", "a");
    expect((await updateNote(db, n!.id, "b"))?.body).toBe("b");
    expect(await deleteNote(db, n!.id)).toBe(true);
    expect(await deleteNote(db, n!.id)).toBe(false);
  });
});
```

- [ ] **Step 4: queries** — usar `db.query.clients.findMany({ where: eq(clients.active, true) })` y por cada uno buscar último snapshot (`orderBy desc(snapshots.generatedAt), limit 1`) y notas (`orderBy desc(notes.createdAt)`). Para evitar N+1 es aceptable a esta escala (menos de veinte clientes). `createSnapshot`: buscar cliente por slug; si no está, null; insertar con `returning()`.

- [ ] **Step 5: rutas** — patrón de cada `route.ts`:

```ts
import { requireApiToken } from "@/src/auth/api-token";
import { json, error } from "@/src/api/respond";
import { getDb } from "@/src/db/client";
import { snapshotInput } from "@/src/api/validators";
import { createSnapshot } from "@/src/db/queries";

export async function POST(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const denied = requireApiToken(request); if (denied) return denied;
  const { slug } = await ctx.params;
  const parsed = snapshotInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error("Cuerpo inválido: " + parsed.error.message, 400);
  const created = await createSnapshot(getDb(), slug, parsed.data);
  if (!created) return error("Cliente desconocido", 404);
  return json(created, 201);
}
```
`requireApiToken`: lee `Authorization: Bearer x`, compara con `process.env.INGEST_TOKEN` via `timingSafeEqual`; 401 si no.

- [ ] **Step 6: `npm test`, `npm run build`. Commit** `feat(dashboard): api de clientes, snapshots y notas con token`

---

### Task 4: UI grilla de clientes

**Files:**
- Create: `dashboard/src/ui/status.ts`, `dashboard/src/ui/time.ts`, `dashboard/test/status.test.ts`, `dashboard/test/time.test.ts`
- Modify: `dashboard/app/page.tsx`, `dashboard/app/layout.tsx`, `dashboard/app/globals.css`

**Interfaces:**
- Produces: `statusOrder(status: "green"|"yellow"|"red"|null): number` (red 0, yellow 1, green 2, null 3); `statusLabel(status)`: "Al día"/"Atención"/"Bloqueado"/"Sin datos"; `statusClass(status)`: clases Tailwind para el punto; `timeAgo(date: Date, now?: Date): string` ("hace 5 min", "hace 3 h", "hace 2 días"); `sortClients(rows)`.

- [ ] **Step 1: tests** de `statusOrder`, `sortClients` (rojo antes que verde; dentro de rojo, más reciente primero; sin snapshot al final) y `timeAgo` (minutos, horas, días).
- [ ] **Step 2: implementar `status.ts` y `time.ts`.**
- [ ] **Step 3: `app/page.tsx`** server component: `export const dynamic = "force-dynamic"`; lee `listClientsWithLatest(getDb())`, ordena, renderiza grilla `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`. Cada tarjeta es `<Link href={/clients/${slug}}>` con: punto de color + nombre, `timeAgo(latest.generatedAt)` o "Sin datos", primera oración de `summary` (`split(/(?<=\.)\s/)[0]`), "N puntos abiertos". Header con título "Clientes" y botón "Salir" (form action que borra la cookie y redirige a /login, en `app/login/actions.ts` como `logout`).
- [ ] **Step 4: `npm test`, `npm run build`, smoke en navegador con datos insertados a mano vía API (curl). Commit** `feat(dashboard): grilla de clientes`

---

### Task 5: UI detalle de cliente con notas e historial

**Files:**
- Create: `dashboard/app/clients/[slug]/page.tsx`, `dashboard/app/clients/[slug]/notes.tsx`, `dashboard/app/clients/[slug]/actions.ts`

**Interfaces:**
- Consumes: `getClientDetail`, `createNote`, `updateNote`, `deleteNote`, `statusLabel`, `statusClass`, `timeAgo`.
- Produces (actions.ts, server actions, todas verifican la cookie con `verifySessionValue` antes de tocar DB y llaman `revalidatePath("/clients/" + slug)`): `addNote(slug, formData)`, `editNote(slug, id, formData)`, `removeNote(slug, id)`.

- [ ] **Step 1: page.tsx** — `notFound()` si null. Secciones: cabecera (nombre, semáforo, "actualizado hace X"), "Situación" (párrafos), "Próximos pasos" (lista; owner y due en gris), "Puntos abiertos" (lista; since en gris), "Notas" (`<Notes slug notes />`), `<details>` "Historial" con lista de snapshots (fecha, semáforo, summary), `<details>` "Fuentes" con links `https://mail.google.com/mail/u/0/#all/{threadId}` y `https://notes.granola.ai/d/{meetingId}`.
- [ ] **Step 2: notes.tsx** client component: textarea + botón "Agregar"; cada nota muestra fecha, cuerpo, botones "Editar" (pasa a textarea inline con "Guardar"/"Cancelar") y "Borrar" (con `confirm()`).
- [ ] **Step 3: actions.ts** con las tres acciones. Error si no hay sesión: `throw new Error("No autorizado")`.
- [ ] **Step 4: `npm run build`, smoke en navegador: agregar, editar, borrar nota. Commit** `feat(dashboard): detalle de cliente con notas e historial`

---

### Task 6: Seed de clientes y scripts de automatización

**Files:**
- Create: `dashboard/scripts/seed.ts`, `automation/scripts/api.sh`, `dashboard/README.md`
- Modify: `dashboard/package.json` (script `db:seed`)

- [ ] **Step 1: `scripts/seed.ts`** — con `dotenv` y `getDb()`, lee `dashboard/clients.json` (ignorado por git; `clients.example.json` da la forma: slug, name, gmailLabelName, domains, keywords) y hace `insert(clients).values(rows).onConflictDoNothing()`. Correr con `npx tsx scripts/seed.ts`.
- [ ] **Step 2: `automation/scripts/api.sh`**

```bash
#!/usr/bin/env bash
# Uso: api.sh GET /api/clients | api.sh POST /api/clients/<slug>/snapshots '{"status":"green",...}'
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
set -a; source "$here/../../dashboard/.env.local"; set +a
method="$1"; path="$2"; body="${3:-}"
args=(-sS -X "$method" "${DASHBOARD_URL%/}$path" -H "Authorization: Bearer $INGEST_TOKEN" -H "Content-Type: application/json")
[ -n "$body" ] && args+=(--data-binary "$body")
curl "${args[@]}"
```
`.env.example` gana `DASHBOARD_URL=http://localhost:3000`.
- [ ] **Step 3: README** — pasos de deploy: crear proyecto en Vercel apuntando a `dashboard/` como root, agregar Neon desde el marketplace (setea `DATABASE_URL`), cargar `DASHBOARD_PASSWORD`, `AUTH_SECRET`, `INGEST_TOKEN` (generar con `openssl rand -hex 32`), correr `npm run db:migrate` y `npm run db:seed` con el `DATABASE_URL` de Neon en `.env.local`, y setear `DASHBOARD_URL` con la URL del deploy.
- [ ] **Step 4: probar `api.sh GET /api/clients` contra dev local. Commit** `feat: seed de clientes y script de api para la automatización`

---

### Task 7: Prompt de la tarea programada y alta

**Files:**
- Create: `automation/daily-brief.md`

- [ ] **Step 1: escribir el prompt** siguiendo la sección "Flujo de la corrida diaria" de la spec, autocontenido: qué conectores usar (Gmail, Granola), cómo invocar `automation/scripts/api.sh` con ruta absoluta, el JSON exacto del snapshot, criterios del semáforo, regla de `hasChanges=false`, tagueo con `label_thread`, pasos de la primera corrida (crear las etiquetas que falten con `create_label`, inferir dominios y PATCH), y formato del resumen final (una línea por cliente: nombre, semáforo, qué cambió; lista de fallas).
- [ ] **Step 2: dar de alta la tarea** con `create_scheduled_task` (`taskId: daily-client-brief`, cron `0 8 * * 1-5`, prompt = contenido del archivo).
- [ ] **Step 3: correrla una vez a mano** con `run_scheduled_task` y verificar que el dashboard muestre snapshots. Commit** `feat: prompt de la corrida diaria`

---

## Self-review

- Spec coverage: datos (T1), auth (T2), API (T3), UI grilla (T4), UI detalle + notas (T5), seed + scripts + README de deploy (T6), corrida diaria y primera corrida (T7). Chat con Claude usa `api.sh` (T6). Cubierto.
- Placeholders: ninguno; los "..." en el seed refieren a la tabla de la spec.
- Tipos: `SnapshotInput` (validators) coincide campo a campo con `NewSnapshot` menos `clientId`; `createSnapshot(db, slug, SnapshotInput)` agrega `clientId`. `Db` viene de `client.ts` y lo usa `test/setup.ts`.
