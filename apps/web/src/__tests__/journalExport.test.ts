/**
 * journalExport — the self-contained HTML journal export (gap B7 / item 8.32b).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildJournalsHtml, downloadJournalsHtml } from '../pages/Coordinator/journalExport';
import type { PatientJournal } from '../lib/types';

function journal(overrides: Partial<PatientJournal> = {}): PatientJournal {
  return {
    patient: {
      id: 'pat-1',
      eventId: 'evt-1',
      ageGroup: 'adult',
      fullName: 'Kari Nordmann',
      status: 'in_treatment',
      presentingComplaint: 'Brystsmerter',
      assignedClinician: 'Lege Andersen',
      triageStatus: 'yellow',
      seq: 7,
      vitalsHistory: [],
      latestVitals: null,
      notes: [],
      createdAt: '2026-09-23T10:00:00Z',
      updatedAt: '2026-09-23T10:00:00Z',
    } as any,
    vitalsHistory: [],
    notes: [],
    medications: [],
    amkCallLogs: [],
    actionHistory: [],
    teams: [{ id: 'team-alpha', name: 'Alpha' }],
    ...overrides,
  };
}

describe('buildJournalsHtml', () => {
  it('builds one section per patient with a page-break between them', () => {
    const html = buildJournalsHtml([journal({ patient: { ...journal().patient, id: 'p1', fullName: 'Pasient En' } as any }), journal({ patient: { ...journal().patient, id: 'p2', fullName: 'Pasient To' } as any })]);
    expect(html).toContain('Pasient En');
    expect(html).toContain('Pasient To');
    expect(html).toContain('page-break-after: always');
    // One <section class="patient"> per journal.
    expect(html.match(/class="patient"/g)).toHaveLength(2);
  });

  it('includes identity, a vitals table with NEWS2, notes, medications, AMK logs and outcome', () => {
    const j = journal({
      vitalsHistory: [{ pulse: 96, spo2: 94, respiratoryRate: 20, systolicBP: 158, temperature: 37.2, acvpu: 'alert', timestamp: '2026-09-23T10:10:00Z' }],
      notes: [{ id: 'n1', text: 'Aspirin gitt', author: 'Sykepleier Bakke', createdAt: '2026-09-23T10:05:00Z' }],
      medications: [{ id: 'm1', drug: 'Aspirin', dose: '300mg', route: 'oral', givenBy: 'Sykepleier Bakke', givenAt: '2026-09-23T10:05:00Z' }],
      amkCallLogs: [{ id: 'c1', eventId: 'evt-1', patientId: 'pat-1', calledAt: '2026-09-23T10:12:00Z', summaryGiven: 'Brystsmerter', amkGuidance: 'Send ambulanse', followUpOwner: 'Lege Andersen' }],
    });
    const html = buildJournalsHtml([j]);
    expect(html).toContain('Kari Nordmann');
    expect(html).toContain('#7');
    expect(html).toContain('Vitale tegn');
    expect(html).toMatch(/NEWS2/);
    expect(html).toContain('Aspirin gitt');
    expect(html).toContain('Per os (svelget)');
    expect(html).toContain('Send ambulanse');
  });

  it('shows the hand-over outcome with the team name when handed over', () => {
    const j = journal({
      patient: {
        ...journal().patient,
        fieldOutcome: 'handed_to_sickbay',
        handedOverAt: '2026-09-23T10:30:00Z',
        handedOverByTeamId: 'team-alpha',
      } as any,
    });
    const html = buildJournalsHtml([j]);
    expect(html).toContain('Overlevert sykestue');
    expect(html).toContain('overlevert av Alpha');
  });

  it('escapes HTML in free-text fields', () => {
    const j = journal({ notes: [{ id: 'n1', text: '<script>alert(1)</script>', author: 'X', createdAt: '2026-09-23T10:05:00Z' }] });
    const html = buildJournalsHtml([j]);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('says how many journals were exported in the header', () => {
    const html = buildJournalsHtml([journal(), journal({ patient: { ...journal().patient, id: 'p2' } as any })], { eventName: 'Testarrangement' });
    expect(html).toContain('2 journaler');
    expect(html).toContain('Testarrangement');
  });
});

describe('downloadJournalsHtml', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('triggers a download named rkf-journaler-<eventId8>.html', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    downloadJournalsHtml('event-12345678-abcd', [journal()]);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    clickSpy.mockRestore();
  });
});
