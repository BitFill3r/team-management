import { z } from "zod";

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T12:00:00Z`);
  return value >= "2000-01-01" && value <= "2100-12-31" &&
    !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Bitte ein gültiges Datum zwischen 2000 und 2100 wählen.");
export const nameSchema = z.string().trim().min(1).max(60).refine((name) => !/[\u0000-\u001f\u007f]/.test(name));
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .refine((value) => value >= "2000-01" && value <= "2100-12");
const version = z.number().int().min(0).max(2147483646);
export const childCreateSchema = z.object({ name: nameSchema });
export const childUpdateSchema = z.object({ id: z.uuid(), version, name: nameSchema, archived: z.boolean() });
export const childDeleteSchema = z.object({ id: z.uuid(), version, confirmed: z.literal(true) });
export const attendanceSchema = z.object({ trainingId: z.uuid(), childId: z.uuid(), version, present: z.boolean() });
