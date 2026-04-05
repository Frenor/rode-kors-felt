# API Load Testing

Kjør event-dag load test lokalt:

```bash
pnpm --filter @rkf/api test:load
```

Valgfrie terskler via miljøvariabler:

- `LOAD_TEST_BASE_URL` (default `http://localhost:4000`)
- `LOAD_TEST_P95_MAX_MS` (default `350`)
- `LOAD_TEST_RPS_MIN` (default `40`)
- `LOAD_TEST_ERROR_RATE_MAX` (default `0.01`)
- `LOAD_TEST_DURATION_SECONDS` (default `20`)
- `LOAD_TEST_CONNECTIONS` (default `25`)
- `LOAD_TEST_ACCESS_CODE` (default `123456`)
- `LOAD_TEST_REQUIRE_AUTH_SCENARIOS` (default `true`)

Eksempel for CI:

```bash
LOAD_TEST_P95_MAX_MS=300 LOAD_TEST_RPS_MIN=30 LOAD_TEST_ERROR_RATE_MAX=0.01 pnpm --filter @rkf/api test:load
```

Testen er ikke-destruktiv som standard:
- All trafikk er `GET`-kall.
- Kjører alltid `GET /health`.
- Hvis tilgangskode fungerer, kjører den også `GET /api/events` og `GET /api/incidents`.
- Hvis tilgangskode ikke fungerer og `LOAD_TEST_REQUIRE_AUTH_SCENARIOS=true`, feiler testen.
