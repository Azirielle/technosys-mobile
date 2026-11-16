# Type and layout

## Font: one family

**Status: choose one.** Recommended: **Plus Jakarta Sans**.

| Option | Why | Cost |
|---|---|---|
| **Plus Jakarta Sans** (recommended) | Friendly, rounded, clear numbers for times like 8:02, narrower than Poppins so long Filipino text fits | One small package (`@expo-google-fonts/plus-jakarta-sans`) |
| DM Sans (current) | Already in the app, neutral and compact | None, but it reads more generic |

Three weights only: Regular 400, Semibold 600, Bold 700.

## Type scale (the only sizes allowed)

| Token | Size / line | Weight | Use |
|---|---|---|---|
| `display` | 28 / 34 | Bold | the clock on the time-in card |
| `title` | 22 / 28 | Bold | screen titles |
| `heading` | 17 / 22 | Semibold | card titles |
| `body` | 15 / 21 | Regular | normal text |
| `label` | 13 / 18 | Semibold | buttons, tabs, pills |
| `caption` | 12 / 16 | Regular | hints, timestamps |

Sentence case everywhere. No ALL CAPS.

## Spacing (multiples of 4)

`xs 4 · sm 8 · md 12 · lg 16 · xl 20 · 2xl 24 · 3xl 32`. Screen side padding: 16. Gap between cards: 12.

## Corners

`chip 10 · control 14 (buttons, inputs) · card 20 · sheet 28 · round 999`.

## Shadows

Cards: very soft, from the admin (`0 1 2 / 4%` plus `0 8 24 / 5%`). In dark mode cards use a slightly lighter surface instead of a shadow.

## Touch

Minimum 44 × 44. Primary buttons 54 high. The center Time-in button is 60 across.
