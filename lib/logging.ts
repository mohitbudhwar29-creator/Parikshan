// Logs only error names and codes. Never log record text, values, names or file contents.
export function logSafe(message: string, error: unknown): void {
  const name = error instanceof Error ? error.name : "UnknownError";
  console.error(`[phc] ${message}: ${name}`);
}
