import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/auth';
import { useWsStore } from '../stores/ws';
import { api } from '../lib/api';
import { EventMap } from '../components/EventMap';
import { assessTriage, type TriageAssessment, type TriageLevel } from '../lib/llm-triage';
import { useLLMApiKey } from '../hooks/useLLMApiKey';

const typeLabels: Record<string, string> = {
  medical: 'Medisinsk', trauma: 'Traume',
  psychiatric: 'Psykiatrisk', other: 'Annet',
};

const TRIAGE_COLORS: Record<TriageLevel, { color: string; bg: string; label: string }> = {
  lav:     { color: 'var(--color-status-ok)',       bg: 'var(--color-status-ok-bg)',       label: 'Lav' },
  middels: { color: 'var(--color-status-info)',      bg: 'var(--color-status-info-bg)',      label: 'Middels' },
  høy:     { color: 'var(--color-status-warning)',   bg: 'var(--color-status-warning-bg)',   label: 'Høy' },
  kritisk: { color: 'var(--color-status-critical)',  bg: 'var(--color-status-critical-bg)',  label: 'KRITISK' },
};

const PATH_LABELS: Record<string, string> = {
  path_a_rk_ambulance: 'Vei A — RK Ambulanse',
  path_b_113: 'Vei B — Ring 113',
};

export function CoordinatorDashboard() {
  const { eventId } = useAuthStore();
  const onMessage = useWsStore((s) => s.onMessage);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [escalateTarget, setEscalateTarget] = useState<string | null>(null);
  const [escalatePath, setEscalatePath] = useState<string>('path_a_rk_ambulance');
  const [escalateReason, setEscalateReason] = useState('');
  const [escalating, setEscalating] = useState(false);
  const [deteriorationAlerts, setDeteriorationAlerts] = useState<Array<{ patientId: string; news2Score: number; ratePerHour: number; receivedAt: string }>>([]);
  const [mciActive, setMciActive] = useState(false);
  const [mciActivatedBy, setMciActivatedBy] = useState<string | null>(null);
  const [togglingMci, setTogglingMci] = useState(false);

  // Nytt koordinatoroppdrag state
  const [showNewOppdrag, setShowNewOppdrag] = useState(false);
  const [newType, setNewType] = useState<string>('medical');
  const [newTeamId, setNewTeamId] = useState<string>('');
  const [newNote, setNewNote] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreateOppdrag = async () => {
    if (!eventId) return;
    setCreating(true);
    try {
      const { incident } = await api.createIncident({
        eventId,
        type: newType,
        source: 'coordinator',
        teamId: newTeamId || undefined,
        notes: newNote || undefined,
      });
      setIncidents((prev) => [incident, ...prev]);
      setShowNewOppdrag(false);
      setNewType('medical');
      setNewTeamId('');
      setNewNote('');
    } finally {
      setCreating(false);
    }
  };

  // LLM triage state
  const { apiKey, setApiKey, hasKey, isDemo } = useLLMApiKey();
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [triageResults, setTriageResults] = useState<Record<string, TriageAssessment>>({});
  const [triageLoading, setTriageLoading] = useState<Record<string, boolean>>({});
  const [triageErrors, setTriageErrors] = useState<Record<string, string>>({});

  const handleTriageAssess = async (inc: any) => {
    if (!hasKey) { setShowApiKeyInput(true); return; }
    setTriageLoading((p) => ({ ...p, [inc.id]: true }));
    setTriageErrors((p) => { const n = { ...p }; delete n[inc.id]; return n; });
    try {
      const result = await assessTriage(inc, apiKey);
      setTriageResults((p) => ({ ...p, [inc.id]: result }));
    } catch (e: any) {
      setTriageErrors((p) => ({ ...p, [inc.id]: e.message ?? 'Feil ved AI-vurdering' }));
    } finally {
      setTriageLoading((p) => ({ ...p, [inc.id]: false }));
    }
  };

  const fetchAll = useCallback(() => {
    if (!eventId) return;
    Promise.all([
      api.getIncidents(eventId),
      api.getEventStats(eventId),
      api.getEvent(eventId),
    ]).then(([incRes, statsRes, evtRes]) => {
      setIncidents(incRes.incidents);
      setStats(statsRes);
      setTeams(evtRes.teams ?? []);
      if (evtRes.event?.mciActive !== undefined) {
        setMciActive(evtRes.event.mciActive);
        setMciActivatedBy(evtRes.event.mciActivatedBy ?? null);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [eventId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Live WS updates — merge into state instead of polling
  useEffect(() => {
    const off = onMessage((msg) => {
      if (msg.type === 'incident.created') {
        const inc = (msg.payload as any)?.incident;
        if (inc) setIncidents((prev) => [inc, ...prev.filter((i) => i.id !== inc.id)]);
      } else if (msg.type === 'incident.updated') {
        const inc = (msg.payload as any)?.incident;
        if (inc) setIncidents((prev) => prev.map((i) => (i.id === inc.id ? inc : i)));
      } else if (msg.type === 'escalation.raised') {
        const { incidentId, escalation } = (msg.payload as any) ?? {};
        if (incidentId) {
          setIncidents((prev) =>
            prev.map((i) => (i.id === incidentId ? { ...i, activeEscalation: escalation } : i)),
          );
        }
      } else if (msg.type === 'escalation.resolved') {
        const { incidentId } = (msg.payload as any) ?? {};
        if (incidentId) {
          setIncidents((prev) =>
            prev.map((i) => (i.id === incidentId ? { ...i, activeEscalation: null } : i)),
          );
        }
      } else if (msg.type === 'event.mci_activated') {
        const { activatedBy } = (msg.payload as any) ?? {};
        setMciActive(true);
        setMciActivatedBy(activatedBy ?? null);
      } else if (msg.type === 'event.mci_deactivated') {
        setMciActive(false);
        setMciActivatedBy(null);
      } else if (msg.type === 'patient.deterioration_alert') {
        const { patientId, trend, news2Score } = (msg.payload as any) ?? {};
        if (patientId && trend) {
          setDeteriorationAlerts((prev) => {
            const filtered = prev.filter((a) => a.patientId !== patientId);
            return [{ patientId, news2Score, ratePerHour: trend.ratePerHour, receivedAt: new Date().toISOString() }, ...filtered];
          });
        }
      } else if (msg.type === 'team.position') {
        const { teamId, position } = (msg.payload as any) ?? {};
        if (teamId && position) {
          setTeams((prev) =>
            prev.map((t) => (t.id === teamId ? { ...t, currentPosition: position } : t)),
          );
        }
      }
    });
    return off;
  }, [onMessage]);

  const handleStatusUpdate = async (id: string, status: string) => {
    await api.updateIncident(id, { status });
    setIncidents((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
  };

  const handleEscalate = async () => {
    if (!escalateTarget) return;
    setEscalating(true);
    try {
      await api.escalateIncident(escalateTarget, { path: escalatePath, reason: escalateReason || undefined });
    } finally {
      setEscalating(false);
      setEscalateTarget(null);
      setEscalateReason('');
    }
  };

  const handleToggleMci = async () => {
    if (!eventId) return;
    setTogglingMci(true);
    try {
      await api.toggleMci(eventId, !mciActive);
    } finally {
      setTogglingMci(false);
    }
  };

  const handleScrollToIncident = (incidentId: string) => {
    document.getElementById(`inc-${incidentId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>Koordinator</h1>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <button
            onClick={handleToggleMci}
            disabled={togglingMci}
            style={{
              padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)',
              border: `2px solid ${mciActive ? 'var(--color-status-critical)' : 'var(--color-border)'}`,
              background: mciActive ? 'var(--color-status-critical)' : 'transparent',
              color: mciActive ? 'white' : 'var(--color-text-muted)',
              fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {mciActive ? '⚠ MCI AKTIV' : 'MCI-modus'}
          </button>
          {!isDemo && (
            <button
              onClick={() => { setApiKeyDraft(apiKey); setShowApiKeyInput(true); }}
              title="Konfigurer Anthropic API-nøkkel for AI-triage"
              style={{
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: hasKey ? 'var(--color-status-ok-bg)' : 'var(--color-surface)',
                color: hasKey ? 'var(--color-status-ok)' : 'var(--color-text-muted)',
                fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
                cursor: 'pointer',
              }}
            >
              {hasKey ? '✓ AI aktiv' : '⚙ API-nøkkel'}
            </button>
          )}
        </div>
      </div>

      {/* API key modal */}
      {showApiKeyInput && (
        <div
          role="dialog"
          aria-label="Anthropic API-nøkkel"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, zIndex: 'var(--z-modal)',
            background: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)',
          }}
        >
          <div style={{
            background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)', maxWidth: 440, width: '100%',
          }}>
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
              Anthropic API-nøkkel
            </h2>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)' }}>
              Nøkkelen lagres kun lokalt i nettleseren din og brukes til AI-triageanalyse.
            </p>
            <input
              type="password"
              value={apiKeyDraft}
              onChange={(e) => setApiKeyDraft(e.target.value)}
              placeholder="sk-ant-..."
              style={{
                width: '100%', padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)', border: '1px solid var(--color-input-border)',
                background: 'var(--color-input-bg)', color: 'var(--color-text)',
                fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)',
                marginBottom: 'var(--space-4)',
              }}
            />
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                onClick={() => setShowApiKeyInput(false)}
                style={{ flex: 1, minHeight: 'var(--touch-min)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}
              >
                Avbryt
              </button>
              <button
                onClick={() => { setApiKey(apiKeyDraft); setShowApiKeyInput(false); }}
                style={{ flex: 1, minHeight: 'var(--touch-min)', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-brand)', color: 'white', fontWeight: 700, cursor: 'pointer' }}
              >
                Lagre
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Escalation modal */}
      {escalateTarget && (
        <div
          role="dialog"
          aria-label="Eskalér hendelse"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, zIndex: 'var(--z-modal)',
            background: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)',
          }}
        >
          <div style={{
            background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)', maxWidth: 440, width: '100%',
          }}>
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-4)' }}>
              Eskalér hendelse
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              {(['path_a_rk_ambulance', 'path_b_113'] as const).map((path) => (
                <button
                  key={path}
                  onClick={() => setEscalatePath(path)}
                  style={{
                    minHeight: 'var(--touch-min)',
                    padding: 'var(--space-3) var(--space-4)',
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${escalatePath === path ? 'var(--color-status-critical)' : 'var(--color-border)'}`,
                    background: escalatePath === path ? 'var(--color-status-critical-bg)' : 'transparent',
                    color: 'var(--color-text)',
                    fontWeight: 600,
                    fontSize: 'var(--text-sm)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {PATH_LABELS[path]}
                </button>
              ))}
            </div>

            <div style={{ marginBottom: 'var(--space-4)' }}>
              <label htmlFor="escalate-reason" style={{ display: 'block', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-1)' }}>
                Årsak (valgfritt)
              </label>
              <textarea
                id="escalate-reason"
                value={escalateReason}
                onChange={(e) => setEscalateReason(e.target.value)}
                rows={3}
                style={{
                  width: '100%', padding: 'var(--space-2)',
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-input-border)',
                  background: 'var(--color-input-bg)', color: 'var(--color-text)',
                  fontSize: 'var(--text-sm)', resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                onClick={() => { setEscalateTarget(null); setEscalateReason(''); }}
                style={{
                  flex: 1, minHeight: 'var(--touch-min)', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)', background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                Avbryt
              </button>
              <button
                onClick={handleEscalate}
                disabled={escalating}
                style={{
                  flex: 1, minHeight: 'var(--touch-min)', borderRadius: 'var(--radius-md)',
                  border: 'none', background: 'var(--color-status-critical)', color: 'white',
                  fontWeight: 700, cursor: 'pointer',
                }}
              >
                {escalating ? 'Sender...' : 'Bekreft eskalering'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nytt koordinatoroppdrag modal */}
      {showNewOppdrag && (
        <div
          role="dialog"
          aria-label="Nytt koordinatoroppdrag"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, zIndex: 'var(--z-modal)',
            background: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)',
          }}
        >
          <div style={{
            background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-6)', maxWidth: 480, width: '100%',
          }}>
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-1)' }}>
              Nytt koordinatoroppdrag
            </h2>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-5)' }}>
              Opprettet av koordinator — vises i hendelsesfeed og tildeles valgt lag.
            </p>

            {/* Type */}
            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
              Hendelsestype
            </label>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
              {(['medical', 'trauma', 'psychiatric', 'other'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setNewType(t)}
                  style={{
                    padding: 'var(--space-2) var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: `2px solid ${newType === t ? 'var(--color-brand)' : 'var(--color-border)'}`,
                    background: newType === t ? 'var(--color-brand)' : 'transparent',
                    color: newType === t ? 'white' : 'var(--color-text)',
                    fontWeight: newType === t ? 700 : 400,
                    cursor: 'pointer', fontSize: 'var(--text-sm)',
                    minHeight: 'var(--touch-min)',
                  }}
                >
                  {typeLabels[t]}
                </button>
              ))}
            </div>

            {/* Team */}
            <label htmlFor="new-oppdrag-team" style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
              Tildel lag (valgfritt)
            </label>
            <select
              id="new-oppdrag-team"
              value={newTeamId}
              onChange={(e) => setNewTeamId(e.target.value)}
              style={{
                width: '100%', padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)', border: '1px solid var(--color-input-border)',
                background: 'var(--color-input-bg)', color: 'var(--color-text)',
                fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)',
                minHeight: 'var(--touch-min)',
              }}
            >
              <option value="">— Velg lag —</option>
              {teams.map((t: any) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>

            {/* Note */}
            <label htmlFor="new-oppdrag-note" style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-2)' }}>
              Sted / beskrivelse
            </label>
            <textarea
              id="new-oppdrag-note"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="F.eks. «Sektor B ved inngang, person sitter på bakken»"
              rows={3}
              style={{
                width: '100%', padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)', border: '1px solid var(--color-input-border)',
                background: 'var(--color-input-bg)', color: 'var(--color-text)',
                fontSize: 'var(--text-sm)', resize: 'vertical',
                marginBottom: 'var(--space-5)',
              }}
            />

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                onClick={() => { setShowNewOppdrag(false); setNewNote(''); setNewTeamId(''); setNewType('medical'); }}
                style={{
                  flex: 1, minHeight: 'var(--touch-min)', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer',
                }}
              >
                Avbryt
              </button>
              <button
                onClick={handleCreateOppdrag}
                disabled={creating}
                style={{
                  flex: 2, minHeight: 'var(--touch-min)', borderRadius: 'var(--radius-md)',
                  border: 'none', background: 'var(--color-brand)', color: 'white',
                  fontWeight: 700, cursor: 'pointer',
                }}
              >
                {creating ? 'Oppretter...' : 'Opprett og tildel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kritiske pasienter — deterioration panel */}
      {deteriorationAlerts.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          style={{
            marginBottom: 'var(--space-4)', padding: 'var(--space-4)',
            borderRadius: 'var(--radius-md)',
            border: '2px solid var(--color-status-critical)',
            background: 'var(--color-status-critical-bg)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
            <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-status-critical)' }}>
              Kritiske pasienter — NEWS2 stiger raskt
            </h3>
            <button
              onClick={() => setDeteriorationAlerts([])}
              style={{ fontSize: 'var(--text-xs)', background: 'transparent', border: 'none', color: 'var(--color-text-subtle)', cursor: 'pointer' }}
            >
              Fjern alle
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {[...deteriorationAlerts].sort((a, b) => b.ratePerHour - a.ratePerHour).map((alert) => (
              <div key={alert.patientId} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-sm)', background: 'var(--color-surface)',
                border: '1px solid var(--color-status-critical)',
              }}>
                <div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', fontWeight: 700 }}>
                    ↑ NEWS2 {alert.news2Score}
                  </span>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', marginLeft: 'var(--space-2)' }}>
                    +{alert.ratePerHour.toFixed(1)} poeng/t
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <button
                    onClick={() => setEscalateTarget(alert.patientId)}
                    style={{
                      fontSize: 'var(--text-xs)', padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-status-critical)', background: 'transparent',
                      color: 'var(--color-status-critical)', cursor: 'pointer', fontWeight: 600,
                    }}
                  >
                    Eskalér
                  </button>
                  <button
                    onClick={() => setDeteriorationAlerts((prev) => prev.filter((a) => a.patientId !== alert.patientId))}
                    style={{ fontSize: 'var(--text-xs)', background: 'transparent', border: 'none', color: 'var(--color-text-subtle)', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MCI overview panel */}
      {mciActive && (
        <div
          role="status"
          aria-live="polite"
          style={{
            marginBottom: 'var(--space-4)', padding: 'var(--space-4)',
            borderRadius: 'var(--radius-md)',
            border: '2px solid var(--color-status-critical)',
            background: 'var(--color-status-critical-bg)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
            <div>
              <span style={{ fontWeight: 700, color: 'var(--color-status-critical)', fontSize: 'var(--text-sm)' }}>
                MASSEULYKKE — MCI-MODUS AKTIV
              </span>
              {mciActivatedBy && (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', marginLeft: 'var(--space-2)' }}>
                  (aktivert av {mciActivatedBy})
                </span>
              )}
            </div>
            <button
              onClick={handleToggleMci}
              disabled={togglingMci}
              style={{
                fontSize: 'var(--text-xs)', padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-status-critical)', background: 'transparent',
                color: 'var(--color-status-critical)', cursor: 'pointer', fontWeight: 600,
              }}
            >
              Deaktiver MCI
            </button>
          </div>

          {/* START triage tag counts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2)' }}>
            {[
              { tag: 'immediate', label: 'Umiddelbar', color: '#d00', bg: '#fee' },
              { tag: 'delayed', label: 'Utsatt', color: '#b60', bg: '#fef3c7' },
              { tag: 'minor', label: 'Mindre', color: 'var(--color-status-ok)', bg: 'var(--color-status-ok-bg)' },
              { tag: 'expectant', label: 'Forventet', color: 'var(--color-text-subtle)', bg: 'var(--color-surface-sunken)' },
            ].map(({ tag, label, color, bg }) => {
              const count = incidents.filter((i: any) => i.triageTag === tag).length;
              return (
                <div key={tag} style={{
                  textAlign: 'center', padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)', background: bg,
                  border: `1px solid ${color}`,
                }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-2xl)', fontWeight: 700, color }}>
                    {count}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color, fontWeight: 600 }}>{label}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 'var(--space-3)', marginBottom: 'var(--space-6)',
        }}>
          {[
            { l: 'Totalt', v: stats.totalIncidents },
            { l: 'Aktive', v: stats.activeIncidents },
            { l: 'Løste', v: stats.resolvedIncidents },
            { l: 'Pasienter', v: stats.totalPatients },
            { l: 'I behandling', v: stats.patientsInTreatment },
            { l: 'Utskrevet', v: stats.discharged },
          ].map(s => (
            <div key={s.l} style={{
              padding: 'var(--space-4)', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)', background: 'var(--color-surface)',
            }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-3xl)', fontWeight: 700 }}>
                {s.v ?? 0}
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
                color: 'var(--color-text-subtle)', textTransform: 'uppercase',
              }}>
                {s.l}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Two-column layout: feed left, map right */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(320px, 1fr) 1fr',
        gap: 'var(--space-4)',
        alignItems: 'start',
      }}>
        {/* Left: incident feed */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <h2 style={{
              fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)',
              color: 'var(--color-text-muted)', textTransform: 'uppercase', margin: 0,
            }}>
              Hendelsesfeed
            </h2>
            <button
              onClick={() => setShowNewOppdrag(true)}
              style={{
                padding: 'var(--space-1) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-brand)',
                background: 'transparent', color: 'var(--color-brand)',
                fontWeight: 600, fontSize: 'var(--text-sm)', cursor: 'pointer',
              }}
            >
              + Nytt oppdrag
            </button>
          </div>

          {loading ? <p>Laster...</p> : incidents.length === 0 ? (
            <div style={{
              padding: 'var(--space-8)', textAlign: 'center',
              background: 'var(--color-surface)', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)', color: 'var(--color-text-subtle)',
            }}>
              Ingen hendelser rapportert
            </div>
          ) : (
            <div role="feed" aria-label="Hendelser" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {incidents.map(inc => (
                <article id={`inc-${inc.id}`} key={inc.id} style={{
                  padding: 'var(--space-4)', borderRadius: 'var(--radius-md)',
                  border: inc.activeEscalation
                    ? '2px solid var(--color-status-critical)'
                    : inc.source === 'coordinator'
                      ? '1px dashed var(--color-brand)'
                      : '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                        <strong>{typeLabels[inc.type] || inc.type}</strong>
                        {inc.source === 'coordinator' && (
                          <span style={{
                            fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
                            fontWeight: 700, color: 'var(--color-brand)',
                            border: '1px solid var(--color-brand)',
                            borderRadius: 'var(--radius-sm)', padding: '0 4px',
                          }}>
                            K
                          </span>
                        )}
                        {inc.status === 'dispatched' && (
                          <span style={{
                            fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
                            color: 'var(--color-text-muted)',
                          }}>
                            Tildelt
                          </span>
                        )}
                        {inc.acvpu && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                            ACVPU: {inc.acvpu.toUpperCase()}
                          </span>
                        )}
                      </div>
                      {inc.activeEscalation && (
                        <span style={{
                          display: 'inline-block', marginTop: 4,
                          fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
                          fontWeight: 700, color: 'var(--color-status-critical)',
                        }}>
                          ⚠ ESKALERT: {PATH_LABELS[inc.activeEscalation.path] ?? inc.activeEscalation.path}
                        </span>
                      )}
                      {inc.notes && inc.source === 'coordinator' && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 4, fontStyle: 'italic' }}>
                          {inc.notes}
                        </div>
                      )}
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', marginTop: 4 }}>
                        {new Date(inc.createdAt).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {/* AI triage button */}
                      <button
                        onClick={() => handleTriageAssess(inc)}
                        disabled={triageLoading[inc.id]}
                        title="Be om AI-vurdering av kritikalitet"
                        style={{
                          fontSize: 11, padding: '4px 8px', borderRadius: 4,
                          border: '1px solid var(--color-brand)',
                          background: triageResults[inc.id] ? 'var(--color-brand)' : 'transparent',
                          color: triageResults[inc.id] ? 'white' : 'var(--color-brand)',
                          cursor: 'pointer', fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {triageLoading[inc.id] ? '⏳ AI...' : triageResults[inc.id] ? '✦ AI' : '✦ Vurder'}
                      </button>
                      {inc.status !== 'resolved' && (
                        <>
                          {!inc.activeEscalation && (
                            <button
                              onClick={() => setEscalateTarget(inc.id)}
                              style={{
                                fontSize: 11, padding: '4px 8px', borderRadius: 4,
                                border: '1px solid var(--color-status-critical)',
                                background: 'transparent',
                                color: 'var(--color-status-critical)',
                                cursor: 'pointer',
                              }}
                            >
                              ⚠ Eskalér
                            </button>
                          )}
                          {inc.status === 'dispatched' && (
                            <button onClick={() => handleStatusUpdate(inc.id, 'on_scene')}
                              style={{ fontSize: 11, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--color-brand)', background: 'transparent', cursor: 'pointer', color: 'var(--color-brand)' }}>
                              → Bekreftet på stedet
                            </button>
                          )}
                          {inc.status === 'on_scene' && (
                            <button onClick={() => handleStatusUpdate(inc.id, 'transporting')}
                              style={{ fontSize: 11, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}>
                              → Transport
                            </button>
                          )}
                          <button onClick={() => handleStatusUpdate(inc.id, 'resolved')}
                            style={{ fontSize: 11, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer', color: 'var(--color-status-ok)' }}>
                            ✓ Løst
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* AI triage result panel */}
                  {triageErrors[inc.id] && (
                    <div style={{
                      marginTop: 'var(--space-3)',
                      padding: 'var(--space-2) var(--space-3)',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--color-status-critical-bg)',
                      color: 'var(--color-status-critical)',
                      fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
                    }}>
                      {triageErrors[inc.id]}
                    </div>
                  )}
                  {triageResults[inc.id] && (() => {
                    const r = triageResults[inc.id];
                    if (!r) return null;
                    const c = TRIAGE_COLORS[r.level];
                    return (
                      <div style={{
                        marginTop: 'var(--space-3)',
                        padding: 'var(--space-3)',
                        borderRadius: 'var(--radius-sm)',
                        background: c.bg,
                        border: `1px solid ${c.color}`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                          <span style={{
                            fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
                            fontWeight: 700, color: c.color, textTransform: 'uppercase',
                          }}>
                            ✦ AI &mdash; {c.label}
                          </span>
                        </div>
                        <p style={{ fontSize: 'var(--text-xs)', margin: '0 0 var(--space-1)', color: 'var(--color-text)' }}>
                          {r.summary}
                        </p>
                        <p style={{ fontSize: 'var(--text-xs)', margin: 0, fontWeight: 600, color: c.color }}>
                          → {r.recommendation}
                        </p>
                      </div>
                    );
                  })()}
                </article>
              ))}
            </div>
          )}
        </div>

        {/* Right: map */}
        <div style={{
          position: 'sticky',
          top: 72,
          height: 'calc(100dvh - 80px)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          border: '1px solid var(--color-border)',
        }}>
          <EventMap
            incidents={incidents}
            teams={teams}
            onIncidentClick={handleScrollToIncident}
          />
        </div>
      </div>
    </div>
  );
}
