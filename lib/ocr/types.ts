// OCR abstraction. Any engine (Google Document AI, Azure Document Intelligence, AWS Textract,
// Tesseract, a hospital PACS/LIS feed...) implements OcrProvider and is selected in provider.ts.

export interface OcrInput {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}

export interface OcrPage {
  pageNumber: number;
  text: string;
  /** 0..1 engine confidence for the page. */
  confidence: number;
}

export interface OcrResult {
  provider: string;
  text: string;
  pages: OcrPage[];
  averageConfidence: number;
}

export interface OcrProvider {
  readonly name: string;
  readText(input: OcrInput): Promise<OcrResult>;
}
