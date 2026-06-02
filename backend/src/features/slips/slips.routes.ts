import { Router, Request, Response } from 'express';
import multer from 'multer';
import { extractText } from './ocr.service';
import { parse, toStructuredTransaction } from './slip-parser.service';
import { APIError, ParseResult, StructuredTransaction } from '../../types';

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_BATCH_FILES = 20;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];

// ────────────────────────────────────────────────────────────
// Multer configuration
// ────────────────────────────────────────────────────────────

const storage = multer.memoryStorage();

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new MulterFormatError(`Unsupported file format: ${file.mimetype}. Only JPG and PNG are accepted.`));
  }
};

const uploadSingle = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
}).single('slip');

const uploadBatch = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
}).array('slips', MAX_BATCH_FILES);

// ────────────────────────────────────────────────────────────
// Custom error class for format errors from multer fileFilter
// ────────────────────────────────────────────────────────────

class MulterFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MulterFormatError';
  }
}

// ────────────────────────────────────────────────────────────
// Result types for slip processing
// ────────────────────────────────────────────────────────────

export interface SlipProcessingResult {
  filename: string;
  success: boolean;
  parseResult?: ParseResult;
  transaction?: StructuredTransaction;
  error?: string;
  errorCode?: string;
}

// ────────────────────────────────────────────────────────────
// Helper: process a single slip buffer through OCR → Parser
// ────────────────────────────────────────────────────────────

async function processSlip(
  buffer: Buffer,
  filename: string,
): Promise<SlipProcessingResult> {
  // Step 1: OCR
  const ocrResult = await extractText(buffer);

  if (!ocrResult.success) {
    return {
      filename,
      success: false,
      error: ocrResult.error ?? 'OCR processing failed',
      errorCode: 'OCR_FAILED',
    };
  }

  // Step 2: Parse
  const parseResult = parse(ocrResult.text);
  const transaction = toStructuredTransaction(parseResult);

  // If there are missing fields, still return the partial result
  const hasIncomplete = parseResult.missingFields.length > 0;

  return {
    filename,
    success: true,
    parseResult,
    transaction,
    ...(hasIncomplete
      ? { error: 'Some fields could not be extracted', errorCode: 'PARSE_INCOMPLETE' }
      : {}),
  };
}

// ────────────────────────────────────────────────────────────
// Helper: wrap multer call in a promise for cleaner error handling
// ────────────────────────────────────────────────────────────

function runMulter(
  multerMiddleware: (req: Request, res: Response, cb: (err?: unknown) => void) => void,
  req: Request,
  res: Response,
): Promise<void> {
  return new Promise((resolve, reject) => {
    multerMiddleware(req, res, (err?: unknown) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// ────────────────────────────────────────────────────────────
// Helper: handle multer errors and send appropriate response
// Returns true if an error was handled (response sent)
// ────────────────────────────────────────────────────────────

function handleMulterError(err: unknown, res: Response): boolean {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const apiError: APIError = {
        code: 'FILE_TOO_LARGE',
        message: 'File size exceeds the 10MB limit',
        retryable: false,
      };
      res.status(413).json(apiError);
      return true;
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      const apiError: APIError = {
        code: 'BATCH_LIMIT_EXCEEDED',
        message: `Too many files. Maximum ${MAX_BATCH_FILES} files allowed per batch.`,
        retryable: false,
      };
      res.status(400).json(apiError);
      return true;
    }
  }

  if (err instanceof MulterFormatError) {
    const apiError: APIError = {
      code: 'UNSUPPORTED_FORMAT',
      message: err.message,
      retryable: false,
    };
    res.status(415).json(apiError);
    return true;
  }

  return false;
}

// ────────────────────────────────────────────────────────────
// Router
// ────────────────────────────────────────────────────────────

const router = Router();

/**
 * POST /api/slips/upload
 *
 * Upload a single slip image for OCR processing.
 * Accepts multipart/form-data with a file field named "slip".
 *
 * Requirements: 3.1, 3.2, 3.4, 3.5, 3.8
 */
router.post('/upload', async (req: Request, res: Response) => {
  try {
    await runMulter(uploadSingle, req, res);
  } catch (err) {
    if (handleMulterError(err, res)) return;
    const apiError: APIError = {
      code: 'INTERNAL_ERROR',
      message: 'File upload failed',
      retryable: true,
    };
    res.status(500).json(apiError);
    return;
  }

  if (!req.file) {
    const apiError: APIError = {
      code: 'UNSUPPORTED_FORMAT',
      message: 'No file provided. Please upload a JPG or PNG image.',
      retryable: false,
    };
    res.status(400).json(apiError);
    return;
  }

  try {
    const result = await processSlip(req.file.buffer, req.file.originalname);

    if (!result.success && result.errorCode === 'OCR_FAILED') {
      const apiError: APIError = {
        code: 'OCR_FAILED',
        message: result.error ?? 'OCR processing failed',
        retryable: true,
      };
      res.status(502).json(apiError);
      return;
    }

    // Return the result (200 even for PARSE_INCOMPLETE per design doc)
    res.status(200).json(result);
  } catch {
    const apiError: APIError = {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred while processing the slip',
      retryable: true,
    };
    res.status(500).json(apiError);
  }
});

/**
 * POST /api/slips/upload-batch
 *
 * Upload multiple slip images (up to 20) for parallel OCR processing.
 * Accepts multipart/form-data with file field named "slips".
 *
 * Requirements: 9.1, 9.2, 9.3, 9.5
 */
router.post('/upload-batch', async (req: Request, res: Response) => {
  try {
    await runMulter(uploadBatch, req, res);
  } catch (err) {
    if (handleMulterError(err, res)) return;
    const apiError: APIError = {
      code: 'INTERNAL_ERROR',
      message: 'File upload failed',
      retryable: true,
    };
    res.status(500).json(apiError);
    return;
  }

  const files = req.files as Express.Multer.File[] | undefined;

  if (!files || files.length === 0) {
    const apiError: APIError = {
      code: 'UNSUPPORTED_FORMAT',
      message: 'No files provided. Please upload JPG or PNG images.',
      retryable: false,
    };
    res.status(400).json(apiError);
    return;
  }

  try {
    // Process all slips in parallel with isolated error handling
    const results = await Promise.all(
      files.map(async (file) => {
        try {
          return await processSlip(file.buffer, file.originalname);
        } catch {
          return {
            filename: file.originalname,
            success: false,
            error: 'Unexpected error during processing',
            errorCode: 'INTERNAL_ERROR',
          } as SlipProcessingResult;
        }
      }),
    );

    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    res.status(200).json({
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      results,
    });
  } catch {
    const apiError: APIError = {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred while processing the batch',
      retryable: true,
    };
    res.status(500).json(apiError);
  }
});

export default router;
