export const meta = {
  name: 'web-release-review',
  description: 'Exhaustive release-readiness technical quality review of biodiagnostico-web (React/TS SPA)',
  phases: [
    { title: 'Inspect', detail: 'Run tsc/lint/test/audit and analyze build output' },
    { title: 'Review', detail: 'One reviewer per quality dimension reads the real code' },
    { title: 'Verify', detail: 'Adversarially verify each finding against cited code' },
    { title: 'Critique', detail: 'Completeness critic finds missed issues and cross-cutting gaps' },
  ],
}

const ROOT = '/Users/otaviodasilvamachado/Desktop/Bio Java Codex/biodiagnostico-web'

const SHARED = [
  'You are a senior product engineer auditing the React/TypeScript SPA at:',
  '  ' + ROOT,
  'This is "Biodiagnostico 4.0", a REAL lab Quality-Control (CQ/Controle de Qualidade) system in production use at a clinical laboratory. Domain concepts (load-bearing, never superficial): referencia, registro de medicao, lote (reagent lot), historico, media, desvio padrao, CV, status de CQ, Westgard rules, Levey-Jennings charts, calibracao, pos-calibracao. Areas: hematologia, imunologia, bioquimica, microbiologia, parasitologia, uroanalise. Reports V2 support signing + public verification by hash.',
  '',
  'STACK & ARCHITECTURE (verified orientation facts — but READ the actual files for evidence):',
  '- React 18.3 + Vite 8 + TypeScript 5.9, Tailwind v4 (@tailwindcss/vite), TanStack Query 5, react-hook-form 7 + @hookform/resolvers + zod 4, axios 1.13, react-router-dom 6.30, recharts 3, xlsx 0.18, lucide-react, react-markdown.',
  '- Entry main.tsx: ErrorBoundary > QueryClientProvider > BrowserRouter > AuthProvider > ToastProvider > ApiToastBridge > App. enforceCanonicalSiteUrl() runs BEFORE render and can short-circuit mounting. QueryClient: refetchOnWindowFocus false, retry 1.',
  '- App.tsx: all pages lazy-loaded via React.lazy + Suspense. Public routes /login, /reset-password, /r/verify/:hash; everything else behind PrivateRoute + AppLayout; /admin and /config behind RoleRoute roles ADMIN.',
  '- Auth (services/api.ts): access token kept in MODULE-SCOPE memory (let accessToken), refresh token is an httpOnly cookie (axios withCredentials true). Proactive refresh timer (0.8 of token lifetime) + reactive 401 -> refresh -> retry. 5xx/network requests retried up to 3x with backoff. redirectToLogin via window.location.href on refresh failure. emitApiError -> ApiToastBridge surfaces toast.',
  '- AuthContext restores session on mount by calling refreshToken with empty refreshToken.',
  '- Runtime config (services/runtimeConfig.ts): window.__APP_CONFIG__ injected by /config.js (generated at container start from config.js.template). Falls back to VITE_API_URL build arg, then localhost:8080/api, then /api. Dev uses Vite proxy /api -> 8080.',
  '- Permissions (lib/permissions.ts): roles ADMIN, FUNCIONARIO, VIGILANCIA_SANITARIA, VISUALIZADOR + granular perms (QC_WRITE, REAGENT_WRITE, MAINTENANCE_WRITE, DOWNLOAD, IMPORT).',
  '- Deploy: multi-stage Dockerfile (node20-alpine build -> nginx 1.27-alpine). nginx.conf.template has security headers, gzip, asset caching, SPA fallback, /health. docker-entrypoint.d/40-generate-seo.sh generates config.js + robots.txt + sitemap.xml at boot. Railway (railway.toml, PORT env).',
  '- Tests: Vitest + Testing Library + jsdom. Test files exist for a subset of components only.',
  '',
  'SOURCE INVENTORY: 120 .ts/.tsx files, ~18.7k LOC. Largest files: proin/ImunologiaArea.tsx 1104, reagentes/ReagentsContent.tsx 1038, pages/AdminPage.tsx 786, proin/ManutencaoTab.tsx 729, proin/RegistroTab.tsx 712, types/index.ts 696, reagentes/ReagentModals.tsx 637, proin/HematologiaArea.tsx 609, proin/ReagentesTab.tsx 571, relatoriosV2/ExecutionsTable.tsx 539, proin/AreaQcModule.tsx 529.',
  '',
  'RULES FOR YOUR OUTPUT:',
  '- Ground EVERY finding in real code you actually read. Quote file path + line numbers (file.tsx:NN). No generic best-practice lectures unconnected to this code.',
  '- This app is in PRODUCTION and a regulated/clinical context — weigh correctness, security, data-integrity, and auditability heavily.',
  '- Do NOT edit files. This is read-only analysis; "fix" is a description of what should change.',
  '- Prefer fewer, high-signal findings over a long list of trivia, but do not miss real release blockers.',
  '- Priority: Critical (blocks release / data-integrity / security / breaks in prod), High (fix before release), Medium (fix soon after), Low (polish).',
].join('\n')

const FINDING_PROPS = {
  title: { type: 'string', description: 'Short, specific finding title' },
  category: { type: 'string', description: 'The quality dimension/category' },
  priority: { type: 'string', enum: ['Critical', 'High', 'Medium', 'Low'] },
  location: { type: 'string', description: 'file path(s) with line numbers, e.g. src/services/api.ts:88' },
  evidence: { type: 'string', description: 'Concrete code-grounded evidence: quote or precise description of what is in the file' },
  why: { type: 'string', description: 'Why it matters for a production release' },
  fix: { type: 'string', description: 'Concrete suggested fix (description only, do not edit)' },
  confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
}

const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: { type: 'object', properties: FINDING_PROPS, required: ['title', 'category', 'priority', 'location', 'evidence', 'why', 'fix', 'confidence'] },
    },
    positives: { type: 'array', items: { type: 'string' }, description: 'Things genuinely done well in this dimension' },
    notes: { type: 'string' },
  },
  required: ['findings'],
}

const VERIFIED_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ...FINDING_PROPS,
          verdict: { type: 'string', enum: ['confirmed', 'adjusted', 'refuted'] },
          verifierNote: { type: 'string', description: 'What you checked and the result' },
        },
        required: ['title', 'category', 'priority', 'location', 'evidence', 'why', 'fix', 'confidence', 'verdict'],
      },
    },
  },
  required: ['findings'],
}

const DIMENSIONS = [
  {
    key: 'architecture',
    label: 'Architecture, folders, naming, maintainability',
    prompt: [
      'DIMENSION: Architecture & folder structure, module boundaries, naming conventions, separation of concerns, long-term maintainability.',
      'Read broadly: tsconfig.json/tsconfig.app.json/tsconfig.node.json, package.json, README.md, docs/, and sample the src tree — App.tsx, main.tsx, the folder layout under src/ (components, pages, hooks, services, lib, contexts, types, utils, styles). Open the largest components (proin/ImunologiaArea.tsx, reagentes/ReagentsContent.tsx, pages/AdminPage.tsx, proin/ManutencaoTab.tsx, proin/RegistroTab.tsx, proin/HematologiaArea.tsx) to judge component size/cohesion.',
      'Look for: god components (>500 lines doing too much), inconsistent layering (components calling axios directly vs via services/hooks), mixed PT/EN naming, folder organization that will not scale (relatoriosV2 vs proin vs reagentes coexistence; "V2" naming implying a stranded V1), import hygiene, circular-dependency risk, where domain/CQ logic lives (is the CQ math in components or isolated/tested?), consistency of file/symbol naming.',
    ].join('\n'),
  },
  {
    key: 'components',
    label: 'Components, UI library, duplicated & dead code',
    prompt: [
      'DIMENSION: Component design, the in-house UI kit, duplicated code, and dead code.',
      'Read: src/components/ui/* (Button, Card, Input, Select, TextArea, FormField, Modal, Toast, StatusBadge, StatCard, Combobox, Skeleton, EmptyState, LoadingSpinner, index.ts), and survey components/proin/*, components/proin/reagentes/*, components/relatoriosV2/*, components/charts/*, components/layout/*.',
      'Look for: duplicated UI patterns that should be shared components (repeated modal/table/badge/status logic across HematologiaArea, ImunologiaArea, areas, reagentes), copy-pasted helpers (multiple date/number/status formatters — check utils/ vs inline), components/exports never imported (dead code — grep usages to confirm before claiming), commented-out blocks, leftover V1 vs V2 duplication, prop-drilling vs context. For duplication cite the 2+ concrete locations.',
    ].join('\n'),
  },
  {
    key: 'flows-routing',
    label: 'User flows, routing, navigation, auth/session flow',
    prompt: [
      'DIMENSION: User flows, routing, navigation guards, and the authentication/session lifecycle as experienced by users.',
      'Read: App.tsx, main.tsx, components/layout/AppLayout.tsx, Navbar.tsx, PrivateRoute.tsx, RoleRoute.tsx, contexts/AuthContext.tsx, contexts/auth-context.ts, hooks/useAuth.ts, pages/LoginPage.tsx, pages/ResetPasswordPage.tsx, pages/VerifyReportPage.tsx, services/authService.ts, services/api.ts.',
      'Look for: gaps in route protection, loading/redirect race conditions (AuthProvider isLoading vs PrivateRoute — flash of login or of protected content before session restore resolves?), hard refresh of a deep link, logout completeness (in-memory token + is React Query cache cleared on logout?), 401 redirect using window.location.href (full reload, loses SPA state and unsaved form data), RoleRoute behavior for unauthorized users (redirect vs 403), back-button/deep-link behavior, unsaved-changes protection on forms.',
    ].join('\n'),
  },
  {
    key: 'forms-validation',
    label: 'Forms and data validation',
    prompt: [
      'DIMENSION: Forms and data validation (react-hook-form + zod + @hookform/resolvers).',
      'Read: lib/authSchemas.ts, components/proin/reagentes/schemas.ts, components/proin/RegistroTab.tsx, components/proin/ReferenciasTab.tsx, components/relatoriosV2/DynamicFilterForm.tsx, components/proin/reagentes/ReagentModals.tsx, ui/FormField.tsx, ui/Input.tsx, ui/Select.tsx, ui/TextArea.tsx, pages/LoginPage.tsx, pages/ResetPasswordPage.tsx, pages/ConfiguracaoPage.tsx. Grep for useForm, zodResolver, register, parseFloat, Number(.',
      'Look for: forms WITHOUT validation schemas, numeric/decimal inputs for CQ measurements parsed unsafely (parseFloat without NaN guard, PT-BR comma vs dot decimals), missing client-side bounds on critical lab values, inconsistent error display, missing required/disabled-while-submitting/double-submit protection, accessibility of validation errors (aria-invalid, aria-describedby, label association), and the trust boundary (is client validation the only guard or duplicated server-side?). CQ data-entry correctness is paramount.',
    ].join('\n'),
  },
  {
    key: 'system-comm',
    label: 'System communication (API layer, services, data fetching)',
    prompt: [
      'DIMENSION: Client/server communication — the axios layer, service modules, and TanStack Query usage.',
      'Read: services/api.ts, all services/* files, lib/apiEvents.ts, and the hooks/* that wrap React Query (useReagents, useQcRecords, useReportsV2, useReports, useAreaQc, useHematology, useImmunology, useMaintenance, useDashboard, useAdmin, useLabSettings, useAiAnalysis).',
      'Look for: the refresh/retry logic in api.ts (race conditions; note the response interceptor retries ALL methods incl. POST/PUT mutations on network/5xx, which can DOUBLE-SUBMIT non-idempotent requests — flag explicitly if present), error handling consistency across services, query-key hygiene (stable keys, cache invalidation after mutations), missing loading/error states, request cancellation, N+1 patterns, hard-coded URLs vs centralized api instance, response typing (any vs typed; runtime validation vs blind cast).',
    ].join('\n'),
  },
  {
    key: 'persistence-config-errors',
    label: 'Persistence, runtime configuration, error handling',
    prompt: [
      'DIMENSION: Client-side persistence, runtime configuration, and error handling/observability.',
      'Read: services/runtimeConfig.ts + runtimeConfig.test.ts, components/ErrorBoundary.tsx, components/ApiToastBridge.tsx, components/ui/Toast.tsx + toast-context.ts + useToast.ts, public/config.js.template and any public/*.template, docker-entrypoint.d/40-generate-seo.sh. Grep src for localStorage, sessionStorage, document.cookie, window.__APP_CONFIG__, and empty catch blocks.',
      'Look for: where auth/session state lives (in-memory token lost on refresh — UX impact?), sensitive data in localStorage, runtime-config edge cases (placeholder host handling, mixed-content http API from https site, missing config.js -> what breaks?), ErrorBoundary coverage (does it cover lazy-route chunk-load failures on a stale deploy? does it offer reload/recovery?), absence of error reporting/monitoring (no Sentry/telemetry?), swallowed errors, toast error UX. Note chunkload-on-redeploy risk for a lazy-loaded SPA.',
    ].join('\n'),
  },
  {
    key: 'deps-build-deploy',
    label: 'Dependencies, build, deployment',
    prompt: [
      'DIMENSION: Dependencies, build pipeline, and deployment configuration.',
      'Read: package.json, Dockerfile, nginx.conf.template, railway.toml, docker-entrypoint.d/*, vite.config.ts, vitest.config.ts, eslint.config.js, tsconfig*.json, scripts/*, .env / .env.example / .env.production / .env.railway.example, .dockerignore, .gitignore. You may run read-only: "npm outdated" and "npm audit --omit=dev". Do NOT run a build or anything that writes to src/ or dist/.',
      'Look for: pinning strategy (all caret ranges; is package-lock committed? yes), known-risky deps (xlsx 0.18.5 has well-known prototype-pollution/ReDoS advisories with NO fixed npm release — flag as security), Vite 8 and other very-new majors stability, missing CI config, Dockerfile correctness (build-time VITE_API_URL baked default http://localhost:8080/api vs runtime config.js — is the baked localhost default a prod footgun?), nginx template correctness, secrets in .env files (real secrets committed?), node version pinning, lack of bundle-size budget. Report actual npm audit summary counts if you run it.',
    ].join('\n'),
  },
  {
    key: 'responsive-a11y-seo',
    label: 'Responsive design, accessibility, SEO',
    prompt: [
      'DIMENSION: Responsive design, accessibility (WCAG), and SEO.',
      'Read: index.html, public/manifest.webmanifest, public/robots.txt.template, public/sitemap.xml.template, styles/globals.css, styles/tokens.ts, tailwind.config.ts, components/layout/Navbar.tsx (mobile menu), components/ui/Modal.tsx (focus trap / Esc / aria-modal), components/ui/Combobox.tsx (keyboard a11y), ui/Button.tsx, ui/FormField.tsx. Grep for aria-, role=, alt=, htmlFor, tabIndex, sr-only, table tag.',
      'Look for: responsive gaps (large data tables ExecutionsTable, AdminPage on mobile; horizontal scroll/overflow; fixed widths), a11y issues (icon-only lucide buttons without aria-label; modals without focus management/escape/aria-modal; form fields without associated labels; color-only status in StatusBadge; missing skip-link; heading order; keyboard nav of Combobox/menus; images without alt), SEO (this is an authenticated/gated app — judge appropriately: robots/sitemap presence, meta description, lang attr, and note there is NO per-route document.title/head management).',
    ].join('\n'),
  },
  {
    key: 'performance',
    label: 'Performance and bundle',
    prompt: [
      'DIMENSION: Runtime performance and bundle size.',
      'Read: App.tsx (lazy/Suspense), main.tsx (QueryClient config), vite.config.ts, and inspect the ALREADY-BUILT output: run "ls -la dist/assets" and "ls -la dist" to read chunk sizes (do NOT rebuild). Open heavy-import sites: anything importing xlsx, recharts (charts/LeveyJenningsChart.tsx, LeveyJenningsModal.tsx), react-markdown, lucide-react. Survey the largest components for re-render cost (ImunologiaArea, ReagentsContent, AdminPage, ExecutionsTable).',
      'Look for: large vendor chunks (xlsx, recharts, react-markdown are heavy — bundled in main or lazy?), missing manualChunks/code-splitting in vite, no bundle-size budget, expensive renders (missing useMemo/useCallback on big lists/derived CQ stats, inline object/array props, key usage), unnecessary refetches, absence of list virtualization on big tables, heavy image assets in public/. Cite actual dist chunk sizes you observe.',
    ].join('\n'),
  },
  {
    key: 'typing',
    label: 'TypeScript typing and type safety',
    prompt: [
      'DIMENSION: TypeScript type-safety rigor.',
      'Read: tsconfig.app.json (strict flags), types/index.ts, types/reportsV2.ts, services/api.ts typing, lib/apiEvents.ts. Grep across src for: ": any", "as any", " as ", "@ts-ignore", "@ts-expect-error", non-null assertions "!", "eslint-disable".',
      'Look for: use of any / as any (especially around API responses, xlsx, recharts, event payloads), unsafe non-null assertions (e.g. getElementById root !), casts that bypass the type system, whether API responses are validated at runtime (zod) or blindly cast to types (trust-the-server typing), tsconfig strictness gaps (strict? noUncheckedIndexedAccess? exactOptionalPropertyTypes?), any leaking through generics. Count occurrences and cite the worst offenders with file:line.',
    ].join('\n'),
  },
  {
    key: 'testing-docs',
    label: 'Testing coverage and documentation',
    prompt: [
      'DIMENSION: Automated test coverage and documentation quality.',
      'Read: all *.test.ts/*.test.tsx files, vitest.config.ts, src/test/setup.ts, README.md (root + biodiagnostico-web/README.md), DEPLOY_TUTORIAL.md, docs/, CLAUDE.md, AGENTS.md. List which areas/components HAVE tests vs the inventory, and judge what is actually tested (CQ math? Westgard? auth? reagent lot logic? forms?).',
      'Look for: critical UNTESTED logic — especially the load-bearing CQ domain math (media/DP/CV/Westgard/Levey-Jennings, calibracao/pos-calibracao), reagent lot lifecycle, the auth/refresh/retry interceptor in api.ts (complex + risky — tested?), permissions.ts. Note there is no coverage threshold/CI gate visible. Assess docs: can a new engineer set up/deploy/configure runtime from the docs; is there an architecture doc; are domain rules written down. Cite the test files that exist and the high-risk modules with zero tests.',
    ].join('\n'),
  },
]

phase('Inspect')
const healthPromise = agent(
  [
    SHARED,
    '',
    'TASK: Run READ-ONLY health/build tooling and report concrete results as findings. Working directory: ' + ROOT + '.',
    'Run these (each is safe and does NOT modify src or dist):',
    '1. npx tsc -p tsconfig.app.json --noEmit   (type-check; report error count + first ~15 errors)',
    '2. npm run lint   (eslint; report error/warning counts + notable rules)',
    '3. npm test   (vitest run; report pass/fail counts, any failing tests, and whether the suite terminates)',
    '4. npm audit --omit=dev   (vuln counts by severity + named packages; if it needs network and fails, say so)',
    '5. npm outdated   (majors behind for key deps)',
    '6. ls -la dist && ls -la dist/assets   (largest JS/CSS chunk sizes; flag any single chunk > 500kb)',
    'Do NOT run "npm run build", "vite build", or anything that writes to src/ or dist/. Do NOT install or update anything.',
    'Return findings (category "Build & tooling") for anything broken/risky (type errors, failing tests, lint errors, vulns, oversized chunks, stale majors). Put raw tool summaries (counts, key lines) into evidence. If a command cannot run (e.g. no network for audit), record that as a finding. In notes, give the exact pass/fail status of tsc, lint, and test.',
  ].join('\n'),
  { label: 'inspect:health', phase: 'Inspect', schema: FINDINGS_SCHEMA, agentType: 'general-purpose' },
)

const reviewed = await pipeline(
  DIMENSIONS,
  (d) =>
    agent(
      [
        SHARED,
        '',
        d.prompt,
        '',
        'Return your findings via the schema. category for every finding = "' + d.label + '". Be exhaustive within THIS dimension but only report code-grounded, real issues.',
      ].join('\n'),
      { label: 'review:' + d.key, phase: 'Review', schema: FINDINGS_SCHEMA },
    ),
  (review, d) => {
    if (!review || !review.findings || review.findings.length === 0) {
      return { findings: [], _positives: (review && review.positives) || [], _notes: (review && review.notes) || '' }
    }
    const list = review.findings
      .map((f, i) => '[#' + (i + 1) + '] (' + f.priority + ') ' + f.title + '\n  location: ' + f.location + '\n  evidence: ' + f.evidence + '\n  why: ' + f.why + '\n  fix: ' + f.fix + '\n  confidence: ' + f.confidence)
      .join('\n\n')
    return agent(
      [
        SHARED,
        '',
        'You are an ADVERSARIAL verifier for the dimension "' + d.label + '". A reviewer produced the findings below. For EACH finding, OPEN the cited file(s) at the cited lines and check: (a) is the evidence factually accurate (does the code actually say/do this)? (b) is the issue real and correctly prioritized for a production release, or overstated/misattributed?',
        'Default to skepticism: if you cannot confirm the evidence in the actual file, mark it refuted. Correct location/evidence/priority when the reviewer was imprecise but the underlying issue is real (verdict "adjusted"). Keep confirmed real issues as "confirmed". Every input finding must appear with a verdict. Do not invent NEW findings here.',
        '',
        'FINDINGS TO VERIFY:',
        list,
        '',
        'Return all findings with an added verdict (confirmed/adjusted/refuted) and a short verifierNote. Keep category = "' + d.label + '".',
      ].join('\n'),
      { label: 'verify:' + d.key, phase: 'Verify', schema: VERIFIED_SCHEMA },
    ).then((v) => ({
      findings: (v && v.findings) || [],
      _positives: review.positives || [],
      _notes: review.notes || '',
    }))
  },
)

const health = await healthPromise

const verifiedFindings = []
const positivesByDim = {}
const dimNotes = {}
reviewed.filter(Boolean).forEach((r, idx) => {
  const dimLabel = DIMENSIONS[idx] ? DIMENSIONS[idx].label : 'unknown'
  positivesByDim[dimLabel] = r._positives || []
  dimNotes[dimLabel] = r._notes || ''
  ;(r.findings || []).forEach((f) => {
    if (f.verdict === 'refuted') return
    verifiedFindings.push(f)
  })
})
const healthFindings = (health && health.findings) || []
healthFindings.forEach((f) => verifiedFindings.push({ ...f, verdict: 'confirmed' }))

phase('Critique')
const titles = verifiedFindings.map((f) => '- [' + f.priority + '] (' + f.category + ') ' + f.title + ' @ ' + f.location).join('\n')
const critic = await agent(
  [
    SHARED,
    '',
    'A multi-agent review already produced the confirmed findings listed below (titles only). Your job is COMPLETENESS: find REAL, code-grounded issues that were MISSED, or important cross-cutting concerns no single dimension owned. Read whatever files you need to substantiate new findings. Check specifically: i18n/hardcoded PT strings, timezone/date handling in utils/date.ts, money/number locale parsing, security headers vs CSP absence, CSRF posture given cookie auth + withCredentials, file-upload/xlsx import safety, print/PDF report flows, empty/error/loading-state consistency, the VoiceRecorderModal + AI analysis flow, the report signing/verification security model, accidental console.log/debug code, TODO/FIXME markers, .env secrets.',
    'ONLY return findings you can substantiate by reading the actual code (cite file:line). Do NOT restate existing findings below. If a whole dimension looks under-covered, add the specific missing issue, not a meta-comment.',
    '',
    'EXISTING FINDINGS:',
    titles,
    '',
    'Return new findings via the schema. Set category to the most fitting dimension name.',
  ].join('\n'),
  { label: 'critique:completeness', phase: 'Critique', schema: FINDINGS_SCHEMA, agentType: 'general-purpose' },
)

const criticFindings = ((critic && critic.findings) || []).map((f) => ({ ...f, verdict: 'confirmed', source: 'critic' }))
criticFindings.forEach((f) => verifiedFindings.push(f))

log('Review complete: ' + verifiedFindings.length + ' findings across ' + DIMENSIONS.length + ' dimensions (+health +critic).')

return {
  findings: verifiedFindings,
  positivesByDim,
  dimNotes,
  healthNotes: (health && health.notes) || '',
  counts: {
    total: verifiedFindings.length,
    critical: verifiedFindings.filter((f) => f.priority === 'Critical').length,
    high: verifiedFindings.filter((f) => f.priority === 'High').length,
    medium: verifiedFindings.filter((f) => f.priority === 'Medium').length,
    low: verifiedFindings.filter((f) => f.priority === 'Low').length,
  },
}
