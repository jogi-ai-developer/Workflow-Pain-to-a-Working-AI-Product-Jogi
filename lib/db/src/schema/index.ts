import { jsonb, pgTable, serial, text } from "drizzle-orm/pg-core";

export const analysesTable = pgTable("analyses", {
  id: serial("id").primaryKey(),
  timestamp: text("timestamp").notNull(),
  steps: jsonb("steps").notNull(),
  input: jsonb("input"),
  logic: jsonb("logic").notNull(),
  ai: jsonb("ai"),
  confidence: text("confidence").notNull(),
  status: text("status").notNull(),
  errorMessage: text("error_message"),
});
