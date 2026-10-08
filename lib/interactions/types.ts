// Drug-interaction abstraction. A verified source (for example a licensed drug database or an
// national formulary API) implements InteractionProvider and is registered in index.ts.

export interface InteractionFinding {
  medicineA: string;
  medicineB: string;
  severity: "potential";
  description: string;
  source: string;
}

export interface InteractionProvider {
  readonly name: string;
  /** Checks every pair of the given medicine names. Never returns advice to stop a medicine. */
  checkPairs(medicineNames: string[]): Promise<InteractionFinding[]>;
}
