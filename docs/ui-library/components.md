# Components

Every screen is built from these. They live in `src/ui/` (one component per file) and read colors,
sizes and motion from `src/ui/tokens.ts` and `src/ui/motion.ts`. If a screen needs something new,
add it here first. A hidden preview screen (development builds only) shows every component in light and dark.

## Structure

| Component | What it is |
|---|---|
| `Screen` | safe area, canvas color, side padding, optional collapsing header (motion #7) |
| `TabBar` | Home · Jobs · DTR · Me (no center button), sliding active pill (motion #6) |
| `TimeInCard` | glass card on Home: status pill, clock (or time worked), shift line, shift progress (accent), Time in / Time out button with the confirmation sequence |
| `Header` | title, optional back button, optional bell (plain icon, brand badge with the unread count) |

## Content

| Component | What it is |
|---|---|
| `Card` | white rounded card; `pressable` adds motion #1 |
| `ChoiceCard` | interactive card that fills when selected (motion #2) |
| `ListRow` | icon chip, title, subtitle, right side (chevron, pill or value) |
| `IconChip` | rounded square with an icon in its area color (`colors.md`) |
| `StatusPill` | Done / Waiting / Declined with words, status colors only |
| `SectionLabel` | small grey label above a group ("My work") |
| `Avatar` | initials in a navy-tint circle |
| `NoticeBox` | error, warning or success message box |
| `EmptyState` | Techy + one line + one action ("No requests yet. File one when you need it.") |

## Actions and input

| Component | What it is |
|---|---|
| `Button` | primary (navy), action (yellow, one per screen), secondary (outline), ghost, danger; sizes md/lg; loading state |
| `ExpandingButton` | "New request" that springs open into choices (motion #3) |
| `SegmentedControl` | Requests / Attendance / Tools switch with sliding thumb |
| `Sheet` | short choice sheet, closes with a button or Back, no drag on scrolling content (motion #8) |
| `TextField` | label, input, hint, error with shake (motion #11) |
| `PinBoxes` | 4-digit PIN boxes (already built for sign-in) |

## Feedback

| Component | What it is |
|---|---|
| `Skeleton` set | `SkeletonCard`, `SkeletonRow`, `SkeletonText`: shapes of the real content (motion #9) |
| `SuccessCheck` | the drawing check in a green circle (motion #10) |
| `Toast` | short message at the bottom for small confirmations ("Copied") |
| `Techy` | the mascot as an SVG, with moods: ready, cheer, wave, worry, rest. Used in empty states |
| `TechyDock` | the overlay: Techy docked at the left or right screen edge above the tab bar on every tab; tucked, slides out to react or speak, tap = Ask Techy, drag to switch sides (side is remembered) |
| `DtrSummary`, `DtrDay` | DTR totals and one day (times, work-type tag, status words, tap to see why) |

## Loading rules

- Never a blank screen and never a full-screen spinner inside the app.
- Lists and cards: skeletons. Buttons: a small spinner inside the button.
- Waits over 3 seconds: Techy "thinking" with "Still loading, check your signal".
- App start: the splash shows the logo, then Home arrives with motion #4.
