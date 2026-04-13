# Agent 4 — Frontend Hardening

## Done
- Added global `ErrorBoundary` with retry/reload fallback.
- Removed token persistence from browser storage.
- Switched frontend auth flow to access token in memory plus refresh through backend cookie.
- Added Axios `withCredentials`, 5xx/network retry with exponential backoff, friendly network/server toasts, and 401 refresh handling.
- Migrated login and reset-password forms to `react-hook-form + zod`.
- Fixed existing lint violation in `Modal.tsx`.

## Pending
- Expand `react-hook-form + zod` to the remaining data-entry screens.
- Add loading/empty/error differentiation across remaining CQ tabs.
- Review `LeveyJenningsChart` and `xlsx` chunk sizes for next performance pass.
- Add `.env.example`/deploy docs refinements and remove operational reliance on tracked `.env.production`.

## Validation
- `cd biodiagnostico-web && npm run lint`
- `cd biodiagnostico-web && npm run build`
