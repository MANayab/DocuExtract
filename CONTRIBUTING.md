# Contributing

1. Use Node 20.
2. Install with `npm ci`.
3. Run `npm run typecheck && npm run lint && npm run test && npm run build` before submitting changes.
4. Do not add network calls, telemetry, storage of invoice contents, or server-side processing.
5. Keep the canonical invoice model in `src/types/invoice.ts`; UI components must not invent export schemas.
6. Add tests for extraction, normalization, validation, and security-sensitive export behavior.
