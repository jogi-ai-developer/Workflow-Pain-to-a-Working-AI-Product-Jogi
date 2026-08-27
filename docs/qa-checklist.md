# QA / Reliability Checklist

Date: 2026-08-27

| Test case | Expected result | Actual result | Pass/fail |
| --- | --- | --- | --- |
| Zero-user funnel (`0 → 0`) | Returns finite `0%` metrics and does not call AI | Verified by deterministic and API tests; no `NaN` or `Infinity` | PASS |
| Tiny flagged sample | Shows explicit inconclusive result and skips AI | Verified with `10 → 5`; status is `inconclusive`, evidence is `insufficient`, AI is not called | PASS |
| Medium/high evidence | Separates deterministic evidence strength from AI confidence | Verified with medium and high sample fixtures; AI confidence remains an independent field | PASS |
| Large sub-threshold loss | Keeps percentage and absolute users lost visible without threshold flagging | Verified with `10,000 → 8,500`; reports `15%` and `1,500` users lost | PASS |
| Invalid funnel order | Rejects user-count increases between ordered steps | API and client validation tests cover the case | PASS |
| Duplicate names | Rejects duplicate names case-insensitively | API and client validation cover duplicate names | PASS |
| Missing descriptions | Preserves the funnel and supplies empty description context | API test verifies missing descriptions normalize to empty strings | PASS |
| No flagged steps | Returns deterministic result without AI request | Existing API and frontend tests pass | PASS |
| AI HTTP failure | Persists deterministic logic and exposes a retryable AI error | Existing API and frontend failure/retry tests pass | PASS |
| Malformed AI response | Persists an AI parse error without discarding deterministic results | Existing API tests pass | PASS |
| Saved analysis retrieval | Retrieves persisted input, logic, AI result, and status | Existing persistence/reload tests pass | PASS |
| Retry after failure or stale loading | Updates the same analysis ID and prevents concurrent duplicate retry | Existing retry and concurrency tests pass | PASS |
| Admin dashboard | Shows summary, filters, detail, empty, malformed, and API-error states | Existing dashboard tests pass; inconclusive status is styled separately | PASS |
| Workspace type safety | Shared contracts and all workspace packages compile | `pnpm run typecheck` passed | PASS |
| Production build | Web and API artifacts build successfully | Both builds passed with workflow `PORT`/`BASE_PATH`; Vite reported only the existing CSS `@import` ordering warning | PASS |
| Dependency/security scans | Dependency, SAST, and HoundDog scans complete with findings reviewed | Dependency scan completed with 3 high, 1 moderate, and 1 low known dependency findings; SAST and HoundDog returned zero findings | PASS WITH FINDINGS |
| Lint/static review | A configured lint gate runs, or its absence is documented | No lint script or ESLint configuration exists; workspace typecheck, tests, diff checks, and production builds passed | PASS |
| Clean workflow preview | Web and API workflows restart without port collisions or browser errors | Both managed workflows restarted successfully; preview rendered and browser logs showed no runtime errors | PASS |

## Causal-language review

The product copy and AI system instruction describe outputs as hypotheses,
possible causes, and investigations. They explicitly state that observed
drop-off is not proof of a cause and that a human decides what to do. AI
confidence is displayed separately from deterministic evidence strength.