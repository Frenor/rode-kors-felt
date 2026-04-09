# Fjernede funksjoner: Hendelse (Incident) og MCI (Mass Casualty Incident)

Disse funksjonene ble fjernet for å forenkle systemet og redusere vedlikeholdsbyrden.
De er dokumentert her for eventuell reimplementering.

---

## Hendelse (Incident)

### Hva var det?

Hendelse-systemet lot førsthjelpspatruljer opprette og oppdatere hendelser fra feltet.
Koordinator kunne se alle hendelser i sanntid, filtrere dem og tildele lag.

### API-ruter

- `POST /api/incidents` — Opprett ny hendelse
- `GET /api/incidents?eventId=:id` — Hent alle hendelser for et arrangement
- `GET /api/incidents/:id` — Hent enkelt hendelse
- `POST /api/incidents/:id/actions` — Utfør handling på hendelse:
  - `status.set` — Oppdater status
  - `escalation.raise` — Eskalér hendelse
  - `escalation.resolve` — Avslutt eskalering
  - `escalation.reopen` — Gjenåpne eskalering

### Database-tabeller

#### `incidents`
| Kolonne | Type | Beskrivelse |
|---|---|---|
| id | uuid | PK |
| event_id | uuid | FK → events |
| team_id | uuid | FK → teams (nullable) |
| type | incident_type enum | `medical`, `trauma`, `psychiatric`, `other` |
| status | incident_status enum | `dispatched`, `on_scene`, `transporting`, `at_sickbay`, `handed_over`, `resolved` |
| source | incident_source enum | `field`, `coordinator` |
| location | jsonb `{lat, lng}` | GPS-posisjon |
| location_context | jsonb | Innendørs sone-kontekst |
| acvpu | acvpu_level enum | Bevissthetsnivå |
| vitals | jsonb | Vitale tegn |
| mist | jsonb | MIST-skjema |
| sbar | jsonb | SBAR-skjema |
| triage_tag | triage_tag enum | START-triage |
| notes | text | Fritekst |
| client_id | varchar | Idempotensykkel for offline-kø |
| created_at / updated_at | timestamptz | — |

#### `escalations`
| Kolonne | Type | Beskrivelse |
|---|---|---|
| id | uuid | PK |
| incident_id | uuid | FK → incidents |
| event_id | uuid | FK → events |
| path | escalation_path enum | `path_a_rk_ambulance`, `path_b_113` |
| reason | text | Begrunnelse |
| raised_at | timestamptz | — |
| resolved_at | timestamptz | Nullbar — aktiv hvis null |
| raised_by | varchar | Brukernavn/rolle |

### DB-enumer som ble fjernet

- `incident_type` — `medical`, `trauma`, `psychiatric`, `other`
- `incident_status` — `dispatched`, `on_scene`, `transporting`, `at_sickbay`, `handed_over`, `resolved`
- `incident_source` — `field`, `coordinator`
- `escalation_path` — `path_a_rk_ambulance`, `path_b_113`
- `triage_tag` — `immediate`, `delayed`, `minor`, `expectant`
- `action_entity_type` ble endret: `incident`-verdien ble fjernet (gjenværende: `patient`, `event`, `team`)

### Shared-types (Zod-skjemaer)

Fjernede eksporter fra `@rkf/shared-types`:
- `IncidentType`, `IncidentStatus`, `IncidentSource`
- `EscalationType`, `EscalationPath`
- `TriageTag`
- `Incident`, `CreateIncidentRequest`
- `MciMode`
- `Escalation`, `CreateEscalationRequest`
- `SickbayIncomingCriticalReason`, `SickbayIncomingItem`, `SickbayIncomingResponse`
- Fra `WsEventType` ble fjernet: `incident.created`, `incident.updated`, `escalation.raised`, `escalation.resolved`

### Frontend-komponenter som ble fjernet

| Fil | Beskrivelse |
|---|---|
| `apps/web/src/pages/IncidentForm.tsx` | Hendelsesregistreringsskjema for førstehjelper |
| `apps/web/src/pages/Coordinator/IncidentCard.tsx` | Enkelt hendelsesoversiktskort |
| `apps/web/src/pages/Coordinator/IncidentFeed.tsx` | Hendelsesstrøm med filtrering |
| `apps/web/src/pages/Coordinator/EscalationModal.tsx` | Modal for å sende/bekrefte eskalering |
| `apps/web/src/pages/Coordinator/NewTaskModal.tsx` | Modal for å opprette nytt koordinatoroppdrag |

### Rute i App.tsx

Fjernet rute: `/firstaid/incident` → `IncidentForm`

### Offline-kø (incident-spesifikk)

- `apps/web/src/lib/offline-queue.ts` — Dexie/IndexedDB-kø for hendelser opprettet offline
- `apps/web/src/hooks/useOfflineSync.ts` — Flush-hook for offline-kø
- API-metode `api.createIncident()` — med innebygd offline-støtte

---

## MCI (Mass Casualty Incident)

### Hva var det?

MCI-modusen aktiverte et spesielt massetapsdriftsoppsett med:
- START-triageoversikt pr. sektorer
- Lagdisponering til sektorer
- Automatisk generert HTML-overleveringsdokument ved deaktivering
- Sanntids-WS-varsler ved aktivering/deaktivering

### API-endepunkter (fjernet)

- `PATCH /api/events/:id/mci` — Aktiver/deaktiver MCI-modus, genererer overleveringsdokument
- `GET /api/events/:id/mci-summary` — Last ned HTML-overleveringsdokument

### Database-felt fjernet fra `events`-tabellen

| Kolonne | Type | Beskrivelse |
|---|---|---|
| mci_active | boolean | Om MCI er aktiv |
| mci_activated_at | timestamptz | Tidspunkt for aktivering |
| mci_activated_by | varchar | Hvem aktiverte |
| mci_sectors | text[] | Sektornavn |
| mci_summary_html | text | Generert HTML-overleveringsdokument |
| mci_summary_generated_at | timestamptz | Generert tidspunkt |
| mci_summary_generated_by | varchar | Generert av |

### WS-hendelsestyper fjernet

- `event.mci_activated` — Sendt når MCI aktiveres
- `event.mci_deactivated` — Sendt når MCI deaktiveres
- `team.sector_assigned` — Sendt når et lag tildeles til en sektor

### Frontend-komponenter fjernet

| Fil | Beskrivelse |
|---|---|
| `apps/web/src/pages/Coordinator/MCIOverviewPanel.tsx` | Oversiktspanel for aktiv MCI |
| `apps/web/src/pages/Coordinator/ResourceAllocationBoard.tsx` | Tavle for lagdisponering til sektorer |

### MCI-tilstand fra CoordinatorDashboard (fjernet)

- `mciActive`, `mciActivatedBy`, `mciSectors`
- `teamSectorAssignments`
- `togglingMci`, `downloadingMciSummary`
- `handleToggleMci`, `handleDownloadMciSummary`, `handleAssignTeamToSector`
- `calcEta` (Haversine ETA-beregning — ble bare brukt til hendelses-/sektorvisning)

### API-metoder fjernet fra `api.ts`

- `api.toggleMci(eventId, mciActive, mciSectors?)` — Toggling MCI-modus
- `api.downloadMciSummary(eventId)` — Last ned overleveringsdokument

### CoordinatorHeader-props fjernet

- `mciActive: boolean`
- `togglingMci: boolean`
- `onToggleMci: () => void`

---

## Sickbay Incoming (avhengig av hendelser)

### Hva var det?

Endepunktet `GET /api/events/:id/sickbay-incoming` og tilhørende
`IncomingCriticalPanel`-komponent i SickBay-dashboardet viste en sanntidsoversikt
over innkommende kritiske hendelser — sortert etter NEWS2-score og START-triage.

Dataene var bygget fra `incidents`-tabellen og kunne ikke videreføres uten hendelser.

### Endret adferd

- `GET /api/events/:id/sickbay-incoming` returnerer nå alltid `{ items: [] }`
- `IncomingCriticalPanel` viser ingenting når listen er tom (return null)

### Shared-types

Fjernet: `SickbayIncomingCriticalReason`, `SickbayIncomingItem`, `SickbayIncomingResponse`

---

## Testfiler fjernet

| Fil | Beskrivelse |
|---|---|
| `apps/api/src/__tests__/incidents.test.ts` | API-tester for hendelsesruter |
| `apps/api/src/__tests__/escalations.test.ts` | API-tester for eskalering |
| `apps/web/src/__tests__/IncidentForm.test.tsx` | Enhetstester for hendelsesregistreringsskjema |
| `apps/web/e2e/incident-flow.spec.ts` | E2E-tester for hendelsesflyt |

---

## Reimplementeringstips

### Prioritert kravliste

1. **Databasemigrasjoner**: Legg til `incidents`- og `escalations`-tabeller via Drizzle-migrasjoner
2. **Enumer**: Gjenopprett PostgreSQL-enumer (`incident_type`, `incident_status` osv.) i `schema.ts`
3. **API-ruter**: Gjenopprett `apps/api/src/routes/incidents.ts` med full CRUD + handlingsendepunkt
4. **WS-integrasjon**: Send `incident.created` og `incident.updated` via `broadcast()` i `ws.ts`
5. **Delt typer**: Gjenopprett Zod-skjemaer i `@rkf/shared-types`
6. **Frontend**: Gjenopprett `IncidentForm`, `IncidentFeed`, `IncidentCard`
7. **MCI**: Gjenopprett som separat modul — anbefaler å lage eget WS-namespace

### Viktige merknader

- `patients`-tabellen har en `incident_id`-FK-kolonne som er bevart (nullable, ubrukt)
- `action_events`-tabellen refererer fremdeles `entity_type` — legg til `incident` tilbake i enum-verdier
- Den offline-køen som ble brukt for hendelsesregistrering (Dexie/IndexedDB) er fjernet —
  se `offline-firstaid-queue.ts` for mønster å gjenbruke
