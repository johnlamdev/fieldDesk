# FieldDesk public mobile testing review — 2026-10-06

## Decision

No public deployment was made. The source review found no actual secrets or real customer records. This is conditional readiness for a private-account, fictional-data internet test, not a production certification. Local migration/authentication checks passed; hosted environment and real-device checks remain required before field use.

## Architecture and findings

- Next.js 16.3.8 App Router, React 19.3, TypeScript; server-rendered pages and React Server Actions. Better Auth routes live under `/api/auth`. Prisma 6.19.3 accesses PostgreSQL; there is no separate API server.
- Reviewed source, schema, migrations, scripts, tests, package lock, docs and configuration. No `.env` file was found in the repository; `.env.example` contains placeholders. No actual API keys, passwords, provider tokens, private external URLs, source exports or real customer data were found. Local credentials are generated outside the repository; their values were not read or exported.
- Local Git has zero commits. Authenticated `git ls-remote origin` completed with no advertised refs. There is no reachable published history to scan at this time; deleted/inaccessible GitHub objects cannot be assessed. All application files are currently untracked, so they must be deliberately committed before automatic deployment can work.
- `.gitignore` correctly excludes env files, node_modules, Next build output, database dumps and spreadsheets, while permitting `.env.example`. Added Vercel metadata, private-key files, logs and SQL dumps. Prisma migration SQL has an explicit allow rule, so the initial untracked migrations can be committed normally.
- Public sign-up is disabled. Staff creation is administrator-only; database writes check roles on the server. Technician visit access checks assignment. Prisma queries are structured and text is rendered by React; no raw SQL user-input interpolation or HTML injection was found.
- Better Auth's default production rate limit used per-instance memory. Changed storage to PostgreSQL with a dedicated migration to share limits across serverless instances. This is basic abuse mitigation, not comprehensive DDoS protection.
- Accounts store password hashes, session tokens, IP addresses and user agents. These are private runtime data even when CRM records are fictional. Never publish a database dump or account password. Free-text forms cannot enforce fictional-only input, so a visible test notice has been added.
- Public login is intentional, authenticated records are not anonymous. Robots/noindex is not access control. No uploads, camera feature, customer password vault or external integration exists.

## Hosting recommendation

Use Vercel for the existing Node/Next.js app and a fresh Neon PostgreSQL test project. Vercel provides GitHub deployments and HTTPS without an adapter. Its Hobby plan is limited to personal/non-commercial use; do not assume a business pilot qualifies merely because it uses synthetic data. Confirm eligibility before choosing Hobby. Neon has a free tier with quotas and idle cold starts. Do not upgrade or attach paid services for this prototype.

Cloudflare Pages static hosting cannot execute these Server Actions/auth/database workflows. Cloudflare Workers supports Next.js via OpenNext, but adds adapter/runtime work; it is not the smallest change for this project.

Sources: https://vercel.com/docs/git , https://vercel.com/docs/plans/hobby , https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/ , https://neon.com/pricing , https://better-auth.com/docs/concepts/rate-limit

## Minimal deployment steps after review

1. Create a new Neon database containing only fictional testing records. Do not migrate or restore the private local database. Choose nearby available hosting/database regions. Copy the pooled PostgreSQL connection string with TLS; append `connection_limit=1` for this low-traffic Prisma 6 serverless prototype.
2. Keep credentials in a private environment file outside Git. With the NEW test database connection loaded, run `npm run db:deploy`. Never use `prisma migrate reset` on the hosted database. A direct Neon connection can be used for this operator migration step.
3. Create the first test administrator using `NEW_USER_PASSWORD` and `npm run user:add -- admin.demo@example.com 示範管理員 admin`. Use a new private password of at least 12 characters; remove the password environment variable afterward. The existing demo seed intentionally remains local-only. Create fictional cases and other test roles through the authenticated UI.
4. Commit the reviewed source to GitHub. Import `johnlamdev/fieldDesk` in Vercel, use Node 22 and the included `vercel.json`; no custom domain or extra CI infrastructure is needed.
5. Set only server-side `DATABASE_URL`, a freshly generated `BETTER_AUTH_SECRET` (32+ random characters), and `BETTER_AUTH_URL` equal to the exact stable HTTPS deployment origin. Never prefix these with `NEXT_PUBLIC_`. Pick/reserve the stable project hostname before the first deploy. Do not put secrets in this document, GitHub source, CLI arguments or chat.
6. For the minimal first setup, provision credentials only to Vercel's Production environment (this is Vercel's environment name, not a claim that the app is production-ready). Disable branch preview builds in the Vercel project if no isolated preview database is configured. Never expose these credentials to untrusted PR/preview code or add wildcard trusted origins.
7. Build uses `prisma generate && next build`. Migrations are deliberately an operator step, not part of every preview build; run `db:deploy` against the hosted test DB before a future schema-changing main-branch deployment. Ordinary main pushes automatically build/deploy to the stable URL after Git integration is connected.
8. Verify HTTPS, private sign-in, role restrictions, secure session cookies, public sign-up rejection, auth rate limiting and one complete fictional workflow on the hosted app before field use. Share account passwords privately, never in the public README. No hosted URL has yet been created.

## Mobile fixes and limits

Kept the existing wrapping navigation and stacked mobile tables. Added 16px form text to reduce iOS input zoom, 44px primary controls/navigation, wrapping long text, pending submission feedback/disabled form controls, login network/rate-limit feedback, session loading and generic retry UI. Next.js already generates a mobile viewport. No hover-only or drag-only required interaction was found in source.

Still requires actual iOS Safari/Android Chrome testing, particularly native datetime/select controls and 4G/5G network transitions. Error redirects can lose entered form values. Connectivity loss after a write can leave an uncertain result; check the record before submitting again. There is no server-side idempotency guarantee or offline mode. Camera/photo testing is not applicable.

## Field checklist

- Turn Wi-Fi off; open the stable HTTPS URL over 4G/5G. Test iOS Safari and Android Chrome where available.
- Sign in/out; refresh and reopen; verify technician/admin/engineer permissions with separate private accounts.
- Search/create/edit a fictional case, add device/event/visit, assign staff, book, complete/cancel and inspect the resulting status.
- Test narrow portrait screen, keyboard visibility, date/time picker, select, checkbox and long text; verify buttons/links are tappable without sideways scrolling.
- Test slow loading, airplane-mode transitions and repeated taps. Verify pending messages, retry paths and whether a write already succeeded before retrying.
- Record URL/page, fictional record reference, device/browser, network, time, steps, expected/actual result and a screenshot without passwords.
- Never enter real customer names, addresses, numbers, work exports or identifying notes.

## Verification completed

- 8 unit tests and TypeScript checks passed.
- Final optimized Next.js build passed (including its TypeScript check).
- All 3 migrations applied to a fresh isolated PostgreSQL test database; fictional role accounts created.
- Existing HTTP smoke suite passed against the final production build on port 3012, including role restrictions, direct Action authorization, core CRM workflows, completion corrections, staff creation and public sign-up denial.
- `tests/http-auth-security.py` passed: fourth failed login received 429; security headers matched. Rate limit rows persisted in PostgreSQL.
- `npm audit --omit=dev` reported zero known vulnerabilities at review time. This does not prove the absence of undisclosed vulnerabilities.
- Browser check of the 390px login viewport: correct mobile viewport, no horizontal overflow, 16px form text, 44px input/button heights. This is a browser viewport check, not a physical phone or cellular network test.
- No public push or deployment performed. Temporary test processes stopped after verification.

## User setup confirmation

The user confirmed personal use and an existing Vercel account. Neon Free is approved if no payment is required. The agent browser currently shows the Vercel login page; Neon registration requires user completion (including any verification and service terms). No cloud resources, paid plan, push or deployment have been created.
