import { AmkAssistDraft, calculateNEWS2 } from '@rkf/shared-types';

type LatestVitalsInput = {
  pulse?: number | null;
  spo2?: number | null;
  respiratoryRate?: number | null;
  systolicBp?: number | null;
  temperature?: number | null;
  acvpu?: 'alert' | 'confused' | 'voice' | 'pain' | 'unresponsive' | null;
  onSupplementalOxygen?: boolean | null;
};

type SbarInput = {
  latestNote?: string;
};

export type AmkAssistInput = {
  presentingComplaint?: string | null;
  latestVitals?: LatestVitalsInput | null;
  sbar?: SbarInput;
};

export type AmkAssistProvenance = {
  source: 'provider' | 'fallback_template';
  model: string;
  fallbackUsed: boolean;
};

type ProviderConfig = {
  provider: string;
  model: string;
  apiKey: string;
};

function mapNewsToCriticality(score: number): 'lav' | 'middels' | 'høy' | 'kritisk' {
  if (score >= 7) return 'kritisk';
  if (score >= 5) return 'høy';
  if (score >= 3) return 'middels';
  return 'lav';
}

function buildDeterministicDraft(input: AmkAssistInput) {
  const news = input.latestVitals
    ? calculateNEWS2({
        respiratoryRate: input.latestVitals.respiratoryRate ?? undefined,
        spo2: input.latestVitals.spo2 ?? undefined,
        systolicBP: input.latestVitals.systolicBp ?? undefined,
        pulse: input.latestVitals.pulse ?? undefined,
        acvpu: input.latestVitals.acvpu ?? undefined,
        temperature: input.latestVitals.temperature ?? undefined,
        onSupplementalOxygen: input.latestVitals.onSupplementalOxygen ?? undefined,
      })
    : null;

  const criticality = mapNewsToCriticality(news?.total ?? 0);
  const vitalsSummary = input.latestVitals
    ? [
        input.latestVitals.pulse != null ? `Puls ${input.latestVitals.pulse}` : null,
        input.latestVitals.spo2 != null ? `SpO₂ ${input.latestVitals.spo2}%` : null,
        input.latestVitals.respiratoryRate != null ? `RF ${input.latestVitals.respiratoryRate}` : null,
        input.latestVitals.systolicBp != null ? `BT ${input.latestVitals.systolicBp}` : null,
        input.latestVitals.temperature != null ? `Temp ${input.latestVitals.temperature}` : null,
        input.latestVitals.acvpu ? `ACVPU ${input.latestVitals.acvpu}` : null,
      ].filter(Boolean).join(', ')
    : 'Ingen vitale tegn registrert ennå';

  const condition = input.presentingComplaint ?? 'Uavklart problemstilling';
  const newsText = news ? `NEWS2 ${news.total}` : 'NEWS2 ikke tilgjengelig';
  const latestNote = input.sbar?.latestNote ?? 'Ingen kjente tilleggsopplysninger.';

  return AmkAssistDraft.parse({
    criticality,
    rationale: `${newsText}. Kliniske funn tilsier ${criticality} prioritet.`,
    sayFirst: [
      `Dette er sykestue på arrangement, pasient med ${condition}.`,
      `Kritikalitet vurderes som ${criticality.toUpperCase()} basert på ${newsText}.`,
      `Siste vitale tegn: ${vitalsSummary}.`,
    ],
    spokenScript: [
      'Hei, dette er Røde Kors sykestue.',
      `Vi ringer om en pasient med ${condition}.`,
      `Vi vurderer kritikalitet som ${criticality} (${newsText}).`,
      `Siste observasjoner: ${vitalsSummary}.`,
      'Vi trenger AMK-råd for videre håndtering og transport.',
    ].join(' '),
    sbarDraft: {
      situation: `Pasient med ${condition}.`,
      background: latestNote,
      assessment: `${newsText}. ${vitalsSummary}.`,
      recommendation: 'Ønsker AMK-vurdering av hastegrad og transportnivå.',
    },
  });
}

async function generateViaProvider(config: ProviderConfig, input: AmkAssistInput) {
  // V1 adapter: provider path is selected via env and can be upgraded without route changes.
  // For now, `mock` provider returns deterministic structure while preserving provenance.
  if (config.provider === 'mock') {
    return buildDeterministicDraft(input);
  }
  throw new Error(`Provider ${config.provider} is not configured in this build`);
}

export async function generateAmkAssistDraft(input: AmkAssistInput): Promise<{
  draft: ReturnType<typeof AmkAssistDraft.parse>;
  provenance: AmkAssistProvenance;
}> {
  const provider = process.env.AI_PROVIDER?.trim();
  const model = process.env.AI_MODEL?.trim();
  const apiKey = process.env.AI_API_KEY?.trim();

  const fallbackDraft = buildDeterministicDraft(input);

  if (!provider || !model || !apiKey) {
    return {
      draft: fallbackDraft,
      provenance: {
        source: 'fallback_template',
        model: 'deterministic-template-v1',
        fallbackUsed: true,
      },
    };
  }

  try {
    const providerDraft = await generateViaProvider({ provider, model, apiKey }, input);
    return {
      draft: providerDraft,
      provenance: {
        source: 'provider',
        model,
        fallbackUsed: false,
      },
    };
  } catch {
    return {
      draft: fallbackDraft,
      provenance: {
        source: 'fallback_template',
        model,
        fallbackUsed: true,
      },
    };
  }
}
