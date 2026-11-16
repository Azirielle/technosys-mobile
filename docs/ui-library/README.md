# TechnoSys mobile UI/UX library

The rules for how the mobile app looks, moves and feels. Read this before changing any screen.
Andrew's preferences are recorded here so every chat and every teammate builds the same app.

| File | What it holds |
|---|---|
| `README.md` (this file) | Direction, preferences, rules, decisions |
| [`colors.md`](colors.md) | Palette options and the one in use |
| [`type-and-layout.md`](type-and-layout.md) | Font, sizes, spacing, corners, shadows |
| [`motion.md`](motion.md) | Every animation: when, how long, how it moves |
| [`components.md`](components.md) | The building blocks screens are made of |
| [`references.md`](references.md) | The examples Andrew picked and what we took from each |
| [`prototype/index.html`](prototype/index.html) | Clickable prototype of the look and motion (open in a browser) |

The code that matches these files lives in `src/ui/` (tokens, motion presets, components).

## Direction (decided 16 Nov 2026)

**Design A, "bright cards"**: Andrew picked the first mock-up (Home + Me, bottom tab bar). Not the teal version, not the bold blue header.

- **Style:** Friendly human-centered design first, then colorful minimalist UI, with motion and interaction on top.
- **Feel:** lively and natural, but calm. Technicians use it every morning, often outdoors and in a hurry. Never visually overwhelming or hard to navigate.
- **Different from the admin on purpose:** the admin is soft-minimal ("Cloud"). The mobile shares its neutrals and status colors, so both apps feel like one product, but it is warmer and uses the logo colors.

## Andrew's preferences (keep these)

1. **Few colors, each with one job.** No rainbow. Feedback on 16 Nov: "you picked like 10 kinds of color".
2. **No filler.** "Good morning, Ramon" style lines that say nothing read as AI slop. Every line on screen must tell the person something.
3. **One font family, chosen on purpose,** with a fixed size scale.
4. **Notifications stay visible:** a bell with a dot at the top of Home. People must always find what needs their attention and the history of what they asked for.
5. **The mascot (Techy) is part of the design,** not an afterthought. It is the only illustration style in the app.
6. **Subtle animation, not excessive movement.** Interactions should feel natural.
7. **Smooth navigation:** real screens and tabs, no draggable sheets stacked on swipeable screens (that caused the jitter in the 16 Nov recording).
8. **Better loading:** skeletons shaped like the content, never a blank screen or a lonely spinner.
9. **Success moments:** saving something important (time-in, leave sent, policy signed) gets a short, happy confirmation.
10. **Show a couple of options, mark one recommended** before building anything big (see memory note "prefers clear recommendations").

## Rules for screens

- Screens arrange components from `src/ui/`. No hex colors, font sizes, shadows or durations typed into a screen.
- All text comes from `src/locales/en.json` and `fil.json` (`useT`).
- Every tap target is at least 44 × 44.
- Text on a color uses the dark shade of that same color, and passes contrast in sunlight. Never white text on a light color.
- Light and dark mode both work.
- Every animation respects the phone's "Reduce motion" setting (see `motion.md`).
- No payroll, pay amounts, social login or QR attendance (out of scope).

## Decisions log

| Date | Decision |
|---|---|
| 16 Nov 2026 | Design A chosen. Bell on Home opens Inbox. |
| 16 Nov 2026 | Motion examples chosen (see `references.md`). |
| 16 Nov 2026 | Colors: navy and white; color only for status words (green OK, yellow pending, red error, blue information). Logo colors as decoration rejected. |
| 16 Nov 2026 | Style fusion: minimalist + glass (time-in card, bottom bar, sheets on a soft navy glow). Lists stay solid white. |
| 16 Nov 2026 | **Bottom tabs changed: Home · Jobs · DTR · Me.** No center button (the fingerprint button was "a mess"); time in happens on the Home card. History tab dropped: request status lives in Inbox, Home "Needs your attention" and Me → My requests. |
| 16 Nov 2026 | **DTR tab:** cut-off switcher, hours worked, approved OT, night shift (10 PM–6 AM), lates, absences, where they worked (on-site / out of town / office HQ), and each day with its times, tags and an explanation. Uses the same rules as the admin DTR. |
| 16 Nov 2026 | **Techy is an overlay** on every tab: docked at the screen edge above the tab bar, mostly tucked away; slides out only to react (time in: cheer, time out: wave then rest) or to say something useful, then tucks back. Tap = Ask Techy; drag to the other edge if it's in the way. |
| 16 Nov 2026 | Colors: logo blue as the main color (color psychology: "this is Technocycle", calm, cool air); status colors are the logo's other arrows. **Cool air chosen, 70/20/10**: 70% cloud white, 20% logo blue, 10% cool-air cyan accent (`colors.md`). Bell is a plain icon. |
| 16 Nov 2026 | Must feel alive: time-in confirmation, interactive job card, one identity for quick actions, animated tab bar, friendly inbox empty states. See `prototype/index.html`. |
| 16 Nov 2026 | **Phase 0 built (foundation):** `src/ui/` has tokens (Cool air light + dark, type scale, spacing, corners, shadows, motion timing), motion presets (press feedback, staggered arrival, haptics, reduce motion), and Txt, PressableScale, Button, Card, ChoiceCard, IconChip, StatusPill/StatusText, ListRow, SectionLabel, Notice, Skeleton set, GlowScreen + Glass, SuccessCheck and Techy (5 moods, alive). Plus Jakarta Sans is loaded. Sign-in and first-time setup use them. Dev-only `/ui-preview` shows everything. Still to build: TabBar, TechyDock, Sheet, TextField, ExpandingButton, Toast, the color wave. |
