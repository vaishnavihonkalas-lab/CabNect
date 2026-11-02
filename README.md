# CabNect — owner/driver fleet management

A server-rendered fleet-management web application built with Node.js, Express, EJS and MySQL. Owners manage vehicles and trips; drivers view assignments and record completion.

**Project status:** local demonstration release. See [Setup](#setup--existing-database-server), [Tests](#tests) and [Limits](#limits). Source and attribution details are recorded in [PROVENANCE.md](PROVENANCE.md).

## Implemented behaviour
- Owner and driver signup/login, bcrypt password hashing and regenerated login sessions.
- Owner vehicle add/list/edit and deletion of unused vehicles; ownership enforced server-side.
- Trip creation with manually entered distance, customer details and India-local date/time.
- Fare: **₹15/km**. Driver's calculated share: **60%** (rounded to paise).
- Manual driver assignment; only one active trip per driver. Database transactions, row locks and uniqueness constraints prevent conflicting assignments.
- Driver views and completes own assignments. Completion records a UTC timestamp, marks the trip completed and restores driver availability.
- Owner cancels own pending/assigned trips; cancellation restores driver availability.
- Completed-trip history and calculated earnings; no money is actually transferred.
- Profile editing; password change requires the current password.
- Account deactivation clears account contact fields and disables login. Active assignments must be completed/cancelled first. Historical trips remain; this is not full personal-data erasure.
- Form CSRF protection, parameterised SQL, server-side validation and a basic login/signup throttle.

## Requirements
Node.js **22 or later**; MySQL **8.0.16+** or MariaDB **10.11+**. Automated integration validation was run on MariaDB 10.11.14. The supplied MySQL Docker recipe has not been executed in this environment.

## Setup — existing database server
1. Open a terminal inside this folder and run `npm ci` (do not reuse the uploaded Windows node_modules).
2. Copy `.env.example` to `.env` (Windows CMD: `copy .env.example .env`; Linux/macOS: `cp .env.example .env`).
3. Set DB_HOST, DB_PORT, DB_USER, DB_PASSWORD and DB_NAME. Set SESSION_SECRET to a random value of at least 32 characters. Generate one with:
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
4. In MySQL Workbench or the MySQL command line, execute `database/schema.sql` using an account permitted to create the database. This schema is for a **fresh database**, not an automatic migration of the unknown original database.
5. Create a dedicated local database account and grant access to `cabnect.*`. Example (replace the password):
   ```sql
   CREATE USER 'cabnect'@'localhost' IDENTIFIED BY 'your-local-password';
   GRANT SELECT, INSERT, UPDATE, DELETE ON cabnect.* TO 'cabnect'@'localhost';
   ```
   Match the account host to the actual connection host when required by your MySQL installation.
6. Run `npm start`; open **http://localhost:3000**. Startup deliberately fails if the database or session secret is not configured.

## Alternative database setup — Docker
After creating `.env`, set DB_HOST=127.0.0.1, DB_USER=cabnect, DB_NAME=cabnect, DB_PASSWORD and MYSQL_ROOT_PASSWORD. Run `docker compose up -d db`; wait for it to become healthy, then run `npm ci` and `npm start` on the host. The schema loads only when the database volume is first created. Changing the SQL file does not migrate an existing volume. Docker is optional.

## Five-minute manual demo
1. Sign up as an owner and as a driver (use separate browser profiles/private windows).
2. Owner: add a vehicle. Create a 20 km trip with customer mobile and date/time. Fare should be ₹300.
3. Owner: select an available driver and assign the pending trip.
4. Driver: view pickup, destination, vehicle and calculated share **₹180**. Click **Mark completed**.
5. Owner: refresh and see completed status. Create a new trip; the driver is available again.
6. Assign another trip and cancel it as owner. Verify the driver becomes available.
7. Check wrong-password login, negative distance, duplicate vehicle/email, and cross-account access.

## Tests
- `npm test`: validation, password hashing, transaction cleanup, EJS rendering, authentication redirects and CSRF rejection. No database required.
- `npm run test:integration`: starts an isolated HTTP server and creates/drops a **randomly named test database**. It requires a running database plus TEST_DB_USER / TEST_DB_PASSWORD (or DB_USER / DB_PASSWORD) with CREATE/DROP database privileges. Never use production credentials. Only its temporary database is dropped.
- Integration scenarios cover account creation/login, validation, duplicate prevention, vehicle management, ownership isolation, fare/time persistence, assignment, completion, cancellation, simultaneous assignment, profile/password updates and deactivation.

## Architecture and tables
Browser forms → Express routers → mysql2 connection pool → MySQL. EJS renders server-side HTML; sessions store only non-password account fields in memory. Tables: owners, drivers, vehicles, trips, assignments. Schema uses foreign keys, unique emails/vehicle/license/trip assignment and a unique nullable generated key enforcing one active assignment per driver.

Important files: app.js (middleware), server.js (startup), routes/accounts.js (shared account flows), routes/ownerRoutes.js, routes/driverRoutes.js, database/schema.sql, utils/validation.js, utils/transaction.js.

## Limits
- Local demo release, **not a production deployment**. Sessions and login throttling are in process memory; sessions reset after restart. Production startup is blocked until a persistent session store and deployment configuration are added.
- No GPS, automated distance lookup, payment gateway, verified driver documents, customer self-booking, password recovery or time-slot scheduling.
- A driver has one active assignment globally; this is not a future scheduling optimiser. Vehicle overlap scheduling is not implemented.
- Trip date/time is entered in Asia/Kolkata and stored in UTC. Fare and share use fixed educational rates.
- Vehicle metadata edits affect the current linked vehicle record; historical snapshots are not implemented.
- Account deactivation retains operational history, including customer trip details. A complete retention/erasure policy would be needed for real users.
- Original media has been replaced with new SVG illustrations. Original source-code attribution still needs verification before public redistribution.

See [CHANGELOG.md](CHANGELOG.md) for implementation changes and [TEST_RESULTS.md](TEST_RESULTS.md) for verification details.
