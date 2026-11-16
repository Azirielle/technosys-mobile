# Colors

**Decided 16 Nov 2026 (Andrew): Cool air, split 70 / 20 / 10.** Live in `prototype/index.html`.
The values go into `src/ui/tokens.ts`.

| Share | Color | Why | Where |
|---|---|---|---|
| **70%** | cloud white `#FFFFFF` and cool grey `#F3F6F9` | calm, clean, readable outdoors | backgrounds, cards, lists |
| **20%** | Technocycle blue `#154C84` (the logo's top arrow) | trust, "this is ours" | buttons, active tab pill, icons, links, headings accents |
| **10%** | cool-air cyan `#22B8F0` | fresh, cool, the company's job | **small highlights only:** active-tab underline, shift progress, live/pulse dots, Techy's air, the glow |

The accent is cyan, not yellow or orange: yellow already means "pending" and red means "problem", so a warm
accent would make normal screens look like warnings.

## Why these colors (color psychology for an internal Technocycle app)

Restaurants use red because it reads as appetite. TechnoSys is Technocycle's own tool, used by people who
service aircons, so the colors should say "this is Technocycle, and it's calm, clean and cool":

- **The logo's own blue** (`#154C84`, the top arrow) is the main color. Staff see it on the logo every day,
  so the app reads as "ours", not as a random app. Blue also means trust and calm, which matters for an app
  that records attendance (it shouldn't feel like a boss watching).
- **Cool-air cyan** is the accent: cool, fresh, clean, like a freshly serviced aircon. It is the company's job in one color.
- **Status colors are the logo's other three arrows**, darkened so text reads in sunlight:
  green = OK, yellow = pending, red = problem. Blue = information. So even warnings feel like Technocycle.
- The logo colors are **not** used as decoration (tried as icon colors on 16 Nov: rejected).

## Status (words always come with the color)

| Meaning | Text / icon | Pill background | Examples |
|---|---|---|---|
| OK (logo green) | `#1E6B45` | `#E6F2EB` | Timed in, Approved, Fixed |
| Pending (logo yellow) | `#7A6200` | `#FFF5C7` | Waiting for HR, HR checking |
| Problem (logo red) | `#8B2028` | `#FBE8EA` | Declined, Late 12 min, Due today |
| Information (logo blue) | `#154C84` | `#E6EFF8` | 2 to read, OT 3.0 h, Upcoming |

## Cool air values

| Role | Light | Use |
|---|---|---|
| canvas | `#F3F6F9` | behind everything (slightly cool) |
| card | `#FFFFFF` | cards and lists |
| card-soft | `#EEF2F6` | inputs, segmented track |
| line | `#E6EBF0` | hairlines |
| ink / ink-2 / ink-3 | `#16202B` / `#5E6B78` / `#8A96A3` | text |
| brand | `#154C84` | buttons, active tab, links, unread badge |
| brand-strong | `#0F3A66` | pressed |
| tint | `#E6EFF8` | icon chips, active-tab pill |
| accent | `#22B8F0` | the 10% highlights |
| accent-soft | `#22B8F0` at 16% | track behind progress bars |
| glow | brand 30% + accent 40% | behind the glass at the top of Home |

Dark mode values are set in `src/ui/tokens.ts` when the foundation is built.

## Glass (decided 16 Nov: "minimalist glassmorphic" fusion)

Glass only shows over color, so: a soft glow at the top of Home, and frosted glass on the time-in card,
the bottom bar and sheets. The bell is a plain icon (no background, decided 16 Nov). Lists and reading cards stay solid white (readable outdoors).
Phones too slow for blur get white 92% without blur (`src/ui/Glass.tsx`, needs `expo-blur`).

## Rules

- No gradients except the glow and the splash screen.
- Never white text on a pale color.
- At most one filled (brand) button per screen.
