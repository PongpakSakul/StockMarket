'use client';

// ============================================================
// Base Skeleton
// ============================================================

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gray-200 rounded ${className}`}
      aria-hidden="true"
    />
  );
}

// ============================================================
// Skeleton Variants
// ============================================================

/**
 * Table skeleton with configurable rows and columns.
 */
export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="animate-pulse" aria-label="Loading table data">
      {/* Header */}
      <div className="flex gap-4 px-4 py-3 border-b border-gray-200">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="h-4 bg-gray-200 rounded flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-4 px-4 py-3 border-b border-gray-100">
          {Array.from({ length: columns }).map((_, colIdx) => (
            <div key={colIdx} className="h-4 bg-gray-200 rounded flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Chart skeleton for stock price chart area.
 */
export function ChartSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-label="Loading chart">
      {/* Chart header */}
      <div className="flex items-center justify-between">
        <div className="h-6 bg-gray-200 rounded w-32" />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-8 w-10 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
      {/* Chart area */}
      <div className="h-64 bg-gray-200 rounded-lg" />
    </div>
  );
}

/**
 * Card skeleton for dashboard summary cards.
 */
export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse" aria-label="Loading data">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-lg shadow p-4">
          <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
          <div className="h-6 bg-gray-200 rounded w-32" />
        </div>
      ))}
    </div>
  );
}

/**
 * Watchlist item skeleton.
 */
export function WatchlistSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3 animate-pulse" aria-label="Loading watchlist">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-5 w-14 bg-gray-200 rounded" />
            <div className="h-4 w-24 bg-gray-200 rounded" />
          </div>
          <div className="flex items-center gap-4">
            <div className="h-5 w-16 bg-gray-200 rounded" />
            <div className="h-8 w-20 bg-gray-200 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
