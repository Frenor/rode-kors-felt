import { describe, expect, it } from 'vitest';
import {
  AMK_CRITICALITY_LABELS,
  TEAM_OPERATIONAL_STATUS_LABELS,
  amkCriticalityLabel,
  normalizeAmkCriticality,
  normalizeLlmTriageLevel,
} from '../lib/constants';

describe('enum normalization and labels', () => {
  it('accepts canonical AMK criticality values', () => {
    expect(normalizeAmkCriticality('low')).toBe('low');
    expect(normalizeAmkCriticality('medium')).toBe('medium');
    expect(normalizeAmkCriticality('high')).toBe('high');
    expect(normalizeAmkCriticality('critical')).toBe('critical');
  });

  it('throws when non-canonical AMK criticality is provided', () => {
    expect(() => normalizeAmkCriticality('lav')).toThrow();
    expect(() => normalizeAmkCriticality('kritisk')).toThrow();
    expect(() => normalizeAmkCriticality('deprecated')).toThrow();
  });

  it('renders Norwegian labels from normalized criticality', () => {
    expect(amkCriticalityLabel('low')).toBe('Lav');
    expect(amkCriticalityLabel('medium')).toBe('Middels');
    expect(amkCriticalityLabel('high')).toBe('Høy');
    expect(AMK_CRITICALITY_LABELS.critical).toBe('Kritisk');
  });

  it('normalizes llm triage levels from legacy and english', () => {
    expect(normalizeLlmTriageLevel('low')).toBe('low');
    expect(normalizeLlmTriageLevel('medium')).toBe('medium');
    expect(normalizeLlmTriageLevel('high')).toBe('high');
    expect(normalizeLlmTriageLevel('critical')).toBe('critical');
    expect(normalizeLlmTriageLevel('invalid')).toBe('medium');
    expect(normalizeLlmTriageLevel(undefined)).toBe('medium');
  });

  it('contains norwegian labels for team operational statuses', () => {
    expect(TEAM_OPERATIONAL_STATUS_LABELS.available).toBe('Ledig');
    expect(TEAM_OPERATIONAL_STATUS_LABELS.en_route).toBe('På vei');
    expect(TEAM_OPERATIONAL_STATUS_LABELS.on_scene).toBe('Fremme på stedet');
    expect(TEAM_OPERATIONAL_STATUS_LABELS.needs_assistance).toBe('Trenger bistand');
    expect(TEAM_OPERATIONAL_STATUS_LABELS.unavailable).toBe('Utilgjengelig');
  });
});
