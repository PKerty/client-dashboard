"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { timingSafeEqual } from "@/src/auth/compare";
import { SESSION_COOKIE, SESSION_TTL_MS, createSessionValue } from "@/src/auth/session";

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  const expected = process.env.DASHBOARD_PASSWORD ?? "";
  const secret = process.env.AUTH_SECRET ?? "";
  if (!expected || !secret) return { error: "El servidor no tiene configurada la clave" };
  if (!timingSafeEqual(password, expected)) return { error: "Clave incorrecta" };

  const store = await cookies();
  store.set(SESSION_COOKIE, await createSessionValue(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  redirect("/");
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
