import { NextRequest, NextResponse } from "next/server";
import { checkPassword, createSessionValue, isPasswordConfigured, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await isPasswordConfigured())) {
    return NextResponse.json({ error: "ADMIN_PASSWORD is not configured on the server." }, { status: 503 });
  }
  let password = "";
  try {
    password = String(((await req.json()) as { password?: unknown })?.password ?? "");
  } catch {}
  if (!(await checkPassword(password))) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }
  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE, await createSessionValue(), {
    httpOnly: true,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
