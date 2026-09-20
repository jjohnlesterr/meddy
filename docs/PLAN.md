# Meddy Project Plan

> No standalone project plan existed before this file. This document consolidates the product goals from the former `.codex/skills/meddy/` skill and the current state of the repository. It records what is already built and the stated direction; it does not introduce new architecture. Update it as the project changes.

## Product

Meddy is a medication reminder and family-care mobile app designed primarily for elderly users. It should feel like a friendly health companion, not a hospital management system.

The app helps users:

- remember when to take medicines
- view upcoming medication schedules
- mark medicines as taken
- snooze reminders
- track medication history
- connect with trusted family members or caregivers through a Care Circle
- let caregivers help manage medicine schedules
- notify caregivers about important missed-dose events

Main goal: **make medication management simple, friendly, and reassuring for elderly users and the people who care for them.**

## Stack

- React Native + Expo (SDK 57) + TypeScript
- Expo Router (file-based routing, `src/app/`)
- Supabase: authentication, PostgreSQL, storage, realtime, server-side logic where appropriate
- Expo Notifications for reminders
- No separate backend unless clearly necessary

## Project layout

```text
src/
  app/          Expo Router routes
    (tabs)/     Home, Medicines, Care Circle, Profile
    care/       create, join, [id], settings/[id]
    medicine/   add, [id], edit/[id]
    dev/        developer-only notification tools
  components/   shared UI (MeddyMascot, MeddyButton, MedicineCard, forms, ...)
  constants/    theme.ts, typography.ts, reminder-sound-previews.ts
  context/      app-state, medicine, care-circle, activity contexts
  hooks/        theme / color scheme hooks
  lib/          supabase client, medicines, care circles, notifications, storage
  types/        medicine.ts, care-circle.ts
assets/         images (incl. images/meddy/ mascot art), sounds, branding
supabase/       SQL schema history (see supabase/README.md)
docs/           PLAN.md, SKILLS.md
```

## Current state (as of this document)

Implemented in the repository:

- Authentication: login, signup, onboarding (`self` or `caregiver`), profile-error screen; `profiles` table with trigger-created profiles.
- Medicines and schedules: add, view, edit; per-schedule reminder settings (three bundled sounds: `gentle_chime`, `soft_bell`, `morning_tone`); optional medicine photo; optional personalized voice reminder audio.
- Notifications: local scheduled reminders, an in-app notification center, Care Circle notification helpers, a developer notification test screen.
- Care Circle: multiple circles per user, owner/admin/member roles, join by code with request + review flow, shared medicines, per-circle activity feed, circle settings.
- Supabase storage: private buckets `medicine-photos` and `personalized-reminder-audio`, both protected by RLS-aware storage policies.
- Input length limits enforced both client-side and by database CHECK constraints.

Tables and functions currently used by the client: `profiles`, `medicines`, `medicine_schedules`, `care_circles`, `care_circle_members`, `care_circle_join_requests`, `care_circle_activity`, RPCs `request_to_join_care_circle` and `review_care_circle_join_request`.

## Not built yet / stated direction

These come from the original product description and are not confirmed as implemented:

- Dose history / `dose_logs` tracking of taken, snoozed, and skipped doses.
- Server-side missed-dose alerts to caregivers via push notifications (patient reminder → no Taken confirmation → overdue threshold → backend checks dose state → caregiver alert).
- `appointments` and `device_tokens` tables.
- Limited-access Family Member role behavior beyond what Care Circle roles already provide.

Before starting any of these, inspect the existing implementation and database first, and record the decision here.

## Working agreements

- UI, accessibility, mascot, Care Circle, notification, and Supabase rules live in `docs/SKILLS.md`.
- Database changes follow the migration workflow in `docs/SKILLS.md` and `supabase/README.md`; the repository is the source of truth for schema history.
