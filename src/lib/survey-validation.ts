import { z } from "zod";

const text = (max: number) => z.string().trim().max(max).refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "Keine Steuerzeichen oder Zeilenumbrüche verwenden.");
export const surveyConfigSchema = z.object({
  title: text(120).min(1), description: z.string().trim().max(2000),
  firstLabel: text(120).min(1), firstPlaceholder: text(120), firstRequired: z.boolean(),
  secondLabel: text(120).min(1), secondPlaceholder: text(120), secondRequired: z.boolean(),
  secondType: z.enum(["text", "single_choice"]), warnDuplicates: z.boolean(),
  options: z.array(text(60).min(1)).max(30),
}).strict().superRefine((config, ctx) => {
  if (config.secondType === "single_choice") {
    if (config.options.length < 2) ctx.addIssue({ code: "custom", message: "Mindestens zwei Auswahloptionen erforderlich." });
    if (config.secondPlaceholder) ctx.addIssue({ code: "custom", message: "Auswahlfelder haben keinen Platzhalter." });
    if (new Set(config.options.map((value) => value.toLocaleLowerCase("de"))).size !== config.options.length)
      ctx.addIssue({ code: "custom", message: "Auswahloptionen müssen eindeutig sein." });
  } else if (config.options.length) ctx.addIssue({ code: "custom", message: "Textfelder haben keine Auswahloptionen." });
});
export const surveyPasswordSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("generated") }).strict(),
  z.object({ mode: z.literal("manual"), password: z.string().min(12).max(128) }).strict(),
]);
export const surveyAnswerSchema = z.object({
  firstValue: text(200).nullable(), secondValue: text(200).nullable(), optionId: z.uuid().nullable(),
}).strict().transform((value) => ({
  ...value, firstValue: value.firstValue || null, secondValue: value.secondValue || null,
}));
export const surveyVersionSchema = z.number().int().min(0).max(2147483646);
export const surveyTokenSchema = z.string().regex(/^[a-f0-9]{48}$/);
