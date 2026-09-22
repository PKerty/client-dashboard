import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionValue } from "./src/auth/session";

export async function proxy(request: NextRequest) {
  const ok = await verifySessionValue(
    process.env.AUTH_SECRET ?? "",
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  if (ok) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|api|_next|favicon.ico).*)"],
};
