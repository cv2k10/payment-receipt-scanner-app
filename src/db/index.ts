import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import type { ReceiptRecord } from "./schema";

/** Drizzle client bound to the Cloudflare D1 database (binding: DB). */
export async function getDb() {
  const { env } = await getCloudflareContext({ async: true });
  return drizzle(env.DB);
}

const money = (n: number | null | undefined) => (Number(n) || 0).toFixed(2);

/**
 * Keep the API response shape identical to the original PostgreSQL version,
 * where numeric columns were returned as fixed-2 decimal strings.
 */
export function serializeReceipt(r: ReceiptRecord) {
  return {
    ...r,
    subtotal: money(r.subtotal),
    tax: money(r.tax),
    tip: money(r.tip),
    discount: money(r.discount),
    total: money(r.total),
    confidence: r.confidence == null ? null : money(r.confidence),
  };
}

export const toNum = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
