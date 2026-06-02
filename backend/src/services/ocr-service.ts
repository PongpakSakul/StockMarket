import { OCRResult } from '../types';

/**
 * Default configuration for the OCR service retry logic.
 */
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_INITIAL_BACKOFF_MS = 2000;

/**
 * Google Cloud Vision API text detection endpoint template.
 * The API key is appended as a query parameter.
 */
const VISION_API_URL =
  'https://vision.googleapis.com/v1/images:annotate';

/**
 * Sleep for the given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Configuration options for the OCR service.
 * Exposed for testing — callers can override retry behaviour and the
 * fetch implementation.
 */
export interface OCRServiceOptions {
  /** Maximum number of retries after the initial attempt (default: 2) */
  maxRetries?: number;
  /** Initial backoff delay in milliseconds (default: 2000) */
  initialBackoffMs?: number;
  /** Override the fetch implementation (useful for testing) */
  fetchFn?: typeof fetch;
  /** Override the sleep implementation (useful for testing) */
  sleepFn?: (ms: number) => Promise<void>;
  /** Override the API key (defaults to process.env.GOOGLE_CLOUD_VISION_API_KEY) */
  apiKey?: string;
}

/**
 * Build the request body for the Google Cloud Vision API TEXT_DETECTION call.
 */
function buildRequestBody(base64Image: string): object {
  return {
    requests: [
      {
        image: { content: base64Image },
        features: [{ type: 'TEXT_DETECTION' }],
      },
    ],
  };
}

/**
 * Determine whether an HTTP status code is retryable.
 * 429 (rate-limited), 500, 502, 503, 504 are considered transient.
 */
function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

/**
 * Extract the full text annotation and average confidence from the
 * Vision API response payload.
 */
function parseVisionResponse(body: unknown): { text: string; confidence: number } {
  const responses = (body as { responses?: unknown[] })?.responses;
  if (!Array.isArray(responses) || responses.length === 0) {
    return { text: '', confidence: 0 };
  }

  const firstResponse = responses[0] as {
    fullTextAnnotation?: { text?: string; pages?: Array<{ confidence?: number }> };
    textAnnotations?: Array<{ description?: string }>;
    error?: { message?: string };
  };

  // Check for per-response errors
  if (firstResponse.error) {
    throw new Error(firstResponse.error.message ?? 'Vision API returned an error');
  }

  // Prefer fullTextAnnotation (includes confidence)
  if (firstResponse.fullTextAnnotation) {
    const text = firstResponse.fullTextAnnotation.text ?? '';
    const pages = firstResponse.fullTextAnnotation.pages ?? [];
    const confidence =
      pages.length > 0 && pages[0].confidence !== undefined
        ? pages[0].confidence
        : 0.9; // default high confidence when text is present
    return { text, confidence };
  }

  // Fallback to textAnnotations (first entry is the full text)
  if (
    Array.isArray(firstResponse.textAnnotations) &&
    firstResponse.textAnnotations.length > 0
  ) {
    const text = firstResponse.textAnnotations[0].description ?? '';
    return { text, confidence: 0.85 };
  }

  return { text: '', confidence: 0 };
}

/**
 * Extract text from an image buffer using the Google Cloud Vision API.
 *
 * The image is sent as base64-encoded content to the TEXT_DETECTION endpoint.
 * Transient failures (5xx, 429) are retried up to `maxRetries` times with
 * exponential backoff starting at `initialBackoffMs` (default 2 s → 4 s).
 *
 * Requirements: 3.2, 3.6
 *
 * @param imageBuffer - Raw image bytes (JPG or PNG)
 * @param options     - Optional overrides for retry behaviour and dependencies
 * @returns An OCRResult with extracted text, confidence, and success flag
 */
export async function extractText(
  imageBuffer: Buffer,
  options: OCRServiceOptions = {},
): Promise<OCRResult> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const initialBackoffMs = options.initialBackoffMs ?? DEFAULT_INITIAL_BACKOFF_MS;
  const fetchFn = options.fetchFn ?? fetch;
  const sleepFn = options.sleepFn ?? sleep;
  const apiKey = options.apiKey ?? process.env.GOOGLE_CLOUD_VISION_API_KEY;

  if (!apiKey) {
    return {
      text: '',
      confidence: 0,
      success: false,
      error: 'GOOGLE_CLOUD_VISION_API_KEY is not configured',
    };
  }

  const base64Image = imageBuffer.toString('base64');
  const requestBody = buildRequestBody(base64Image);
  const url = `${VISION_API_URL}?key=${encodeURIComponent(apiKey)}`;

  let lastError: string | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Wait before retrying (skip delay on the first attempt)
    if (attempt > 0) {
      const delayMs = initialBackoffMs * Math.pow(2, attempt - 1);
      await sleepFn(delayMs);
    }

    try {
      const response = await fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');

        if (isRetryableStatus(response.status) && attempt < maxRetries) {
          lastError = `HTTP ${response.status}: ${errorText}`;
          continue; // retry
        }

        // Non-retryable or exhausted retries
        return {
          text: '',
          confidence: 0,
          success: false,
          error: `Google Cloud Vision API error: HTTP ${response.status}`,
        };
      }

      const body: unknown = await response.json();
      const { text, confidence } = parseVisionResponse(body);

      if (!text) {
        return {
          text: '',
          confidence: 0,
          success: false,
          error: 'No text detected in the image',
        };
      }

      return {
        text,
        confidence,
        success: true,
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unknown error occurred';

      if (attempt < maxRetries) {
        lastError = message;
        continue; // retry on network errors
      }

      return {
        text: '',
        confidence: 0,
        success: false,
        error: `OCR processing failed after ${maxRetries + 1} attempts: ${message}`,
      };
    }
  }

  // Should not reach here, but handle gracefully
  return {
    text: '',
    confidence: 0,
    success: false,
    error: `OCR processing failed after ${maxRetries + 1} attempts: ${lastError ?? 'Unknown error'}`,
  };
}
