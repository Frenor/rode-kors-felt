import { useEffect, useMemo, useState } from 'react';
import { calculateNEWS2, calculateNEWS2Trend, news2BadgeLabel, news2MonitoringLabel } from '@rkf/shared-types';
import { FocusTrap } from '../../components/FocusTrap';
import { api } from '../../lib/api';
import type { AmkAssistDraft, AmkCallLog, AmkCriticality, MedicationRecord, SickBayPatient } from '../../lib/types';
import {
  AMK_CRITICALITY_LABELS,
  formatPatientAge,
  GENDER_LABELS,
  normalizeAmkCriticality,
} from '../../lib/constants';

interface AmkBriefModalProps {
  patient: SickBayPatient;
  medications: MedicationRecord[];
  onClose: () => void;
  onSaved: () => void;
}

interface AmkCallFormShape {
  summaryGiven: string;
  amkGuidance: string;
  followUpOwner: string;
  referenceId: string;
  eta: string;
  calledAt: string;
}

const EMPTY_FORM = (): AmkCallFormShape => ({
  summaryGiven: '',
  amkGuidance: '',
  followUpOwner: '',
  referenceId: '',
  eta: '',
  calledAt: new Date().toISOString().slice(0, 16),
});

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
}

function describeMedication(medication: MedicationRecord) {
  const route = medication.route ? ` (${medication.route})` : '';
  const dose = medication.dose ? ` ${medication.dose}` : '';
  const givenBy = medication.givenBy ? ` — ${medication.givenBy}` : '';
  return `${medication.drug}${dose}${route}${givenBy}`;
}

export function AmkBriefModal({ patient, medications, onClose, onSaved }: AmkBriefModalProps) {
  const [callLogs, setCallLogs] = useState<AmkCallLog[]>([]);
  const [form, setForm] = useState<AmkCallFormShape>(() => EMPTY_FORM());
  const [draft, setDraft] = useState<AmkAssistDraft | null>(null);
  const [criticality, setCriticality] = useState<AmkCriticality>('low');
  const [spokenScript, setSpokenScript] = useState('');
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [savingCallLog, setSavingCallLog] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const latestVitals = patient.latestVitals ?? patient.vitalsHistory?.[0] ?? null;
  const news2 = latestVitals ? calculateNEWS2(latestVitals) : null;
  const trend = (patient.vitalsHistory?.length ?? 0) >= 2 ? calculateNEWS2Trend(patient.vitalsHistory) : null;
  const patientName = patient.fullName ?? patient.presentingComplaint ?? 'Ukjent pasient';
  const patientAgeLabel = formatPatientAge({
    birthDate: patient.birthDate ?? null,
    ageGroup: patient.ageGroup ?? null,
    ageYears: patient.ageYears ?? null,
  });
  const patientGenderLabel = patient.gender ? GENDER_LABELS[patient.gender] : 'Kjønn ikke oppgitt';

  const latestInterventions = useMemo(() => {
    if (medications.length === 0) {
      return ['Ingen registrerte intervensjoner ennå.'];
    }
    return medications.slice(0, 3).map(describeMedication);
  }, [medications]);

  const keyFindings = useMemo(() => {
    const findings = [
      patient.presentingComplaint ? `Problemstilling: ${patient.presentingComplaint}` : null,
      news2 ? `NEWS2 ${news2.total} (${news2BadgeLabel(news2)} · ${news2MonitoringLabel(news2)})` : null,
      trend ? `Trend: ${trend.direction === 'rising' ? 'stigende' : trend.direction === 'falling' ? 'fallende' : 'stabil'}` : null,
      patient.notes?.length ? patient.notes[patient.notes.length - 1]?.text : null,
    ].filter(Boolean);

    return findings.length > 0 ? findings as string[] : ['Ingen særskilte funn registrert ennå.'];
  }, [news2, patient.notes, patient.presentingComplaint, trend]);

  const recommendedEscalation = draft?.sbarDraft.recommendation
    ?? 'Ring 113, presenter pasienten strukturert og avklar transportnivå med AMK.';

  useEffect(() => {
    let active = true;
    setLoadingLogs(true);
    setError(null);
    setSuccess(null);
    setDraft(null);
    setCriticality('low');
    setSpokenScript('');
    setForm(EMPTY_FORM());

    api.getAmkCallLogs(patient.id)
      .then((res) => {
        if (!active) return;
        setCallLogs(res.callLogs ?? []);
      })
      .catch((err) => {
        if (!active) return;
        console.error('[amk] Failed to load call logs', err);
        setError('Kunne ikke laste AMK-logger.');
        setCallLogs([]);
      })
      .finally(() => {
        if (!active) return;
        setLoadingLogs(false);
      });

    return () => {
      active = false;
    };
  }, [patient.id]);

  const handleCopyTel = async () => {
    try {
      await navigator.clipboard.writeText('113');
      setCopyState('copied');
      setSuccess('113 er kopiert til utklippstavlen.');
    } catch {
      setError('Klarte ikke å kopiere nummeret. Ring 113 manuelt.');
    }
  };

  const handleGenerateDraft = async () => {
    setLoadingDraft(true);
    setError(null);
    setSuccess(null);
    try {
      const nextDraft = await api.generateAmkAssistDraft(patient.id);
      setDraft(nextDraft);
      setCriticality(normalizeAmkCriticality(nextDraft.criticality));
      setSpokenScript(nextDraft.spokenScript);
      setForm((current) => ({
        summaryGiven: current.summaryGiven || nextDraft.sayFirst.join(' '),
        amkGuidance: current.amkGuidance || nextDraft.spokenScript,
        followUpOwner: current.followUpOwner || patient.assignedClinician || '',
        referenceId: current.referenceId,
        eta: current.eta,
        calledAt: current.calledAt || new Date().toISOString().slice(0, 16),
      }));
      setSuccess('AI-forslag er generert.');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Klarte ikke å generere AI-forslag.');
    } finally {
      setLoadingDraft(false);
    }
  };

  const handleConfirmDraft = async () => {
    if (!draft) {
      setError('Generer et AI-forslag først.');
      return;
    }
    setConfirming(true);
    setError(null);
    setSuccess(null);
    try {
      const confirmedDraft: AmkAssistDraft = {
        ...draft,
        criticality,
      };
      await api.confirmAmkAssist(patient.id, confirmedDraft, spokenScript);
      setSuccess('AI-script er bekreftet og logget.');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Klarte ikke å bekrefte AI-script.');
    } finally {
      setConfirming(false);
    }
  };

  const handleSubmitCallLog = async () => {
    setSavingCallLog(true);
    setError(null);
    setSuccess(null);
    try {
      await api.createAmkCallLog(patient.id, {
        summaryGiven: form.summaryGiven.trim(),
        amkGuidance: form.amkGuidance.trim(),
        followUpOwner: form.followUpOwner.trim(),
        referenceId: form.referenceId.trim() || undefined,
        eta: form.eta.trim() || undefined,
        calledAt: form.calledAt ? new Date(form.calledAt).toISOString() : undefined,
      });
      setSuccess('AMK-samtale er logget.');
      setForm(EMPTY_FORM());
      onSaved();
      const refreshed = await api.getAmkCallLogs(patient.id);
      setCallLogs(refreshed.callLogs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Klarte ikke å lagre AMK-logg.');
    } finally {
      setSavingCallLog(false);
    }
  };

  const formDisabled = !form.summaryGiven.trim() || !form.amkGuidance.trim() || !form.followUpOwner.trim();
  const scriptDisabled = loadingDraft || confirming || !draft;

  return (
    <div
      role="dialog"
      aria-label="AMK-brief"
      aria-modal="true"
      data-testid="amk-brief-modal"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-modal)',
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
      }}
    >
      <FocusTrap onEscape={onClose}>
        <div style={{
          background: 'var(--color-surface)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-6)',
          maxWidth: 920,
          width: '100%',
          maxHeight: '92vh',
          overflow: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
            <div>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-1)' }}>
                AMK-brief
              </h2>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-subtle)' }}>
                Ordnet pasientopplysninger, ring 113 direkte og logg samtalen strukturert.
              </p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', marginTop: 'var(--space-1)' }}>
                Pasient: {patientName} · {patientAgeLabel} · {patientGenderLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="touch-target"
              style={{
                minHeight: 'var(--touch-min)',
                padding: '0 var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'transparent',
                color: 'var(--color-text)',
                cursor: 'pointer',
              }}
            >
              Lukk
            </button>
          </div>

          {(error || success) && (
            <div style={{
              marginBottom: 'var(--space-4)',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${error ? 'var(--color-status-critical)' : 'var(--color-status-ok)'}`,
              background: error ? 'rgba(220, 38, 38, 0.08)' : 'rgba(22, 163, 74, 0.08)',
              color: 'var(--color-text)',
              fontSize: 'var(--text-sm)',
            }}>
              {error || success}
            </div>
          )}

          <div style={{
            display: 'grid',
            gap: 'var(--space-4)',
            gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)',
          }}>
            <section style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <article style={{
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface-sunken)',
              }}>
                <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                  Pasientoversikt
                </h3>
                <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'var(--space-2) var(--space-3)', fontSize: 'var(--text-sm)' }}>
                  <dt style={{ color: 'var(--color-text-subtle)' }}>Problemstilling</dt>
                  <dd>{patient.presentingComplaint || 'Ukjent'}</dd>
                  <dt style={{ color: 'var(--color-text-subtle)' }}>Status</dt>
                  <dd>{patient.status}</dd>
                  <dt style={{ color: 'var(--color-text-subtle)' }}>Ansvarlig</dt>
                  <dd>{patient.assignedClinician || 'Ikke satt'}</dd>
                  <dt style={{ color: 'var(--color-text-subtle)' }}>NEWS2</dt>
                  <dd>{news2 ? `${news2BadgeLabel(news2)} · ${news2MonitoringLabel(news2)}` : 'Ikke registrert'}</dd>
                </dl>
              </article>

              <article style={{
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface-sunken)',
              }}>
                <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                  Ordnet AMK-brief
                </h3>
                <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                  <div>
                    <p style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-subtle)' }}>
                      1. Pasientcontext
                    </p>
                    <p style={{ fontSize: 'var(--text-sm)', marginTop: 4 }}>
                      {patient.presentingComplaint || 'Ukjent problemstilling'}.
                      {' '}
                      {patient.assignedClinician ? `Ansvarlig kliniker: ${patient.assignedClinician}.` : 'Ansvarlig kliniker er ikke satt.'}
                    </p>
                  </div>

                  <div>
                    <p style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-subtle)' }}>
                      2. Siste NEWS2 og trend
                    </p>
                    <p style={{ fontSize: 'var(--text-sm)', marginTop: 4 }}>
                      {news2 ? `NEWS2 ${news2.total} · ${news2BadgeLabel(news2)} · ${news2MonitoringLabel(news2)}` : 'NEWS2 er ikke tilgjengelig ennå.'}
                    </p>
                    <p style={{ fontSize: 'var(--text-sm)', marginTop: 4, color: 'var(--color-text-subtle)' }}>
                      {trend ? `Trend: ${trend.direction === 'rising' ? 'stigende' : trend.direction === 'falling' ? 'fallende' : 'stabil'} (${trend.ratePerHour.toFixed(1)}/time)` : 'Trend kan ikke beregnes ennå.'}
                    </p>
                  </div>

                  <div>
                    <p style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-subtle)' }}>
                      3. Siste intervensjoner
                    </p>
                    <ul style={{ margin: 'var(--space-2) 0 0', paddingLeft: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
                      {latestInterventions.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-subtle)' }}>
                      4. Nøkkelfunn
                    </p>
                    <ul style={{ margin: 'var(--space-2) 0 0', paddingLeft: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
                      {keyFindings.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-text-subtle)' }}>
                      5. Anbefalt eskaleringsspråk
                    </p>
                    <p style={{ fontSize: 'var(--text-sm)', marginTop: 4 }}>
                      {recommendedEscalation}
                    </p>
                  </div>
                </div>
              </article>

              <article style={{
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface-sunken)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>
                      Ring 113
                    </h3>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
                      Bruk telefonlenken eller kopier nummeret dersom lenken ikke åpner.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    <a
                      href="tel:113"
                      className="touch-target"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: 'var(--touch-min)',
                        padding: '0 var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--color-status-critical)',
                        color: 'white',
                        fontWeight: 700,
                        textDecoration: 'none',
                      }}
                    >
                      Ring 113
                    </a>
                    <button
                      type="button"
                      onClick={handleCopyTel}
                      className="touch-target"
                      style={{
                        minHeight: 'var(--touch-min)',
                        padding: '0 var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border)',
                        background: 'transparent',
                        color: 'var(--color-text)',
                        cursor: 'pointer',
                      }}
                    >
                      {copyState === 'copied' ? 'Kopiert 113' : 'Kopier 113'}
                    </button>
                  </div>
                </div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
                  Hvis telefonlenken ikke åpner, ring 113 manuelt eller bruk enheten som har telefonfunksjon.
                </p>
              </article>
            </section>

            <section style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <article style={{
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface-sunken)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <div>
                    <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>
                      AI-beslutningsstøtte
                    </h3>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
                      AI-beslutningsstøtte — kliniker avgjør
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateDraft}
                    disabled={loadingDraft}
                    className="touch-target"
                    style={{
                      minHeight: 'var(--touch-min)',
                      padding: '0 var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      border: 'none',
                      background: 'var(--color-brand)',
                      color: 'white',
                      fontWeight: 700,
                      cursor: 'pointer',
                      opacity: loadingDraft ? 0.7 : 1,
                    }}
                  >
                    {loadingDraft ? 'Genererer...' : 'Generer AI-forslag'}
                  </button>
                </div>

                {draft ? (
                  <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                    <label style={{ fontSize: 'var(--text-sm)', fontWeight: 600, display: 'grid', gap: 'var(--space-1)' }}>
                      Kritikalitet
                      <select
                        value={criticality}
                        onChange={(e) => setCriticality(normalizeAmkCriticality(e.target.value))}
                        style={{
                          minHeight: 40,
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-input-border)',
                          background: 'var(--color-input-bg)',
                          color: 'var(--color-text)',
                          padding: '0 var(--space-2)',
                        }}
                      >
                        <option value="low">Lav</option>
                        <option value="medium">Middels</option>
                        <option value="high">Høy</option>
                        <option value="critical">Kritisk</option>
                      </select>
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
                        Valgt: {AMK_CRITICALITY_LABELS[normalizeAmkCriticality(criticality)] ?? 'Lav'}
                      </span>
                    </label>

                    <div>
                      <p style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Hvorfor
                      </p>
                      <p style={{ fontSize: 'var(--text-sm)', marginTop: 4 }}>
                        {draft.rationale}
                      </p>
                    </div>

                    <div>
                      <p style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Si først
                      </p>
                      <ul style={{ margin: 'var(--space-2) 0 0', paddingLeft: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
                        {draft.sayFirst.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>

                    <label style={{ display: 'grid', gap: 'var(--space-1)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                      Foreslått tale
                      <textarea
                        value={spokenScript}
                        onChange={(e) => setSpokenScript(e.target.value)}
                        rows={8}
                        style={{
                          width: '100%',
                          padding: 'var(--space-2)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-input-border)',
                          background: 'var(--color-input-bg)',
                          color: 'var(--color-text)',
                          fontSize: 'var(--text-sm)',
                          resize: 'vertical',
                          fontFamily: 'inherit',
                        }}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={handleConfirmDraft}
                      disabled={scriptDisabled}
                      className="touch-target"
                      style={{
                        minHeight: 'var(--touch-min)',
                        padding: '0 var(--space-3)',
                        borderRadius: 'var(--radius-md)',
                        border: 'none',
                        background: 'var(--color-status-critical)',
                        color: 'white',
                        fontWeight: 700,
                        cursor: 'pointer',
                        opacity: scriptDisabled ? 0.6 : 1,
                      }}
                    >
                      {confirming ? 'Bekrefter...' : 'Bekreft script'}
                    </button>
                  </div>
                ) : (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-subtle)' }}>
                    Generer et AI-forslag for å få et strukturert forslag til kritikalitet og formulering.
                  </p>
                )}
              </article>

              <article style={{
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface-sunken)',
              }}>
                <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                  Samtalelogg
                </h3>
                <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                  <label style={{ display: 'grid', gap: 'var(--space-1)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                    Oppsummering gitt
                    <textarea
                      value={form.summaryGiven}
                      onChange={(e) => setForm((current) => ({ ...current, summaryGiven: e.target.value }))}
                      rows={3}
                      placeholder="Hva ble presentert til AMK?"
                      style={{
                        width: '100%',
                        padding: 'var(--space-2)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-input-border)',
                        background: 'var(--color-input-bg)',
                        color: 'var(--color-text)',
                        fontSize: 'var(--text-sm)',
                        resize: 'vertical',
                        fontFamily: 'inherit',
                      }}
                    />
                  </label>

                  <label style={{ display: 'grid', gap: 'var(--space-1)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                    AMK-veiledning
                    <textarea
                      value={form.amkGuidance}
                      onChange={(e) => setForm((current) => ({ ...current, amkGuidance: e.target.value }))}
                      rows={4}
                      placeholder="Hva anbefalte AMK?"
                      style={{
                        width: '100%',
                        padding: 'var(--space-2)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-input-border)',
                        background: 'var(--color-input-bg)',
                        color: 'var(--color-text)',
                        fontSize: 'var(--text-sm)',
                        resize: 'vertical',
                        fontFamily: 'inherit',
                      }}
                    />
                  </label>

                  <label style={{ display: 'grid', gap: 'var(--space-1)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                    Videre ansvar
                    <input
                      value={form.followUpOwner}
                      onChange={(e) => setForm((current) => ({ ...current, followUpOwner: e.target.value }))}
                      placeholder="Navn / rolle"
                      style={{
                        minHeight: 40,
                        padding: '0 var(--space-2)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-input-border)',
                        background: 'var(--color-input-bg)',
                        color: 'var(--color-text)',
                        fontSize: 'var(--text-sm)',
                      }}
                    />
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                    <label style={{ display: 'grid', gap: 'var(--space-1)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                      Referanse / ambulansenummer
                      <input
                        value={form.referenceId}
                        onChange={(e) => setForm((current) => ({ ...current, referenceId: e.target.value }))}
                        placeholder="Valgfritt"
                        style={{
                          minHeight: 40,
                          padding: '0 var(--space-2)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-input-border)',
                          background: 'var(--color-input-bg)',
                          color: 'var(--color-text)',
                          fontSize: 'var(--text-sm)',
                        }}
                      />
                    </label>
                    <label style={{ display: 'grid', gap: 'var(--space-1)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                      ETA
                      <input
                        value={form.eta}
                        onChange={(e) => setForm((current) => ({ ...current, eta: e.target.value }))}
                        placeholder="f.eks. 14:35"
                        style={{
                          minHeight: 40,
                          padding: '0 var(--space-2)',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--color-input-border)',
                          background: 'var(--color-input-bg)',
                          color: 'var(--color-text)',
                          fontSize: 'var(--text-sm)',
                        }}
                      />
                    </label>
                  </div>

                  <label style={{ display: 'grid', gap: 'var(--space-1)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                    Ringtidspunkt
                    <input
                      type="datetime-local"
                      value={form.calledAt}
                      onChange={(e) => setForm((current) => ({ ...current, calledAt: e.target.value }))}
                      style={{
                        minHeight: 40,
                        padding: '0 var(--space-2)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-input-border)',
                        background: 'var(--color-input-bg)',
                        color: 'var(--color-text)',
                        fontSize: 'var(--text-sm)',
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleSubmitCallLog}
                    disabled={savingCallLog || formDisabled}
                    className="touch-target"
                    style={{
                      minHeight: 'var(--touch-min)',
                      padding: '0 var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      border: 'none',
                      background: 'var(--color-brand)',
                      color: 'white',
                      fontWeight: 700,
                      cursor: 'pointer',
                      opacity: savingCallLog || formDisabled ? 0.6 : 1,
                    }}
                  >
                    {savingCallLog ? 'Lagrer...' : 'Lagre AMK-logg'}
                  </button>
                </div>
              </article>

              <article style={{
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface-sunken)',
              }}>
                <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                  Tidligere AMK-logger
                </h3>
                {loadingLogs ? (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>Laster logger...</p>
                ) : callLogs.length === 0 ? (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>Ingen AMK-logger ennå.</p>
                ) : (
                  <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
                    {callLogs.map((log) => (
                      <div key={log.id} style={{
                        padding: 'var(--space-2)',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: 'var(--text-xs)' }}>{formatTime(log.calledAt)}</strong>
                          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>{log.recordedBy || 'Ukjent'}</span>
                        </div>
                        <p style={{ marginTop: 4, fontSize: 'var(--text-xs)' }}>{log.summaryGiven}</p>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            </section>
          </div>
        </div>
      </FocusTrap>
    </div>
  );
}
