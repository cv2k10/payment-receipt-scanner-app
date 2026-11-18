import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

export const SESSION_COOKIE = "receipt_admin_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

async function getAdminPassword(): Promise<string | undefined> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    if (env.ADMIN_PASSWORD) return env.ADMIN_PASSWORD;
  } catch {
    // not running with a Cloudflare context
  }
  return process.env.ADMIN_PASSWORD || undefined;
}

async function hmacHex(key: string, message: string) {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Session token derived from the admin password; changing the password invalidates all sessions. */
async function sessionToken(password: string) {
  return hmacHex(password, "receipt-scanner-admin-session-v1");
}

export async function isPasswordConfigured() {
  return Boolean(await getAdminPassword());
}

export async function checkPassword(candidate: string) {
  const password = await getAdminPassword();
  if (!password || typeof candidate !== "string") return false;
  // Compare HMACs so timing does not depend on the password's length or content.
  const [a, b] = await Promise.all([hmacHex("pw-check", candidate), hmacHex("pw-check", password)]);
  return safeEqual(a, b);
}

export async function createSessionValue() {
  const password = await getAdminPassword();
  if (!password) throw new Error("ADMIN_PASSWORD is not configured");
  return sessionToken(password);
}

export async function isAuthenticated(req: Request) {
  const password = await getAdminPassword();
  if (!password) return false;
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!match) return false;
  const value = decodeURIComponent(match.slice(SESSION_COOKIE.length + 1));
  return safeEqual(value, await sessionToken(password));
}

/** Returns a 401/503 response when the request is not authorized, otherwise null. */
export async function requireAdmin(req: Request): Promise<NextResponse | null> {
  if (!(await isPasswordConfigured())) {
    return NextResponse.json({ error: "ADMIN_PASSWORD is not configured on the server." }, { status: 503 });
  }
  if (!(await isAuthenticated(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
