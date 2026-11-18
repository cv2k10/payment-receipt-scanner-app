import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";

export type ReceiptItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export const receipts = sqliteTable("receipts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  merchant: text("merchant").notNull(),
  merchantAddress: text("merchant_address"),
  receiptDate: text("receipt_date"), // YYYY-MM-DD
  receiptTime: text("receipt_time"),
  receiptNumber: text("receipt_number"),
  category: text("category").notNull().default("Other"),
  paymentMethod: text("payment_method").notNull().default("Card"),
  currency: text("currency").notNull().default("USD"),
  subtotal: real("subtotal").notNull().default(0),
  tax: real("tax").notNull().default(0),
  tip: real("tip").notNull().default(0),
  discount: real("discount").notNull().default(0),
  total: real("total").notNull().default(0),
  items: text("items", { mode: "json" }).$type<ReceiptItem[]>().notNull().default([]),
  notes: text("notes"),
  fileName: text("file_name"),
  imageUrl: text("image_url"),
  rawText: text("raw_text"),
  confidence: real("confidence"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export type ReceiptRecord = typeof receipts.$inferSelect;
