/**
 * EventSetupPage — event set-up (gap B5 / item 8.31) at `/coordinator/event`.
 * Arrangement, Lag, Tilgangskoder, Sykestue kapasitet, journal export and
 * archive, in one page. Every section fails loud: an API error shows a
 * visible line in that section, never a silent no-op.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';
import { api } from '../../lib/api';
import { Button, Icon } from '../../components/ui';
import type { AccessCode } from '../../lib/types';
import { AccessCodesPanel } from './AccessCodesPanel';
import { TeamsSetupPanel } from './TeamsSetupPanel';
import { ArchiveEventCard } from './ArchiveEventCard';
import { downloadJournalsHtml } from './journalExport';

interface SetupTeam {
  id: string;
  name: string;
  transport?: string;
  contactPhone?: string | null;
  contactRadio?: string | null;
  active?: boolean;
}

interface SetupEvent {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status?: 'draft' | 'active' | 'archived';
  settings?: { sickbay?: { chairs?: number; beds?: number } };
  anonymisedAt?: string | null;
}

const inputStyle = { minHeight: 44, fontSize: 'var(--text-sm)' };
const fieldLabelStyle = { display: 'block', marginBottom: 4 };

/** ISO → the local value a `datetime-local` input wants (no timezone, no seconds). */
function toDatetimeLocalValue(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventSetupPage() {
  const { eventId } = useAuthStore();
  const [event, setEvent] = useState<SetupEvent | null>(null);
  const [teams, setTeams] = useState<SetupTeam[]>([]);
  const [codes, setCodes] = useState<AccessCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Arrangement section draft.
  const [nameDraft, setNameDraft] = useState('');
  const [startDraft, setStartDraft] = useState('');
  const [endDraft, setEndDraft] = useState('');
  const [statusDraft, setStatusDraft] = useState<'draft' | 'active' | 'archived'>('draft');
  const [savingEvent, setSavingEvent] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);

  // Sykestue kapasitet draft.
  const [chairsDraft, setChairsDraft] = useState('');
  const [bedsDraft, setBedsDraft] = useState('');
  const [savingCapacity, setSavingCapacity] = useState(false);
  const [capacityError, setCapacityError] = useState<string | null>(null);

  // Journal export (top-level button, gap B7 / item 8.32b).
  const [exportingJournals, setExportingJournals] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportedCount, setExportedCount] = useState<number | null>(null);

  const load = useCallback(() => {
    if (!eventId) return;
    setLoadError(null);
    Promise.all([
      api.getEvent(eventId, { includeInactive: true }),
      api.getAccessCodes(eventId),
    ]).then(([evtRes, codesRes]) => {
      const evt = evtRes.event as SetupEvent;
      setEvent(evt);
      setTeams((evtRes.teams ?? []) as SetupTeam[]);
      setCodes(codesRes.codes ?? []);
      setNameDraft(evt.name ?? '');
      setStartDraft(toDatetimeLocalValue(evt.startDate));
      setEndDraft(toDatetimeLocalValue(evt.endDate));
      setStatusDraft(evt.status ?? 'draft');
      setChairsDraft(evt.settings?.sickbay?.chairs != null ? String(evt.settings.sickbay.chairs) : '');
      setBedsDraft(evt.settings?.sickbay?.beds != null ? String(evt.settings.sickbay.beds) : '');
      setLoading(false);
    }).catch((err) => {
      setLoadError(err instanceof Error ? err.message : 'Kunne ikke laste arrangementet');
      setLoading(false);
    });
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  const handleSaveEvent = async () => {
    if (!eventId) return;
    setSavingEvent(true);
    setEventError(null);
    try {
      const res = await api.updateEvent(eventId, {
        name: nameDraft.trim(),
        startDate: startDraft ? new Date(startDraft).toISOString() : undefined,
        endDate: endDraft ? new Date(endDraft).toISOString() : undefined,
        status: statusDraft,
      });
      setEvent(res.event as SetupEvent);
    } catch (err) {
      setEventError(err instanceof Error ? err.message : 'Kunne ikke lagre arrangementet');
    } finally {
      setSavingEvent(false);
    }
  };

  const handleSaveCapacity = async () => {
    if (!eventId) return;
    setSavingCapacity(true);
    setCapacityError(null);
    try {
      const res = await api.updateEventSettings(eventId, {
        sickbay: {
          chairs: chairsDraft.trim() ? Number(chairsDraft) : undefined,
          beds: bedsDraft.trim() ? Number(bedsDraft) : undefined,
        },
      });
      setEvent((prev) => (prev ? { ...prev, settings: res.settings } : prev));
    } catch (err) {
      setCapacityError(err instanceof Error ? err.message : 'Kunne ikke lagre kapasitet');
    } finally {
      setSavingCapacity(false);
    }
  };

  const handleCreateTeam = async (data: { name: string; transport?: string; contactPhone?: string | null; contactRadio?: string | null }) => {
    if (!eventId) return;
    const res = await api.createTeam(eventId, data);
    setTeams((prev) => [...prev, res.team as SetupTeam]);
  };

  const handleUpdateTeam = async (teamId: string, data: Partial<{ name: string; transport: string; contactPhone: string | null; contactRadio: string | null; active: boolean }>) => {
    const res = await api.updateTeam(teamId, data);
    setTeams((prev) => prev.map((t) => (t.id === teamId ? { ...t, ...(res.team as SetupTeam) } : t)));
  };

  const handleCreateCode = async (data: { role: 'first_aider' | 'sickbay' | 'coordinator'; hours?: number }) => {
    if (!eventId) throw new Error('Ingen arrangement-ID');
    const res = await api.createAccessCode(eventId, data);
    setCodes((prev) => [...prev, res.code]);
    return res.code;
  };

  const handleRevokeCode = async (codeId: string) => {
    const res = await api.revokeAccessCode(codeId);
    setCodes((prev) => prev.map((c) => (c.id === codeId ? res.code : c)));
  };

  const handleExportJournals = useCallback(async (): Promise<number> => {
    if (!eventId) throw new Error('Ingen arrangement-ID');
    const { journals } = await api.getEventJournals(eventId);
    downloadJournalsHtml(eventId, journals, { eventName: event?.name });
    return journals.length;
  }, [eventId, event?.name]);

  const handleExportJournalsButton = async () => {
    setExportingJournals(true);
    setExportError(null);
    try {
      const count = await handleExportJournals();
      setExportedCount(count);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Kunne ikke eksportere journaler');
    } finally {
      setExportingJournals(false);
    }
  };

  const handleAnonymise = useCallback(async () => {
    if (!eventId) throw new Error('Ingen arrangement-ID');
    const res = await api.anonymiseEvent(eventId);
    setEvent((prev) => (prev ? { ...prev, anonymisedAt: res.anonymisedAt } : prev));
    return res;
  }, [eventId]);

  if (loading) {
    return <p style={{ padding: 'var(--space-4)', color: 'var(--color-text-subtle)' }}>Laster arrangement…</p>;
  }

  if (loadError || !event) {
    return (
      <div style={{ padding: 'var(--space-4)' }}>
        <p role="alert" style={{ color: 'var(--color-status-critical)' }}>{loadError ?? 'Fant ikke arrangementet'}</p>
        <Button variant="secondary" onClick={load}>Prøv igjen</Button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <Link to="/coordinator" style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
          <Icon name="chevronRight" style={{ transform: 'rotate(180deg)' }} />
          Tilbake til oversikten
        </Link>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, marginTop: 'var(--space-2)' }}>Arrangement</h1>
      </div>

      {/* Arrangement */}
      <section aria-labelledby="event-setup-title" data-testid="event-setup-general" className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
        <h2 id="event-setup-title" className="section-label" style={{ margin: '0 0 var(--space-3)' }}>Arrangement</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', maxWidth: 560 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="event-setup-name" className="section-label" style={fieldLabelStyle}>Navn</label>
            <input id="event-setup-name" data-testid="event-setup-name" className="field" style={inputStyle} value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} />
          </div>
          <div>
            <label htmlFor="event-setup-start" className="section-label" style={fieldLabelStyle}>Starter</label>
            <input id="event-setup-start" type="datetime-local" className="field" style={inputStyle} value={startDraft} onChange={(e) => setStartDraft(e.target.value)} />
          </div>
          <div>
            <label htmlFor="event-setup-end" className="section-label" style={fieldLabelStyle}>Slutter</label>
            <input id="event-setup-end" type="datetime-local" className="field" style={inputStyle} value={endDraft} onChange={(e) => setEndDraft(e.target.value)} />
          </div>
          <div>
            <label htmlFor="event-setup-status" className="section-label" style={fieldLabelStyle}>Status</label>
            <select id="event-setup-status" data-testid="event-setup-status" className="field" style={inputStyle} value={statusDraft} onChange={(e) => setStatusDraft(e.target.value as typeof statusDraft)}>
              <option value="draft">Utkast</option>
              <option value="active">Aktivt</option>
              <option value="archived">Arkivert</option>
            </select>
          </div>
        </div>
        <Button variant="primary" size="sm" disabled={savingEvent || !nameDraft.trim()} onClick={() => void handleSaveEvent()} style={{ marginTop: 'var(--space-3)' }}>
          {savingEvent ? 'Lagrer…' : 'Lagre'}
        </Button>
        {eventError && (
          <p role="alert" style={{ margin: 'var(--space-2) 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-status-critical)' }}>{eventError}</p>
        )}
      </section>

      {/* Lag */}
      <TeamsSetupPanel teams={teams} onCreateTeam={handleCreateTeam} onUpdateTeam={handleUpdateTeam} />

      {/* Tilgangskoder */}
      <AccessCodesPanel codes={codes} onCreateCode={handleCreateCode} onRevokeCode={handleRevokeCode} />

      {/* Sykestue kapasitet */}
      <section aria-labelledby="event-setup-capacity-title" data-testid="event-setup-capacity" className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
        <h2 id="event-setup-capacity-title" className="section-label" style={{ margin: '0 0 var(--space-3)' }}>Sykestue kapasitet</h2>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label htmlFor="event-setup-capacity-chairs" className="section-label" style={fieldLabelStyle}>Stoler</label>
            <input id="event-setup-capacity-chairs" data-testid="event-setup-capacity-chairs" type="number" min={0} max={999} className="field" style={{ ...inputStyle, width: 100 }} value={chairsDraft} onChange={(e) => setChairsDraft(e.target.value)} />
          </div>
          <div>
            <label htmlFor="event-setup-capacity-beds" className="section-label" style={fieldLabelStyle}>Senger</label>
            <input id="event-setup-capacity-beds" data-testid="event-setup-capacity-beds" type="number" min={0} max={999} className="field" style={{ ...inputStyle, width: 100 }} value={bedsDraft} onChange={(e) => setBedsDraft(e.target.value)} />
          </div>
          <Button variant="secondary" size="sm" disabled={savingCapacity} onClick={() => void handleSaveCapacity()}>
            {savingCapacity ? 'Lagrer…' : 'Lagre kapasitet'}
          </Button>
        </div>
        {capacityError && (
          <p role="alert" style={{ margin: 'var(--space-2) 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-status-critical)' }}>{capacityError}</p>
        )}
      </section>

      {/* Journal export (gap B7 / item 8.32b) */}
      <section aria-labelledby="event-setup-export-title" data-testid="event-setup-export" className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
        <h2 id="event-setup-export-title" className="section-label" style={{ margin: '0 0 var(--space-2)' }}>Journaler</h2>
        <Button variant="secondary" size="sm" icon="download" disabled={exportingJournals} data-testid="event-setup-export-journals" onClick={() => void handleExportJournalsButton()}>
          {exportingJournals ? 'Eksporterer…' : 'Eksporter journaler'}
        </Button>
        {exportedCount !== null && (
          <p style={{ margin: 'var(--space-2) 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            {exportedCount} {exportedCount === 1 ? 'journal' : 'journaler'} eksportert
          </p>
        )}
        {exportError && (
          <p role="alert" style={{ margin: 'var(--space-2) 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-status-critical)' }}>{exportError}</p>
        )}
      </section>

      {/* Arkivering (gap B8 / item 8.33) */}
      <ArchiveEventCard
        eventName={event.name}
        eventStatus={event.status}
        anonymisedAt={event.anonymisedAt}
        onExportJournals={handleExportJournals}
        onAnonymise={handleAnonymise}
      />
    </div>
  );
}
