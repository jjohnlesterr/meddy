# Meddy Supabase

The repository is the source of truth for database schema history.

## Workflow for every database change

```text
inspect live Supabase through MCP
→ create a timestamped SQL migration locally (supabase/migrations/)
→ apply the migration through Supabase MCP
→ verify the resulting live database state
```

- Inspect the live schema (tables, columns, RLS policies, grants, functions, storage buckets) through the Supabase MCP tools before writing SQL.
- Add a new file `supabase/migrations/YYYYMMDDHHMMSS_short_description.sql`. Prefer idempotent statements.
- Apply it with the Supabase MCP `apply_migration` tool. The MCP assigns the version recorded in the live ledger (`list_migrations`); give the local file that same version prefix.
- After applying, verify the live state and re-run the security advisor. Do not treat a change as done until it is verified.
- Never make live database changes that are not represented as SQL in this repository.
- When adding a function to `public`, revoke EXECUTE from `PUBLIC` in the same migration and grant only the roles that need it. Default privileges no longer grant `anon` or `authenticated` on new functions, but `PUBLIC` (inherited by `anon`) is still granted by PostgreSQL. See `migrations/20260920124528_revoke_default_function_execute_from_anon_authenticated.sql`.
- Never put service-role credentials in client code or in this repository.
- Avoid destructive changes unless explicitly requested.

## Baseline SQL (pre-migration history)

These files were written before `supabase/migrations/` existed. They are the reference definition of the schema as built so far and are kept in place. They are not timestamped migrations. If a fresh database is ever provisioned from them, run in this order:

1. `schema.sql` — profiles, `handle_new_user` trigger
2. `medicines.sql` — medicines and schedules
3. `care_circles.sql` — circles, members, join requests, RPCs
4. `care_circle_shared_medicines.sql` — shared medicines, activity feed, policy updates
5. `fix_care_circle_join_request.sql` — fixes ambiguous `circle_id` in `request_to_join_care_circle`
6. `medicine_reminder_settings.sql` — per-schedule reminder sound
7. `medicine_personalized_audio.sql` — personalized audio metadata
8. `medicine_personalized_audio_storage.sql` — private `personalized-reminder-audio` bucket and policies
9. `medicine_photos.sql` — `medicine-photos` bucket and policies
10. `field_length_limits.sql` — max-length CHECK constraints (run last)

All ten are already reflected in the live project (confirmed by a live-vs-repository comparison on 2026-09-20). Where a baseline file has since been corrected or superseded, the timestamped files in `migrations/` are authoritative for live state and must be applied after the baseline files.
