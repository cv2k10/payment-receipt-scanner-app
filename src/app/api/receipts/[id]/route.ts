import { NextRequest, NextResponse } from "next/server";
import { getDb, serializeReceipt, toNum } from "@/db";
import { receipts } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { eq } from "drizzle-orm";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const db = await getDb();
    const { id } = await params;
    const body = (await req.json()) as any;
    const [row] = await db
      .update(receipts)
      .set({
        merchant: body.merchant,
        merchantAddress: body.merchantAddress || null,
        receiptDate: body.date || body.receiptDate || null,
        receiptTime: body.time || body.receiptTime || null,
        receiptNumber: body.receiptNumber || null,
        category: body.category,
        paymentMethod: body.paymentMethod,
        currency: body.currency,
        subtotal: toNum(body.subtotal),
        tax: toNum(body.tax),
        tip: toNum(body.tip),
        discount: toNum(body.discount),
        total: toNum(body.total),
        items: Array.isArray(body.items) ? body.items : [],
        notes: body.notes || null,
        updatedAt: new Date(),
      })
      .where(eq(receipts.id, Number(id)))
      .returning();
    if (!row) return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
    return NextResponse.json({ receipt: serializeReceipt(row) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const db = await getDb();
    const { id } = await params;
    await db.delete(receipts).where(eq(receipts.id, Number(id)));
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
