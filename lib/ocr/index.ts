import { getOcrProvider } from "./provider";
import type { OcrInput, OcrResult } from "./types";

export { extractLabValues, extractPrescriptionData, classifyDocument, findDocumentDate } from "./parsers";
export type { OcrInput, OcrResult, OcrProvider } from "./types";

/**
 * Reads text from an uploaded document using the configured OCR provider.
 * Never log the returned text: it contains personal health information.
 */
export async function extractTextFromImage(input: OcrInput): Promise<OcrResult> {
  return getOcrProvider().readText(input);
}
