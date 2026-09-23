import { describe, expect, it } from 'vitest';
import { demoStore } from '../lib/demo-store';

describe('demoStore — hand-over model (gap A1)', () => {
  it('updatePatient stores handedOverAt, handedOverByTeamId and fieldOutcome', () => {
    const { patient: created } = demoStore.createPatient({ label: 'Hand-over parity test' });
    const handedOverAt = new Date().toISOString();

    const { patient: updated } = demoStore.updatePatient(created.id, {
      fieldOutcome: 'handed_to_sickbay',
      handedOverAt,
      handedOverByTeamId: 'team-alpha',
    });

    expect(updated?.fieldOutcome).toBe('handed_to_sickbay');
    expect(updated?.handedOverAt).toBe(handedOverAt);
    expect(updated?.handedOverByTeamId).toBe('team-alpha');
  });

  it('getTeamWorkspace drops a patient with handedOverAt set from every bucket, even while status stays open', () => {
    const { patient: created } = demoStore.createPatient({
      label: 'Bucket rule test',
      assignedTeamId: 'team-alpha',
      status: 'incoming',
    });

    // Sanity check: before hand-over, it shows up in the assigned bucket.
    const before = demoStore.getTeamWorkspace('team-alpha');
    expect(before.assignedPatients.some((p) => p.id === created.id)).toBe(true);

    demoStore.updatePatient(created.id, {
      fieldOutcome: 'handed_to_sickbay',
      handedOverAt: new Date().toISOString(),
      handedOverByTeamId: 'team-alpha',
    });

    const after = demoStore.getTeamWorkspace('team-alpha');
    const allIds = [
      ...after.assignedPatients,
      ...after.monitoredPatients,
      ...after.unassignedPatients,
    ].map((p) => p.id);
    expect(allIds).not.toContain(created.id);
  });
});

describe('demoStore — shared patient number (gap A5)', () => {
  it('allocates an increasing seq for each new patient', () => {
    const { patient: first } = demoStore.createPatient({ label: 'Seq test 1' });
    const { patient: second } = demoStore.createPatient({ label: 'Seq test 2' });

    expect(typeof first.seq).toBe('number');
    expect(second.seq).toBe(first.seq + 1);
  });
});

describe('demoStore — AMK notified action (gap B2 data half)', () => {
  it('amk.notified sets the columns once and is idempotent on a repeat call', () => {
    const { patient: created } = demoStore.createPatient({ label: 'AMK test' });

    const first = demoStore.executePatientAction(created.id, { type: 'amk.notified', by: 'Alpha' });
    expect(first.patient.amkNotifiedBy).toBe('Alpha');
    expect(first.patient.amkNotifiedAt).toBeTruthy();
    expect(first.action?.actionType).toBe('amk.notified');
    const firstNotifiedAt = first.patient.amkNotifiedAt;

    const second = demoStore.executePatientAction(created.id, { type: 'amk.notified', by: 'Bravo' });
    expect(second.patient.amkNotifiedAt).toBe(firstNotifiedAt);
    expect(second.patient.amkNotifiedBy).toBe('Alpha');
    expect(second.action).toBeNull();
  });

  it('amk.cleared nulls amkNotifiedAt/amkNotifiedBy', () => {
    const { patient: created } = demoStore.createPatient({ label: 'AMK clear test' });
    demoStore.executePatientAction(created.id, { type: 'amk.notified', by: 'Alpha' });

    const cleared = demoStore.executePatientAction(created.id, { type: 'amk.cleared' });
    expect(cleared.patient.amkNotifiedAt).toBeNull();
    expect(cleared.patient.amkNotifiedBy).toBeNull();
    expect(cleared.action?.actionType).toBe('amk.cleared');
  });
});
