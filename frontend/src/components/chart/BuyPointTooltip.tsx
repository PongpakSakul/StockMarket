'use client';

import { useRef, useEffect } from 'react';
import type { BuyPoint } from '@/store/slices/chartSlice';

export interface BuyPointTooltipProps {
  buyPoint: BuyPoint;
  visible: boolean;
  position: { x: number; y: number };
  containerRef?: React.RefObject<HTMLDivElement>;
}

export default function BuyPointTooltip({
  buyPoint,
  visible,
  position,
  containerRef,
}: BuyPointTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible || !tooltipRef.current || !containerRef?.current) return;

    const tooltip = tooltipRef.current;
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    // Adjust position if tooltip overflows container bounds
    let adjustedX = position.x;
    let adjustedY = position.y;

    if (position.x + tooltipRect.width > containerRect.width) {
      adjustedX = position.x - tooltipRect.width;
    }
    if (position.y + tooltipRect.height > containerRect.height) {
      adjustedY = position.y - tooltipRect.height - 8;
    }

    tooltip.style.left = `${adjustedX}px`;
    tooltip.style.top = `${adjustedY}px`;
  }, [visible, position, containerRef]);

  if (!visible) return null;

  return (
    <div
      ref={tooltipRef}
      data-testid="buy-point-tooltip"
      className="absolute z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 pointer-events-none"
      style={{ left: position.x, top: position.y }}
    >
      <div className="text-xs font-semibold text-gray-700 mb-1">
        Buy Point
      </div>
      <div className="space-y-1 text-xs text-gray-600">
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Date:</span>
          <span className="font-medium text-gray-800">{buyPoint.date}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Shares:</span>
          <span className="font-medium text-gray-800">
            {buyPoint.shares.toFixed(6)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Price/Share:</span>
          <span className="font-medium text-gray-800">
            ${buyPoint.pricePerShare.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-500">Total:</span>
          <span className="font-medium text-gray-800">
            ${buyPoint.totalAmount.toFixed(2)}
          </span>
        </div>
        {buyPoint.transactionCount > 1 && (
          <div className="flex justify-between gap-4 pt-1 border-t border-gray-100">
            <span className="text-gray-500">Transactions:</span>
            <span className="font-medium text-blue-600">
              {buyPoint.transactionCount}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
