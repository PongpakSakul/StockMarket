import { extractText, OCRServiceOptions } from './ocr-service';

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

const TEST_API_KEY = 'test-api-key-123';
const SAMPLE_IMAGE = Buffer.from('fake-image-bytes');

/**
 * Build a minimal successful Vision API response body.
 */
function visionSuccessBody(text: string, confidence = 0.95) {
  return {
    responses: [
      {
        fullTextAnnotation: {
          text,
          pages: [{ confidence }],
        },
        textAnnotations: [{ description: text }],
      },
    ],
  };
}

/**
 * Build a Vision API response with only textAnnotations (no fullTextAnnotation).
 */
function visionTextAnnotationsOnly(text: string) {
  return {
    responses: [
      {
        textAnnotations: [{ description: text }],
      },
    ],
  };
}

/**
 * Build a Vision API response with an empty result (no text detected).
 */
function visionEmptyBody() {
  return { responses: [{}] };
}

/**
 * Build a Vision API response with a per-response error.
 */
function visionErrorBody(message: string) {
  return {
    responses: [{ error: { message } }],
  };
}

/**
 * Create a mock fetch that returns a sequence of responses.
 * Each entry can specify status, body, or throw a network error.
 */
type MockResponseSpec =
  | { status: number; body: unknown }
  | { networkError: string };

function createMockFetch(specs: MockResponseSpec[]): jest.Mock {
  let callIndex = 0;
  return jest.fn(async () => {
    const spec = specs[callIndex++] ?? specs[specs.length - 1];
    if ('networkError' in spec) {
      throw new Error(spec.networkError);
    }
    return {
      ok: spec.status >= 200 && spec.status < 300,
      status: spec.status,
      json: async () => spec.body,
      text: async () => JSON.stringify(spec.body),
    } as unknown as Response;
  });
}

/** A no-op sleep for fast tests. */
const noopSleep = async (_ms: number): Promise<void> => {};

/** Default test options with no-op sleep and test API key. */
function testOptions(overrides: Partial<OCRServiceOptions> = {}): OCRServiceOptions {
  return {
    apiKey: TEST_API_KEY,
    sleepFn: noopSleep,
    ...overrides,
  };
}

// ────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────

describe('OCR Service — extractText', () => {
  describe('successful extraction', () => {
    it('returns extracted text and confidence from fullTextAnnotation', async () => {
      const mockFetch = createMockFetch([
        { status: 200, body: visionSuccessBody('VOO\n2024-01-15\n$450.25\n1.123456 shares', 0.97) },
      ]);

      const result = await extractText(
        SAMPLE_IMAGE,
        testOptions({ fetchFn: mockFetch }),
      );

      expect(result.success).toBe(true);
      expect(result.text).toBe('VOO\n2024-01-15\n$450.25\n1.123456 shares');
      expect(result.confidence).toBe(0.97);
      expect(result.error).toBeUndefined();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('falls back to textAnnotations when fullTextAnnotation is absent', async () => {
      const mockFetch = createMockFetch([
        { status: 200, body: visionTextAnnotationsOnly('AAPL Buy 10 shares') },
      ]);

      const result = await extractText(
        SAMPLE_IMAGE,
        testOptions({ fetchFn: mockFetch }),
      );

      expect(result.success).toBe(true);
      expect(result.text).toBe('AAPL Buy 10 shares');
      expect(result.confidence).toBe(0.85);
    });

    it('sends image as base64 in the request body', async () => {
      const imageBuffer = Buffer.from('test-image-data');
      const expectedBase64 = imageBuffer.toString('base64');

      const mockFetch = createMockFetch([
        { status: 200, body: visionSuccessBody('some text') },
      ]);

      await extractText(imageBuffer, testOptions({ fetchFn: mockFetch }));

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toContain('vision.googleapis.com');
      expect(url).toContain(`key=${TEST_API_KEY}`);

      const body = JSON.parse(init.body as string);
      expect(body.requests[0].image.content).toBe(expectedBase64);
      expect(body.requests[0].features[0].type).toBe('TEXT_DETECTION');
    });
  });

  describe('no text detected', () => {
    it('returns failure when Vision API returns empty response', async () => {
      const mockFetch = createMockFetch([
        { status: 200, body: visionEmptyBody() },
      ]);

      const result = await extractText(
        SAMPLE_IMAGE,
        testOptions({ fetchFn: mockFetch }),
      );

      expect(result.success).toBe(false);
      expect(result.text).toBe('');
      expect(result.confidence).toBe(0);
      expect(result.error).toContain('No text detected');
    });
  });

  describe('API key handling', () => {
    it('returns failure when API key is not configured', async () => {
      const result = await extractText(
        SAMPLE_IMAGE,
        testOptions({ apiKey: undefined }),
      );

      // Also clear the env var to ensure it's not picked up
      const originalKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
      delete process.env.GOOGLE_CLOUD_VISION_API_KEY;

      const result2 = await extractText(SAMPLE_IMAGE, {
        sleepFn: noopSleep,
        apiKey: undefined,
      });

      process.env.GOOGLE_CLOUD_VISION_API_KEY = originalKey;

      expect(result2.success).toBe(false);
      expect(result2.error).toContain('GOOGLE_CLOUD_VISION_API_KEY');
    });
  });

  describe('retry logic', () => {
    it('retries on 500 errors and succeeds on subsequent attempt', async () => {
      const mockFetch = createMockFetch([
        { status: 500, body: { error: 'Internal Server Error' } },
        { status: 200, body: visionSuccessBody('Retry success text', 0.92) },
      ]);

      const result = await extractText(
        SAMPLE_IMAGE,
        testOptions({ fetchFn: mockFetch }),
      );

      expect(result.success).toBe(true);
      expect(result.text).toBe('Retry success text');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('retries on 503 errors and succeeds on third attempt', async () => {
      const mockFetch = createMockFetch([
        { status: 503, body: { error: 'Service Unavailable' } },
        { status: 503, body: { error: 'Service Unavailable' } },
        { status: 200, body: visionSuccessBody('Third attempt success') },
      ]);

      const result = await extractText(
        SAMPLE_IMAGE,
        testOptions({ fetchFn: mockFetch }),
      );

      expect(result.success).toBe(true);
      expect(result.text).toBe('Third attempt success');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('retries on 429 rate-limit errors', async () => {
      const mockFetch = createMockFetch([
        { status: 429, body: { error: 'Rate limited' } },
        { status: 200, body: visionSuccessBody('After rate limit') },
      ]);

      const result = await extractText(
        SAMPLE_IMAGE,
        testOptions({ fetchFn: mockFetch }),
      );

      expect(result.success).toBe(true);
      expect(result.text).toBe('After rate limit');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('fails after exhausting all retries on persistent 500 errors', async () => {
      const mockFetch = createMockFetch([
        { status: 500, body: { error: 'Error 1' } },
        { status: 500, body: { error: 'Error 2' } },
        { status: 500, body: { error: 'Error 3' } },
      ]);

      const result = await extractText(
        SAMPLE_IMAGE,
        testOptions({ fetchFn: mockFetch, maxRetries: 2 }),
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('HTTP 500');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('retries on network errors and succeeds', async () => {
      const mockFetch = createMockFetch([
        { networkError: 'ECONNRESET' },
        { status: 200, body: visionSuccessBody('After network error') },
      ]);

      const result = await extractText(
        SAMPLE_IMAGE,
        testOptions({ fetchFn: mockFetch }),
      );

      expect(result.success).toBe(true);
      expect(result.text).toBe('After network error');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('fails after exhausting retries on persistent network errors', async () => {
      const mockFetch = createMockFetch([
        { networkError: 'ECONNREFUSED' },
        { networkError: 'ECONNREFUSED' },
        { networkError: 'ECONNREFUSED' },
      ]);

      const result = await extractText(
        SAMPLE_IMAGE,
        testOptions({ fetchFn: mockFetch, maxRetries: 2 }),
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('ECONNREFUSED');
      expect(result.error).toContain('3 attempts');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('does not retry on 400 client errors', async () => {
      const mockFetch = createMockFetch([
        { status: 400, body: { error: 'Bad Request' } },
      ]);

      const result = await extractText(
        SAMPLE_IMAGE,
        testOptions({ fetchFn: mockFetch }),
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('HTTP 400');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('does not retry on 403 forbidden errors', async () => {
      const mockFetch = createMockFetch([
        { status: 403, body: { error: 'Forbidden' } },
      ]);

      const result = await extractText(
        SAMPLE_IMAGE,
        testOptions({ fetchFn: mockFetch }),
      );

      expect(result.success).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('applies exponential backoff delays (2s, 4s)', async () => {
      const delays: number[] = [];
      const trackingSleep = async (ms: number) => {
        delays.push(ms);
      };

      const mockFetch = createMockFetch([
        { status: 502, body: {} },
        { status: 502, body: {} },
        { status: 200, body: visionSuccessBody('After backoff') },
      ]);

      await extractText(
        SAMPLE_IMAGE,
        testOptions({
          fetchFn: mockFetch,
          sleepFn: trackingSleep,
          maxRetries: 2,
          initialBackoffMs: 2000,
        }),
      );

      expect(delays).toEqual([2000, 4000]);
    });
  });

  describe('Vision API error responses', () => {
    it('handles per-response error in Vision API body', async () => {
      const mockFetch = createMockFetch([
        { status: 200, body: visionErrorBody('Image too large') },
      ]);

      const result = await extractText(
        SAMPLE_IMAGE,
        testOptions({ fetchFn: mockFetch }),
      );

      // The error from parseVisionResponse is caught and retried as a network-like error
      // After all retries exhausted, it returns failure
      expect(result.success).toBe(false);
    });

    it('handles malformed JSON response gracefully', async () => {
      const mockFetch = jest.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('Unexpected token');
        },
        text: async () => 'not json',
      })) as unknown as jest.Mock;

      const result = await extractText(
        SAMPLE_IMAGE,
        testOptions({ fetchFn: mockFetch, maxRetries: 0 }),
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unexpected token');
    });

    it('handles empty responses array', async () => {
      const mockFetch = createMockFetch([
        { status: 200, body: { responses: [] } },
      ]);

      const result = await extractText(
        SAMPLE_IMAGE,
        testOptions({ fetchFn: mockFetch }),
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('No text detected');
    });
  });

  describe('confidence scoring', () => {
    it('uses page confidence from fullTextAnnotation', async () => {
      const mockFetch = createMockFetch([
        { status: 200, body: visionSuccessBody('text', 0.88) },
      ]);

      const result = await extractText(
        SAMPLE_IMAGE,
        testOptions({ fetchFn: mockFetch }),
      );

      expect(result.confidence).toBe(0.88);
    });

    it('defaults to 0.9 when fullTextAnnotation has no page confidence', async () => {
      const body = {
        responses: [
          {
            fullTextAnnotation: {
              text: 'some text',
              pages: [{}], // no confidence field
            },
          },
        ],
      };
      const mockFetch = createMockFetch([{ status: 200, body }]);

      const result = await extractText(
        SAMPLE_IMAGE,
        testOptions({ fetchFn: mockFetch }),
      );

      expect(result.confidence).toBe(0.9);
    });

    it('uses 0.85 confidence for textAnnotations-only responses', async () => {
      const mockFetch = createMockFetch([
        { status: 200, body: visionTextAnnotationsOnly('text') },
      ]);

      const result = await extractText(
        SAMPLE_IMAGE,
        testOptions({ fetchFn: mockFetch }),
      );

      expect(result.confidence).toBe(0.85);
    });
  });
});
