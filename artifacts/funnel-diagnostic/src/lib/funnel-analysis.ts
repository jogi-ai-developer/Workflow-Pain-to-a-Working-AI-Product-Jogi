export type FunnelStepInput = {
  name: string;
  order: number;
  entered: number;
  converted: number;
  description: string;
};

export type FunnelStepAnalysis = FunnelStepInput & {
  conversionRate: number;
  dropOffPercent: number;
  usersLost: number;
  isAbnormal: boolean;
};

export type FunnelAnalysis = {
  thresholdPercent: number;
  steps: FunnelStepAnalysis[];
  flaggedSteps: string[];
  hasAbnormalDropOff: boolean;
  largestDropOffStep: string | null;
};

export const DEFAULT_DROP_OFF_THRESHOLD_PERCENT = 40;

const roundToTwoDecimals = (value: number) => Math.round(value * 100) / 100;

/**
 * Calculates the observable funnel signal without relying on an API or LLM.
 * Flagging uses the unrounded drop-off value so display rounding cannot change
 * the diagnostic decision.
 */
export function analyzeFunnel(
  steps: FunnelStepInput[],
  thresholdPercent = DEFAULT_DROP_OFF_THRESHOLD_PERCENT,
): FunnelAnalysis {
  if (!Number.isFinite(thresholdPercent) || thresholdPercent < 0 || thresholdPercent > 100) {
    throw new RangeError('Drop-off threshold must be between 0 and 100');
  }

  const analyzedSteps = steps.map((step) => {
    const conversionRate = (step.converted / step.entered) * 100;
    const dropOffPercent = ((step.entered - step.converted) / step.entered) * 100;
    const usersLost = step.entered - step.converted;

    return {
      ...step,
      conversionRate: roundToTwoDecimals(conversionRate),
      dropOffPercent: roundToTwoDecimals(dropOffPercent),
      usersLost,
      isAbnormal: dropOffPercent >= thresholdPercent,
    };
  });

  const flaggedSteps = analyzedSteps
    .filter((step) => step.isAbnormal)
    .map((step) => step.name);
  const largestDropOff = analyzedSteps.reduce<FunnelStepAnalysis | null>(
    (largest, step) =>
      largest === null || step.dropOffPercent > largest.dropOffPercent ? step : largest,
    null,
  );

  return {
    thresholdPercent,
    steps: analyzedSteps,
    flaggedSteps,
    hasAbnormalDropOff: flaggedSteps.length > 0,
    largestDropOffStep: largestDropOff?.name ?? null,
  };
}