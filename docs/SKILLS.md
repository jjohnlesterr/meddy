# Meddy Skills

Shared rules for anyone (Claude Code, Codex, or another agent) working on the Meddy app. This file consolidates the former `.codex/skills/meddy`, `meddy-design`, and `meddy-mascot` skills. Follow it whenever creating or changing Meddy code, UI, or database schema.

Sections:

1. [Project overview](#1-project-overview)
2. [Core stack](#2-core-stack)
3. [React Native rules](#3-react-native-rules)
4. [Routing](#4-routing)
5. [Design system](#5-design-system)
6. [Elderly-friendly UX and accessibility](#6-elderly-friendly-ux-and-accessibility)
7. [Home screen priority](#7-home-screen-priority)
8. [Medication information, actions, and reminders](#8-medication-information-actions-and-reminders)
9. [Care Circle](#9-care-circle)
10. [Supabase and database safety](#10-supabase-and-database-safety)
11. [Notifications](#11-notifications)
12. [Meddy mascot](#12-meddy-mascot)
13. [Code organization and development style](#13-code-organization-and-development-style)
14. [Product personality and language](#14-product-personality-and-language)

---

## 1. Project overview

Meddy is a medication reminder and family-care mobile app designed primarily for elderly users.

The app helps users:

- remember when to take medicines
- view upcoming medication schedules
- mark medicines as taken
- snooze reminders
- track medication history
- connect with trusted family members or caregivers through a Care Circle
- allow caregivers to help manage medicine schedules
- notify caregivers about important missed-dose events

Meddy must feel like a friendly health companion, not a hospital management system.

**Final rule:** every implementation decision should support Meddy's main goal — make medication management simple, friendly, and reassuring for elderly users and the people who care for them.

---

## 2. Core stack

Use:

- React Native
- Expo
- TypeScript
- Expo Router
- Supabase
- Expo Notifications

Do not introduce a separate backend unless clearly necessary.

Use Supabase for authentication, PostgreSQL database, storage, realtime, and backend logic where appropriate.

Read the versioned Expo docs (https://docs.expo.dev/versions/v57.0.0/) before writing Expo code; this project's Expo version differs from older material.

---

## 3. React Native rules

Always use native React Native components.

Prefer: `View`, `Text`, `Image`, `Pressable`, `ScrollView`, `FlatList`, `TextInput`, `StyleSheet`.

Never use web-only elements such as `div`, `button`, `img`, `input`, `span`, or DOM-specific CSS.

Keep components functional and written in TypeScript.

Avoid unnecessary dependencies. Prefer Expo-compatible libraries. Do not introduce a library when Expo or React Native already provides an appropriate solution.

---

## 4. Routing

Use Expo Router.

Primary tabs:

- Home
- Medicines
- Care Circle
- Profile

Use route groups where appropriate. Use dynamic routes for medicine detail screens when needed. Keep navigation simple and easy to understand.

---

## 5. Design system

Meddy uses a clean **white + soft pink** visual identity.

### Colors

| Role           | Hex       |
| -------------- | --------- |
| Background     | `#FFFFFF` |
| Soft pink surface | `#FFF6F9` |
| Primary pink   | `#F28BA8` |
| Strong pink    | `#E96F93` |
| Light pink     | `#FCE1E9` |
| Dark text      | `#2B2B2B` |
| Secondary text | `#737373` |
| Border         | `#F1DCE3` |
| Success        | `#73B98C` |
| Warning        | `#E8AA55` |
| Danger         | `#DF7070` |

Pink is an accent color. Do not make the whole screen strongly pink.

### UI style

Use:

- clean white backgrounds
- large rounded cards
- subtle shadows
- soft pink highlights
- generous spacing
- high readability
- simple icons
- large touch targets

Avoid:

- dense dashboards
- excessive gradients
- glassmorphism
- tiny buttons
- tiny text
- hospital-like styling
- overly dark screens

### Cards

Cards should generally use white or soft pink surfaces, rounded corners, comfortable padding, simple layouts, and subtle borders or shadows. Avoid excessive nested cards.

### Buttons

- Primary actions: soft or strong pink, high contrast, large, rounded.
- Secondary actions: white or light pink, bordered, visually less dominant.

### Navigation

Primary tabs are Home, Medicines, Care Circle, and Profile. Keep navigation simple and clearly labeled.

---

## 6. Elderly-friendly UX and accessibility

Meddy is primarily designed for elderly users. The primary experience must remain simple and accessible.

Always prioritize:

- large readable text
- large touch targets
- clear contrast
- simple language
- obvious primary actions
- generous spacing
- minimal cognitive load

Do not rely on color alone to communicate important status. Use labels and/or icons.

Examples:

- ✓ Taken
- ⏰ Upcoming
- ! Missed

---

## 7. Home screen priority

The Home screen should immediately answer:

1. What medicine should I take next?
2. What time should I take it?
3. What should I press after taking it?

Recommended hierarchy:

1. Greeting
2. Meddy hero area
3. Next medicine
4. Primary Taken action
5. Today's progress
6. Today's schedule
7. Quick actions
8. Care Circle preview

Do not turn the Home screen into a dense dashboard.

---

## 8. Medication information, actions, and reminders

### Information

Medication interfaces may show: medicine name, dosage, quantity (such as tablet or capsule), scheduled time, instructions, medication image when available, and current dose status.

Example:

> **Amlodipine**
> 5 mg • 1 tablet
> 8:00 AM
> After breakfast
> ⏰ Upcoming

### Actions

- **Taken** — marks the scheduled dose as completed.
- **Snooze** — temporarily delays the reminder (for example `Snooze 10 minutes`).
- **Skip** — marks the scheduled dose as skipped. Skip must be visually less prominent than Taken.

### Reminder experience

When medication becomes due, prioritize:

- Meddy `reminder` state
- medicine name
- dosage
- instructions
- scheduled time
- large Taken action
- Snooze action
- secondary Skip action

Avoid displaying unrelated information during an active medication reminder.

---

## 9. Care Circle

Care Circle connects a patient with trusted family members or caregivers.

**Patient** may: receive reminders, view medicines, view schedules, mark doses as taken, snooze reminders, view medication history.

**Primary caregiver** may: add medicines, edit medicines, configure schedules, view medication status, view medication history, receive important missed-dose alerts.

**Family member** may have limited access, such as viewing medication progress and receiving selected notifications.

Permissions must be explicit. Never assume every Care Circle member has full access. Entering a join code never creates membership by itself; it creates a pending request that an owner or admin reviews.

Care Circle screens use the Meddy `caring` mascot state with supportive, non-judgmental wording (see [section 12](#12-meddy-mascot)).

---

## 10. Supabase and database safety

### Usage

Use Supabase for authentication, database, storage, realtime, and server-side logic where appropriate.

Tables in use include `profiles`, `medicines`, `medicine_schedules`, `care_circles`, `care_circle_members`, `care_circle_join_requests`, and `care_circle_activity`. Planned tables from the original product description: `dose_logs`, `appointments`, `device_tokens` (see `docs/PLAN.md`).

Use UUID relationships where appropriate. Enable and correctly configure Row Level Security on every table and storage bucket.

### Safety rules

- Inspect the existing database/schema before making changes.
- Never expose the Supabase service-role key in the React Native application. Client code uses only the public URL and anon/publishable key from environment variables.
- Use environment variables for client-safe project configuration. Do not modify `.env` unless asked.
- Avoid destructive database changes (dropping tables/columns, deleting data, weakening RLS) unless explicitly requested.
- Never make undocumented live database changes. Every schema, function, policy, or storage change must exist as SQL in the repository.
- Storage buckets holding medicine photos and personalized audio are private; never make them public.

### Migration workflow

The repository is the source of truth for database schema history.

```text
inspect live Supabase through MCP
→ create a timestamped SQL migration locally (supabase/migrations/)
→ apply the migration through Supabase MCP
→ verify the resulting live database state
```

Rules:

- Inspect the live database through the Supabase MCP tools (read-only queries, `list_tables`, advisors) before writing SQL. Do not assume the live state matches the repository.
- New schema changes go in `supabase/migrations/` as a new, clearly named, timestamp-prefixed `.sql` file: `YYYYMMDDHHMMSS_short_description.sql`.
- Apply the migration with the Supabase MCP `apply_migration` tool. The MCP records its own version timestamp in the live migration ledger (`list_migrations`); name the local file with that exact version so the repository and ledger agree.
- Write idempotent statements where possible (`create or replace`, `drop policy if exists`, `add column if not exists`).
- Do not re-run whole original schema files. Ship a new migration for the change.
- If a change also fixes a canonical definition, keep the older reference SQL under `supabase/` consistent so a fresh database does not reintroduce the bug.
- After applying, verify the live state (tables, columns, policies, grants, functions, storage) with queries and re-run the security advisor. Only report a change as applied and working once that verification passes; if verification fails or is not possible, say so.
- Test access-control changes without persisting anything, for example a `DO` block that switches role, exercises the policy, and ends with `raise exception` so everything rolls back.
- Every live change must match a migration file in the repository, and nothing destructive is applied unless explicitly requested.
- New functions in `public`: default privileges no longer grant EXECUTE to `anon` or `authenticated`, but PostgreSQL still grants it to `PUBLIC`, which `anon` inherits. In the same migration, `revoke execute on function … from public;` and then grant only the roles that need it (usually `authenticated`; `supabase_auth_admin` for auth-fired trigger functions).
- Existing files directly under `supabase/` are the pre-migration baseline history; see `supabase/README.md`. Do not fabricate migrations for them.

---

## 11. Notifications

Use Expo Notifications.

- For medication reminders on the patient's own device, prefer scheduled local notifications where appropriate.
- For caregiver alerts, use push notifications with server-side logic where required.

Example flow:

```text
Medication becomes due
→ patient receives reminder
→ no Taken confirmation
→ overdue threshold is reached
→ backend checks dose state
→ caregiver receives missed-dose alert
```

Do not rely on the foreground app staying open for important reminder logic.

---

## 12. Meddy mascot

Use this section whenever Meddy the rabbit appears in the UI, changes state, or is animated.

### Identity

Meddy is a friendly rabbit health companion representing care, encouragement, medication reminders, companionship, and reassurance.

Meddy should feel gentle, warm, friendly, trustworthy, and comforting.

Meddy should not feel chaotic, overly childish, scary, overly clinical, or judgmental.

### Source assets

The project uses existing transparent PNG artwork of Meddy. Always prefer the provided Meddy PNG assets.

Do not redraw, redesign, regenerate, or recolor Meddy. Do not change facial features, stretch or distort proportions, crop important parts, or alter the outfit or accessories. Preserve the source artwork.

Display with a contain-style resize mode and leave room for ears, hands, feet, accessories, and pose-specific props:

```tsx
<Image source={source} resizeMode="contain" style={styles.mascot} />
```

### Official mascot states

There are **exactly four official Meddy mascot states**:

1. `default`
2. `caring`
3. `success`
4. `reminder`

Do not invent additional mascot states unless new assets are explicitly added to the project.

**`default`** — standard neutral/friendly appearance. Use for the Home screen, greeting sections, normal idle state, general informational screens, Profile, and the Medicines screen when no special state is needed.

**`caring`** — use for supportive messages, Care Circle, caregiver-related sections, reassurance, gentle warnings, overdue medication messages where a compassionate tone is appropriate, and empty states where encouragement is useful. Never pair `caring` with harsh or judgmental wording.

**`success`** — use when a medicine is marked Taken, all medicines for a period are completed, today's goal is completed, a medicine is added, a schedule is saved, or another meaningful positive action completes. May be paired with subtle effects (small hearts, check animation, light confetti, gentle bounce). Do not make success excessively energetic.

**`reminder`** — use for medication due now, upcoming medication reminders, reminder screens, alarm-related interfaces, and snooze states. Make the medication action clear without alarming or pressuring the user.

### Unsupported states

Do not reference nonexistent assets or states such as `idle`, `happy`, `concerned`, `sad`, `angry`, `sleep`, `sleeping`, `celebration`, `doctor`, or `nurse` unless a corresponding official Meddy asset is added later.

When no specialized state matches, use `default`.

### Assets and component API

Mascot art lives in `assets/images/meddy/` (for example `default.png`, `caring.png`, `success.png`, `reminder.png`). Do not rename source assets that are already integrated.

Use the shared `MeddyMascot` component (`src/components/meddy-mascot.tsx`) rather than importing mascot PNGs directly across the app. Keep the image mapping inside that component.

```tsx
<MeddyMascot state="default" />
<MeddyMascot state="caring" />
<MeddyMascot state="success" />
<MeddyMascot state="reminder" />
```

> **Known deviation:** the current `MeddyState` type in `src/components/meddy-mascot.tsx` also accepts `medicine`, `careCircle`, `login`, and `profile`, backed by extra scene-illustration PNGs (`medicine.png`, `care-circle.png`, `login.png`, `profile.png`). These predate this consolidation. Do not add further states. Do not remove these without a deliberate decision, because existing screens use them.

### Placement

Meddy should feel integrated into the interface, not placed randomly as decoration.

- **Hero areas:** Meddy may appear prominently on the right, slightly overlap a hero card, extend beyond a colored background shape, or sit beside a greeting. Keep negative space around the character. Do not place Meddy inside a tiny square card. Do not hide Meddy behind text.
- **Reminder screen:** Meddy may be larger than usual with the `reminder` state, but medicine information and the primary button must stay dominant.
- **After Taken:** switch to `success`, optionally animate briefly, then return to the appropriate normal state. Do not permanently show `success` while the user is simply browsing.

### Animation

Prefer subtle animation with React Native animation techniques:

- `default`: gentle floating (slight vertical movement, slow, minimal amplitude)
- `caring`: gentle fade or subtle scale-in
- `success`: small bounce after completing an action
- `reminder`: subtle shake, pulse, or attention movement

Do not constantly shake the mascot, use fast repetitive movement, rotate the mascot excessively, create distracting infinite animations, or distort the PNG. Animation should support meaning, not exist merely because it is possible.

Lottie may be used for decorative effects (hearts, subtle confetti, bell movement, success check, sparkles), not as a replacement for the official PNG artwork unless an actual Meddy Lottie asset is provided. Keep effects secondary to Meddy.

### Mascot accessibility

Mascot animation must never be required to understand important information. Communicate medication information through text, icons, labels, and buttons too. Do not rely on Meddy's facial expression alone to communicate Taken, Missed, Upcoming, Overdue, or Success.

### Final mascot rule

Meddy has only four official visual states: **default, caring, success, reminder**. Always choose from those four. Never invent another pose or mascot state unless a new official asset is explicitly added.

---

## 13. Code organization and development style

Prefer a straightforward structure: routes in `src/app`, shared UI in `src/components`, constants in `src/constants`, data access in `src/lib`, state in `src/context`, and types in `src/types`. See `docs/PLAN.md` for the current layout.

Do not create abstractions before they are actually needed.

The developer already knows React, Next.js, and TypeScript but is still learning React Native. Keep implementations straightforward, readable, maintainable, and beginner-friendly. Do not over-engineer. Do not rewrite working code unnecessarily.

When modifying an existing feature: inspect the current implementation, preserve working behavior, and change only what is necessary.

---

## 14. Product personality and language

Meddy should feel caring, calm, friendly, reassuring, trustworthy, and family-oriented.

Preferred language:

- "It's time for your medicine."
- "You're halfway there!"
- "Great job! Your morning medicine is complete."
- "We'll remind you again in 10 minutes."

Avoid judgmental language such as:

- "You failed to take your medicine."
- "You forgot again."
