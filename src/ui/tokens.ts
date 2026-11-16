// Design tokens for the mobile app: the ONE place for colors, type, spacing, corners, shadows and motion timing.
// Values come from docs/ui-library (colors.md "Cool air 70/20/10", type-and-layout.md, motion.md).
// Screens and components never type hex values, sizes or durations: they read them from here (useTokens()).

export type Palette = {
  canvas: string; card: string; cardSoft: string; line: string;
  ink: string; ink2: string; ink3: string;
  brand: string; brandStrong: string; tint: string; onBrand: string;
  accent: string; accentSoft: string;
  glow1: string; glow2: string; glass: string; glassLine: string; scrim: string;
  ok: string; okBg: string; pending: string; pendingBg: string;
  error: string; errorBg: string; info: string; infoBg: string;
};

// 70% cloud white / cool grey · 20% Technocycle blue (logo) · 10% cool-air cyan.
// Status colors are the logo's arrows, darkened so text reads in sunlight.
const light: Palette = {
  canvas: '#F3F6F9', card: '#FFFFFF', cardSoft: '#EEF2F6', line: '#E6EBF0',
  ink: '#16202B', ink2: '#5E6B78', ink3: '#8A96A3',
  brand: '#154C84', brandStrong: '#0F3A66', tint: '#E6EFF8', onBrand: '#FFFFFF',
  accent: '#22B8F0', accentSoft: 'rgba(34, 184, 240, 0.16)',
  glow1: 'rgba(21, 76, 132, 0.30)', glow2: 'rgba(34, 184, 240, 0.40)',
  glass: 'rgba(255, 255, 255, 0.62)', glassLine: 'rgba(255, 255, 255, 0.75)', scrim: 'rgba(16, 17, 22, 0.32)',
  ok: '#1E6B45', okBg: '#E6F2EB', pending: '#7A6200', pendingBg: '#FFF5C7',
  error: '#8B2028', errorBg: '#FBE8EA', info: '#154C84', infoBg: '#E6EFF8',
};

const dark: Palette = {
  canvas: '#0E1319', card: '#18202A', cardSoft: '#212B36', line: '#2A3440',
  ink: '#EEF3F8', ink2: '#A3AFBC', ink3: '#788594',
  brand: '#7FB2EA', brandStrong: '#A9CCF2', tint: '#1B2C40', onBrand: '#0E1319',
  accent: '#3CC6F5', accentSoft: 'rgba(60, 198, 245, 0.18)',
  glow1: 'rgba(21, 76, 132, 0.45)', glow2: 'rgba(60, 198, 245, 0.22)',
  glass: 'rgba(24, 32, 42, 0.62)', glassLine: 'rgba(255, 255, 255, 0.08)', scrim: 'rgba(0, 0, 0, 0.5)',
  ok: '#5CC08A', okBg: '#13301F', pending: '#E3C04A', pendingBg: '#33290A',
  error: '#F08A8F', errorBg: '#3A1519', info: '#7FB2EA', infoBg: '#1B2C40',
};

export const palettes = { light, dark };

/** Plus Jakarta Sans, three weights (loaded in app/_layout.tsx). */
export const fonts = {
  regular: 'Jakarta-Regular',
  semibold: 'Jakarta-SemiBold',
  bold: 'Jakarta-Bold',
};

/** The only text sizes allowed (type-and-layout.md). */
export const type = {
  display: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 38 },
  title: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28 },
  heading: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  label: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
} as const;
export type TypeName = keyof typeof type;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
export const radius = { chip: 10, control: 14, card: 20, sheet: 28, round: 999 } as const;

/** Soft card shadow (light mode only; dark mode uses the lighter card surface instead). */
export const shadow = {
  card: { shadowColor: '#101116', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  raised: { shadowColor: '#101116', shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
};

/** Motion timing (motion.md). */
export const duration = { instant: 90, quick: 150, base: 220, slow: 350 } as const;
export const spring = { damping: 16, stiffness: 260, mass: 1 } as const;
export const stagger = { step: 40, max: 6 } as const;
