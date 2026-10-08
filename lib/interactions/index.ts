import { MockInteractionProvider } from "./mock-provider";
import type { InteractionProvider } from "./types";

// Register verified interaction sources here. Keep API keys server-side.
const INTERACTION_PROVIDERS: Record<string, () => InteractionProvider> = {
  mock: () => new MockInteractionProvider(),
};

let cachedProvider: InteractionProvider | null = null;

function getInteractionProvider(): InteractionProvider {
  if (cachedProvider) return cachedProvider;
  const requested = (process.env.INTERACTION_PROVIDER ?? "mock").toLowerCase();
  const factory = INTERACTION_PROVIDERS[requested] ?? INTERACTION_PROVIDERS.mock!;
  cachedProvider = factory();
  return cachedProvider;
}

export function checkMedicineInteractions(medicineNames: string[]) {
  return getInteractionProvider().checkPairs(medicineNames);
}

export type { InteractionFinding, InteractionProvider } from "./types";
