import { requireApiToken } from "@/src/auth/api-token";
import { error, json, readJson } from "@/src/api/respond";
import { clientPatch } from "@/src/api/validators";
import { getDb } from "@/src/db/client";
import { getClientDetail, patchClient } from "@/src/db/queries";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const denied = requireApiToken(request);
  if (denied) return denied;
  const { slug } = await ctx.params;
  const detail = await getClientDetail(await getDb(), slug);
  if (!detail) return error("Cliente desconocido", 404);
  return json(detail);
}

export async function PATCH(request: Request, ctx: Ctx) {
  const denied = requireApiToken(request);
  if (denied) return denied;
  const { slug } = await ctx.params;
  const parsed = clientPatch.safeParse(await readJson(request));
  if (!parsed.success) return error("Cuerpo inválido: " + parsed.error.message, 400);
  const updated = await patchClient(await getDb(), slug, parsed.data);
  if (!updated) return error("Cliente desconocido", 404);
  return json(updated);
}
