import { describe, expect, it } from 'vitest';
import {
  AMK_CRITICALITY_LABELS,
  TEAM_OPERATIONAL_STATUS_LABELS,
  amkCriticalityLabel,
  normalizeAmkCriticality,
  normalizeLlmTriageLevel,
} from '../lib/constants';

describe('enum normalization and labels', () => {
  it('normalizes legacy and english AMK criticality values', () => {
    expect(normalizeAmkCriticality('lav')).toBe('low');
    expect(normalizeAmkCriticality('middels')).toBe('medium');
    expect(normalizeAmkCriticality('høy')).toBe('high');
    expect(normalizeAmkCriticality('kritisk')).toBe('critical');
    expect(normalizeAmkCriticality('low')).toBe('low');
    expect(normalizeAmkCriticality('medium')).toBe('medium');
    expect(normalizeAmkCriticality('high')).toBe('high');
    expect(normalizeAmkCriticality('critical')).toBe('critical');
  });

  it('renders Norwegian labels from normalized criticality', () => {
    expect(amkCriticalityLabel('lav')).toBe('Lav');
    expect(amkCriticalityLabel('medium')).toBe('Middels');
    expect(amkCriticalityLabel('high')).toBe('Høy');
    expect(amkCriticalityLabel('kritisk')).toBe('Kritisk');
    expect(AMK_CRITICALITY_LABELS.critical).toBe('Kritisk');
  });

  it('normalizes llm triage levels from legacy and english', () => {
    expect(normalizeLlmTriageLevel('lav')).toBe('low');
    expect(normalizeLlmTriageLevel('middels')).toBe('medium');
    expect(normalizeLlmTriageLevel('høy')).toBe('high');
    expect(normalizeLlmTriageLevel('kritisk')).toBe('critical');
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
