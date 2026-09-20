# Meddy — Claude Code instructions

Meddy is a React Native + Expo + TypeScript + Supabase medication reminder and family-care app for elderly users and their caregivers.

## Read first

Before making meaningful changes, read:

- `docs/PLAN.md` — product goals, current state, project layout
- `docs/SKILLS.md` — design system, accessibility, Care Circle, notifications, Supabase safety, mascot rules

## Expo

Expo has changed. Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing Expo code.

## General rules

- Inspect the existing implementation before modifying it.
- Preserve working behavior.
- Do not rewrite working code unnecessarily.
- Prefer simple, maintainable solutions.
- UI work must follow the Meddy design and accessibility rules in `docs/SKILLS.md` (sections 5–8).
- Mascot usage must follow the official Meddy mascot rules in `docs/SKILLS.md` (section 12): exactly four states — `default`, `caring`, `success`, `reminder`.

## Supabase rules

- Inspect the existing database/schema before making changes.
- Never expose service-role credentials to the client.
- Avoid destructive database changes unless explicitly requested.
- Schema changes must be SQL migrations in `supabase/migrations/`.
- Do not make undocumented live database changes.
- Workflow: inspect live Supabase through MCP, create a timestamped migration, apply it through Supabase MCP, then verify the live state. Do not report a change as done until verified.

Full workflow: `docs/SKILLS.md` section 10 and `supabase/README.md`.
