export * from "./health";

/** Result shape returned by server actions. Errors carry a translation key, never raw messages. */
export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; errorKey: string; detail?: string };
