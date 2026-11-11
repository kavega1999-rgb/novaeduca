 # Architecture rules

- Apply heading capitalization globally in the base stylesheet and training-title normalization in the shared text utility, keeping presentation consistent without changing personal-name or body-text formatting.
- Load tabulation datasets through the shared paginated-query helper with stable ordering; partial assignment reads can incorrectly hide preserved pre/post results after membership edits.
- Generate adherence (pre/post) reports with database triggers on completed evaluation and pretest attempts; client-triggered generation was skipped whenever the user left the page or took the exam outside the training view.
- Add employee registration authorizations through the existing whitelist with dual-admin checks in the UI and database policy; this preserves the signup flow without creating accounts or exposing the employee list publicly.
