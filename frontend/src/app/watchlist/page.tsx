'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import WatchlistPanel from '@/components/watchlist/WatchlistPanel';

export default function WatchlistPage() {
  const router = useRouter();

  const handleNavigateToChart = useCallback(
    (ticker: string) => {
      router.push(`/chart?ticker=${ticker}`);
    },
    [router]
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Watchlist</h1>
      <div className="max-w-2xl">
        <WatchlistPanel onNavigateToChart={handleNavigateToChart} />
      </div>
    </div>
  );
}
