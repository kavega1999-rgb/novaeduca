 # Architecture rules

- Apply heading capitalization globally in the base stylesheet and training-title normalization in the shared text utility, keeping presentation consistent without changing personal-name or body-text formatting.
- Load tabulation datasets through the shared paginated-query helper with stable ordering; partial assignment reads can incorrectly hide preserved pre/post results after membership edits.
- Generate adherence (pre/post) reports with database triggers on completed evaluation and pretest attempts; client-triggered generation was skipped whenever the user left the page or took the exam outside the training view.
- Add employee registration authorizations through the existing whitelist with dual-admin checks in the UI and database policy; this preserves the signup flow without creating accounts or exposing the employee list publicly.
- Load the original certificate logo through the shared authenticated private-storage helper for generation and regeneration; public logo requests fail in the private certificates bucket and must never produce a generic substitute.
- Delete accounts through a manually authenticated, dual-admin Edge Function; a profile deletion trigger cleans dependent application records atomically with Auth deletion while retaining shared content and audit history.
