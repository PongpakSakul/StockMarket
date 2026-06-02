'use client';

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

/**
 * A minimal SVG sparkline chart for 7-day close prices.
 */
export default function Sparkline({
  data,
  width = 80,
  height = 30,
  color,
}: SparklineProps) {
  if (data.length < 2) {
    return (
      <svg
        width={width}
        height={height}
        aria-label="Sparkline chart"
        role="img"
        data-testid="sparkline"
      >
        <text x={width / 2} y={height / 2} textAnchor="middle" fontSize="8" fill="#9ca3af">
          N/A
        </text>
      </svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Determine color based on trend if not provided
  const lineColor = color ?? (data[data.length - 1] >= data[0] ? '#16a34a' : '#dc2626');

  const padding = 2;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const points = data
    .map((value, index) => {
      const x = padding + (index / (data.length - 1)) * chartWidth;
      const y = padding + chartHeight - ((value - min) / range) * chartHeight;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg
      width={width}
      height={height}
      aria-label="Sparkline chart"
      role="img"
      data-testid="sparkline"
    >
      <polyline
        points={points}
        fill="none"
        stroke={lineColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
