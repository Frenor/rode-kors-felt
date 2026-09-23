/**
 * Close-flow → outcome mapping (gap A1, P0).
 *
 * "Avslutt pasient" used to set `status: 'discharged'` for every reason,
 * including a hand-over to the sick bay — the opposite of what "handed over"
 * means to a patrol. Each close reason now maps to its own PATCH payload and
 * note text; only a genuine hand-over to sick bay leaves `status` untouched
 * (the patient is in the tent now, not finished).
 */

export interface CloseOutcomeInput {
  /** One of PATIENT_CLOSE_REASONS' ids (lib/constants.ts). */
  reasonId: string;
  reasonLabel: string;
  /** This patrol's team id — becomes `handedOverByTeamId` for a sick-bay hand-over. */
  teamId: string | null;
  teamName: string;
  /** Free-text addendum typed alongside the reason chip. */
  extraNote: string;
  nowIso: string;
}

export interface CloseOutcomeResult {
  /** Passed straight to `api.updatePatient(patientId, updatePayload)`. */
  updatePayload: Record<string, unknown>;
  /** Passed to `api.addPatientNote(patientId, noteText, teamName)`. */
  noteText: string;
  /** What the toast says — never "Pasient avsluttet", always the outcome. */
  toastMessage: string;
  /** Shown on the "Avsluttede pasienter" row. */
  outcomeLabel: string;
}

export function resolveCloseOutcome(input: CloseOutcomeInput): CloseOutcomeResult {
  const { reasonId, reasonLabel, teamId, teamName, extraNote, nowIso } = input;
  const extra = extraNote.trim();

  if (reasonId === 'handed_to_sickbay') {
    const noteText = extra
      ? `Overlevert sykestue av ${teamName} — ${extra}`
      : `Overlevert sykestue av ${teamName}`;
    return {
      updatePayload: {
        fieldOutcome: reasonId,
        handedOverAt: nowIso,
        handedOverByTeamId: teamId,
        assignedTeamId: null,
      },
      noteText,
      toastMessage: 'Overlevert sykestue',
      outcomeLabel: reasonLabel,
    };
  }

  const noteText = extra ? `${reasonLabel} — ${extra}` : reasonLabel;
  const status = reasonId === 'handed_to_ambulance' ? 'transferred' : 'discharged';

  return {
    updatePayload: { fieldOutcome: reasonId, status },
    noteText,
    toastMessage: reasonLabel,
    outcomeLabel: reasonLabel,
  };
}
