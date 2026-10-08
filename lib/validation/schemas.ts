import { z } from "zod";
import { RELATIONSHIPS, SLOTS, extractedRecordSchema } from "@/types/health";

// Server-side validation for every user-supplied input. Client forms reuse these schemas
// for instant feedback, but the server never trusts the client.

export const ABHA_PATTERN = /^\d{2}-?\d{4}-?\d{4}-?\d{4}$/;

export const abhaSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || ABHA_PATTERN.test(value), "ABHA numbers have 14 digits.")
  .transform((value) => (value === "" ? null : value.replace(/-/g, "")));

export const loginSchema = z.object({
  abhaNumber: abhaSchema,
  name: z.string().trim().min(2, "Please enter your full name.").max(80),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address.").max(120),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const idSchema = z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);

export const profileSchema = z.object({
  name: z.string().trim().min(1, "Please enter a name.").max(80),
  dateOfBirth: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Please enter a valid date of birth.")
    .refine((value) => {
      const date = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now();
    }, "Please enter a valid date of birth.")
    .optional()
    .or(z.literal("")),
  relationship: z.enum(RELATIONSHIPS),
});

export const medicationInputSchema = z
  .object({
    name: z.string().trim().min(1, "Medicine name is required.").max(120),
    dosage: z.string().trim().min(1, "Dosage is required.").max(60),
    timesPerDay: z.number().int().min(0).max(3),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
    notes: z.string().trim().max(300).default(""),
  })
  .refine((value) => value.endDate === "" || value.endDate >= value.startDate, {
    message: "End date must be after the start date.",
    path: ["endDate"],
  });
export type MedicationInput = z.infer<typeof medicationInputSchema>;

export const doseToggleSchema = z.object({
  medicationId: idSchema,
  slot: z.enum(SLOTS),
  taken: z.boolean(),
});

export const confirmRecordSchema = extractedRecordSchema;

export const questionSchema = z.string().trim().min(1, "Please type a question.").max(500);

export const interactionCheckSchema = z.object({
  medicines: z.array(z.string().trim().min(1).max(120)).min(2, "Select at least two medicines.").max(10),
});

export const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
