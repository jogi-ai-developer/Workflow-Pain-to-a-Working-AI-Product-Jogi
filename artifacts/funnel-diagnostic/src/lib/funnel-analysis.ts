export type FunnelStepInput = {
  name: string;
  order: number;
  entered: number;
  converted: number;
  description: string;
};

export type EvidenceStrength = 'high' | 'medium' | 'low' | 'insufficient';

export type FunnelStepAnalysis = FunnelStepInput & {
  conversionRate: number;
  dropOffPercent: number;
  usersLost: number;
  isAbnormal: boolean;
  evidenceStrength: EvidenceStrength;
};

export type FunnelAnalysis = {
  thresholdPercent: number;
  steps: FunnelStepAnalysis[];
  flaggedSteps: string[];
  hasAbnormalDropOff: boolean;
  hasActionableDropOff: boolean;
  hasInsufficientEvidence: boolean;
  evidenceStrength: EvidenceStrength;
  largestDropOffStep: string | null;
};

export const DEFAULT_DROP_OFF_THRESHOLD_PERCENT = 40;
export const MINIMUM_EVIDENCE_SAMPLE_SIZE = 30;
export const MINIMUM_EVIDENCE_USERS_LOST = 10;
export const STRONG_EVIDENCE_SAMPLE_SIZE = 1_000;
export const STRONG_EVIDENCE_USERS_LOST = 500;

const roundToTwoDecimals = (value: number) => Math.round(value * 100) / 100;

export function classifyEvidenceStrength(
  entered: number,
  usersLost: number,
  dropOffPercent: number,
  thresholdPercent = DEFAULT_DROP_OFF_THRESHOLD_PERCENT,
): EvidenceStrength {
  if (
    entered < MINIMUM_EVIDENCE_SAMPLE_SIZE ||
    usersLost < MINIMUM_EVIDENCE_USERS_LOST
  ) {
    return 'insufficient';
  }
  if (dropOffPercent >= thresholdPercent) {
    return entered >= STRONG_EVIDENCE_SAMPLE_SIZE || usersLost >= STRONG_EVIDENCE_USERS_LOST
      ? 'high'
      : 'medium';
  }
  return 'low';
}

function summarizeEvidenceStrength(
  steps: FunnelStepAnalysis[],
): EvidenceStrength {
  const flaggedSteps = steps.filter((step) => step.isAbnormal);
  if (flaggedSteps.some((step) => step.evidenceStrength === 'high')) return 'high';
  if (flaggedSteps.some((step) => step.evidenceStrength === 'medium')) return 'medium';
  if (flaggedSteps.some((step) => step.evidenceStrength === 'low')) return 'low';
  return flaggedSteps.length > 0 || steps.every((step) => step.evidenceStrength === 'insufficient')
    ? 'insufficient'
    : 'low';
}

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
    const conversionRate = step.entered === 0 ? 0 : (step.converted / step.entered) * 100;
    const dropOffPercent = step.entered === 0
      ? 0
      : ((step.entered - step.converted) / step.entered) * 100;
    const usersLost = step.entered - step.converted;
    const isAbnormal = dropOffPercent >= thresholdPercent;

    return {
      ...step,
      conversionRate: roundToTwoDecimals(conversionRate),
      dropOffPercent: roundToTwoDecimals(dropOffPercent),
      usersLost,
      isAbnormal,
      evidenceStrength: classifyEvidenceStrength(
        step.entered,
        usersLost,
        dropOffPercent,
        thresholdPercent,
      ),
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
    hasActionableDropOff: analyzedSteps.some(
      (step) => step.isAbnormal && step.evidenceStrength !== 'insufficient',
    ),
    hasInsufficientEvidence: analyzedSteps.some(
      (step) => step.isAbnormal && step.evidenceStrength === 'insufficient',
    ),
    evidenceStrength: summarizeEvidenceStrength(analyzedSteps),
    largestDropOffStep: largestDropOff?.name ?? null,
  };
}