import { describe, expect, it } from 'vitest';
import { resolveCloseOutcome } from '../pages/FirstAider/close-outcome';

const base = {
  teamId: 'team-alpha',
  teamName: 'Alpha',
  extraNote: '',
  nowIso: '2026-09-23T11:52:00.000Z',
};

describe('resolveCloseOutcome', () => {
  it('hand-over to sick bay keeps the patient open and clears the assignment', () => {
    const result = resolveCloseOutcome({
      ...base,
      reasonId: 'handed_to_sickbay',
      reasonLabel: 'Overlevert sykestue',
    });
    expect(result.updatePayload).toEqual({
      fieldOutcome: 'handed_to_sickbay',
      handedOverAt: base.nowIso,
      handedOverByTeamId: 'team-alpha',
      assignedTeamId: null,
    });
    // No `status` field — status must be left untouched.
    expect(result.updatePayload).not.toHaveProperty('status');
    expect(result.noteText).toBe('Overlevert sykestue av Alpha');
    expect(result.toastMessage).toBe('Overlevert sykestue');
    expect(result.outcomeLabel).toBe('Overlevert sykestue');
  });

  it('appends the free-text addendum to the hand-over note', () => {
    const result = resolveCloseOutcome({
      ...base,
      extraNote: '  båre til km 12  ',
      reasonId: 'handed_to_sickbay',
      reasonLabel: 'Overlevert sykestue',
    });
    expect(result.noteText).toBe('Overlevert sykestue av Alpha — båre til km 12');
  });

  it('hand-over to ambulance transfers the patient', () => {
    const result = resolveCloseOutcome({
      ...base,
      reasonId: 'handed_to_ambulance',
      reasonLabel: 'Overlevert ambulanse',
    });
    expect(result.updatePayload).toEqual({ fieldOutcome: 'handed_to_ambulance', status: 'transferred' });
    expect(result.toastMessage).toBe('Overlevert ambulanse');
  });

  it.each([
    ['treated_on_scene', 'Ferdig behandlet på stedet'],
    ['false_alarm', 'Falsk alarm'],
    ['disappeared', 'Forsvunnet'],
  ])('%s discharges the patient', (reasonId, reasonLabel) => {
    const result = resolveCloseOutcome({ ...base, reasonId, reasonLabel });
    expect(result.updatePayload).toEqual({ fieldOutcome: reasonId, status: 'discharged' });
    expect(result.toastMessage).toBe(reasonLabel);
    expect(result.noteText).toBe(reasonLabel);
  });

  it('never produces the old generic "Pasient avsluttet" wording', () => {
    for (const [reasonId, reasonLabel] of [
      ['handed_to_sickbay', 'Overlevert sykestue'],
      ['handed_to_ambulance', 'Overlevert ambulanse'],
      ['treated_on_scene', 'Ferdig behandlet på stedet'],
      ['false_alarm', 'Falsk alarm'],
      ['disappeared', 'Forsvunnet'],
    ]) {
      const result = resolveCloseOutcome({ ...base, reasonId: reasonId!, reasonLabel: reasonLabel! });
      expect(result.toastMessage).not.toBe('Pasient avsluttet');
      expect(result.toastMessage.length).toBeGreaterThan(0);
    }
  });
});
