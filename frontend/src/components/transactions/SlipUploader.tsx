'use client';

import { useState, useCallback, useRef } from 'react';

// ============================================================
// Types
// ============================================================

export interface UploadResult {
  file: File;
  success: boolean;
  error?: string;
}

export interface UploadProgress {
  processed: number;
  total: number;
}

export interface SlipUploaderProps {
  onUploadComplete: (results: UploadResult[]) => void;
  uploading?: boolean;
  progress?: UploadProgress;
}

// ============================================================
// Constants
// ============================================================

const ACCEPTED_TYPES = ['image/jpeg', 'image/png'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 20;

// ============================================================
// Validation
// ============================================================

export interface FileValidationError {
  fileName: string;
  reason: string;
}

export function validateFiles(files: File[]): {
  valid: File[];
  errors: FileValidationError[];
} {
  const errors: FileValidationError[] = [];
  const valid: File[] = [];

  if (files.length > MAX_FILES) {
    errors.push({
      fileName: '',
      reason: `Too many files. Maximum ${MAX_FILES} files allowed per batch.`,
    });
    return { valid: [], errors };
  }

  for (const file of files) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      errors.push({
        fileName: file.name,
        reason: 'Only JPG and PNG files are supported.',
      });
    } else if (file.size > MAX_FILE_SIZE) {
      errors.push({
        fileName: file.name,
        reason: 'File exceeds 10MB size limit.',
      });
    } else {
      valid.push(file);
    }
  }

  return { valid, errors };
}

// ============================================================
// Component
// ============================================================

export default function SlipUploader({
  onUploadComplete,
  uploading = false,
  progress,
}: SlipUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [validationErrors, setValidationErrors] = useState<FileValidationError[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;

      const files = Array.from(fileList);
      const { valid, errors } = validateFiles(files);

      setValidationErrors(errors);

      if (valid.length > 0) {
        const results: UploadResult[] = valid.map((file) => ({
          file,
          success: true,
        }));
        onUploadComplete(results);
      }
    },
    [onUploadComplete]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
      // Reset input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [handleFiles]
  );

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const progressPercent =
    progress && progress.total > 0
      ? Math.round((progress.processed / progress.total) * 100)
      : 0;

  return (
    <div className="w-full" aria-label="Slip uploader">
      {/* Drop Zone */}
      <div
        role="button"
        tabIndex={0}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleBrowseClick();
          }
        }}
        className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer ${
          dragOver
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
        } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
        aria-disabled={uploading}
        data-testid="drop-zone"
      >
        {/* Upload Icon */}
        <svg
          className="mb-3 h-10 w-10 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>

        <p className="mb-1 text-sm text-gray-600">
          <span className="font-medium text-blue-600">Drag & drop</span> slip images here
        </p>
        <p className="text-xs text-gray-500">
          or{' '}
          <button
            type="button"
            className="font-medium text-blue-600 underline hover:text-blue-700"
            onClick={(e) => {
              e.stopPropagation();
              handleBrowseClick();
            }}
            disabled={uploading}
            aria-label="Browse files"
          >
            browse files
          </button>
        </p>
        <p className="mt-2 text-xs text-gray-400">
          JPG or PNG, up to 10MB each, max 20 files
        </p>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
          aria-hidden="true"
          data-testid="file-input"
        />
      </div>

      {/* Progress Bar */}
      {uploading && progress && (
        <div className="mt-4" role="status" aria-label="Upload progress">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
            <span>Uploading...</span>
            <span>
              {progress.processed} / {progress.total}
            </span>
          </div>
          <div className="w-full rounded-full bg-gray-200 h-2.5">
            <div
              className="h-2.5 rounded-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
              role="progressbar"
              aria-valuenow={progress.processed}
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-label={`${progress.processed} of ${progress.total} files processed`}
            />
          </div>
        </div>
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="mt-4 rounded-md bg-red-50 p-3" role="alert" aria-label="Upload errors">
          <div className="flex">
            <svg
              className="h-5 w-5 text-red-400 flex-shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                clipRule="evenodd"
              />
            </svg>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                {validationErrors.length === 1
                  ? 'File validation error'
                  : `${validationErrors.length} file validation errors`}
              </h3>
              <ul className="mt-1 list-disc list-inside text-sm text-red-700">
                {validationErrors.map((error, index) => (
                  <li key={index}>
                    {error.fileName ? `${error.fileName}: ` : ''}
                    {error.reason}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
