import Anthropic from '@anthropic-ai/sdk';

export type TriageLevel = 'lav' | 'middels' | 'høy' | 'kritisk';

export interface TriageAssessment {
  level: TriageLevel;
  summary: string;
  recommendation: string;
}

const SYSTEM_PROMPT = `Du er et medisinsk beslutningsstøttesystem for en Røde Kors feltkoordinator.
Du får hendelsesdata fra en førstehjelper og skal gi en kortfattet vurdering.

Svar ALLTID med dette JSON-formatet (ingen annen tekst):
{
  "level": "lav" | "middels" | "høy" | "kritisk",
  "summary": "1–2 setninger om tilstanden",
  "recommendation": "Konkret anbefaling til koordinator (maks 1 setning)"
}

Kriterier:
- lav: Stabil, ingen umiddelbar fare, kan vente
- middels: Bør følges opp, potensiell forverring
- høy: Krever rask handling, vurder eskalering til RK Ambulanse
- kritisk: Livstruende — ring 113 umiddelbart

Svar på norsk bokmål. Vær konkret og handlingsorientert.`;

const DEMO_RESPONSES: Record<string, TriageAssessment> = {
  medical: {
    level: 'høy',
    summary: 'Medisinsk hendelse med redusert bevissthet (ACVPU). Potensiell kardiovaskulær eller nevrologisk årsak.',
    recommendation: 'Eskalér til RK Ambulanse — pasienten bør til sykestue umiddelbart.',
  },
  trauma: {
    level: 'middels',
    summary: 'Traumehendelse registrert. Mekanisme og omfang krever klinisk vurdering.',
    recommendation: 'Send lag til sykestue for nærmere undersøkelse.',
  },
  psychiatric: {
    level: 'middels',
    summary: 'Psykiatrisk hendelse. Pasienten kan utgjøre risiko for seg selv eller andre.',
    recommendation: 'Sikre trygge omgivelser og kontakt lege ved behov.',
  },
  other: {
    level: 'lav',
    summary: 'Hendelse av ukjent type. Ingen umiddelbar livstruende indikasjon.',
    recommendation: 'Monitorer og oppdater status ved endring.',
  },
};

function incidentToPrompt(incident: any): string {
  const lines = [
    `Hendelsestype: ${incident.type ?? 'ukjent'}`,
    incident.acvpu ? `ACVPU: ${incident.acvpu}` : null,
    incident.mechanism ? `Mekanisme: ${incident.mechanism}` : null,
    incident.injuries?.length ? `Skader: ${incident.injuries.join(', ')}` : null,
    incident.symptoms?.length ? `Symptomer: ${incident.symptoms.join(', ')}` : null,
    incident.treatments?.length ? `Behandling gitt: ${incident.treatments.join(', ')}` : null,
    incident.notes ? `Notater: ${incident.notes}` : null,
    `Status: ${incident.status ?? 'ukjent'}`,
    `Rapportert: ${incident.createdAt ? new Date(incident.createdAt).toLocaleTimeString('nb-NO') : 'ukjent'}`,
  ].filter(Boolean);
  return lines.join('\n');
}

export async function assessTriage(
  incident: any,
  apiKey: string,
): Promise<TriageAssessment> {
  if (import.meta.env.VITE_DEMO_MODE === 'true') {
    await new Promise((r) => setTimeout(r, 800)); // simulate latency
    return (DEMO_RESPONSES[incident.type] ?? DEMO_RESPONSES['other']) as TriageAssessment;
  }

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: incidentToPrompt(incident) }],
  });

  const block = response.content[0];
  const text = block?.type === 'text' ? block.text : '';

  try {
    const parsed = JSON.parse(text);
    return parsed as TriageAssessment;
  } catch {
    // Fallback if model doesn't return pure JSON
    return {
      level: 'middels',
      summary: text.slice(0, 150),
      recommendation: 'Se råtekst ovenfor.',
    };
  }
}
