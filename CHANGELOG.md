# Completion pass

## Added
- Fresh InnoDB schema with keys, checks, status fields and one-active-driver uniqueness.
- Trip completion, cancellation and driver availability restoration.
- Vehicle listing/editing and unused-vehicle deletion.
- Transaction helper and consistent locking around trip state changes.
- Shared account routes, password-change verification and account deactivation.
- CSRF tokens on every form, POST logout, regenerated sessions and basic throttling.
- Environment configuration, startup checks, optional MySQL Docker recipe.
- Unit/HTTP smoke tests and real database integration suite.
- Setup, provenance, limits and verification documentation.

## Fixed
- Cross-owner trip/vehicle access through crafted form IDs.
- Negative/malformed distance, invalid calendar dates and missing-field crashes.
- Partial assignment updates, duplicate active assignments and unavailable drivers never recovering.
- Removed drivers_backup dependency; consistent soft-deactivation model.
- Password hashes no longer stored in session profiles.
- Flash-after-session-destruction error removed with shared notice messages.
- Removed stale commented code copies, duplicate About route and unsupported tracking claims.
- Replaced all inherited media with new SVG illustrations; removed original personal photos and video files.
- Replaced environment-specific bundled native dependency with a current installable bcrypt package; updated dependency lockfile and patched known transitive dependency issues.

These are adaptation changes to an externally supplied project. They do not establish the user's original authorship of the initial application.
