// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { FunnelBuilder } from './FunnelBuilder';

const { createAnalysisMock, getAnalysisMock, retryAnalysisMock } = vi.hoisted(() => ({
  createAnalysisMock: vi.fn(),
  getAnalysisMock: vi.fn(),
  retryAnalysisMock: vi.fn(),
}));

vi.mock('@workspace/api-client-react', () => ({
  createAnalysis: createAnalysisMock,
  getAnalysis: getAnalysisMock,
  retryAnalysis: retryAnalysisMock,
}));

describe('FunnelBuilder results', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    createAnalysisMock.mockReset();
    getAnalysisMock.mockReset();
    retryAnalysisMock.mockReset();
    createAnalysisMock.mockResolvedValue({
      id: 1,
      timestamp: '2026-08-26T00:00:00.000Z',
      steps: [
        { name: 'Visited Site', order: 1, entered: 10_000, converted: 8_000, description: 'Landed on homepage' },
        { name: 'Signed Up', order: 2, entered: 8_000, converted: 2_000, description: 'Created an account' },
        { name: 'Purchased', order: 3, entered: 2_000, converted: 150, description: 'Completed checkout' },
      ],
      logic: {
        thresholdPercent: 40,
        steps: [],
        flaggedSteps: ['Signed Up', 'Purchased'],
        hasAbnormalDropOff: true,
      },
      ai: {
        likelyCauses: ['Possible payment friction'],
        hypotheses: ['A payment issue blocks checkout', 'A pricing concern causes abandonment'],
        missingEvidence: ['Payment error rate by method'],
        suggestedInvestigation: 'Compare checkout errors with successful payment attempts.',
        recommendedInvestigation: 'Review payment errors segmented by method and device.',
        suggestedExperiment: 'Expose the clearest payment error and measure recovery.',
        confidence: 'medium',
        reasoning: 'These are competing possibilities based on the flagged evidence.',
      },
      confidence: 'medium',
      status: 'ok',
      errorMessage: null,
    });
  });

  test('renders hypotheses, missing evidence, and recommended investigation', async () => {
    render(<FunnelBuilder />);

    fireEvent.click(screen.getByRole('button', { name: /validate data/i }));

    expect(await screen.findByText('Evidence-aware hypotheses')).toBeTruthy();
    expect(screen.getByText('A payment issue blocks checkout')).toBeTruthy();
    expect(screen.getByText('Payment error rate by method')).toBeTruthy();
    expect(screen.getByText('Review payment errors segmented by method and device.')).toBeTruthy();
    expect(screen.getByText('Suggested experiment')).toBeTruthy();
    expect(createAnalysisMock).toHaveBeenCalledTimes(1);
  });

  test('lets analysts retry a failed request without resubmitting the funnel', async () => {
    const failedAnalysis = {
      id: 1,
      timestamp: '2026-08-26T00:00:00.000Z',
      steps: [
        { name: 'Visited Site', order: 1, entered: 10_000, converted: 8_000, description: 'Landed on homepage' },
        { name: 'Signed Up', order: 2, entered: 8_000, converted: 2_000, description: 'Created an account' },
        { name: 'Purchased', order: 3, entered: 2_000, converted: 150, description: 'Completed checkout' },
      ],
      logic: {
        thresholdPercent: 40,
        steps: [],
        flaggedSteps: ['Signed Up', 'Purchased'],
        hasAbnormalDropOff: true,
      },
      ai: null,
      confidence: 'low',
      status: 'api-error',
      errorMessage: 'AI service returned HTTP 503',
    };
    createAnalysisMock.mockRejectedValueOnce({ data: failedAnalysis });
    retryAnalysisMock.mockResolvedValueOnce({
      ...failedAnalysis,
      status: 'ok',
      confidence: 'medium',
      errorMessage: null,
      ai: {
        likelyCauses: ['Possible payment friction'],
        hypotheses: ['A payment issue blocks checkout', 'A pricing concern causes abandonment'],
        missingEvidence: ['Payment error rate by method'],
        suggestedInvestigation: 'Compare checkout errors with successful payment attempts.',
        recommendedInvestigation: 'Review payment errors segmented by method and device.',
        suggestedExperiment: 'Expose the clearest payment error and measure recovery.',
        confidence: 'medium',
        reasoning: 'These are competing possibilities based on the flagged evidence.',
      },
    });

    render(<FunnelBuilder />);
    fireEvent.change(
      screen.getByPlaceholderText(/new checkout flow launched last week/i),
      { target: { value: 'The checkout redesign launched last week.' } },
    );
    fireEvent.click(screen.getByRole('button', { name: /validate data/i }));

    expect((await screen.findByRole('alert')).textContent).toContain('AI service returned HTTP 503');
    expect(screen.getByRole('button', { name: /retry hypothesis generation/i }).hasAttribute('disabled')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: /retry hypothesis generation/i }));

    expect(await screen.findByText('Evidence-aware hypotheses')).toBeTruthy();
    expect(screen.getByText('A payment issue blocks checkout')).toBeTruthy();
    expect(retryAnalysisMock).toHaveBeenCalledWith(1, {
      recentChanges: 'The checkout redesign launched last week.',
    });
    expect(createAnalysisMock).toHaveBeenCalledTimes(1);
  });

  test('reopens a failed saved analysis and retries with its persisted context', async () => {
    const failedAnalysis = {
      id: 42,
      timestamp: '2026-08-26T00:00:00.000Z',
      input: {
        steps: [
          { name: 'Visited Site', order: 1, entered: 10_000, converted: 8_000, description: 'Landed on homepage' },
          { name: 'Signed Up', order: 2, entered: 8_000, converted: 2_000, description: 'Created an account' },
          { name: 'Purchased', order: 3, entered: 2_000, converted: 150, description: 'Completed checkout' },
        ],
        funnelGoal: 'Increase purchases',
        recentChanges: 'Checkout redesign launched last week.',
        additionalContext: 'Payment errors are suspected.',
      },
      steps: [
        { name: 'Visited Site', order: 1, entered: 10_000, converted: 8_000, description: 'Landed on homepage' },
        { name: 'Signed Up', order: 2, entered: 8_000, converted: 2_000, description: 'Created an account' },
        { name: 'Purchased', order: 3, entered: 2_000, converted: 150, description: 'Completed checkout' },
      ],
      logic: {
        thresholdPercent: 40,
        steps: [],
        flaggedSteps: ['Signed Up', 'Purchased'],
        hasAbnormalDropOff: true,
      },
      ai: null,
      confidence: 'low',
      status: 'api-error',
      errorMessage: 'AI service returned HTTP 503',
    };
    getAnalysisMock.mockResolvedValueOnce(failedAnalysis);
    retryAnalysisMock.mockResolvedValueOnce({
      ...failedAnalysis,
      status: 'ok',
      confidence: 'medium',
      errorMessage: null,
      ai: {
        likelyCauses: ['Possible payment friction'],
        hypotheses: ['A payment issue blocks checkout', 'A pricing concern causes abandonment'],
        missingEvidence: ['Payment error rate by method'],
        suggestedInvestigation: 'Compare checkout errors with successful payment attempts.',
        recommendedInvestigation: 'Review payment errors segmented by method and device.',
        suggestedExperiment: 'Expose the clearest payment error and measure recovery.',
        confidence: 'medium',
        reasoning: 'These are competing possibilities based on the flagged evidence.',
      },
    });

    render(<FunnelBuilder analysisId={42} />);

    expect((await screen.findByRole('alert')).textContent).toContain('AI service returned HTTP 503');
    fireEvent.click(screen.getByRole('button', { name: /retry hypothesis generation/i }));

    expect(await screen.findByText('Evidence-aware hypotheses')).toBeTruthy();
    expect(retryAnalysisMock).toHaveBeenCalledWith(42, {
      funnelGoal: 'Increase purchases',
      recentChanges: 'Checkout redesign launched last week.',
      additionalContext: 'Payment errors are suspected.',
    });
  });
});