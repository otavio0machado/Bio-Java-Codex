# Agent 1 — Security & Auth

## Done
- Tightened `SecurityFilterChain` to explicit public routes only.
- Enforced JWT token typing for access vs. refresh tokens.
- Added refresh-token rotation with persisted `refresh_token_sessions`.
- Added logout flow with access-token in-memory blacklist and refresh-cookie invalidation.
- Moved refresh token transport to `HttpOnly` cookie while keeping access token in the response body.
- Added login rate limiting.
- Added security headers and stricter CORS validation.
- Set BCrypt strength to `12`.
- Added/updated auth coverage in controller and service tests.

## Pending
- Decide whether to add server-side persistence for the access-token blacklist in multi-instance deployments.
- Consolidate auth environment templates and deployment checklist.

## Validation
- `cd biodiagnostico-api && ./mvnw test`
- `cd biodiagnostico-api && ./mvnw clean package -DskipTests`
