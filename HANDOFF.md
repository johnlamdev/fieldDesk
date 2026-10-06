# FieldDesk project context

FieldDesk is an independent, public-facing **fictional field service CRM demo**. It models a basic workflow from customer case to device record, site survey, installation visit, and service event. Every sample person, address, contact number, reference code, and device identifier is invented. Only generic process descriptions belong in this repository.

## Project direction

- The product is a Web app for desktop and mobile use. The current implementation uses Next.js, TypeScript, PostgreSQL, Prisma, and Better Auth.
- A case has a customer name, optional reference code, address, one contact, notes, and installation/service status. Devices, visits, and events link to that case.
- Demo device categories are deliberately abstract: `設備1` through `設備6`. Administrators and engineers can edit the list in the UI.
- Roles are administrator, engineer, and technician. Technicians only view visits assigned to them. Administrators and engineers manage operational records; only administrators manage users.
- PostgreSQL data and credentials stay in a private local directory outside the repository. Development binds to loopback. There is no public deployment.

## Current working paths

- App and business actions: `src/app/`.
- Data model and clean initial migration: `prisma/`.
- Fictional demo seed: `scripts/seed-demo.ts`. It runs only on a new local FieldDesk database.
- Local database and backup helpers: `scripts/local-db.sh`, `scripts/backup-local.py`.
- Unit and synthetic HTTP workflow checks: `tests/`.

## What works now

Login; role checks; case search/create/edit/archive/restore; device type editing and device create/edit/archive/restore; visit time, assignment, booking, completion, cancellation and correction; manual service events and visit links; audit records. The fictional seed includes two cases, two devices, three visits, one event, and three demo accounts.

The generic schema has been applied to a fresh temporary PostgreSQL database. Synthetic HTTP workflows, role restrictions, the demo seed, TypeScript checks, unit tests, and the production build have passed. Manual usability review on desktop and phone is still needed.

## Ten-day local MVP plan

| Period | Work | Acceptance |
|---|---|---|
| 10/05–10/07 | Correct P0 rules and forms; test roles and core workflow with fictional data | Case → device/event/visit → assignment/booking → completion or cancellation works; unauthorized actions fail |
| 10/08–10/11 | Repeat end-to-end checks on a separate test database; resolve defects | Fresh migration, seed, backup/restore, and realistic workflow checks pass |
| 10/12–10/14 | Review desktop and phone use; improve search, empty states, labels, and navigation | A new user can complete the main workflow without developer assistance |
| 10/15 | Review the local demo release | Record passed checks and remaining limits before considering any next environment |

Progress is measured by the checks above, rather than the date alone. The schedule is a working target.

## Privacy and scope boundary

Only fictional examples may be entered into this demo. Do not add real customer records, organization-specific terms, source spreadsheets, exports, or credentials. Review code, migrations, tests, documentation, and seed data before any public commit or push.

Customer password storage, file uploads, external system integration, billing, production hosting, and offline PWA use are outside this version. Keep the demo focused on cases, devices, visits, events, people, and auditability.

## Public mobile testing preparation (2026-10-06)

The user has requested a separate internet-accessible fictional-data testing environment. This supersedes the earlier local-only direction for that test environment; the local database remains private. No public deployment has been made. See `PUBLIC_TESTING.md` for the security review, Vercel + Neon recommendation, environment setup, remaining checks and field checklist. Minimal changes add database-backed auth limiting, deployment build configuration and mobile/network feedback; no core CRM feature was changed.
