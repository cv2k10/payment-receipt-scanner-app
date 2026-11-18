import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireAdmin } from "@/lib/auth";

const INVOKE_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

async function getApiKey() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    if (env.NVIDIA_API_KEY) return env.NVIDIA_API_KEY;
  } catch {}
  return process.env.NVIDIA_API_KEY || "";
}

const EXTRACTION_PROMPT = `You are an expert receipt OCR and data extraction system. Analyze this payment receipt image carefully and extract all structured data.

Return ONLY a valid JSON object. No markdown, no explanation, no code fences. Just JSON.

Use this exact schema:
{
  "merchant": "string - store/restaurant/business name, e.g. Starbucks",
  "merchantAddress": "string or null - full address if visible",
  "date": "YYYY-MM-DD or null if not found",
  "time": "HH:MM or null",
  "receiptNumber": "string or null - receipt / invoice / transaction / order number",
  "category": "one of: Groceries, Dining, Coffee, Transport, Shopping, Utilities, Healthcare, Entertainment, Travel, Fuel, Other",
  "paymentMethod": "one of: Card, Cash, Mobile Pay, Bank Transfer, Other - infer from receipt (Visa/Mastercard/Amex = Card)",
  "currency": "USD or EUR or GBP etc - 3 letter code, infer from $ € £ symbols",
  "subtotal": number,
  "tax": number,
  "tip": number,
  "discount": number,
  "total": number,
  "items": [
    {"name": "item name", "quantity": number, "unitPrice": number, "total": number}
  ],
  "notes": "string or null - any useful extra info like cashier, table, loyalty points",
  "confidence": number between 0 and 100 - how confident you are
}

Rules:
- All money values must be numbers (not strings), e.g. 12.99 not "12.99". Use 0 if not found.
- If total is visible, use the exact total printed. Items total should ideally sum to subtotal.
- Extract EVERY line item you can read. Clean up item names.
- Date must be YYYY-MM-DD. Convert any format.
- If something is unreadable, use null / 0 and lower confidence.
- Do not hallucinate items that are not on the receipt.`;

function extractJson(text: string) {
  if (!text) return null;
  let cleaned = text.trim();
  // Remove markdown fences
  cleaned = cleaned.replace(/```json/gi, "").replace(/```/g, "").trim();
  // Find first { and last }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  const jsonStr = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(jsonStr);
  } catch {
    // try fixing trailing commas
    try {
      return JSON.parse(jsonStr.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]"));
    } catch {
      return null;
    }
  }
}

function normalize(data: any, fileName: string) {
  const num = (v: any) => {
    const n = typeof v === "string" ? parseFloat(v.replace(/[^0-9.-]/g, "")) : Number(v);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
  };
  const items = Array.isArray(data?.items)
    ? data.items.map((it: any) => ({
        name: String(it.name || it.description || "Item"),
        quantity: num(it.quantity || it.qty || 1) || 1,
        unitPrice: num(it.unitPrice ?? it.price ?? it.unit_price ?? 0),
        total: num(it.total ?? it.amount ?? ((num(it.quantity || 1) || 1) * num(it.unitPrice ?? it.price ?? 0))),
      }))
    : [];

  const subtotal = num(data?.subtotal);
  const total = num(data?.total) || items.reduce((s: number, i: any) => s + i.total, 0) + num(data?.tax);

  // Validate date
  let dateStr: string | null = null;
  if (data?.date) {
    const d = new Date(data.date);
    if (!isNaN(d.getTime())) dateStr = d.toISOString().slice(0, 10);
    else if (/^\d{4}-\d{2}-\d{2}/.test(String(data.date))) dateStr = String(data.date).slice(0, 10);
  }

  return {
    merchant: String(data?.merchant || "Unknown Merchant").slice(0, 255),
    merchantAddress: data?.merchantAddress || null,
    date: dateStr,
    time: data?.time || null,
    receiptNumber: data?.receiptNumber ? String(data.receiptNumber) : null,
    category: String(data?.category || "Other"),
    paymentMethod: String(data?.paymentMethod || "Card"),
    currency: String(data?.currency || "USD").toUpperCase().slice(0, 3),
    subtotal: subtotal || items.reduce((s: number, i: any) => s + i.total, 0),
    tax: num(data?.tax),
    tip: num(data?.tip),
    discount: num(data?.discount),
    total,
    items,
    notes: data?.notes || null,
    confidence: Math.min(100, Math.max(0, num(data?.confidence || 88))),
    fileName,
  };
}

function toBase64(bytes: Uint8Array) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  try {
    const form = await req.formData();
    const file = form.get("image") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No image provided. Upload a receipt image." }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File must be an image (JPG, PNG, WebP)." }, { status: 400 });
    }
    if (file.size > 12 * 1024 * 1024) {
      return NextResponse.json({ error: "Image too large. Max 12MB." }, { status: 400 });
    }

    const API_KEY = await getApiKey();
    if (!API_KEY) {
      return NextResponse.json({ error: "NVIDIA_API_KEY is not configured on the server." }, { status: 503 });
    }

    const base64 = toBase64(new Uint8Array(await file.arrayBuffer()));
    const mime = file.type || "image/jpeg";
    const dataUrl = `data:${mime};base64,${base64}`;

    const payload = {
      model: "mistralai/mistral-large-4-1t-a52b",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: EXTRACTION_PROMPT },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      max_tokens: 4096,
      stream: false,
      temperature: 0.15,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      reasoning_effort: "high",
    };

    const res = await fetch(INVOKE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("NVIDIA API error", res.status, errText.slice(0, 1000));
      return NextResponse.json(
        { error: `AI scan failed (${res.status}). ${errText.slice(0, 300)}` },
        { status: 502 }
      );
    }

    const json = (await res.json()) as any;
    const content: string =
      json?.choices?.[0]?.message?.content ||
      json?.choices?.[0]?.message?.reasoning_content ||
      "";

    const parsed = extractJson(content);
    if (!parsed) {
      return NextResponse.json(
        { error: "AI could not read this receipt. Try a clearer, well-lit photo.", raw: content.slice(0, 800) },
        { status: 422 }
      );
    }

    const normalized = normalize(parsed, file.name);
    return NextResponse.json({ success: true, data: normalized, raw: content });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e?.message || "Scan failed. Please try again." }, { status: 500 });
  }
}
