import { requireApiToken } from "@/src/auth/api-token";
import { json } from "@/src/api/respond";
import { getDb } from "@/src/db/client";
import { listClientsWithLatest } from "@/src/db/queries";

export async function GET(request: Request) {
  const denied = requireApiToken(request);
  if (denied) return denied;
  return json(await listClientsWithLatest(await getDb()));
}
