# FieldDesk

FieldDesk is a fictional field service CRM demo. It tracks customer cases, devices, site surveys, installation visits, service events, staff assignments, and an audit trail. All names, addresses, contact numbers, reference codes, and device identifiers created by the demo seed are invented.

This repository is a standalone example. It contains no source spreadsheets, customer exports, credentials, or data migration tools. It has no connection to a prior CRM database.

Public mobile testing review and setup: [PUBLIC_TESTING.md](PUBLIC_TESTING.md). No public deployment has been made.

The public-safe project context and milestone plan are in [HANDOFF.md](HANDOFF.md). Demo device categories use neutral labels `設備1` to `設備6`.

## Stack

Next.js 16, TypeScript, PostgreSQL 17, Prisma, and Better Auth. The local development server binds to `127.0.0.1`. Roles are administrator, engineer, and technician. Administrators and engineers maintain cases and visits; technicians see only assigned visits.

## Run locally with fictional data

Requires Node.js 22, npm, PostgreSQL 17, and macOS for the included local database helper. The helper creates a **new** private database under `~/Library/Application Support/FieldDesk/` on port `5434`.

```sh
./scripts/local-db.sh start
source "$HOME/Library/Application Support/FieldDesk/local.env"
npm ci
npm run db:generate
npm run db:deploy
read -s DEMO_PASSWORD
export DEMO_PASSWORD
npm run demo:seed
unset DEMO_PASSWORD
npm run dev
```

Enter a unique password of at least 12 characters when `read` waits for input. Open `http://127.0.0.1:3000` and sign in as `admin.demo@example.com`, `engineer.demo@example.com`, or `technician.demo@example.com` with that password. The seed command runs only once on a new, empty local FieldDesk database. It refuses any other database URL.

If port `3000` is already in use, run `BETTER_AUTH_URL=http://127.0.0.1:3001 npm run dev -- --port 3001` and open `http://127.0.0.1:3001`.

To stop PostgreSQL without deleting its data:

```sh
./scripts/local-db.sh stop
```

For a blank database, skip `demo:seed` and create the first administrator with `npm run user:add -- your-email@example.com YourName admin` after setting `NEW_USER_PASSWORD` to a private value of at least 12 characters.

## Scope

- Customer case: name, optional reference code, address, one contact, notes, status, archive and restore.
- Device: editable device types, ID, serial number, location, notes, archive and restore.
- Visits: site survey, installation, and incident response; tentative and confirmed times, assignments, status, cancellation or incomplete reason, and conflict indication.
- Service event: manual creation, status, optional device, and visit links.
- Staff: administrator, engineer, and technician roles with server side checks.

The app has no customer password vault, file uploads, external integrations, billing, or production operations. Use fictional data only. The migration starts from an empty schema; it is intentionally unrelated to any other CRM migration history.

## Checks

```sh
npm test
npm run typecheck
npm run build
```

The HTTP smoke test is in `tests/http-smoke.py` and uses a separate throwaway local PostgreSQL database and test server. Local backups can be made with `python3 scripts/backup-local.py` after loading `local.env`; they are stored outside this repository.
