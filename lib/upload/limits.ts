// Client-safe upload limits. Keep this file free of Node imports: client components import it.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_UPLOAD_TYPES = ["image/jpeg", "image/png", "application/pdf"] as const;
