import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated, isPasswordConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return NextResponse.json({
    configured: await isPasswordConfigured(),
    authenticated: await isAuthenticated(req),
  });
}
