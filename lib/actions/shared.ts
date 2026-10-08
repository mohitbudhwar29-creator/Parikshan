import type { ZodError } from "zod";

export type FieldErrors = Partial<Record<string, string>>;

/** Turns a Zod error into a field -> message map. Messages are the schema texts (already plain English). */
export function fieldErrorsFrom(error: ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
