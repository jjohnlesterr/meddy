# Meddy App Skill

Use this skill whenever working on the Meddy mobile application.

## Project Overview

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

---

## Core Stack

Use:

- React Native
- Expo
- TypeScript
- Expo Router
- Supabase
- Expo Notifications

Do not introduce a separate backend unless clearly necessary.

Use Supabase for:

- authentication
- PostgreSQL database
- storage
- realtime
- backend logic where appropriate

---

## React Native Rules

Always use native React Native components.

Prefer:

- View
- Text
- Image
- Pressable
- ScrollView
- FlatList
- TextInput
- StyleSheet

Never use web-only elements such as:

- div
- button
- img
- input
- span
- DOM-specific CSS

Keep components functional and written in TypeScript.

Avoid unnecessary dependencies.

Prefer Expo-compatible libraries.

Do not introduce a library when Expo or React Native already provides an appropriate solution.

---

## Routing

Use Expo Router.

Primary tabs:

- Home
- Medicines
- Care Circle
- Profile

Use route groups where appropriate.

Use dynamic routes for medicine detail screens when needed.

Keep navigation simple and easy to understand.

---

## Design System

Meddy uses a clean **white + soft pink** visual identity.

Detailed visual rules are defined in:

`.codex/skills/meddy-design/SKILL.md`

Always follow that skill when creating or modifying UI.

---

## Mascot

Meddy is a friendly rabbit health companion.

Detailed mascot rules are defined in:

`.codex/skills/meddy-mascot/SKILL.md`

Always use the provided Meddy PNG assets when available.

Do not invent or generate a new Meddy pose unless explicitly requested.

The currently supported mascot states are:

- default
- caring
- success
- reminder

---

## Elderly-Friendly UX

The primary user experience must remain simple and accessible.

Always prioritize:

- large readable text
- large touch targets
- clear contrast
- simple language
- obvious primary actions
- generous spacing
- minimal cognitive load

Do not rely on color alone to communicate important status.

Use labels and/or icons.

Examples:

- ✓ Taken
- ⏰ Upcoming
- ! Missed

---

## Home Screen Priority

The Home screen should immediately answer:

1. What medicine should I take next?
2. What time should I take it?
3. What should I press after taking it?

Recommended hierarchy:

1. Greeting and Meddy
2. Next medicine
3. Taken action
4. Today's progress
5. Today's schedule
6. Quick actions
7. Care Circle preview

Do not turn the Home screen into a dense dashboard.

---

## Medication Information

Medication interfaces may show:

- medicine name
- dosage
- quantity such as tablet or capsule
- scheduled time
- instructions
- medication image when available
- current dose status

Example:

**Amlodipine**

5 mg • 1 tablet

8:00 AM

After breakfast

⏰ Upcoming

---

## Medication Actions

Primary medication actions:

### Taken

Marks the scheduled dose as completed.

### Snooze

Temporarily delays the reminder.

Example:

`Snooze 10 minutes`

### Skip

Marks the scheduled dose as skipped.

Skip must be visually less prominent than Taken.

---

## Reminder Experience

When medication becomes due, prioritize:

- Meddy reminder state
- medicine name
- dosage
- instructions
- scheduled time
- large Taken action
- Snooze action
- secondary Skip action

Avoid displaying unrelated information during an active medication reminder.

---

## Care Circle

Care Circle connects a patient with trusted family members or caregivers.

### Patient

May:

- receive reminders
- view medicines
- view schedules
- mark doses as taken
- snooze reminders
- view medication history

### Primary Caregiver

May:

- add medicines
- edit medicines
- configure schedules
- view medication status
- view medication history
- receive important missed-dose alerts

### Family Member

May have limited access such as:

- viewing medication progress
- receiving selected notifications

Permissions must be explicit.

Never assume every Care Circle member has full access.

---

## Supabase

Use Supabase for:

- authentication
- database
- storage
- realtime
- server-side logic where appropriate

Potential tables include:

- profiles
- care_circles
- care_circle_members
- medicines
- medicine_schedules
- dose_logs
- appointments
- device_tokens

Use UUID relationships where appropriate.

Enable and correctly configure Row Level Security.

Never expose the Supabase service-role key in the React Native application.

Use environment variables for client-safe project configuration.

---

## Notifications

Use Expo Notifications.

For medication reminders on the patient's own device:

- prefer scheduled local notifications where appropriate

For caregiver alerts:

- use push notifications with server-side logic where required

Example flow:

Medication becomes due
→ patient receives reminder
→ no Taken confirmation
→ overdue threshold is reached
→ backend checks dose state
→ caregiver receives missed-dose alert

Do not rely on the foreground app staying open for important reminder logic.

---

## Code Organization

Prefer a straightforward structure such as:

```text
app/
components/
assets/
  images/
  animations/
constants/
lib/
hooks/
types/
```

Possible reusable components:

```text
components/
  MeddyMascot.tsx
  MedicineCard.tsx
  PrimaryButton.tsx
  ProgressCard.tsx
```

Possible utility files:

```text
constants/
  colors.ts
  theme.ts

lib/
  supabase.ts
```

Do not create abstractions before they are actually needed.

---

## Development Style

The developer already knows React, Next.js, and TypeScript but is still learning React Native.

Keep implementations:

- straightforward
- readable
- maintainable
- beginner-friendly

Do not over-engineer.

Do not rewrite working code unnecessarily.

When modifying an existing feature:

- inspect the current implementation
- preserve working behavior
- change only what is necessary

---

## Product Personality

Meddy should feel:

- caring
- calm
- friendly
- reassuring
- trustworthy
- family-oriented

Preferred language:

- "It's time for your medicine."
- "You're halfway there!"
- "Great job! Your morning medicine is complete."
- "We'll remind you again in 10 minutes."

Avoid judgmental language such as:

- "You failed to take your medicine."
- "You forgot again."

---

## Final Rule

Every implementation decision should support Meddy's main goal:

**Make medication management simple, friendly, and reassuring for elderly users and the people who care for them.**
