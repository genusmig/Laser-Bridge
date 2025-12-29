import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const macros = pgTable("macros", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  gcode: text("gcode").notNull(),
  color: text("color").default("blue"), // for UI button color
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMacroSchema = createInsertSchema(macros).omit({ id: true, createdAt: true });

export type Macro = typeof macros.$inferSelect;
export type InsertMacro = z.infer<typeof insertMacroSchema>;

export type CreateMacroRequest = InsertMacro;
export type UpdateMacroRequest = Partial<InsertMacro>;
