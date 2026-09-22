import { timingSafeEqual } from "./compare";
import { error } from "../api/respond";

/** Devuelve una respuesta 401 si el bearer token falta o no coincide; null si está bien. */
export function requireApiToken(request: Request): Response | null {
  const expected = process.env.INGEST_TOKEN ?? "";
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!expected || !token || !timingSafeEqual(token, expected)) return error("No autorizado", 401);
  return null;
}
