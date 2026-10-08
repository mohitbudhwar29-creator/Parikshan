import { MockHealthAIProvider } from "./mock-provider";
import type { HealthAIProvider } from "./types";

// Register hosted model adapters here (OpenAI, Gemini, Azure OpenAI, ...). Each adapter must:
//  - read its API key from a server-only environment variable (never NEXT_PUBLIC_*),
//  - send only the HealthContext it is given (the profile's own records) and never raw user data,
//  - return validated output (AssistantAnswer, HealthSummary) so the UI never sees free-form JSON.
const AI_PROVIDERS: Record<string, () => HealthAIProvider> = {
  mock: () => new MockHealthAIProvider(),
};

let cachedProvider: HealthAIProvider | null = null;

export function getHealthAIProvider(): HealthAIProvider {
  if (cachedProvider) return cachedProvider;
  const requested = (process.env.AI_PROVIDER ?? "mock").toLowerCase();
  const factory = AI_PROVIDERS[requested];
  if (!factory) {
    console.warn(`[ai] Unknown AI_PROVIDER "${requested}". Falling back to the mock provider.`);
  }
  cachedProvider = (factory ?? AI_PROVIDERS.mock!)();
  return cachedProvider;
}
