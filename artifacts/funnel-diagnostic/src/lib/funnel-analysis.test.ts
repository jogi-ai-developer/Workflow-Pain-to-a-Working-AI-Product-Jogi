import { describe, expect, test } from 'vitest';
import {
  analyzeFunnel,
  classifyEvidenceStrength,
} from './funnel-analysis';

const step = (name: string, order: number, entered: number, converted: number) => ({
  name,
  order,
  entered,
  converted,
  description: '',
});

describe('analyzeFunnel', () => {
  test('handles a zero-user step without NaN or Infinity', () => {
    const result = analyzeFunnel([
      step('Landing', 1, 0, 0),
      step('Signup', 2, 0, 0),
      step('Purchase', 3, 0, 0),
    ]);

    expect(result.hasAbnormalDropOff).toBe(false);
    expect(result.evidenceStrength).toBe('insufficient');
    expect(result.steps[0]).toMatchObject({
      conversionRate: 0,
      dropOffPercent: 0,
      usersLost: 0,
      evidenceStrength: 'insufficient',
    });
    expect(JSON.stringify(result)).not.toMatch(/NaN|Infinity/);
  });

  test('marks a high percentage from a tiny sample inconclusive', () => {
    const result = analyzeFunnel([
      step('Landing', 1, 10, 5),
      step('Signup', 2, 5, 5),
      step('Purchase', 3, 5, 5),
    ]);

    expect(result.flaggedSteps).toEqual(['Landing']);
    expect(result.hasAbnormalDropOff).toBe(true);
    expect(result.hasActionableDropOff).toBe(false);
    expect(result.hasInsufficientEvidence).toBe(true);
    expect(result.evidenceStrength).toBe('insufficient');
    expect(result.steps[0].evidenceStrength).toBe('insufficient');
  });

  test('separates medium and high evidence from the deterministic signal', () => {
    const medium = analyzeFunnel([
      step('Landing', 1, 100, 50),
      step('Signup', 2, 50, 45),
      step('Purchase', 3, 45, 40),
    ]);
    const high = analyzeFunnel([
      step('Landing', 1, 1_000, 500),
      step('Signup', 2, 500, 450),
      step('Purchase', 3, 450, 400),
    ]);

    expect(medium.steps[0].evidenceStrength).toBe('medium');
    expect(medium.evidenceStrength).toBe('medium');
    expect(medium.hasActionableDropOff).toBe(true);
    expect(high.steps[0].evidenceStrength).toBe('high');
    expect(high.evidenceStrength).toBe('high');
  });

  test('keeps a large but sub-threshold loss visible as low-strength evidence', () => {
    const result = analyzeFunnel([
      step('Landing', 1, 10_000, 8_500),
      step('Signup', 2, 8_500, 8_000),
      step('Purchase', 3, 8_000, 7_500),
    ]);

    expect(result.hasAbnormalDropOff).toBe(false);
    expect(result.steps[0]).toMatchObject({
      dropOffPercent: 15,
      usersLost: 1_500,
      evidenceStrength: 'low',
    });
  });
});

describe('classifyEvidenceStrength', () => {
  test('uses raw drop-off at the threshold and rejects small impact', () => {
    expect(classifyEvidenceStrength(100, 40, 40)).toBe('medium');
    expect(classifyEvidenceStrength(100, 9, 80)).toBe('insufficient');
    expect(classifyEvidenceStrength(29, 29, 80)).toBe('insufficient');
  });
});