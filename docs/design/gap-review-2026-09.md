# RKF gap review — missing functionality and flows that do not match the users (2026-09-23)

Companion to `ux-review-2026-09.md` (hierarchy and ergonomics, now fixed) and
`design-system-2026-09.md`. This review asks a different question: **what is not there, and
where does the product's model of an event differ from the model in the head of the person
using it?** Every finding was checked against the code on `claude/sickbay-ux-review-x6ihme`;
nothing in this document has been changed in code.

Severity: `P0` wrong data or a broken hand-over, `P1` a real job the tool cannot do,
`P2` friction the users will route around, `P3` polish. Size: S (hours), M (days), L (a sprint).

## The three mental models

- **Patrol:** "I'm with a patient. Tell everyone what's going on with the fewest taps. Get
  help or a vehicle. Hand over cleanly. Log the small stuff and move on."
- **Sick bay:** "Who is coming, who is here, who is due, who is leaving. Keep a journal I can
  stand behind."
- **Coordinator:** "What needs me now. Where is everyone. How much room do I have. Whom do I
  send. What did we do (report, debrief)."

## A. Flows that do not match the user's mind

| # | Sev | Finding | Evidence | Recommendation | Size |
|---|---|---|---|---|---|
| A1 | **P0** | **Handing a patient over closes the patient.** "Avslutt pasient" sets `status: 'discharged'` for every reason, including *Overlevert sykestue* and *Overlevert ambulanse*. The patient vanishes from the sick bay's open groups and from the coordinator's active list at the moment the sick bay takes over. In the patrol's mind "handed over" is the opposite of "finished". | `FirstAiderDashboard.tsx` `handleClosePatient` | Map close reasons to outcomes: *Overlevert sykestue* → clear the team's engagement, keep `incoming`, note "Overlevert av Alpha kl. 11:52"; *Overlevert ambulanse* → `transferred` with who/where; *Ferdig behandlet på stedet* → `discharged` with outcome `treated_on_scene`; *Falsk alarm* / *Forsvunnet* → `discharged` with the reason. The sick bay card shows "Overlevert av Alpha". | S |
| A2 | P1 | **Only the coordinator can re-triage.** A patrol cannot change the colour after "Meld pasient"; the sick bay cannot set or change triage at all. Triage is a moving judgement: the yellow ankle becomes red when the pulse climbs. | no triage control in the field summary editor or the sick bay editors; `PatientManagementPanel.tsx:317` is the only one | Triage chips in the field summary editor and in the sick bay's "Rediger detaljer"; every change goes to the log with author and time; the coordinator's queue re-evaluates. | S |
| A3 | P1 | **"Trenger bistand" says nothing about what is needed.** The sheet sends the status only. The coordinator sees "Alpha trenger bistand" and has to radio to ask *what*: more hands, a vehicle, AMK. The API already accepts a `note`. | `TeamStatusPickerSheet.tsx` (no note), `team.status_set` accepts `note` | After the tap, a one-tap "hva": *Flere hender* / *Transport* / *AMK er varslet* / *Annet* (+ optional text) → `note`. The queue row and the sick bay's critical panel show it. | S |
| A4 | P1 | **An assignment is silent on the patrol's phone.** When the coordinator assigns a patient, the field list re-renders with a small "Oppdatert" flag. No vibration, no sound, no banner, no acknowledgement back. Chat vibrates; assignments do not. The phone is in a pocket. | `FirstAiderDashboard.tsx` `patient.updated` handler; vibration only in the `team.message` branch | Vibration + a persistent banner "Koordinator har tildelt dere: … — *Vi drar* / *Kan ikke*". "Vi drar" sends `en_route_to_patient` as the acknowledgement; the coordinator's row shows "Bekreftet av Alpha" or "Ikke bekreftet (2 min)" and escalates. | S/M |
| A5 | P1 | **The patient has no shared name.** The coordinator's map numbers markers P1…Pn; that number is derived in the client, not stored, and never appears in the field or the sick bay. On the radio a patient is "the unconscious one at km 12" while the screen says P4. | `EventMap.tsx` `P${seqNum}`; no sequence column in the schema | A per-event running number assigned by the server on creation (`#12`), shown on every card, pill, marker and in every message about the patient; searchable. | S |
| A6 | P2 | **Priority ignores waiting time.** By decision the banner holds red patients and assistance requests only. A yellow patient without a team for 25 minutes is quietly counted. The coordinator's model is severity × time waiting. | `AttentionQueuePanel.tsx` (red-only filter) | Keep the decision, add time as the second trigger: yellow > 10 min or green > 30 min without a team enters the banner as "venter for lenge". Thresholds per event. | S |
| A7 | P2 | **The sick bay cannot tell when someone arrives.** "Alpha · Transporterer" is shown but there is no distance. Team position, patient position and transport mode all exist. | `FieldEngagementLine.tsx`; positions in `Team.currentPosition` / patient `lat/lon` | "≈ 800 m unna · til fots" computed client-side (Haversine; improvement plan 5.4). A measured distance, not an invented ETA. | S |
| A8 | P2 | **The most common case takes the longest path.** Blister, cut, plaster: Meld pasient (triage, position, description) → expand → Avslutt → reason. The patrol wants "log it and move on". | current field flow | A "Behandlet på stedet" quick log: one sheet, green preselected, complaint chips (gnagsår, kutt, forstuing, …), age group, done. Creates and closes in one step; still counted. | S |
| A9 | P2 | **"Innkommende" mixes two different things:** patients on their way with a patrol and walk-ins already in the tent waiting for treatment. The nurse thinks "på vei" and "venter her". | `SickBayDashboard.tsx` groups by `status` only | Split the column: *På vei* (with patrol and distance) above *Venter i teltet*. | S |
| A10 | P2 | **Unassigned patients are not sorted by distance.** On a 40 km course a patrol at km 3 sees the list in update order with position text only. "Vi drar til denne" is a distance decision. | `FirstAiderDashboard.tsx` "Utildelte pasienter" | Sort by distance from the phone's GPS, show "≈ 1,2 km NØ" on the card (the helper exists in `lib/geo.ts`). | S |

## B. Obviously missing functionality

| # | Sev | Finding | Evidence | Recommendation | Size |
|---|---|---|---|---|---|
| B1 | P1 | **The sick bay is online-only.** The generic offline queue exists but nothing uses it; vitals, notes and status changes in the tent fail when the network drops. The field now queues; the tent does not. | `lib/offline-queue.ts` unused; `api.ts` queues team actions only | Reuse the field pattern for `recordVitals`, `addPatientNote`, `executePatientAction`; "lagret lokalt" toast; pending count in the header. | M |
| B2 | P1 | **No 113/AMK support in the field.** The sick bay has the AMK brief (script, log). The patrol at km 12 with a red patient has no "Ring 113" and no way to say "AMK er varslet", so the coordinator and the tent do not know an ambulance is coming. | no `tel:113` / AMK in `FirstAiderDashboard.tsx` | "Ring 113" on red/yellow field cards (`tel:`), plus a one-tap "AMK varslet kl." action event shown in the queue and on the sick bay card. | S |
| B3 | P1 | **No transport request.** "We need an ATV / a sled / an ambulance to km 12" is the most frequent ask after help. Today: status or chat. | nothing in API or web | "Be om transport" from the field card: pickup = patient position, need = *båre* / *ATV* / *ambulanse*. Appears in "Krever handling"; the coordinator assigns a vehicle team; the patrol sees "Delta (ATV) på vei". | M |
| B4 | P2 | **The coordinator can dispatch to a patient but not to a place.** `team.sector_assigned` exists and the field renders the sector badge, but no coordinator control sends it — a dead feature. | `FirstAiderDashboard.tsx:404` handles it; nothing in `Coordinator/` sends it | "Send til sektor / posisjon" on a team row or from a map click, reusing the message. | S |
| B5 | P1 | **No event set-up.** Events, teams and access codes come from `seed.ts`. The coordinator cannot create Sunday's event, its teams or the codes, nor rename or disable a team mid-event. | `apps/api/src/db/seed.ts`; only `POST /events` exists, no teams/codes routes | An "Arrangement" page: event, teams, codes (with QR), sectors, sick bay capacity. Without it every event needs a developer. | M/L |
| B6 | P2 | **Sick bay capacity is invisible.** Chair/bed numbers are per patient; nobody sees "12 av 16 stoler i bruk". The coordinator cannot decide tent versus hospital; the nurse cannot see which chair is free. | placement fields only | Capacity per event; an occupancy strip in the sick bay header; a tile in the coordinator's counters; a free-number picker in placement. | S/M |
| B7 | P1 | **No patient journal export.** The report is a markdown debrief with counts and one line per patient. Health personnel must keep a record per patient; at the end of the event the sick bay needs vitals history, notes, medications, AMK log and discharge summary per patient, printable. | `events.ts` `GET /:id/report` | Per-patient journal (PDF/print) and an "eksporter alle" at event end; no PII in the debrief report. | M |
| B8 | P1 | **No retention or deletion.** `Safety > Offline > Accessibility > GDPR` is the stated priority, but nothing deletes: names and birth dates stay in Postgres indefinitely, phones keep queues and auth in browser storage. | no purge/anonymise in API or PLAN.md | "Avslutt arrangement" flow: export journals → anonymise patients (keep counts, triage, timestamps) → clear device storage on logout. A scheduled purge for events older than N days. | M |
| B9 | P2 | **Chat history is lost on reload** (PLAN.md #15). A patrol that reopens the app loses the coordinator's last instruction. | realtime-only `team.message` | Store the last N messages per event; return them on connect. | S/M |
| B10 | P2 | **No acknowledgement of instructions.** The coordinator writes "Alpha: trekk tilbake"; nothing tells them it was read. Radio discipline expects a read-back. | `TeamChatSection.tsx` | "Mottatt" on directed messages → shows on the coordinator's stream with time. | S |

## C. Missing features (bigger decisions)

| # | Sev | Finding | Recommendation | Size |
|---|---|---|---|---|
| C2 | P2 | **No push notifications in the background.** Vibration fires only while the app is open. | Web Push through the existing service worker for assignments, directed messages and "trenger bistand". Radio stays primary. | M |
| C3 | P3 | **No people, only teams.** Who is on Alpha today, their phone, who recorded a note (author is the team name). Matters for hand-over at shift change and for the journal. | Optional member names per team for the shift; author = member when known. | M |
| C4 | P3 | **No voice notes.** Gloves in the dark: dictating beats typing (improvement plan 5.2). | Web Speech API, `nb-NO`, hidden when unsupported. | S |
| C5 | P3 | **Stale product docs.** `ideation-ui-2026.md` says the bottom tab bar is implemented; it was removed. | Archive or update; the UX review and design system are current. | S |

## Suggested order

1. **A1** (hand-over must not discharge) — a data-correctness bug, hours of work.
2. **A3 + A4 + A5** — the three that make radio and screen tell the same story: what is needed,
   did the patrol hear it, which patient are we talking about.
3. **B2 + B3** — 113 from the field, transport requests. These are the two asks a patrol
   makes most after "help".
4. **B1** — the tent offline.
5. **B7 + B8** — journal export and deletion before the tool holds real patient data for a
   full season.
6. **B5** — event set-up, so the next event does not need a developer.
7. The P2 flow items (A2, A6–A10, B4, B6, B9, B10), each small.
8. C2 once the field flows above are in. Mass casualty mode is out of scope for good; it is
   recorded under Removed in `docs/FEATURES.md`.

## What was not found

Things that were checked and are fine: two phones per patrol stay in sync; closed patients
leave every list; the sick bay sees field patients without reload; NEWS2 and re-assessment
timing are right; the coordinator can assign, message and stand a patrol down; the demo,
`local-full` and `pages-demo` suites cover the main flows.
