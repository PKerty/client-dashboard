import { requireApiToken } from "@/src/auth/api-token";
import { error, json, readJson } from "@/src/api/respond";
import { noteInput } from "@/src/api/validators";
import { getDb } from "@/src/db/client";
import { createNote } from "@/src/db/queries";

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const denied = requireApiToken(request);
  if (denied) return denied;
  const { slug } = await ctx.params;
  const parsed = noteInput.safeParse(await readJson(request));
  if (!parsed.success) return error("Cuerpo inválido: " + parsed.error.message, 400);
  const created = await createNote(await getDb(), slug, parsed.data.body);
  if (!created) return error("Cliente desconocido", 404);
  return json(created, 201);
}
