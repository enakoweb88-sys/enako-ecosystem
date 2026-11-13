**ENAKO OS — Health Check, Release and Deployment Completion Report**

**Report date:** 7 November 2026, Africa/Douala  
**Scope:** The original health-check request and the subsequent explicitly approved release, database, Cloudflare, frontend and upload-availability work.  
**Overall result:** The backend starts successfully on Render and the public health endpoint returns HTTP 200. Full business-workflow and security sign-off remains pending.

**1. Original request and inspection**

The original problem was a Better Stack-confirmed HTTP 404 at https://api.enakoos.com/api/v1/health.

Inspection covered the NestJS bootstrap, global prefix, module registration, controller routing and global guards. The committed backend baseline b90985f already used the api/v1 prefix but did not contain the implemented HealthModule. A dedicated module, service, controller and test suite were added.

The health-check feature is distinct from the larger remediation release. The later release integrated legitimate existing uncommitted security changes following the owner's subsequent instructions. Those broader changes should not be described as necessary solely to add a health endpoint.

**2. Original requirement-by-requirement result**

| Requirement | Work completed | Evidence / limit |
|---|---|---|
| Inspect bootstrap, prefixes, modules and guards | Confirmed api/v1 prefix, registered HealthModule and checked global gateway/rate-limit behavior | Source reviewed in main.ts, app.module.ts and guards |
| Find an appropriate existing endpoint or add one | Implemented and registered GET /api/v1/health | Dedicated HealthController and module |
| Minimal healthy response | HTTP 200 with {"status":"ok"} | Automated HTTP tests and successful production request |
| Unhealthy dependency response | HTTP 503 with {"status":"unavailable"} | Tested locally; production database was not deliberately interrupted |
| Read-only, bounded PostgreSQL check | SELECT 1 in a read-only transaction with short timeouts | Service tests inspect the SQL and options |
| No sensitive health response | Errors are reduced to the minimal unavailable status | Tests inject private connection/error text and verify it is not returned |
| Unauthenticated monitoring | Health route bypasses gateway authentication and the database-backed limiter | Real-guard HTTP tests; public production request succeeded |
| Preserve protected-route security | Exemptions are scoped to health; an unrelated protected fixture still returns 401 | Automated regression test |
| Healthy/unhealthy automated tests | Eight health-specific tests cover behavior, deadlines, recovery and guards | Included in the 34-test unit suite |
| TypeScript, lint, tests and build | Completed relevant local verification | Detailed results below |
| Report files and changes | Health file table and full repository manifests included | Manifests distinguish health work from the integrated release |
| Obtain approval before publication/deployment | Publication followed later explicit push/release instructions | Owner operated Render and Cloudflare through guided steps |
| Avoid unrelated health-feature changes | Health-specific behavior is isolated; the wider release was separately authorized | Broader security integration is explicitly identified in this report |

**3. Health-check implementation**

**Public URL:** https://api.enakoos.com/api/v1/health

Healthy response:

~~~json
{"status":"ok"}
~~~

Unhealthy response:

~~~json
{"status":"unavailable"}
~~~

The controller sets the corresponding HTTP status and no-store caching. The service checks PostgreSQL through the existing Prisma architecture:

- SET TRANSACTION READ ONLY.
- Transaction-local statement timeout: 750 ms.
- SELECT 1; no customer/application records are read by this probe.
- Transaction acquisition maximum wait: 500 ms.
- Transaction timeout: 1,000 ms.
- Application response deadline: 1,500 ms.
- Concurrent health requests share a pending probe to avoid accumulating repeated database checks during an outage.

Transaction-local settings do not change persistent database configuration. Driver/database errors are handled without exposing connection strings, stack traces, credentials or infrastructure details in the health response.

The route is registered through HealthModule in AppModule under the existing api/v1 prefix. Its public marker exempts it from gateway verification. A separate health marker exempts it from the PostgreSQL-backed limiter, so a limiter/database outage cannot prevent the readiness service from producing its own bounded response.

Health-specific source files:

| File, relative to backend | Purpose |
|---|---|
| src/modules/health/health.controller.ts | Public route, status code, minimal JSON and no-store header |
| src/modules/health/health.service.ts | Read-only PostgreSQL probe, timeouts and shared pending check |
| src/modules/health/health.module.ts | Registers controller/service using PrismaModule |
| src/modules/health/health.spec.ts | Eight service and HTTP/guard regression tests |
| src/app.module.ts | Imports HealthModule |
| src/common/gateway-access.ts | Public-route metadata recognized by the gateway guard |
| src/common/http-rate-limit.guard.ts | Narrow health exemption from database-backed throttling |
| src/main.ts | Existing global prefix and production bootstrap reviewed; broader release also hardened bootstrap behavior |

**4. Authorized database preparation and backups**

The release was prepared against the locally configured Supabase PostgreSQL database. During deployment troubleshooting, the prepared connection's project identifier was independently compared with the owner's real Render connection and matched. Switching database logins did not create or redirect the application to a new Supabase project.

Completed database work recorded in the release evidence:

- Created an encrypted pre-cutover PostgreSQL archive before applying changes.
- Restored the application's public/auth dependencies to disposable local PostgreSQL and checked all 65 original application table counts.
- Rehearsed the reviewed migrations and role/RLS changes against that restore.
- Reconciled the baseline enum ordering with the existing schema without rebuilding the live enum.
- Applied the reviewed changes in a bounded transaction and recorded canonical Prisma migration history.
- Compared original-record digests before and after; original record contents and existing ownership mappings were preserved.
- Created the restricted enako_runtime login without superuser, RLS-bypass, database-creation, role-management or public-schema creation privileges.
- Enforced certificate-verified TLS for Supabase connections and validated the runtime credential.
- Rotated the new runtime password over verified TLS and verified the preceding runtime password was rejected.
- Created a second encrypted post-cutover backup, restored its public/auth dependencies locally, checked 77 public table counts and verified all three migration-history entries.

Recorded migrations:

| Migration | Result |
|---|---|
| 20261105000100_baseline | Verified existing schema and recorded baseline |
| 20261105000200_security | Applied and verified |
| 20261105000300_private_api | Applied and verified, including Donation protection |

The Prisma CLI migration-status connection timed out during the earlier cutover. Reviewed/rehearsed SQL and canonical migration history were instead applied transactionally through the PostgreSQL driver, followed by independent checksum verification. This report does not claim the CLI returned a clean status.

Private local backup directories:

- backend/.private-backups/cutover-2026-11-06-hL9OSi
- backend/.private-backups/post-cutover-2026-11-06-xFdhQc

Archives use AES-256-GCM; recovery keys are protected with Windows DPAPI for the current Windows profile. Backups and runtime secrets are excluded from Git and Docker build context. Local helpers support recovery and copying prepared settings without printing credentials.

Recovery limits: PostgreSQL dumps do not include external Supabase Storage object bytes or global role passwords. The local restore checks did not establish a one-click recovery of every managed Supabase platform component. Off-machine backup retention and separately protected portable recovery keys remain the owner's responsibility. Restoring must account for writes after the snapshots.

No reset, reseed, production table recreation or automatic Cash ownership remapping was performed.

**5. Independent application boundaries and frontend release**

ENAKO OS and Cash Dashboard remain separate applications. Infrastructure sharing does not grant cross-application access.

The integrated remediation introduced or preserved:

- Separate Cash identities, sessions, JWT secret/audience and explicit permission grants.
- Separate OS and Cash document/KYC stores and financial workflows.
- Server-side ownership checks and private document retrieval.
- Rejection of OS credentials on Cash endpoints and Cash credentials on OS endpoints.
- Removal of inappropriate personal Cash data/widgets from company OS paths in the integrated frontend work.
- Fixture-based checks for private tasks/objectives, assignments, private chat, reports and notification behavior.
- No automatic conversion of OS roles into Cash permissions.

Compatible frontend changes were published for OS and Cash. Production browser API traffic now stays on each website's own hostname, avoiding reliance on third-party Cloudflare cookies. Refresh, login, session-end requests, uploads/downloads and OS chat were updated accordingly. Separate edge proxies forward signed Access assertions to the fixed Render backend, where existing cryptographic and application-account checks remain active.

This does not establish that every existing Cash account, legacy record or grant has been provisioned correctly. That remains an independent owner-managed transition and live validation item.

**6. Cloudflare configuration completed with the owner**

The owner configured separate website Access applications:

- ENAKO OS: enakoos.com.
- Cash Dashboard: enakootc.com.
- Approved email policies and one-time PIN authentication were configured/reported by the owner.
- Separate OS and Cash audiences and the team domain were entered in Render.
- The existing API DNS record was already proxied through Cloudflare.

The owner deployed separate OS and Cash Worker sources and reported these routes configured with fail-closed behavior:

| Application | Worker route |
|---|---|
| OS API | https://enakoos.com/api/v1/* |
| OS chat | https://enakoos.com/socket.io/* |
| Cash API | https://enakootc.com/api/v1/* |

The owner also reported workers.dev and preview URLs disabled.

A separate public health-check Access application was configured at api.enakoos.com/api/v1/health using Bypass/Everyone. This exception is scoped to health; it is not a private-API bypass.

Proxy controls include fixed upstream routing, application-path separation, origin checks, signed-assertion forwarding, cookie/service-secret stripping, redirect refusal, streaming uploads/downloads and private/no-store responses. Public KYC/Outreach submission and callback routes remain on the shared API with their own backend validation.

Cloudflare settings were entered by the owner through the dashboard; this report is not a fresh API export of every policy. Real authenticated browser and WebSocket behavior still needs live verification.

**7. Render troubleshooting and successful startup**

The Docker image built successfully. Startup then surfaced configuration problems in sequence:

| Failure | Cause established | Correction |
|---|---|---|
| Mandatory JWT security configuration missing or invalid | Required signing/issuer/audience settings were not valid in the running environment | Verified prepared values and corrected environment-variable entry |
| Invalid authentication duration configuration | Token lifetime settings did not match the accepted format/policy | Set access TTL to 5m and refresh TTL to 2h |
| Restricted database role required | Render was using the postgres administrator login | Confirmed the same Supabase project, then supplied the existing restricted runtime-account connection |
| Duplicate keys during environment import | Import added rows for keys already present | Guided replacement/removal so each key has one intended value |
| Helper uploaded under Secret Files | Uploading a cmd helper does not execute it or populate environment variables | Corrected the workflow to run the helper locally and enter values under Environment Variables |

The new database credential belongs to the same verified Supabase project. The database, customer records and application history were not replaced by changing the connection login.

Final owner-supplied deployment logs show:

- 2026-11-07 01:39:16 UTC: Nest application successfully started.
- Backend listening on Render-assigned port 10000.
- 2026-11-07 01:39:24 UTC: Render reported the service live.

A subsequent independent public request confirmed HTTP 200 with {"status":"ok"}. A fresh request during preparation of this report confirmed the same result.

The last successful Render log excerpt does not contain a release SHA. The expected published backend release is 4f60628, but the exact successful live commit was not independently verified from final deployment metadata. Startup and public database-backed readiness are verified; commit provenance should still be checked in Render Events.

**8. Upload availability correction**

The earlier integrated release required a scanner for all uploads. The owner retained Render Free and declined paid scanner hosting. When the impact on client KYC was clarified, the owner explicitly requested that uploads remain available.

The correction was implemented and pushed before the final successful deployment sequence:

- In default auto mode, explicit FILE_SCANNER_EMBEDDED=false permits validated uploads without antivirus.
- FILE_SCANNER_MODE=required still requires scanning and rejects scanner outages or infection.
- Invalid scanning-mode configuration fails closed.
- File size/type/content restrictions, safe filenames, private storage, hashes and access checks remain.
- Skipped OS/Cash file scans are stored as UNSCANNED, never falsely marked CLEAN.
- Pending, failed and infected statuses are not made readable.
- Reports retain document-format support and now reject executable/HTML/SVG content through the shared validation rule.
- Authorization and separate application boundaries remain enforced.

Actual HTTP tests with a disposable database verified OS KYC, Cash KYC and employee report upload/download with scanning disabled.

Current limitation: antivirus scanning is disabled. Validation does not certify that a document is malware-free. Future required-scanner mode blocks previously unscanned private documents until an explicit rescan transition exists. No live client submission was created merely to test this release.

**9. Verification results**

| Check | Latest local result |
|---|---|
| Backend TypeScript | Passed |
| Backend lint | Zero errors; 49 existing warnings |
| Backend unit tests | 34 passed across 13 suites |
| Health-specific tests | Eight passed, included in the unit total |
| Backend security tests | 95 passed |
| Disposable database integration checks | 16 passed |
| Full HTTP integration groups | 10 passed, including disabled-scanner KYC/Cash/report uploads |
| Backend production build | Passed |
| Scanner startup lifecycle checks | Both disabled and enabled fixtures passed |
| Backend secret scan | Zero findings |
| OS TypeScript and production build | Passed |
| OS proxy tests | 10 passed |
| OS session/configuration regression groups | Five passed |
| OS existing finance/workspace tests | Eight passed, plus UI rendering checks |
| Cash TypeScript and production build | Passed |
| Cash proxy and auth/document tests | 22 passed |
| OS/Cash secret scans | Zero findings |
| Public production health request | HTTP 200, {"status":"ok"} |

The aggregate backend verification initially stopped because the sandbox could not create a temporary folder inside the protected local test directory. Database/HTTP integration was rerun with the required local filesystem permission and passed. A Windows Prisma DLL lock interrupted a concurrent build attempt; after the integration processes exited, the production build passed. These were local verification-environment issues, not additional production data migrations.

Hosted CI previously passed for backend commit 19e5f91, including Docker build and scanner-binary checks. This report does not claim the newest three repository releases have independently verified hosted-CI results; their stated verification above is local unless explicitly marked production.

Production 503 behavior was not tested by intentionally taking the real database offline. Local HTTP and timeout tests cover that failure path.

**10. Published release references**

All listed production publication was to main, preserving history without force-push. Matching integration branches were also pushed.

| Repository | Commit | Purpose |
|---|---|---|
| Backend | 00c2c91 | Integrated security boundaries and health module |
| Backend | 19e5f91 | Database cutover preparation, verified TLS and Docker/scanner support |
| Backend | ae1ff12 | Coordinated Access release documentation |
| Backend | 4f60628 | Upload availability correction; latest published backend release in this session |
| ENAKO OS | 3317d59 | Integrated frontend security and same-origin Access transport |
| Cash | 2883f19 | Independent Cash security and Access transport |

Backend commit: https://github.com/enakoweb88-sys/backend/commit/4f6062818ba6b144d1f3f62509e86dcd93e6a188

OS commit: https://github.com/enakoweb88-sys/enako-os/commit/3317d595e300a00ad7d918399cdc9ce9a680f98f

Cash commit: https://github.com/enakoweb88-sys/cash/commit/2883f199aee5e0d90fba02392d746a7e5e24c0fa

Earlier preparation commits used skip-render markers while the owner managed configuration. Later production pushes were expressly authorized and could trigger configured automatic deployments.

No other frontend repository is claimed published by these three release references. Older audit/status documents are dated snapshots; their statements that changes were uncommitted or not pushed are superseded by the actual commits and publication recorded here.

**11. Remaining work and limits**

The original health endpoint is implemented, registered, tested and publicly returning 200. That is not proof that every business workflow or security requirement is complete.

Remaining live acceptance work:

- Confirm the final successful Render SHA and the actual deployed OS/Cash frontend versions.
- Test every relevant role's login, refresh/logout and Cloudflare identity mapping.
- Confirm the CEO's distinct notification address works without changing the intended login identity.
- Exercise client KYC submission and authorized viewing/download using approved test documents.
- Exercise employee report upload, manager acceptance, automatic CEO forwarding, private review and download.
- Verify real email and in-system notification delivery, assignment visibility and private chat/WebSockets.
- Verify direct-origin denial and independent OS/Cash Access audiences in the deployed environment.
- Confirm separately provisioned Cash accounts/grants and owner-approved legacy record mapping.
- Keep scanner-disabled operation documented; antivirus remains deliberately deferred.
- Rotate the database administrator password exposed in the conversation, coordinating any remaining consumers. The restricted runtime credential is a different account.
- Retain encrypted backups off-machine and protect recovery keys separately.
- Review remaining moderate/low dependency findings and historical credential exposure.
- Complete provider/sandbox verification where contracts are missing; unsupported Orange/PixiPay and incomplete public-account/newsletter contracts were not declared operational.
- Verify any legacy public documents and storage objects requiring separately approved inventory/migration.

The health endpoint checks backend readiness and PostgreSQL connectivity. It does not verify scanner availability, email delivery, payment providers, all schema/business workflows, frontend deployment or a full independent security/compliance certification.

**12. Complete changed-file manifests**

The appendices below are generated from Git, not inferred from feature names. The backend comparison starts at b90985f and therefore includes carried-forward master-remediation work, not just health additions. OS and Cash comparisons cover their published integration releases from 74309d0 and 5cf0a1a respectively.

Private archives, encrypted configuration and private clipboard helpers are deliberately excluded from Git and these tracked-file manifests. Maintenance-script names in the manifest are not evidence that those scripts were executed against production.

This report itself is a new local documentation artifact. It has not been committed, pushed or deployed as part of generating the report.

**A. Backend ? 175 changed files**

~~~text
.dockerignore
.env.example
.github/workflows/verify.yml
.gitignore
Dockerfile
check_tables.js
config/README.md
config/clamd.conf
config/freshclam.conf
config/supabase-ca.crt
docs/master-remediation/access-api-transport-2026-11-07.md
docs/master-remediation/application-boundaries.md
docs/master-remediation/cash-identity-mapping.template.csv
docs/master-remediation/cash-record-mapping.template.csv
docs/master-remediation/checklist.md
docs/master-remediation/deployment-request-2026-11-05.md
docs/master-remediation/preflight.json
docs/master-remediation/production-cutover-plan.md
docs/master-remediation/production-release-2026-11-06.md
docs/master-remediation/publication-mode.md
docs/master-remediation/schema-readiness-2026-11-06.md
docs/master-remediation/security-control-status.md
docs/master-remediation/upload-availability-2026-11-07.md
docs/master-remediation/verification-snapshot.md
docs/security-remediation/batch-1.md
docs/security-remediation/change-register.md
docs/security-remediation/migration-and-rollback.md
docs/security-remediation/zero-trust-setup.md
enable_rls.js
eslint.config.js
fix-creds.ts
fix_rls.js
jest.config.cjs
package-lock.json
package.json
prisma/migrations/20261105000100_baseline/migration.sql
prisma/migrations/20261105000200_security/migration.sql
prisma/migrations/20261105000300_private_api/migration.sql
prisma/migrations/migration_lock.toml
prisma/schema.prisma
prisma/seed.ts
scripts/check-anthony.js
scripts/check-manager-details.js
scripts/check-recent-user.js
scripts/check-user-details.js
scripts/dependency-audit.cjs
scripts/enable-marketer-rls.js
scripts/fix-db-schema.js
scripts/local-postgres.cjs
scripts/maintenance-config.cjs
scripts/register-typescript.cjs
scripts/resend-welcome-chinji.js
scripts/run-security-tests.cjs
scripts/scan-secrets.cjs
scripts/send-confirmation-enakoweb88.js
scripts/send-welcome-chelsea.js
scripts/test-cash-security.cjs
scripts/test-email.js
scripts/test-marketer-endpoints.js
scripts/test-master-access.cjs
scripts/test-master-boundaries.cjs
scripts/test-master-database.cjs
scripts/test-master-http.cjs
scripts/test-private-chat.cjs
scripts/test-prod-clean-and-create.js
scripts/test-report-documents.cjs
scripts/test-scanner-startup.cjs
scripts/test-send-real-welcome.js
scripts/test-staff-redaction.cjs
scripts/test-welcome-email.js
scripts/update-and-resend-chinji.js
scripts/wipe-non-ceo-users.js
secure_rls.js
src/app.module.ts
src/common/application-boundary.ts
src/common/current-user.decorator.ts
src/common/database-connection.spec.ts
src/common/database-connection.ts
src/common/document-content.ts
src/common/document-scanner.ts
src/common/dtos.ts
src/common/gateway-access.ts
src/common/http-rate-limit.guard.ts
src/common/jwt-auth.guard.ts
src/common/permissions.ts
src/common/postgres-throttler.ts
src/common/request-security.ts
src/common/role-grants.ts
src/common/safe-exception.filter.ts
src/common/security-config.ts
src/common/serializable.ts
src/common/staff-response.dto.ts
src/common/upload-validation.ts
src/main.ts
src/modules/admin/admin.controller.spec.ts
src/modules/admin/admin.controller.ts
src/modules/admin/admin.service.spec.ts
src/modules/admin/admin.service.ts
src/modules/analytics/analytics.controller.ts
src/modules/auth/auth.controller.ts
src/modules/auth/auth.module.ts
src/modules/auth/auth.service.ts
src/modules/auth/jwt.strategy.ts
src/modules/bd/bd.controller.spec.ts
src/modules/bd/bd.controller.ts
src/modules/bd/bd.service.spec.ts
src/modules/bd/bd.service.ts
src/modules/cash-collections/cash-access.guard.ts
src/modules/cash-collections/cash-access.ts
src/modules/cash-collections/cash-auth.controller.ts
src/modules/cash-collections/cash-auth.service.ts
src/modules/cash-collections/cash-collections.controller.ts
src/modules/cash-collections/cash-collections.module.ts
src/modules/cash-collections/cash-collections.service.ts
src/modules/cash-collections/cash-files.service.ts
src/modules/cash-collections/cash-kyc.controller.ts
src/modules/cash-collections/cash-mail.service.ts
src/modules/cash-collections/cash-response.interceptor.ts
src/modules/cash-collections/cash-transactions.controller.ts
src/modules/cash-collections/cash-transactions.service.ts
src/modules/cash-collections/cash.dto.ts
src/modules/communications/communications.controller.ts
src/modules/communications/communications.gateway.ts
src/modules/communications/communications.service.ts
src/modules/dashboard/dashboard.controller.ts
src/modules/dashboard/dashboard.service.ts
src/modules/digital/digital.controller.spec.ts
src/modules/digital/digital.controller.ts
src/modules/digital/digital.service.spec.ts
src/modules/digital/digital.service.ts
src/modules/employees/employees.controller.ts
src/modules/employees/employees.service.ts
src/modules/expenses/expenses.controller.ts
src/modules/expenses/expenses.service.ts
src/modules/files/files.controller.ts
src/modules/files/files.module.ts
src/modules/files/private-files.controller.ts
src/modules/files/secure-files.service.ts
src/modules/finance/finance.controller.spec.ts
src/modules/finance/finance.controller.ts
src/modules/finance/finance.service.spec.ts
src/modules/finance/finance.service.ts
src/modules/health/health.controller.ts
src/modules/health/health.module.ts
src/modules/health/health.service.ts
src/modules/health/health.spec.ts
src/modules/kyc/kyc.controller.ts
src/modules/kyc/kyc.service.ts
src/modules/mail/mail.service.spec.ts
src/modules/mail/mail.service.ts
src/modules/meals/meals.controller.ts
src/modules/meals/meals.service.ts
src/modules/notifications/notifications.controller.ts
src/modules/outreach/donation-payments.service.ts
src/modules/outreach/mtn.service.ts
src/modules/outreach/outreach.controller.ts
src/modules/outreach/outreach.module.ts
src/modules/outreach/outreach.service.ts
src/modules/outreach/pixipay.service.ts
src/modules/prisma/prisma.module.ts
src/modules/prisma/prisma.service.ts
src/modules/public/public.controller.ts
src/modules/public/public.service.ts
src/modules/reports/report-alerts.service.ts
src/modules/reports/report-documents.service.ts
src/modules/subscriptions/subscriptions.service.ts
src/modules/support/support.controller.spec.ts
src/modules/support/support.controller.ts
src/modules/support/support.service.spec.ts
src/modules/support/support.service.ts
src/modules/transactions/transactions.controller.ts
src/modules/transactions/transactions.service.ts
src/modules/users/users.controller.ts
src/modules/users/users.service.ts
start.sh
~~~

**B. ENAKO OS ? 52 changed files**

~~~text
.github/workflows/verify.yml
edge/access-proxy.mjs
edge/copy-worker-code.cmd
edge/wrangler.jsonc
package-lock.json
package.json
scripts/scan-secrets.cjs
scripts/test-access-proxy.mjs
scripts/test-api-session.cjs
src/App.tsx
src/components/CashCollectionsWidget.tsx
src/layouts/DashboardLayout.tsx
src/lib/api/admin.ts
src/lib/api/cashCollections.ts
src/lib/api/core.ts
src/lib/api/index.ts
src/lib/api/outreach.ts
src/lib/api/transactions.ts
src/lib/auth.tsx
src/lib/private-documents.ts
src/pages/CashCollectionsPage.tsx
src/pages/Chat.tsx
src/pages/CreateCashTaskPage.tsx
src/pages/CreateExpensePage.tsx
src/pages/CreateSubscriptionPage.tsx
src/pages/CreateTransactionPage.tsx
src/pages/Dashboard.tsx
src/pages/Expenses.tsx
src/pages/Help.tsx
src/pages/KYC.tsx
src/pages/LogMealPage.tsx
src/pages/PendingExpensesPage.tsx
src/pages/Profile.tsx
src/pages/StaffMeals.tsx
src/pages/Subscriptions.tsx
src/pages/UpdateRatesPage.tsx
src/pages/WebsitesPage.tsx
src/pages/dashboards/AdminDashboard.tsx
src/pages/dashboards/CeoDashboard.tsx
src/pages/dashboards/DigitalDashboard.tsx
src/pages/dashboards/EngineeringDashboard.tsx
src/pages/dashboards/FinanceDashboard.tsx
src/pages/dashboards/outreach/OutreachScholarships.tsx
src/pages/quick-views/AuditedCashBatchesPage.tsx
src/pages/quick-views/KycPendingPage.tsx
src/pages/quick-views/RealTimeMetricsPage.tsx
src/pages/quick-views/SecurityAuditPage.tsx
src/pages/quick-views/TodaysMealOrdersPage.tsx
src/pages/quick-views/UnreadMessagesPage.tsx
src/services/authService.ts
src/services/geminiService.ts
vite.config.ts
~~~

**C. Cash Dashboard ? 22 changed files**

~~~text
.github/workflows/verify.yml
docs/security-batch-1.md
edge/access-proxy.mjs
edge/copy-worker-code.cmd
edge/wrangler.jsonc
package-lock.json
package.json
scripts/scan-secrets.cjs
scripts/test-access-proxy.mjs
src/App.tsx
src/api/cashApi.ts
src/components/CollectorsView.tsx
src/components/DashboardView.tsx
src/components/ExchangeRatesView.tsx
src/components/KycView.tsx
src/components/LoginView.tsx
src/components/NewCollectionView.tsx
src/components/TransactionsView.tsx
src/types.ts
src/utils/permissions.ts
test-cash-auth.cjs
test-fx-collectors.cjs
~~~
