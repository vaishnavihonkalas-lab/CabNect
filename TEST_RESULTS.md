# Verification results — 2 November 2026

- Runtime: Node.js 24.22.1; declared supported runtime Node.js 22+.
- `npm test`: 6 checks passed (validation, date/time conversion, bcrypt, transaction cleanup, populated EJS rendering, HTTP authentication/CSRF smoke checks).
- Integration: 14 scenarios passed plus the parent test (15 runner entries), against a real, isolated MariaDB 10.11.14 database through mysql2 and HTTP requests.
- Covered signup/login for multiple accounts, duplicate input, vehicle creation/edit/deletion, cross-owner isolation, invalid distance/dates, fare and UTC persistence, linked-vehicle deletion rejection, assignment, completed history, availability recovery, cancellation, concurrent assignment, password changes and deactivation.
- `npm audit --omit=dev`: 0 reported vulnerabilities after dependency updates. This is a point-in-time dependency check, not a security certification.
- JavaScript syntax and all EJS templates checked. Core suite rerun after final media/UI edits.
- A browser smoke check was attempted but could not launch because Chromium was not installed. Browser interaction, appearance on different screens and keyboard accessibility remain to be manually checked.
- MySQL 8 Docker configuration supplied but not executed. MariaDB integration passing does not replace deployment verification on the intended MySQL version.
- No production deployment, payment processing, GPS or external messaging performed. No GitHub push performed; original source attribution and destination repository remain unresolved.
