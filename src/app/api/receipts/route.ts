import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { receipts } from "@/db/schema";
import { desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db.select().from(receipts).orderBy(desc(receipts.createdAt)).limit(500);
    return NextResponse.json({ receipts: rows });
  } catch (e: any) {
    // If table doesn't exist yet, return empty
    return NextResponse.json({ receipts: [], error: e?.message });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const [row] = await db
      .insert(receipts)
      .values({
        merchant: body.merchant || "Unknown Merchant",
        merchantAddress: body.merchantAddress || null,
        receiptDate: body.date || body.receiptDate || null,
        receiptTime: body.time || body.receiptTime || null,
        receiptNumber: body.receiptNumber || null,
        category: body.category || "Other",
        paymentMethod: body.paymentMethod || "Card",
        currency: body.currency || "USD",
        subtotal: String(body.subtotal ?? 0),
        tax: String(body.tax ?? 0),
        tip: String(body.tip ?? 0),
        discount: String(body.discount ?? 0),
        total: String(body.total ?? 0),
        items: Array.isArray(body.items) ? body.items : [],
        notes: body.notes || null,
        fileName: body.fileName || null,
        imageUrl: body.imageUrl || null,
        rawText: body.rawText || null,
        confidence: body.confidence != null ? String(body.confidence) : null,
      })
      .returning();
    return NextResponse.json({ receipt: row }, { status: 201 });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message || "Failed to save receipt" }, { status: 500 });
  }
}

// Seed demo data
export async function PUT() {
  try {
    const countRes: any = await db.execute(sql`select count(*)::int as c from receipts`);
    const c = countRes.rows?.[0]?.c ?? 0;
    if (c > 0) return NextResponse.json({ message: "Already has data", count: c });

    const demos = [
      {
        merchant: "Whole Foods Market",
        merchantAddress: "399 4th St, San Francisco, CA",
        receiptDate: "2026-05-18",
        receiptTime: "14:32",
        receiptNumber: "WF-884120",
        category: "Groceries",
        paymentMethod: "Card",
        currency: "USD",
        subtotal: "86.42",
        tax: "7.18",
        tip: "0",
        discount: "0",
        total: "93.60",
        items: [
          { name: "Organic Avocados (4ct)", quantity: 1, unitPrice: 6.99, total: 6.99 },
          { name: "Almond Milk 64oz", quantity: 2, unitPrice: 4.49, total: 8.98 },
          { name: "Free Range Eggs 12ct", quantity: 1, unitPrice: 7.99, total: 7.99 },
          { name: "Sourdough Loaf", quantity: 1, unitPrice: 5.5, total: 5.5 },
          { name: "Atlantic Salmon Fillet", quantity: 1, unitPrice: 24.96, total: 24.96 },
          { name: "Organic Spinach", quantity: 2, unitPrice: 3.99, total: 7.98 },
          { name: "Greek Yogurt", quantity: 3, unitPrice: 5.29, total: 15.87 },
          { name: "Cold Brew Coffee", quantity: 1, unitPrice: 8.15, total: 8.15 },
        ],
        fileName: "wholefoods-receipt.jpg",
        confidence: "96",
      },
      {
        merchant: "Starbucks",
        merchantAddress: "1200 Broadway, New York, NY",
        receiptDate: "2026-05-19",
        receiptTime: "08:15",
        receiptNumber: "SB-239401",
        category: "Coffee",
        paymentMethod: "Mobile Pay",
        currency: "USD",
        subtotal: "12.45",
        tax: "1.05",
        tip: "2.00",
        discount: "0",
        total: "15.50",
        items: [
          { name: "Grande Caramel Latte", quantity: 1, unitPrice: 6.45, total: 6.45 },
          { name: "Butter Croissant", quantity: 1, unitPrice: 3.75, total: 3.75 },
          { name: "Oat Milk Add-on", quantity: 1, unitPrice: 0.8, total: 0.8 },
          { name: "Banana Nut Loaf", quantity: 1, unitPrice: 1.45, total: 1.45 },
        ],
        fileName: "starbucks.jpg",
        confidence: "98",
      },
      {
        merchant: "Shell Gas Station",
        merchantAddress: "88 Highway 101, Austin, TX",
        receiptDate: "2026-05-17",
        receiptTime: "19:04",
        receiptNumber: "SH-7712",
        category: "Fuel",
        paymentMethod: "Card",
        currency: "USD",
        subtotal: "52.30",
        tax: "0",
        tip: "0",
        discount: "0",
        total: "52.30",
        items: [{ name: "Unleaded 87 - 13.42 gal @ $3.897", quantity: 1, unitPrice: 52.3, total: 52.3 }],
        fileName: "shell-fuel.jpg",
        confidence: "94",
      },
      {
        merchant: "Olive Garden",
        merchantAddress: "555 Olive Way, Chicago, IL",
        receiptDate: "2026-05-20",
        receiptTime: "20:12",
        receiptNumber: "OG-552310",
        category: "Dining",
        paymentMethod: "Card",
        currency: "USD",
        subtotal: "68.97",
        tax: "6.21",
        tip: "13.00",
        discount: "0",
        total: "88.18",
        items: [
          { name: "Chicken Alfredo", quantity: 1, unitPrice: 19.99, total: 19.99 },
          { name: "Shrimp Scampi", quantity: 1, unitPrice: 21.49, total: 21.49 },
          { name: "Caesar Salad", quantity: 2, unitPrice: 9.99, total: 19.98 },
          { name: "Tiramisu", quantity: 1, unitPrice: 7.51, total: 7.51 },
        ],
        fileName: "olive-garden.jpg",
        confidence: "91",
      },
    ];

    const inserted = await db.insert(receipts).values(demos as any).returning();
    return NextResponse.json({ receipts: inserted });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
