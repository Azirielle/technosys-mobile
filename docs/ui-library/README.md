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
| 16 Nov 2026 | **Phase 1 built (tabs and navigation):** `app/(tabs)` is Home · Jobs · DTR · Me with `TabBar` (sliding pill, cyan underline, haptic) and a crossfade between tabs; `TechyDock` overlay on every tab (`techy.react()` / `techy.say()`; reacts to time in/out; tap = Ask Techy; drag to switch sides, remembered). The Menu pill, menu sheet and Profile sheet are gone; Me lists everything, and features still living on Home open there via `lib/homeActions.ts` until their phase. Swipe-to-close is off on every remaining pop-up. Jobs and DTR are new screens on the library; the DTR uses the admin's exact rules (`lib/dtr.ts`) and matched the admin's 1–15 Nov numbers for Juan, Pedro and Joel. |
| 16 Nov 2026 | **Fixes from Andrew's Phase 1 test + Phase 2 (Home):** Back on the phone returns to the screen you came from (root is a stack; Handbook, DTR day and Ask HR are pushed screens). No drag handles anywhere (nothing looks swipeable). Everything arrives at once (no stagger). **Home** follows the prototype: date + Today + bell → glass time-in card (not timed in / working with cyan shift bar / done, green check on change) → today's job (Details, Navigate) → three shortcuts (My tools, Leave, Updates) → Needs your attention. **Jobs:** the job now or next on top, "What changed this week" (moved, cancelled, VIP squeeze-in, crew added, with the office's reason), later today, coming up by day, earlier folded; updates live. **DTR:** one summary card, "Needs a look", every day; a day opens its own screen with how the hours were counted, HR's changes, and **Ask HR about this day** (a DTR concern ticket). **Me:** photo, General (notifications, appearance, language), Security (handbook and forms, work phone), Sign out. **Handbook** redesigned; office-only policies hidden. |
| 16 Nov 2026 | **Second test round:** *Me* is now **Profile**, laid out like a phone's Settings (Andrew's reference): photo card, then General / Security groups with grey icon squares, no dividers, the current value before the arrow; Appearance and Language open their own screen; Sign out is a red row. **Tabs switch instantly** (no fade, like the phone's own apps); the pill moves the moment you tap, 200 ms ease-out, no bounce; all tabs load at start. **Back/forward slide** is the smooth native iOS-style slide on Android too, pushed screens don't fade on top of it, and a screen you return to reloads only after the slide ends (`lib/useFocusRefresh.ts`). Earlier jobs are a compact list (see-through cards over a shadow showed a grey frame on Android: never fade a card that has a shadow). |
| 16 Nov 2026 | **Third test round:** **One way to open things:** every feature opened from a tab is a full screen that slides in from the right (`PushedScreen`): job details (`app/job/[id].tsx`, replaces the Dispatch Details pop-up; Jobs cards open it instead of expanding), My tools + Report a problem, Leave + File a leave (with the certificate photo actually uploaded now), Updates. Sending something ends on one `SentScreen` (Ask HR, tool problem, leave). Pop-ups are only for real dialogs (time-in check, inbox, support chat) and now use the native animation (the old ones ran on the JavaScript thread: ~25 fps). **Maps:** Esri street tiles, because OpenStreetMap's servers refuse apps ("Access blocked"), which is why the map stayed black. **Vibrate on tap** switch in Profile → General (`Toggle`; every buzz goes through `haptic`). New library pieces: `PushedScreen`, `SentScreen`, `DateField`, `Toggle`, `ListRow leading`. |
| 16 Nov 2026 | **After the third test (Andrew):** **Maps are Google Maps only** (replaces the Esri tiles above; no OpenStreetMap, Esri or Leaflet). `MapWrapper` is a plain Google map with the normal blue "you are here" dot. **Back on Android** uses Android's full slide (`slide_from_right`, ~400 ms, both screens move); the copied iPhone slide (`ios_from_right`) is only ~200 ms on Android and showed the previous screen at once. iPhones keep `ios_from_right`. |
