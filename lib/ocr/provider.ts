import { MockOcrProvider } from "./mock-provider";
import type { OcrProvider } from "./types";

// Register production engines here. Each entry must implement OcrProvider and read its credentials
// from server-side environment variables only (never from NEXT_PUBLIC_* variables).
const OCR_PROVIDERS: Record<string, () => OcrProvider> = {
  mock: () => new MockOcrProvider(),
};

let cachedProvider: OcrProvider | null = null;

export function getOcrProvider(): OcrProvider {
  if (cachedProvider) return cachedProvider;
  const requested = (process.env.OCR_PROVIDER ?? "mock").toLowerCase();
  const factory = OCR_PROVIDERS[requested];
  if (!factory) {
    console.warn(`[ocr] Unknown OCR_PROVIDER "${requested}". Falling back to the mock provider.`);
  }
  cachedProvider = (factory ?? OCR_PROVIDERS.mock!)();
  return cachedProvider;
}
