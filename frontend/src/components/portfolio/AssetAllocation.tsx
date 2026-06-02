'use client';

import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import type { AssetAllocation as AssetAllocationType } from '../../store/slices/portfolioSlice';

export interface AssetAllocationProps {
  allocation: AssetAllocationType[];
}

const COLORS = [
  '#3B82F6', // blue-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#EF4444', // red-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
  '#06B6D4', // cyan-500
  '#F97316', // orange-500
  '#14B8A6', // teal-500
  '#6366F1', // indigo-500
];

function getColor(index: number): string {
  return COLORS[index % COLORS.length];
}

interface CustomLabelProps {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
}

function renderCustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: CustomLabelProps) {
  if (percent < 0.05) return null; // Don't render label for slices < 5%

  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
      fontWeight="bold"
    >
      {`${(percent * 100).toFixed(1)}%`}
    </text>
  );
}

interface LegendPayloadItem {
  value: string;
  color: string;
}

function renderLegend(props: { payload?: LegendPayloadItem[] }) {
  const { payload } = props;
  if (!payload) return null;

  return (
    <ul className="flex flex-wrap justify-center gap-3 mt-2" data-testid="allocation-legend">
      {payload.map((entry, index) => (
        <li key={`legend-${index}`} className="flex items-center gap-1 text-sm text-gray-700">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          {entry.value}
        </li>
      ))}
    </ul>
  );
}

export default function AssetAllocation({ allocation }: AssetAllocationProps) {
  if (allocation.length === 0) {
    return (
      <div
        className="bg-white rounded-lg shadow p-6 text-center text-gray-500"
        data-testid="allocation-empty"
        role="status"
      >
        No holdings to display allocation.
      </div>
    );
  }

  const chartData = allocation.map((item) => ({
    name: item.tickerSymbol,
    value: item.percentage,
    fullName: item.tickerName,
  }));

  return (
    <div className="bg-white rounded-lg shadow p-4" data-testid="asset-allocation-chart">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Asset Allocation</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomLabel}
            outerRadius={100}
            dataKey="value"
            nameKey="name"
          >
            {chartData.map((_entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(index)} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [`${value.toFixed(1)}%`, 'Allocation']}
          />
          <Legend content={renderLegend as any} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
