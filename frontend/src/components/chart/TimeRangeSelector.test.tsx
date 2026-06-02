import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TimeRangeSelector from './TimeRangeSelector';
import type { TimeRange } from '@/store/slices/chartSlice';

describe('TimeRangeSelector', () => {
  const mockOnChange = vi.fn();

  it('renders all time range buttons', () => {
    render(<TimeRangeSelector selected="1Y" onChange={mockOnChange} />);

    expect(screen.getByText('1W')).toBeInTheDocument();
    expect(screen.getByText('1M')).toBeInTheDocument();
    expect(screen.getByText('3M')).toBeInTheDocument();
    expect(screen.getByText('6M')).toBeInTheDocument();
    expect(screen.getByText('1Y')).toBeInTheDocument();
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('highlights the currently selected range', () => {
    render(<TimeRangeSelector selected="3M" onChange={mockOnChange} />);

    const selectedButton = screen.getByText('3M');
    expect(selectedButton).toHaveAttribute('aria-pressed', 'true');
    expect(selectedButton.className).toContain('bg-blue-600');
    expect(selectedButton.className).toContain('text-white');
  });

  it('does not highlight non-selected ranges', () => {
    render(<TimeRangeSelector selected="1Y" onChange={mockOnChange} />);

    const nonSelectedButton = screen.getByText('1W');
    expect(nonSelectedButton).toHaveAttribute('aria-pressed', 'false');
    expect(nonSelectedButton.className).toContain('bg-gray-100');
  });

  it('calls onChange with the correct value when a button is clicked', () => {
    render(<TimeRangeSelector selected="1Y" onChange={mockOnChange} />);

    fireEvent.click(screen.getByText('6M'));
    expect(mockOnChange).toHaveBeenCalledWith('6M');

    fireEvent.click(screen.getByText('All'));
    expect(mockOnChange).toHaveBeenCalledWith('ALL');
  });

  it('calls onChange for each time range value', () => {
    render(<TimeRangeSelector selected="1Y" onChange={mockOnChange} />);

    const ranges: { label: string; value: TimeRange }[] = [
      { label: '1W', value: '1W' },
      { label: '1M', value: '1M' },
      { label: '3M', value: '3M' },
      { label: '6M', value: '6M' },
      { label: '1Y', value: '1Y' },
      { label: 'All', value: 'ALL' },
    ];

    ranges.forEach(({ label, value }) => {
      fireEvent.click(screen.getByText(label));
      expect(mockOnChange).toHaveBeenCalledWith(value);
    });
  });

  it('has accessible group role and label', () => {
    render(<TimeRangeSelector selected="1Y" onChange={mockOnChange} />);

    expect(screen.getByRole('group', { name: 'Time range selector' })).toBeInTheDocument();
  });
});
