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

// ────────────────────────────────────────────────────────────────────────────
// Lane 8 batch 3 (B) — event operations
// ────────────────────────────────────────────────────────────────────────────

describe('demoStore — chat history (gap B9 / 8.29)', () => {
  it('sendTeamMessage appends to the in-memory list getTeamMessages reads', () => {
    const before = demoStore.getTeamMessages('demo-event').messages.length;
    const { message } = demoStore.sendTeamMessage('demo-event', { fromLabel: 'Koordinator', text: 'Test melding' });
    const after = demoStore.getTeamMessages('demo-event').messages;

    expect(after.length).toBe(before + 1);
    expect(after[after.length - 1]).toEqual(message);
    expect(message.text).toBe('Test melding');
    expect(typeof message.sentAt).toBe('string');
  });
});

describe('demoStore — capacity settings (gap B6 / 8.30)', () => {
  it('defaults to chairs 16 / beds 4', () => {
    const { event } = demoStore.getEvent('demo-event');
    expect(event.settings).toEqual({ sickbay: { chairs: 16, beds: 4 } });
  });

  it('updateEventSettings merges rather than replacing', () => {
    demoStore.updateEventSettings('demo-event', { sickbay: { beds: 6 } });
    const { settings } = demoStore.updateEventSettings('demo-event', { sickbay: { chairs: 20 } });
    expect(settings).toEqual({ sickbay: { chairs: 20, beds: 6 } });
  });
});

describe('demoStore — event set-up (gap B5 / 8.31)', () => {
  it('createTeam adds an active team visible via getEvent', () => {
    const { team } = demoStore.createTeam('demo-event', { name: 'Patrulje Golf', transport: 'bike' });
    expect(team.active).toBe(true);

    const { teams } = demoStore.getEvent('demo-event');
    expect(teams.some((t) => t.id === team.id)).toBe(true);
  });

  it('updateTeam(active: false) hides the team from getEvent', () => {
    const { team } = demoStore.createTeam('demo-event', { name: 'Patrulje Hidden' });
    demoStore.updateTeam(team.id, { active: false });

    const { teams } = demoStore.getEvent('demo-event');
    expect(teams.some((t) => t.id === team.id)).toBe(false);
  });

  it('createAccessCode generates a 6-digit code; revokeAccessCode sets revokedAt', () => {
    const { code } = demoStore.createAccessCode('demo-event', { role: 'first_aider' });
    expect(code.code).toMatch(/^\d{6}$/);
    expect(code.revokedAt).toBeNull();

    const { code: revoked } = demoStore.revokeAccessCode(code.id);
    expect(revoked.revokedAt).toBeTruthy();

    const { codes } = demoStore.getAccessCodes('demo-event');
    expect(codes.find((c) => c.id === code.id)?.revokedAt).toBe(revoked.revokedAt);
  });
});
describe('demoStore — transport request (gap B3)', () => {
  it('transport.requested sets need/pickupText/requestedAt/requestedBy from the assigned team, and clears any team', () => {
    const { patient: created } = demoStore.createPatient({
      label: 'Transport request test',
      eventId: 'demo-event',
      assignedTeamId: 'team-alpha',
    });

    const result = demoStore.executePatientAction(created.id, {
      type: 'transport.requested',
      need: 'atv',
      pickupText: 'Ved kiosken',
    });

    expect(result.patient.transportNeed).toBe('atv');
    expect(result.patient.transportPickupText).toBe('Ved kiosken');
    expect(result.patient.transportRequestedAt).toBeTruthy();
    expect(result.patient.transportRequestedBy).toBe('Alpha');
    expect(result.patient.transportTeamId).toBeNull();
    expect(result.patient.transportAssignedAt).toBeNull();
    expect(result.action?.actionType).toBe('transport.requested');
  });

  it('transport.assigned sets the team, transport.cleared nulls all six fields', () => {
    const { patient: created } = demoStore.createPatient({ label: 'Transport assign test', eventId: 'demo-event' });
    demoStore.executePatientAction(created.id, { type: 'transport.requested', need: 'stretcher' });

    const assigned = demoStore.executePatientAction(created.id, { type: 'transport.assigned', teamId: 'team-delta' });
    expect(assigned.patient.transportTeamId).toBe('team-delta');
    expect(assigned.patient.transportAssignedAt).toBeTruthy();
    expect(assigned.action?.actionType).toBe('transport.assigned');

    const cleared = demoStore.executePatientAction(created.id, { type: 'transport.cleared' });
    expect(cleared.patient.transportNeed).toBeNull();
    expect(cleared.patient.transportPickupText).toBeNull();
    expect(cleared.patient.transportRequestedAt).toBeNull();
    expect(cleared.patient.transportRequestedBy).toBeNull();
    expect(cleared.patient.transportTeamId).toBeNull();
    expect(cleared.patient.transportAssignedAt).toBeNull();
    expect(cleared.action?.actionType).toBe('transport.cleared');
  });

  it('transport.assigned rejects an unknown team', () => {
    const { patient: created } = demoStore.createPatient({ label: 'Transport bad team test', eventId: 'demo-event' });
    expect(() => demoStore.executePatientAction(created.id, { type: 'transport.assigned', teamId: 'no-such-team' }))
      .toThrow();
  });
});

describe('demoStore — quick log (gap A8)', () => {
  it('creates a closed patient with a "<outcome> av <team>" note when status and fieldOutcome are both given', () => {
    const { patient } = demoStore.createPatient({
      label: 'Quick log test',
      eventId: 'demo-event',
      assignedTeamId: 'team-alpha',
      fieldOutcome: 'treated_on_scene',
      status: 'discharged',
      ageGroup: 'adult',
    });

    expect(patient.status).toBe('discharged');
    expect(patient.notes).toHaveLength(1);
    expect(patient.notes[0]?.text).toBe('Behandlet på stedet av Alpha');
  });

  it('leaves the patient open with no note when only fieldOutcome is given (no status)', () => {
    const { patient } = demoStore.createPatient({
      label: 'Quick log outcome-only test',
      eventId: 'demo-event',
      fieldOutcome: 'treated_on_scene',
    });

    expect(patient.status).toBe('incoming');
    expect(patient.notes).toHaveLength(0);
  });
});

describe('demoStore — journal export (gap B7)', () => {
  it('getPatientJournal returns vitals, notes, medications, amkCallLogs, actionHistory and teams', () => {
    const journal = demoStore.getPatientJournal('demo-pat-1');

    expect(journal.patient.id).toBe('demo-pat-1');
    expect(journal.vitalsHistory.length).toBeGreaterThan(0);
    expect(journal.notes.length).toBeGreaterThan(0);
    expect(Array.isArray(journal.medications)).toBe(true);
    expect(Array.isArray(journal.amkCallLogs)).toBe(true);
    expect(Array.isArray(journal.actionHistory)).toBe(true);
    expect(journal.teams.length).toBeGreaterThan(0);
    expect(journal.teams[0]).toHaveProperty('name');
  });

  it('getEventJournals returns one journal per patient in the event', () => {
    const { journals } = demoStore.getEventJournals('demo-event');
    expect(journals.length).toBeGreaterThan(0);
    expect(journals.every((j) => j.patient.eventId === 'demo-event')).toBe(true);
    expect(journals.some((j) => j.patient.id === 'demo-pat-1')).toBe(true);
  });
});

describe('demoStore — retention (gap B8)', () => {
  it('anonymiseEvent nulls identifying fields, replaces note and AMK call log text, and is idempotent', () => {
    const { patient: created } = demoStore.createPatient({
      label: 'Anonymise test',
      eventId: 'demo-event',
      fullName: 'Test Testesen',
      birthDate: '1990-01-01',
      gender: 'male',
      description: 'Beskrivelse',
      positionText: 'Ved scenen',
    });
    demoStore.addPatientNote(created.id, 'Sensitiv informasjon', 'Sykepleier');
    demoStore.createAmkCallLog(created.id, {
      summaryGiven: 'Fortalte om pasienten',
      amkGuidance: 'Send ambulanse',
      followUpOwner: 'Lege Andersen',
    });

    // The demo event defaults to 'active' (event set-up, gap B5 / 8.31) —
    // anonymising a still-active event is refused (409 on the real API), same
    // as archiving it first in the event set-up page's flow.
    demoStore.updateEvent('demo-event', { status: 'archived' });

    const first = demoStore.anonymiseEvent('demo-event');
    expect(first.alreadyAnonymised).toBe(false);
    expect(first.patientsAnonymised).toBeGreaterThan(0);
    expect(first.anonymisedAt).toBeTruthy();

    const patientAfter = demoStore.getPatientJournal(created.id).patient;
    expect(patientAfter.fullName).toBeNull();
    expect(patientAfter.birthDate).toBeNull();
    expect(patientAfter.gender).toBeNull();
    expect(patientAfter.description).toBeNull();
    expect(patientAfter.positionText).toBeNull();
    expect(patientAfter.notes.every((n: { text: string }) => n.text === '[anonymisert]')).toBe(true);
    // Untouched — retention keeps the clinical record itself.
    expect(patientAfter.label).toBe('Anonymise test');

    const journalAfter = demoStore.getPatientJournal(created.id);
    expect(journalAfter.amkCallLogs[0]?.summaryGiven).toBe('[anonymisert]');
    expect(journalAfter.amkCallLogs[0]?.amkGuidance).toBe('[anonymisert]');
    expect(journalAfter.amkCallLogs[0]?.followUpOwner).toBe('Lege Andersen');

    const second = demoStore.anonymiseEvent('demo-event');
    expect(second.alreadyAnonymised).toBe(true);
    expect(second.patientsAnonymised).toBe(0);
    expect(second.anonymisedAt).toBe(first.anonymisedAt);
  });
});
