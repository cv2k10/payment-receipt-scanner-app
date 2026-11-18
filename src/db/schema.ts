import { pgTable, serial, text, varchar, numeric, timestamp, jsonb, date } from "drizzle-orm/pg-core";

export type ReceiptItem = {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export const receipts = pgTable("receipts", {
  id: serial("id").primaryKey(),
  merchant: varchar("merchant", { length: 255 }).notNull(),
  merchantAddress: text("merchant_address"),
  receiptDate: date("receipt_date"),
  receiptTime: varchar("receipt_time", { length: 32 }),
  receiptNumber: varchar("receipt_number", { length: 128 }),
  category: varchar("category", { length: 80 }).notNull().default("Other"),
  paymentMethod: varchar("payment_method", { length: 80 }).notNull().default("Card"),
  currency: varchar("currency", { length: 12 }).notNull().default("USD"),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
  tax: numeric("tax", { precision: 12, scale: 2 }).notNull().default("0"),
  tip: numeric("tip", { precision: 12, scale: 2 }).notNull().default("0"),
  discount: numeric("discount", { precision: 12, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
  items: jsonb("items").$type<ReceiptItem[]>().notNull().default([]),
  notes: text("notes"),
  fileName: varchar("file_name", { length: 255 }),
  imageUrl: text("image_url"),
  rawText: text("raw_text"),
  confidence: numeric("confidence", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
