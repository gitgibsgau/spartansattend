// theme/index.js
// Central design tokens for SpartansAttend.
// Refined light theme with an indigo -> violet accent.
// Import what you need:  import { colors, spacing, radius, typography, shadows } from '../theme';

export const colors = {
  // Brand accent (indigo -> violet)
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  primaryLight: '#8B5CF6',
  primaryGradient: ['#6366F1', '#8B5CF6'],
  primarySoft: '#EEF2FF', // tinted background for chips / soft buttons
  primaryOn: '#FFFFFF', // text/icon on top of primary

  // Surfaces
  background: '#F7F8FB', // app background (soft off-white)
  backgroundAlt: '#EEF1F6', // subtle alternate background
  surface: '#FFFFFF', // cards
  surfaceMuted: '#F1F5F9', // inset / muted surface
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',

  // Text
  text: '#0F172A', // primary text
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textOnPrimary: '#FFFFFF',

  // Status
  success: '#059669',
  successSoft: '#D1FAE5',
  successDark: '#047857',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  warning: '#D97706',
  warningSoft: '#FEF3C7',
  info: '#2563EB',
  infoSoft: '#DBEAFE',

  // Misc
  white: '#FFFFFF',
  black: '#0F172A',
  overlay: 'rgba(15, 23, 42, 0.45)',
  shadow: '#0F172A',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 999,
};

// Poppins font families (loaded per-screen via @expo-google-fonts/poppins).
export const fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
};

export const typography = {
  // size + lineHeight pairs; combine with a fontFamily from `fonts`
  h1: { fontSize: 26, lineHeight: 32 },
  h2: { fontSize: 22, lineHeight: 28 },
  h3: { fontSize: 18, lineHeight: 24 },
  title: { fontSize: 16, lineHeight: 22 },
  body: { fontSize: 14, lineHeight: 21 },
  small: { fontSize: 12.5, lineHeight: 18 },
  caption: { fontSize: 11, lineHeight: 15 },
};

export const shadows = {
  // Soft, modern elevation. iOS uses shadow*, Android uses elevation.
  none: {},
  sm: {
    shadowColor: colors.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  md: {
    shadowColor: colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  lg: {
    shadowColor: colors.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  // Colored glow for primary buttons
  primary: {
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
};

const theme = { colors, spacing, radius, fonts, typography, shadows };
export default theme;
