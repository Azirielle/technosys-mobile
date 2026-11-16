# Motion

Subtle and purposeful: motion explains what happened (you pressed it, it saved, you moved to a new place).
It never decorates for its own sake. Built with `react-native-reanimated` (already installed), so it runs
smoothly even on cheap Android phones. Presets live in `src/ui/motion.ts`; screens never type their own durations.

## Timing tokens

| Token | Duration | Use |
|---|---|---|
| `instant` | 90 ms | press down |
| `quick` | 150 ms | tab switch, small fades |
| `base` | 220 ms | cards appearing, color fills, sheets |
| `slow` | 350 ms | success check, color wave |
| `spring` | damping 16, stiffness 260 | press release, toggles, expanding button |
| `stagger` | 40 ms between items, max 6 items | lists and grids arriving |

Easing for fades and slides: ease-out (`Easing.out(Easing.cubic)`).

## The catalogue

| # | Pattern | Where in TechnoSys | How it moves | From |
|---|---|---|---|---|
| 1 | **Press feedback** | every button, card and row | shrinks to 97% in `instant`, springs back; light haptic tap on main actions | pin 2 |
| 2 | **Interactive card fill** | choosing a leave type, a tool problem, setup choices, filter chips | background fills with brand-tint (or the area color), icon chip turns solid, check appears; `base` | pin 1 |
| 3 | **Expanding action button** | "New request" in Inbox and Me → My requests | springs open into 4 choices (Leave, Time correction, Tool problem, Something else), each pops in 40 ms after the last; tap outside or Back collapses | pin 2 |
| 4 | **Staggered arrival** | Home cards, DTR days, Jobs list, My tools | each item fades in and rises 8 px, `base`, 40 ms apart; only the first 6 items, the rest just appear | pins 1 and 3 |
| 5 | **Screen push** | opening any detail | native stack slide from the right (Android back goes back); content then uses #4 | pins 1 and 3 |
| 6 | **Tab switch** | bottom tabs | content crossfades in `quick`; the active tab's pill slides under the new tab with `spring` | pin 2 |
| 7 | **Collapsing header** | Home, DTR, Inbox | big title shrinks into a small top bar while scrolling | pin 1 |
| 8 | **Short sheet** | quick choices (filters, confirm sign-out) | rises from the bottom with a dim backdrop, `base`. **Closes with a button or Back, never by dragging a scrolling sheet** (the 16 Nov jitter) | pin 3 |
| 9 | **Skeleton loading** | every list and card that loads | grey shapes the same size as the real content, soft shimmer every 1.2 s; shown only if loading takes over 150 ms; crossfades to content in `quick` | Andrew's request |
| 10 | **Success** | time in/out saved, leave sent, policy signed, phone registered | a check draws itself in a green circle (`slow`), Techy gives a small hop, then the card settles into its new state ("Timed in 8:02") | Andrew's request |
| 11 | **Gentle error** | wrong PIN, missing field | the field shakes 3 times, 6 px, 250 ms, and the message appears below | |
| 12 | **Color wave** | **only** when first-time setup finishes, going to Home | the brand color floods out from the Finish button, then drains to reveal Home (`slow` + `slow`) | pin 3 |
| 13 | **Count-up** | hours worked, tools out | numbers count up in `base` when the card first appears | |
| 14 | **Living Techy** | overlay dock on every tab, empty states | breathes (2.5 px float, 3.2 s), blinks every 3–6 s, air from its vents; cheers and hops on time in, waves then rests on time out, worried face when something is due. Docked and tucked at the screen edge (peeking, tilted); slides out with a spring to react or speak, tucks back after ~4 s; drag snaps to the nearest edge. Speech bubble only for useful lines (where you are, what's due), never repeats the success message | Andrew's request |

Not used: bouncing icons, parallax, confetti, page flips, or anything longer than 700 ms. The only endless loops are Techy's slow breathing and vents, which stop with "Reduce motion".

## Reduce motion

If the phone has "Remove animations / Reduce motion" on, every pattern above becomes a plain `quick` fade
(the wave becomes a fade, the success check appears already drawn, no shake, no haptics).
This is handled once, in `src/ui/motion.ts`.

## Haptics

Light tap on: Time in / Time out, New request, Approve-type confirmations. Success haptic on #10. Error haptic on #11.
Nothing on ordinary taps. Needs `expo-haptics` (works in Expo Go).
