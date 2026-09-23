/**
 * Journal export (gap B7 / item 8.32b) — builds one self-contained,
 * printable HTML file for every journal in an event, and triggers its
 * download. Pure functions so the HTML shape is unit-testable without a DOM.
 */
import { calculateNEWS2 } from '@rkf/shared-types';
import {
  formatPatientAge,
  formatSickbayPlacement,
  GENDER_LABELS,
  PATIENT_CLOSE_REASONS,
  routeLabels,
  statusLabels,
} from '../../lib/constants';
import type { PatientJournal } from '../../lib/types';

const CLOSE_REASON_LABELS: Record<string, string> = Object.fromEntries(
  PATIENT_CLOSE_REASONS.map((r) => [r.id, r.label]),
);

function esc(value: unknown): string {
  const s = value == null ? '' : String(value);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('nb-NO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });
}

function patientName(journal: PatientJournal): string {
  const p = journal.patient;
  return p.fullName?.trim() || p.label?.trim() || p.presentingComplaint?.trim() || 'Ukjent pasient';
}

/** One patient's journal, rendered as a printable HTML section. */
function patientSectionHtml(journal: PatientJournal): string {
  const p = journal.patient as any;
  const teamName = (id: string | null | undefined) => journal.teams.find((t) => t.id === id)?.name ?? null;
  const placement = formatSickbayPlacement(p.placementType, p.placementNumber);
  const age = formatPatientAge({ birthDate: p.birthDate, ageGroup: p.ageGroup, ageYears: p.ageYears });
  const gender = p.gender ? GENDER_LABELS[p.gender as 'male' | 'female' | 'other'] : null;

  const vitalsRows = [...journal.vitalsHistory]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((v) => {
      const n2 = calculateNEWS2(v);
      return `<tr>
        <td>${esc(fmtTime(v.timestamp))}</td>
        <td>${v.pulse ?? '—'}</td>
        <td>${v.spo2 ?? '—'}</td>
        <td>${v.respiratoryRate ?? '—'}</td>
        <td>${v.systolicBP ?? '—'}</td>
        <td>${v.temperature ?? '—'}</td>
        <td>${esc(v.acvpu ?? '—')}</td>
        <td class="news2 news2--${n2.alertLevel}">${n2.total}</td>
      </tr>`;
    })
    .join('');

  const notesRows = [...journal.notes]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((n) => `<li><span class="ts">${esc(fmtDateTime(n.createdAt))}</span> — <strong>${esc(n.author)}:</strong> ${esc(n.text)}</li>`)
    .join('');

  const medicationRows = journal.medications
    .map((m) => `<tr>
      <td>${esc(fmtTime(m.givenAt))}</td>
      <td>${esc(m.drug)}</td>
      <td>${esc(m.dose ?? '—')}</td>
      <td>${esc(m.route ? (routeLabels[m.route] ?? m.route) : '—')}</td>
      <td>${esc(m.givenBy ?? '—')}</td>
    </tr>`)
    .join('');

  const amkRows = journal.amkCallLogs
    .map((a) => `<li>
      <span class="ts">${esc(fmtDateTime(a.calledAt))}</span>
      — <strong>Gitt:</strong> ${esc(a.summaryGiven)}
      — <strong>AMK-veiledning:</strong> ${esc(a.amkGuidance)}
      — <strong>Videre ansvar:</strong> ${esc(a.followUpOwner)}
      ${a.referenceId ? ` — Ref: ${esc(a.referenceId)}` : ''}
      ${a.eta ? ` — ETA: ${esc(a.eta)}` : ''}
    </li>`)
    .join('');

  const outcomeLabel = p.fieldOutcome ? (CLOSE_REASON_LABELS[p.fieldOutcome] ?? p.fieldOutcome) : null;
  const handedOverBy = p.handedOverByTeamId ? teamName(p.handedOverByTeamId) : null;

  return `<section class="patient">
    <h2>${esc(patientName(journal))} ${p.seq ? `<span class="seq">#${p.seq}</span>` : ''}</h2>
    <table class="meta">
      <tr><th>Alder / kjønn</th><td>${esc(age)}${gender ? `, ${esc(gender)}` : ''}</td></tr>
      <tr><th>Triage</th><td>${esc(p.triageStatus ?? '—')}</td></tr>
      <tr><th>Status</th><td>${esc(statusLabels[p.status] ?? p.status)}</td></tr>
      ${placement ? `<tr><th>Plassering</th><td>${esc(placement)}</td></tr>` : ''}
      <tr><th>Problemstilling</th><td>${esc(p.presentingComplaint ?? p.description ?? '—')}</td></tr>
      <tr><th>Behandler</th><td>${esc(p.assignedClinician ?? '—')}</td></tr>
    </table>

    <h3>Vitale tegn</h3>
    ${vitalsRows
      ? `<table class="vitals">
          <thead><tr><th>Kl.</th><th>Puls</th><th>SpO₂</th><th>RF</th><th>BT</th><th>Temp</th><th>ACVPU</th><th>NEWS2</th></tr></thead>
          <tbody>${vitalsRows}</tbody>
        </table>`
      : '<p class="empty">Ingen vitale tegn registrert.</p>'}

    <h3>Notater</h3>
    ${notesRows ? `<ul class="notes">${notesRows}</ul>` : '<p class="empty">Ingen notater.</p>'}

    <h3>Medisiner</h3>
    ${medicationRows
      ? `<table class="meds">
          <thead><tr><th>Kl.</th><th>Legemiddel</th><th>Dose</th><th>Rute</th><th>Gitt av</th></tr></thead>
          <tbody>${medicationRows}</tbody>
        </table>`
      : '<p class="empty">Ingen medisiner registrert.</p>'}

    <h3>AMK-logg</h3>
    ${amkRows ? `<ul class="amk">${amkRows}</ul>` : '<p class="empty">Ingen AMK-samtaler registrert.</p>'}

    <h3>Utfall</h3>
    <p>${outcomeLabel ? esc(outcomeLabel) : esc(statusLabels[p.status] ?? p.status)}${handedOverBy ? ` — overlevert av ${esc(handedOverBy)} kl. ${esc(fmtTime(p.handedOverAt))}` : ''}</p>
  </section>`;
}

/** Builds one self-contained HTML document, one printable section per patient. */
export function buildJournalsHtml(journals: PatientJournal[], opts?: { eventName?: string }): string {
  const generatedAt = fmtDateTime(new Date().toISOString());
  const sections = journals.map((j) => patientSectionHtml(j)).join('\n');
  return `<!doctype html>
<html lang="nb">
<head>
<meta charset="utf-8" />
<title>Pasientjournaler${opts?.eventName ? ` — ${esc(opts.eventName)}` : ''}</title>
<style>
  body { font-family: sans-serif; color: #111; margin: 0; padding: 0; }
  header { padding: 16px 24px; border-bottom: 2px solid #111; }
  .patient { padding: 24px; page-break-after: always; }
  .patient:last-child { page-break-after: auto; }
  h2 { margin: 0 0 12px; }
  h3 { margin: 16px 0 4px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.04em; }
  .seq { font-family: monospace; color: #555; font-weight: normal; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 8px; }
  table.meta th { text-align: left; width: 160px; color: #555; font-weight: normal; vertical-align: top; }
  table.vitals th, table.vitals td, table.meds th, table.meds td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; font-size: 13px; }
  .news2 { font-weight: bold; }
  .news2--routine, .news2--low { color: #0a7d2c; }
  .news2--medium { color: #a15c00; }
  .news2--high { color: #b91c1c; }
  ul.notes, ul.amk { list-style: none; margin: 0; padding: 0; }
  ul.notes li, ul.amk li { padding: 4px 0; border-bottom: 1px solid #eee; font-size: 13px; }
  .ts { font-family: monospace; color: #555; }
  .empty { color: #888; font-size: 13px; }
</style>
</head>
<body>
<header>
  <strong>${opts?.eventName ? esc(opts.eventName) : 'Pasientjournaler'}</strong>
  <div>Eksportert ${esc(generatedAt)} — ${journals.length} ${journals.length === 1 ? 'journal' : 'journaler'}</div>
</header>
${sections}
</body>
</html>`;
}

/** Builds the export and triggers a browser download via a Blob URL. */
export function downloadJournalsHtml(eventId: string, journals: PatientJournal[], opts?: { eventName?: string }): void {
  const html = buildJournalsHtml(journals, opts);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rkf-journaler-${eventId.slice(0, 8)}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
