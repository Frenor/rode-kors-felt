#!/usr/bin/env node
/**
 * Export the three RKF interfaces, prefilled with demo data, as ONE self-contained
 * HTML page for presentations: docs/design/showcase/index.html.
 *
 * What it does: drives the demo build through one incident (a patrol in the field,
 * the sick bay, the coordinator), snapshots the live DOM at each step, inlines the
 * app's CSS and fonts, replaces the map with a picture, and wraps the snapshots in
 * a presentation shell with device frames and speaker notes. No server, no build
 * step and no network is needed to open the result — double-click it.
 *
 * Prerequisites (from the repo root):
 *   VITE_DEMO_MODE=true VITE_BASE_PATH=/ pnpm --filter @rkf/web build
 *   pnpm --filter @rkf/web exec vite preview --port 3200
 *   pnpm --filter @rkf/web showcase:export
 *
 * Env: SHOWCASE_BASE_URL (default http://127.0.0.1:3200)
 *      SHOWCASE_CHROMIUM  (executablePath for a system Chromium, optional)
 *      SHOWCASE_OUT       (default docs/design/showcase/index.html)
 */
import { chromium } from '@playwright/test';
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const REPO = resolve(WEB, '..', '..');
const BASE = process.env.SHOWCASE_BASE_URL ?? 'http://127.0.0.1:3200';
const OUT = resolve(process.env.SHOWCASE_OUT ?? resolve(REPO, 'docs/design/showcase/index.html'));

const CODE_FIELD = '123456';
const CODE_SICKBAY = '654321';
const COORD_EMAIL = 'admin@rkf.no';
const COORD_PASSWORD = 'admin123';

// ─── App CSS: fonts inline, scoped to a shadow root ─────────────────────────
function loadAppCss() {
  const assets = resolve(WEB, 'dist', 'assets');
  const cssFile = readdirSync(assets).find((f) => f.startsWith('index-') && f.endsWith('.css'));
  if (!cssFile) throw new Error('No dist/assets/index-*.css — build the demo first.');
  let css = readFileSync(resolve(assets, cssFile), 'utf8');

  // Fonts: keep latin and latin-ext faces as embedded woff2; drop the rest.
  const fontFaces = [];
  css = css.replace(/@font-face\s*\{[^}]*\}/g, (block) => {
    if (!/unicode-range:\s*U\+0000-00FF|unicode-range:\s*U\+0100-02BA/i.test(block)) return '';
    const m = block.match(/url\((["']?)([^)"']+\.woff2)\1\)/);
    if (!m) return '';
    const file = m[2].split('/').pop();
    const data = readFileSync(resolve(assets, file)).toString('base64');
    fontFaces.push(block.replace(/src:[^;]+;/, `src:url(data:font/woff2;base64,${data}) format("woff2");`));
    return '';
  });

  // Other asset references (leaflet icons etc.) → data URIs.
  const mime = { svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
  css = css.replace(/url\((["']?)\/assets\/([^)"']+)\1\)/g, (_m, _q, file) => {
    try {
      const ext = file.split('.').pop().toLowerCase();
      return `url(data:${mime[ext] ?? 'application/octet-stream'};base64,${readFileSync(resolve(assets, file)).toString('base64')})`;
    } catch {
      return 'none';
    }
  });

  // The page becomes a shadow root: html → :host, body → .rkf-root, :root → :host.
  css = css
    .replace(/(^|[\s,}])html(?=[\s{,.:[])/g, '$1:host')
    .replace(/(^|[\s,}])body(?=[\s{,.:[])/g, '$1.rkf-root')
    .replace(/:root/g, ':host')
    .replace(/100dvh/g, '100%');
  return { css, fontCss: fontFaces.join('\n') };
}

// ─── Snapshot the live DOM of the app ───────────────────────────────────────
async function snapshot(page, { mapImage } = {}) {
  await dismissDemoChrome(page);
  await page.waitForTimeout(250);
  return page.evaluate(({ mapImage }) => {
    // Typed values live in properties, not attributes — copy them over so
    // the serialized markup shows the filled-in state.
    document.querySelectorAll('input, textarea').forEach((el) => {
      if (el.type === 'checkbox' || el.type === 'radio') {
        if (el.checked) el.setAttribute('checked', ''); else el.removeAttribute('checked');
      } else if (el.tagName === 'TEXTAREA') {
        el.textContent = el.value;
      } else {
        el.setAttribute('value', el.value);
      }
    });
    document.querySelectorAll('select').forEach((sel) => {
      for (const o of sel.options) { if (o.selected) o.setAttribute('selected', ''); else o.removeAttribute('selected'); }
    });
    const clone = document.getElementById('root').cloneNode(true);
    // Toasts are moments, not state.
    clone.querySelectorAll('[aria-label="Varsler"]').forEach((el) => el.remove());
    clone.querySelectorAll('script, link, style').forEach((el) => el.remove());
    if (mapImage) {
      const map = clone.querySelector('.leaflet-container');
      if (map) {
        const img = document.createElement('img');
        img.src = mapImage;
        img.alt = 'Kart over arrangementet med lag og pasienter';
        img.style.cssText = 'display:block;width:100%;height:100%;object-fit:cover';
        map.replaceChildren(img);
        map.style.background = '#e5e7eb';
      }
    }
    const theme = document.documentElement.getAttribute('data-theme')
      ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    return { html: clone.innerHTML, theme, scrollY: window.scrollY };
  }, { mapImage: mapImage ?? null });
}

async function captureMap(page) {
  const map = page.locator('.leaflet-container').first();
  if (!(await map.isVisible().catch(() => false))) return null;
  await page.waitForTimeout(1500);
  const buf = await map.screenshot({ type: 'jpeg', quality: 82 });
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}

/** Scroll so the element's top sits `offset` px below the viewport top (under sticky headers). */
async function scrollToTop(locator, offset) {
  await locator.evaluate((el, off) => {
    window.scrollTo(0, Math.max(0, el.getBoundingClientRect().top + window.scrollY - off));
  }, offset);
}

async function dismissDemoChrome(page) {
  for (const label of ['Lukk demo-banner', 'Lukk veiledning']) {
    const btn = page.locator(`[aria-label="${label}"]`).first();
    if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => {});
  }
}

async function enterCode(page, code) {
  for (const d of code) await page.getByRole('button', { name: d, exact: true }).click();
  await page.getByRole('button', { name: /Koble til arrangement/i }).click();
}

async function logout(page) {
  await page.getByRole('button', { name: 'Logg ut' }).click();
  await page.waitForURL((u) => !/\/(firstaid|sickbay|coordinator)/.test(u.pathname));
}

// ─── The walk through one incident ──────────────────────────────────────────
async function run() {
  const browser = await chromium.launch({
    executablePath: process.env.SHOWCASE_CHROMIUM || undefined,
  });
  const screens = [];
  const add = (role, id, title, notes, size, snap) => screens.push({ role, id, title, notes, ...size, ...snap });

  // The demo store lives in the page: one tab, client-side navigation only, so
  // what the patrol does is what the sick bay and the coordinator then see.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('rkf-theme', 'dark'); });
  await page.goto(`${BASE}/`);

  // ── Field: patrol Alpha, phone, dark ─────────────────────────────────────
  const PHONE = { width: 390, height: 844 };
  await enterCode(page, CODE_FIELD);
  await page.waitForURL('**/firstaid');
  const chooseTeam = page.getByRole('heading', { name: /Velg patrulje/i });
  const ready = page.getByRole('button', { name: /Meld pasient/i });
  await chooseTeam.or(ready).first().waitFor({ timeout: 20_000 });
  if (await chooseTeam.isVisible()) await page.getByRole('button', { name: /^Alpha/ }).click();
  await ready.waitFor();
  await dismissDemoChrome(page);
  const workspace = page.getByTestId('firstaid-patient-workspace');

  add('felt', 'oversikt', 'Oversikt', [
    'Alt en patrulje trenger på ett skjermbilde: lagstatus, «Meld pasient» én tapp unna, egne pasienter med triage-stripe og NEWS2, og pasienter uten lag.',
    'Mørk modus huskes mellom omstarter. Alle knapper er minst 48 px — hansker.',
  ], PHONE, await snapshot(page));

  // Expand own patient, choose engagement, type a set of vitals and a note.
  const card = workspace.getByTestId(/^firstaid-patient-(?!workspace)/).first();
  await card.getByRole('button').first().click();
  await card.getByTestId('engagement-transporting').click();
  await card.getByLabel('Puls', { exact: true }).fill('112');
  await card.getByLabel('SpO₂', { exact: true }).fill('93');
  await card.getByLabel('RF', { exact: true }).fill('24');
  await card.getByLabel('Syst. BT', { exact: true }).fill('100');
  await card.getByLabel('Temp', { exact: true }).fill('37.8');
  await card.getByRole('radio', { name: /^A —/ }).click();
  await card.getByPlaceholder('Hva ser dere? Hva er gjort?').fill('Kald og blek, gitt varmeteppe. Klager på kvalme.');
  await scrollToTop(card, 116);
  add('felt', 'pasient', 'Pasientkort', [
    'Først det koordinator venter på: hva gjør vi med pasienten («Transporterer» valgt).',
    'Forrige sett vises med NEWS2. Det nye settet vurderes mens det skrives — «NEWS2 foreløpig» — før noe lagres.',
    'Uten nett lagres vitale tegn og notat lokalt og sendes senere; lagkortet teller det som «venter på sending».',
  ], PHONE, await snapshot(page));

  // Close the patient: reasons are chips, not a sentence typed with gloves.
  await card.getByRole('button', { name: 'Avslutt pasient' }).click();
  const closeForm = card.getByTestId(/^firstaid-close-form-/);
  await closeForm.getByRole('radio', { name: 'Overlevert sykestue' }).click();
  await closeForm.getByLabel('Tilleggsinformasjon ved avslutning', { exact: true }).fill('Overlevert til sykepleier Bakke');
  await scrollToTop(closeForm, 180);
  add('felt', 'avslutt', 'Avslutt pasient', [
    'Fem årsaker som chips i stedet for fritekst; fritekst er valgfritt tillegg.',
    'Bekreftelsen er den eneste fylte røde knappen her — rødt betyr «uopprettelig», ikke «lagre».',
  ], PHONE, await snapshot(page));
  await closeForm.getByRole('button', { name: 'Avbryt' }).click();
  await card.getByRole('button').first().click(); // collapse

  // Report a new patient — form prefilled.
  await page.evaluate(() => window.scrollTo(0, 0));
  await workspace.getByRole('button', { name: /Meld pasient/i }).click();
  await workspace.getByRole('button', { name: 'Gul', exact: true }).click();
  await workspace.getByLabel('Hvor er pasienten?', { exact: true }).fill('Km 8, ved drikkestasjon 2');
  await workspace.getByPlaceholder(/Beskriv skaden/).fill('Fall i nedkjøringen, smerter i venstre ankel. Kan ikke belaste.');
  add('felt', 'meld', 'Meld pasient', [
    'Triage først, så posisjon (GPS foreslås automatisk) og en kort beskrivelse.',
    'Én fylt rød knapp per skjerm: «Registrer pasient» er sidens handling.',
  ], PHONE, await snapshot(page));
  await workspace.getByRole('button', { name: 'Lukk', exact: true }).click();

  // Team status sheet, then "Trenger bistand" — the incident the desk will see.
  await page.evaluate(() => window.scrollTo(0, 0));
  await workspace.getByTestId('firstaid-field-status-pill').click({ force: true });
  await workspace.getByTestId('firstaid-field-status-controls').waitFor();
  add('felt', 'status', 'Lagstatus', [
    '«Trenger bistand» er skilt fra de fire vanlige tilstandene: 64 px, rød kant, øverst.',
    'Valget varsler koordinator og sykestue umiddelbart.',
  ], PHONE, await snapshot(page));
  await workspace.getByTestId('firstaid-field-status-needs_assistance').click();
  await workspace.getByTestId('firstaid-needs-assistance-banner').waitFor();
  await page.evaluate(() => window.scrollTo(0, 0));
  add('felt', 'bistand', 'Trenger bistand', [
    'Så lenge laget har bedt om hjelp ligger et banner under laghodet med én tapp for «avklart».',
    'Koordinator kan også avklare fra pulten — patruljens telefon følger med.',
  ], PHONE, await snapshot(page));

  // ── Sick bay: tablet, light ───────────────────────────────────────────────
  // No reload from here on: the demo store is in-page state, and what Alpha
  // just did (transporting, asking for help) is what the sick bay and the
  // coordinator must see. The theme toggle cycles Mørk → Lys without a reload.
  await page.getByTestId('theme-toggle').click();
  await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'light');
  await logout(page);
  await page.setViewportSize({ width: 1024, height: 1366 });
  const TABLET = { width: 1024, height: 860 };
  await enterCode(page, CODE_SICKBAY);
  await page.waitForURL('**/sickbay');
  await page.getByRole('heading', { name: 'Sykestue' }).waitFor();
  await dismissDemoChrome(page);
  add('sykestue', 'oversikt', 'Oversikt', [
    'Kritisk innkommende øverst med «Start behandling» og plassering inline; deretter tre kolonner etter status.',
    'Hvert kort: hvem som bringer pasienten («Alpha · Transporterer»), neste vurdering, siste vitale, neste steg, «Ring 113» på egen rad.',
    'Forfalte vurderinger sorteres øverst og telles i toppen.',
  ], TABLET, await snapshot(page));

  // Vitals for Lea Hansen (in treatment) — prefilled, NEWS2 previewed.
  // The card root is the outermost stripe card that mentions her.
  const lea = page.locator('.card.card--stripe').filter({ hasText: 'Lea Hansen' }).first();
  await lea.getByRole('button', { name: 'Vitale', exact: true }).click();
  await lea.getByLabel('Puls', { exact: true }).fill('118');
  await lea.getByLabel('SpO₂', { exact: true }).fill('92');
  await lea.getByLabel('RF', { exact: true }).fill('26');
  await lea.getByLabel('Syst. BT', { exact: true }).fill('98');
  await lea.getByLabel('Temp', { exact: true }).fill('37.4');
  await lea.getByRole('radio', { name: /^V —/ }).click();
  await scrollToTop(lea, 72);
  add('sykestue', 'vitale', 'Vitale tegn', [
    'Skjemaet regner NEWS2 mens man skriver og sier hvilke parametre som mangler — før lagring.',
    'Et sett som utløser eskalering ses med en gang: «høy» betyr kontinuerlig overvåkning og kritisk-panelet.',
  ], TABLET, await snapshot(page));
  await lea.getByRole('button', { name: 'Lukk vitale', exact: true }).click();

  // Intake modal prefilled.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('button', { name: /^Ny pasient/i }).click();
  const intake = page.getByRole('dialog', { name: 'Registrer ny pasient' });
  await intake.getByLabel('Fullt navn', { exact: true }).fill('Jonas Lie');
  await intake.getByLabel('Kjønn', { exact: true }).selectOption('male');
  await intake.getByLabel('Fødselsdato', { exact: true }).fill('1994-03-12');
  await intake.getByLabel('Plasseringstype', { exact: true }).selectOption('chair');
  await intake.getByLabel('Nr.', { exact: true }).fill('12');
  await intake.getByLabel('Problemstilling', { exact: true }).fill('Kutt i pannen, blødning stanset');
  await intake.getByLabel('Behandler', { exact: true }).fill('Sykepleier Bakke');
  add('sykestue', 'ny', 'Ny pasient', [
    'Navn eller problemstilling er påkrevd — et tomt skjema lager ikke lenger «Ukjent pasient».',
    'Plassering (stol/seng + nummer) settes her eller senere fra kortet.',
  ], TABLET, await snapshot(page));
  await intake.getByRole('button', { name: /Avbryt|Lukk/ }).first().click();

  // ── Coordinator: laptop, light ────────────────────────────────────────────
  await logout(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  const LAPTOP = { width: 1280, height: 860 };
  await page.locator('a[href="/login"]').first().click();
  await page.getByLabel(/e-post/i).fill(COORD_EMAIL);
  await page.getByLabel(/passord/i).fill(COORD_PASSWORD);
  await page.getByRole('button', { name: /Logg inn/i }).click();
  await page.waitForURL('**/coordinator');
  await page.getByRole('heading', { name: 'Koordinator' }).waitFor();
  await dismissDemoChrome(page);
  await page.locator('.leaflet-container').first().waitFor({ timeout: 15_000 }).catch(() => {});
  let mapImage = await captureMap(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  add('koordinator', 'oversikt', 'Oversikt', [
    '«Krever handling» først, og bare det som faktisk krever det: røde pasienter uten lag og lag som ber om bistand. Gule og grønne uten lag telles stille.',
    'Hver rad har sin beslutning inline: tildel lag, send melding, avklar.',
    'Seks tellere som alltid fyller radene, pasientliste og lag ved siden av kartet. Kartmotor og 3D er innstillinger.',
  ], LAPTOP, await snapshot(page, { mapImage }));

  // Message a patrol and start standing one down (confirm step visible).
  const compose = page.getByTestId('coordinator-message-compose');
  await compose.getByTestId('coordinator-message-to').selectOption('team-alpha');
  await compose.getByTestId('coordinator-message-text').fill('Alpha: Bravo er på vei til dere. Hold posisjonen.');
  await compose.getByTestId('coordinator-message-send').click();
  await page.getByText('Koordinator → Alpha').first().waitFor();
  const clearAlpha = page.getByTestId('team-status-clear-team-alpha');
  if (await clearAlpha.isVisible().catch(() => false)) await clearAlpha.click();
  mapImage = await captureMap(page);
  await scrollToTop(page.getByTestId('coordinator-team-status'), 72);
  add('koordinator', 'melding', 'Melding og avklaring', [
    'Koordinator skriver til alle lag eller ett; strømmen viser «Koordinator → Alpha». En patrulje ser bare det som er til alle eller til den selv.',
    '«Avklart» spør én gang til («Ja, sett Alpha ledig») før laget settes ledig — et nødsignal skal ikke forsvinne ved et feiltrykk.',
    'Sanntid: uten forbindelse sendes ikke meldingen, og koordinator bes bruke samband.',
  ], LAPTOP, await snapshot(page, { mapImage }));

  await browser.close();
  return screens;
}

// ─── Presentation shell ─────────────────────────────────────────────────────
function gitStamp() {
  try {
    const sha = execSync('git rev-parse --short HEAD', { cwd: REPO }).toString().trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: REPO }).toString().trim();
    return `${branch} @ ${sha}`;
  } catch {
    return 'ukjent revisjon';
  }
}

const ROLES = [
  { id: 'felt', label: 'Felt', device: 'Telefon · patrulje Alpha', blurb: 'En patrulje i løypa, i mørket, med hansker og en pasient foran seg. Alt viktig må kunne gjøres med én tommel.' },
  { id: 'sykestue', label: 'Sykestue', device: 'Nettbrett · seks pasienter', blurb: 'En sykepleier med seks pasienter og en avbrytelse i minuttet. Verktøyet holder styr på hvem som er forfalt og hva som er neste steg.' },
  { id: 'koordinator', label: 'Koordinator', device: 'Laptop · hele arrangementet', blurb: 'Koordinator har flere innkommende oppgaver enn hodet rommer. Skjermen svarer på «hva trenger meg nå?» før noe annet.' },
];

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildPage(screens, { css, fontCss }) {
  const date = new Date().toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
  const stamp = gitStamp();
  const data = screens.map(({ html, ...rest }) => rest);
  const templates = screens.map((s) => `<template id="tpl-${s.role}-${s.id}">${s.html}</template>`).join('\n');

  return `<!doctype html>
<html lang="nb">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>RKF feltverktøy</title>
<meta name="description" content="Rødt Kors Felt: patrulje, sykestue og koordinator, ferdig utfylt med demo-data. Statisk eksport for presentasjon.">
<style>
${fontCss}
:root {
  color-scheme: light;
  --bg: #f4f5f8; --surface: #fff; --sunken: #eaedf2; --text: #1a1d26; --muted: #5c6273; --border: #d9dde5;
  --brand: #e8112d; --brand-dim: rgba(232,17,45,.08); --ok: #166534; --ok-bg: rgba(22,101,52,.10);
  --sans: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --mono: 'IBM Plex Mono', Menlo, Consolas, monospace;
  --frame: #0f1319;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --bg: #0f1319; --surface: #171c24; --sunken: #0b0e13; --text: #e8ecf2; --muted: #a0a8b8; --border: #2c3441;
    --brand: #ff3b52; --brand-dim: rgba(255,59,82,.14); --ok: #4ade80; --ok-bg: rgba(74,222,128,.14); --frame: #2c3441;
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #0f1319; --surface: #171c24; --sunken: #0b0e13; --text: #e8ecf2; --muted: #a0a8b8; --border: #2c3441;
  --brand: #ff3b52; --brand-dim: rgba(255,59,82,.14); --ok: #4ade80; --ok-bg: rgba(74,222,128,.14); --frame: #2c3441;
}
* { box-sizing: border-box; }
html, body { height: 100%; }
body { margin: 0; background: var(--bg); color: var(--text); font-family: var(--sans); font-size: 16px; line-height: 1.5; padding-block: 0 48px; padding-inline: 16px; }
.wrap { max-width: 1440px; margin: 0 auto; }
header.masthead { display: flex; flex-wrap: wrap; align-items: center; gap: 16px 24px; padding-block: 20px 14px; border-bottom: 1px solid var(--border); }
.mark { width: 36px; height: 36px; border-radius: 6px; background: var(--brand); position: relative; flex-shrink: 0; }
.mark::before, .mark::after { content: ''; position: absolute; background: #fff; border-radius: 1px; }
.mark::before { width: 8px; height: 20px; left: 14px; top: 8px; } .mark::after { width: 20px; height: 8px; left: 8px; top: 14px; }
h1 { font-size: 22px; margin: 0; letter-spacing: -0.01em; }
.sub { color: var(--muted); font-size: 14px; margin: 2px 0 0; }
.meta { margin-left: auto; color: var(--muted); font-size: 13px; display: flex; flex-wrap: wrap; gap: 4px 16px; align-items: center; }
.meta code { font-family: var(--mono); font-size: 12px; }
.meta button { font: inherit; font-size: 13px; font-weight: 600; color: var(--text); background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 6px 12px; cursor: pointer; min-height: 36px; }
.roles { display: flex; gap: 8px; flex-wrap: wrap; padding-block: 16px 8px; }
.role { font: inherit; font-weight: 700; font-size: 15px; color: var(--muted); background: var(--surface); border: 1px solid var(--border); border-radius: 999px; padding: 10px 18px; cursor: pointer; min-height: 44px; }
.role[aria-selected="true"] { color: #fff; background: var(--text); border-color: var(--text); }
:root[data-theme="dark"] .role[aria-selected="true"], :root:not([data-theme="light"]) .role[aria-selected="true"] { color: var(--bg); }
.blurb { color: var(--muted); max-width: 70ch; margin: 4px 0 12px; text-wrap: pretty; }
.states { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
.state { font: inherit; font-size: 14px; font-weight: 600; color: var(--text); background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; cursor: pointer; min-height: 40px; }
.state[aria-selected="true"] { border-color: var(--brand); color: var(--brand); background: var(--brand-dim); }
.layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 24px; align-items: start; }
@media (max-width: 960px) { .layout { grid-template-columns: 1fr; } }
.stage { min-width: 0; }
.stage-inner { position: relative; }
.device { background: var(--surface); border: 10px solid var(--frame); border-radius: 22px; overflow: auto; contain: paint; transform-origin: top left; box-shadow: 0 20px 60px rgba(0,0,0,.18); }
.device.phone { border-width: 12px; border-radius: 34px; }
.device::-webkit-scrollbar { width: 8px; } .device::-webkit-scrollbar-thumb { background: rgba(127,127,127,.4); border-radius: 8px; }
.host { display: block; min-height: 100%; }
.notes { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; position: sticky; top: 16px; }
.notes .eyebrow { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin: 0 0 6px; }
.notes h2 { font-size: 18px; margin: 0 0 10px; }
.notes ul { margin: 0; padding-left: 18px; display: grid; gap: 8px; font-size: 14.5px; }
.notes .nav { display: flex; gap: 8px; margin-top: 16px; }
.notes .nav button { flex: 1; font: inherit; font-size: 14px; font-weight: 600; color: var(--text); background: var(--sunken); border: 1px solid var(--border); border-radius: 8px; padding: 10px; cursor: pointer; min-height: 44px; }
.notes .nav button:disabled { opacity: .4; cursor: default; }
.notes .device-label { font-family: var(--mono); font-size: 12px; color: var(--muted); margin-top: 14px; }
.caveat { margin-top: 24px; color: var(--muted); font-size: 13px; max-width: 80ch; }
.caveat b { color: var(--text); font-weight: 600; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
</style>
</head>
<body>
<div class="wrap">
  <header class="masthead">
    <div class="mark" aria-hidden="true"></div>
    <div>
      <h1>RKF feltverktøy</h1>
      <p class="sub">Én hendelse, tre roller: patrulje Alpha i løypa, sykestua og koordinator.</p>
    </div>
    <div class="meta">
      <span>Demo-data · ${esc(date)}</span>
      <code>${esc(stamp)}</code>
      <button type="button" id="theme-toggle" aria-pressed="false">Mørk side</button>
    </div>
  </header>

  <div class="roles" role="tablist" aria-label="Rolle" id="roles"></div>
  <p class="blurb" id="blurb"></p>
  <div class="states" role="tablist" aria-label="Skjermbilde" id="states"></div>

  <div class="layout">
    <div class="stage" id="stage"><div class="stage-inner" id="stage-inner"></div></div>
    <aside class="notes" aria-live="polite">
      <p class="eyebrow" id="notes-role"></p>
      <h2 id="notes-title"></h2>
      <ul id="notes-list"></ul>
      <div class="nav">
        <button type="button" id="prev">← Forrige</button>
        <button type="button" id="next">Neste →</button>
      </div>
      <div class="device-label" id="device-label"></div>
      <button type="button" id="frame-theme" class="state" style="margin-top:12px;width:100%">Vis skjermen i lys modus</button>
    </aside>
  </div>

  <p class="caveat"><b>Statisk eksport.</b> Skjermbildene er ekte DOM fra demo-bygget, ferdig utfylt, med app-ens egne stiler og fonter — teksten kan zoomes og markeres. Knapper og felt gjør ingenting her. Kartet er et bilde. Ingenting av dette er ekte pasientdata.</p>
</div>

${templates}

<script type="text/plain" id="app-css">${css.replace(/<\/script/gi, '<\\/script')}</script>
<script>
(function () {
  const ROLES = ${JSON.stringify(ROLES)};
  const SCREENS = ${JSON.stringify(data)};
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(document.getElementById('app-css').textContent);

  let roleIdx = 0, stateIdx = 0;
  const roleList = () => SCREENS.filter((s) => s.role === ROLES[roleIdx].id);
  const $ = (id) => document.getElementById(id);
  const tabs = $('roles'), states = $('states'), stageInner = $('stage-inner');
  let frameTheme = null; // null = as captured

  function render() {
    const role = ROLES[roleIdx];
    tabs.innerHTML = ROLES.map((r, i) => '<button type="button" class="role" role="tab" aria-selected="' + (i === roleIdx) + '" data-i="' + i + '">' + r.label + '</button>').join('');
    $('blurb').textContent = role.blurb;
    const list = roleList();
    states.innerHTML = list.map((s, i) => '<button type="button" class="state" role="tab" aria-selected="' + (i === stateIdx) + '" data-i="' + i + '">' + (i + 1) + '. ' + s.title + '</button>').join('');
    const s = list[stateIdx];
    $('notes-role').textContent = role.label + ' · ' + role.device;
    $('notes-title').textContent = s.title;
    $('notes-list').innerHTML = s.notes.map((n) => '<li>' + n + '</li>').join('');
    $('prev').disabled = stateIdx === 0 && roleIdx === 0;
    $('next').disabled = stateIdx === list.length - 1 && roleIdx === ROLES.length - 1;
    $('device-label').textContent = s.width + ' × ' + s.height + ' px · ' + ((frameTheme ?? s.theme) === 'dark' ? 'mørk modus' : 'lys modus');
    $('frame-theme').textContent = (frameTheme ?? s.theme) === 'dark' ? 'Vis skjermen i lys modus' : 'Vis skjermen i mørk modus';
    mount(s);
  }

  function mount(s) {
    stageInner.innerHTML = '';
    const device = document.createElement('div');
    device.className = 'device' + (s.width < 500 ? ' phone' : '');
    device.style.width = s.width + 'px';
    device.style.height = s.height + 'px';
    const theme = frameTheme ?? s.theme;
    device.setAttribute('data-theme', theme);
    const host = document.createElement('div');
    host.className = 'host';
    host.setAttribute('data-theme', theme);
    const root = host.attachShadow({ mode: 'open' });
    root.adoptedStyleSheets = [sheet];
    const inner = document.createElement('div');
    inner.className = 'rkf-root';
    inner.setAttribute('data-theme', theme);
    inner.appendChild(document.getElementById('tpl-' + s.role + '-' + s.id).content.cloneNode(true));
    root.appendChild(inner);
    device.appendChild(host);
    stageInner.appendChild(device);
    fit();
    device.scrollTop = s.scrollY || 0;
  }

  function fit() {
    const device = stageInner.firstElementChild;
    if (!device) return;
    const w = parseFloat(device.style.width) + 2 * parseFloat(getComputedStyle(device).borderLeftWidth);
    const h = parseFloat(device.style.height) + 2 * parseFloat(getComputedStyle(device).borderTopWidth);
    const scale = Math.min(1, $('stage').clientWidth / w);
    device.style.transform = 'scale(' + scale + ')';
    stageInner.style.height = (h * scale) + 'px';
  }

  tabs.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (!b) return; roleIdx = +b.dataset.i; stateIdx = 0; render(); });
  states.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (!b) return; stateIdx = +b.dataset.i; render(); });
  function step(dir) {
    const list = roleList();
    if (dir > 0) { if (stateIdx < list.length - 1) stateIdx++; else if (roleIdx < ROLES.length - 1) { roleIdx++; stateIdx = 0; } }
    else { if (stateIdx > 0) stateIdx--; else if (roleIdx > 0) { roleIdx--; stateIdx = roleList().length - 1; } }
    render();
  }
  $('prev').addEventListener('click', () => step(-1));
  $('next').addEventListener('click', () => step(1));
  document.addEventListener('keydown', (e) => { if (e.target.closest('input, textarea, select')) return; if (e.key === 'ArrowRight' || e.key === 'PageDown') step(1); if (e.key === 'ArrowLeft' || e.key === 'PageUp') step(-1); });
  $('frame-theme').addEventListener('click', () => { const s = roleList()[stateIdx]; frameTheme = (frameTheme ?? s.theme) === 'dark' ? 'light' : 'dark'; render(); });
  $('theme-toggle').addEventListener('click', () => {
    const root = document.documentElement;
    const dark = root.getAttribute('data-theme') === 'dark' || (!root.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
    root.setAttribute('data-theme', dark ? 'light' : 'dark');
    $('theme-toggle').textContent = dark ? 'Mørk side' : 'Lys side';
  });
  new ResizeObserver(fit).observe($('stage'));
  const hash = location.hash.replace('#', '');
  const ri = ROLES.findIndex((r) => r.id === hash);
  if (ri >= 0) roleIdx = ri;
  render();
})();
</script>
</body>
</html>
`;
}

const screens = await run();
const page = buildPage(screens, loadAppCss());
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, page);
console.log(`Wrote ${OUT} (${(Buffer.byteLength(page) / 1024 / 1024).toFixed(2)} MB, ${screens.length} screens)`);
