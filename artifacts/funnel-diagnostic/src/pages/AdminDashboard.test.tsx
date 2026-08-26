// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import AdminDashboard from './AdminDashboard';

const { summaryMock, listMock, detailMock } = vi.hoisted(() => ({
  summaryMock: vi.fn(),
  listMock: vi.fn(),
  detailMock: vi.fn(),
}));

vi.mock('@workspace/api-client-react', () => ({
  getGetAdminSummaryQueryKey: () => ['/api/admin/summary'],
  getGetAnalysisQueryKey: (id: number) => [`/api/analyses/${id}`],
  getListAnalysesQueryKey: () => ['/api/analyses'],
  useGetAdminSummary: summaryMock,
  useGetAnalysis: detailMock,
  useListAnalyses: listMock,
}));

const flaggedAnalysis = {
  id: 2,
  timestamp: '2026-08-26T10:00:00.000Z',
  flaggedSteps: ['Checkout'],
  confidence: 'medium' as const,
  status: 'ok' as const,
};

const noFlagAnalysis = {
  id: 1,
  timestamp: '2026-08-26T09:00:00.000Z',
  flaggedSteps: [],
  confidence: 'low' as const,
  status: 'no-flag' as const,
};

const flaggedDetail = {
  id: flaggedAnalysis.id,
  timestamp: flaggedAnalysis.timestamp,
  steps: [
    { name: 'Landing page', order: 1, entered: 1000, converted: 900, description: 'Viewed page' },
    { name: 'Checkout', order: 2, entered: 900, converted: 300, description: 'Started checkout' },
    { name: 'Confirmation', order: 3, entered: 300, converted: 270, description: 'Completed purchase' },
  ],
  logic: {
    thresholdPercent: 40,
    steps: [
      { name: 'Landing page', order: 1, entered: 1000, converted: 900, description: 'Viewed page', conversionRate: 90, dropOffPercent: 10, usersLost: 100, isAbnormal: false },
      { name: 'Checkout', order: 2, entered: 900, converted: 300, description: 'Started checkout', conversionRate: 33.33, dropOffPercent: 66.67, usersLost: 600, isAbnormal: true },
      { name: 'Confirmation', order: 3, entered: 300, converted: 270, description: 'Completed purchase', conversionRate: 90, dropOffPercent: 10, usersLost: 30, isAbnormal: false },
    ],
    flaggedSteps: ['Checkout'],
    hasAbnormalDropOff: true,
  },
  ai: {
    likelyCauses: ['Possible payment friction'],
    hypotheses: ['Payment errors may block checkout', 'Checkout complexity may cause abandonment'],
    missingEvidence: ['Payment outcomes by method'],
    suggestedInvestigation: 'Compare payment outcomes by method.',
    recommendedInvestigation: 'Compare payment outcomes by method.',
    suggestedExperiment: 'Test a clearer payment error state.',
    confidence: 'medium' as const,
    reasoning: 'These are competing possibilities based on the observed drop-off.',
  },
  confidence: 'medium' as const,
  status: 'ok' as const,
  errorMessage: null,
};

function setLoadedState() {
  summaryMock.mockReturnValue({
    data: { totalAnalyses: 2, confidenceCounts: { high: 0, medium: 1, low: 1 }, aiErrorCount: 0, recentAnalyses: [flaggedAnalysis, noFlagAnalysis] },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  listMock.mockReturnValue({
    data: [flaggedAnalysis, noFlagAnalysis],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  detailMock.mockReturnValue({
    data: flaggedDetail,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
}

describe('AdminDashboard', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    summaryMock.mockReset();
    listMock.mockReset();
    detailMock.mockReset();
    setLoadedState();
  });

  test('shows operational metrics, filters records, and opens persisted detail', () => {
    render(<AdminDashboard />);

    expect(screen.getByText('Analysis overview')).toBeTruthy();
    expect(screen.getByText('Total analyses')).toBeTruthy();
    expect(screen.getByText('Flagged analyses')).toBeTruthy();
    expect(screen.getByText('AI interpretation')).toBeTruthy();
    expect(screen.getByText('Payment errors may block checkout')).toBeTruthy();

    fireEvent.click(screen.getByTestId('filter-no-flag'));

    expect(screen.getByText('Healthy funnel')).toBeTruthy();
    expect(screen.queryByText('Checkout')).toBeNull();
  });

  test('shows a clear empty state when there are no saved analyses', () => {
    summaryMock.mockReturnValue({
      data: { totalAnalyses: 0, confidenceCounts: { high: 0, medium: 0, low: 0 }, aiErrorCount: 0, recentAnalyses: [] },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    listMock.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() });
    detailMock.mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() });

    render(<AdminDashboard />);

    expect(screen.getByText('No analyses in this view')).toBeTruthy();
    expect(screen.getByText('Select an analysis')).toBeTruthy();
  });

  test('shows a friendly API failure state with retry', () => {
    const summaryRefetch = vi.fn();
    const listRefetch = vi.fn();
    summaryMock.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: summaryRefetch });
    listMock.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: listRefetch });
    detailMock.mockReturnValue({ data: undefined, isLoading: false, isError: false, refetch: vi.fn() });

    render(<AdminDashboard />);

    expect(screen.getByText('The dashboard could not load')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(summaryRefetch).toHaveBeenCalledTimes(1);
    expect(listRefetch).toHaveBeenCalledTimes(1);
  });

  test('shows a friendly detail state when a response is malformed', () => {
    detailMock.mockReturnValue({
      data: { id: 2, status: 'ok' },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<AdminDashboard />);

    expect(screen.getByText('Analysis unavailable')).toBeTruthy();
    expect(screen.queryByText('AI interpretation')).toBeNull();
  });
});