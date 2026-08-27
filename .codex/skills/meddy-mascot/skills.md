# Meddy Mascot Skill

Use this skill whenever Meddy the rabbit appears in the UI, changes state, or is animated.

## Mascot Identity

Meddy is a friendly rabbit health companion.

Meddy represents:

- care
- encouragement
- medication reminders
- companionship
- reassurance

Meddy should feel:

- gentle
- warm
- friendly
- trustworthy
- comforting

Meddy should not feel:

- chaotic
- overly childish
- scary
- overly clinical
- judgmental

---

## Source Assets

The project uses existing transparent PNG artwork of Meddy.

Always prefer the provided Meddy PNG assets.

Do not:

- redraw Meddy
- redesign Meddy
- regenerate Meddy
- recolor Meddy
- change facial features
- stretch Meddy
- distort Meddy's proportions
- crop important parts of the mascot
- alter Meddy's outfit or accessories

Preserve the source artwork.

When displaying Meddy with React Native `Image`, use an appropriate contain-style resize behavior.

Example:

```tsx
<Image source={source} resizeMode="contain" style={styles.mascot} />
```

Always allow enough room for:

- ears
- hands
- feet
- accessories
- pose-specific props

---

# Official Mascot States

There are currently **exactly four supported Meddy mascot states**:

1. `default`
2. `caring`
3. `success`
4. `reminder`

Do not invent additional mascot states unless new assets are explicitly added to the project.

---

## Default

Use the `default` Meddy asset for:

- Home screen
- greeting sections
- normal idle state
- general informational screens
- Profile
- Medicines screen when no special state is needed

This is Meddy's standard neutral/friendly appearance.

Example:

```tsx
<MeddyMascot state="default" />
```

---

## Caring

Use the `caring` Meddy asset for:

- supportive messages
- Care Circle
- caregiver-related sections
- reassurance
- gentle warnings
- overdue medication messages where a compassionate tone is appropriate
- empty states where encouragement is useful

Example:

```tsx
<MeddyMascot state="caring" />
```

The caring state should never be paired with harsh or judgmental wording.

---

## Success

Use the `success` Meddy asset when:

- a medicine is marked Taken
- all medicines for a period are completed
- today's medication goal is completed
- a medicine is successfully added
- a schedule is successfully saved
- another meaningful positive action completes

Example:

```tsx
<MeddyMascot state="success" />
```

Success may be paired with subtle visual effects such as:

- small hearts
- check animation
- light confetti
- gentle bounce

Do not make the success experience excessively energetic.

---

## Reminder

Use the `reminder` Meddy asset for:

- medication due now
- upcoming medication reminders
- medication reminder screens
- alarm-related interfaces
- snooze reminder states

Example:

```tsx
<MeddyMascot state="reminder" />
```

The reminder state should make the medication action clear without making the user feel alarmed or pressured.

---

# Unsupported States

Do not reference nonexistent assets or states such as:

- idle
- happy
- concerned
- sad
- angry
- sleep
- sleeping
- celebration
- doctor
- nurse

unless a corresponding official Meddy asset is added later.

When no specialized state matches the situation, use:

`default`

---

# Recommended Asset Naming

Prefer this structure:

```text
assets/
└── images/
    └── meddy/
        ├── meddy-default.png
        ├── meddy-caring.png
        ├── meddy-success.png
        └── meddy-reminder.png
```

Do not rename source assets unnecessarily if they are already integrated into the project.

---

# Recommended Component API

Prefer a reusable mascot component rather than importing individual mascot PNGs throughout the app.

Example API:

```tsx
<MeddyMascot state="default" />
<MeddyMascot state="caring" />
<MeddyMascot state="success" />
<MeddyMascot state="reminder" />
```

Recommended TypeScript state:

```tsx
export type MeddyState = "default" | "caring" | "success" | "reminder";
```

Keep the image mapping inside the mascot component.

Example concept:

```tsx
const meddyImages = {
  default: require("../assets/images/meddy/meddy-default.png"),
  caring: require("../assets/images/meddy/meddy-caring.png"),
  success: require("../assets/images/meddy/meddy-success.png"),
  reminder: require("../assets/images/meddy/meddy-reminder.png"),
};
```

This keeps mascot usage consistent across the app.

---

# Placement

Meddy should feel integrated into the interface rather than placed randomly as decoration.

## Hero Areas

Meddy may:

- appear prominently on the right side
- slightly overlap a hero card
- extend visually beyond a colored background shape
- sit beside a greeting or short message

Keep enough negative space around the character.

Do not place Meddy inside a tiny square card.

Do not hide the mascot behind text.

---

## Reminder Screen

For an active medicine reminder:

- Meddy may be larger than usual
- use the `reminder` state
- keep medicine information highly visible
- do not let the mascot overpower the medication details or primary button

---

## Success State

After a medicine is marked Taken:

- switch to `success`
- optionally animate Meddy briefly
- return to the appropriate normal state afterward

Do not permanently display the success state when the user is simply browsing the app.

---

# Animation

Meddy's PNG artwork may be animated using React Native animation techniques.

Prefer subtle animations.

Good examples:

### Default

Gentle floating:

- slight vertical movement
- slow duration
- minimal amplitude

### Caring

Gentle fade or subtle scale-in.

### Success

Small bounce after completing an action.

### Reminder

Subtle shake, pulse, or attention movement.

Animations should remain calm and accessible.

---

## Motion Rules

Do not:

- constantly shake the mascot
- use fast repetitive movement
- rotate the entire mascot excessively
- create distracting infinite animations
- distort the PNG during animation

Animation should support meaning.

It should not exist merely because animation is possible.

---

# Lottie

Lottie may be used for **decorative effects**, not as a replacement for the official Meddy PNG artwork unless an actual Meddy Lottie asset is later provided.

Possible Lottie effects:

- hearts
- subtle confetti
- bell movement
- success check
- small sparkles

Keep these secondary to Meddy.

---

# Accessibility

Mascot animation must never be required to understand important information.

Important medication information must also be communicated through:

- text
- icons
- labels
- buttons

Do not rely on Meddy's facial expression alone to communicate:

- Taken
- Missed
- Upcoming
- Overdue
- Success

---

# Final Rule

Meddy has only four official visual states at this stage:

**default, caring, success, reminder**

Always choose from those four.

Never invent another pose or mascot state unless a new official asset is explicitly added.
