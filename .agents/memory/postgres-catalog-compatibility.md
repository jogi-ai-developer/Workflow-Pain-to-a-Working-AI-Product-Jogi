---
name: PostgreSQL catalog compatibility
description: Compatibility guidance for schema preflight queries against the project database.
---

Use PostgreSQL catalog fields and rendered definitions that are available across the
database versions used by this project. In particular, do not assume newer
`pg_constraint` columns exist; derive optional constraint properties from
`pg_get_constraintdef` when necessary.

**Why:** The configured database rejected a query referencing `connullsnotdistinct`,
even though the current Drizzle types expose support for NULLS NOT DISTINCT.

**How to apply:** When extending catalog validation, check the target PostgreSQL
version and prefer `pg_get_*` helpers or broadly available `pg_catalog` columns
over version-specific metadata fields.