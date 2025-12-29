import { db } from "./db";
import {
  macros,
  type Macro,
  type InsertMacro,
  type UpdateMacroRequest
} from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  getMacros(): Promise<Macro[]>;
  createMacro(macro: InsertMacro): Promise<Macro>;
  updateMacro(id: number, updates: UpdateMacroRequest): Promise<Macro>;
  deleteMacro(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getMacros(): Promise<Macro[]> {
    return await db.select().from(macros);
  }

  async createMacro(insertMacro: InsertMacro): Promise<Macro> {
    const [macro] = await db.insert(macros).values(insertMacro).returning();
    return macro;
  }

  async updateMacro(id: number, updates: UpdateMacroRequest): Promise<Macro> {
    const [updated] = await db.update(macros)
      .set(updates)
      .where(eq(macros.id, id))
      .returning();
    return updated;
  }

  async deleteMacro(id: number): Promise<void> {
    await db.delete(macros).where(eq(macros.id, id));
  }
}

export const storage = new DatabaseStorage();
