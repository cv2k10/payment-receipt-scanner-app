import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { receipts } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
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
        subtotal: String(body.subtotal ?? 0),
        tax: String(body.tax ?? 0),
        tip: String(body.tip ?? 0),
        discount: String(body.discount ?? 0),
        total: String(body.total ?? 0),
        items: Array.isArray(body.items) ? body.items : [],
        notes: body.notes || null,
        updatedAt: new Date(),
      })
      .where(eq(receipts.id, Number(id)))
      .returning();
    return NextResponse.json({ receipt: row });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.delete(receipts).where(eq(receipts.id, Number(id)));
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
