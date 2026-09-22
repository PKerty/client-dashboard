import { requireApiToken } from "@/src/auth/api-token";
import { error, json, readJson } from "@/src/api/respond";
import { snapshotInput } from "@/src/api/validators";
import { getDb } from "@/src/db/client";
import { createSnapshot } from "@/src/db/queries";

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const denied = requireApiToken(request);
  if (denied) return denied;
  const { slug } = await ctx.params;
  const parsed = snapshotInput.safeParse(await readJson(request));
  if (!parsed.success) return error("Cuerpo inválido: " + parsed.error.message, 400);
  const created = await createSnapshot(await getDb(), slug, parsed.data);
  if (!created) return error("Cliente desconocido", 404);
  return json(created, 201);
}
