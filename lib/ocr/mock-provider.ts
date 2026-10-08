import { sleep } from "@/lib/utils";
import { DOCTOR_VISIT_SAMPLE_TEXT, LAB_REPORT_SAMPLE_TEXT, PRESCRIPTION_SAMPLE_TEXT } from "./mock-samples";
import type { OcrInput, OcrProvider, OcrResult } from "./types";

/**
 * Demo OCR. It does not read pixels. It returns a bundled sample document chosen by file name,
 * with a realistic processing delay, so the complete pipeline can be demonstrated offline.
 * Replace with a real engine by implementing OcrProvider (see README: "Replace mock OCR").
 */
export class MockOcrProvider implements OcrProvider {
  readonly name = "mock-ocr";

  async readText(input: OcrInput): Promise<OcrResult> {
    // Simulated engine latency: a phone photo takes longer than a small PDF.
    await sleep(1400 + Math.min(input.buffer.length / 50_000, 1800));

    const text = sampleFor(input.fileName);
    const confidence = input.mimeType === "application/pdf" ? 0.97 : 0.91;
    return {
      provider: this.name,
      text,
      pages: [{ pageNumber: 1, text, confidence }],
      averageConfidence: confidence,
    };
  }
}

function sampleFor(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (/(lab|blood|cbc|report|test)/.test(lower)) return LAB_REPORT_SAMPLE_TEXT;
  if (/(visit|doctor|opd|consult)/.test(lower)) return DOCTOR_VISIT_SAMPLE_TEXT;
  return PRESCRIPTION_SAMPLE_TEXT;
}
