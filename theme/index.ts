import { Platform } from 'react-native';

export const Colors = {
  background: '#0b1220',
  surface1: '#111827',
  surface2: '#1f2937',
  glassBg: 'rgba(255, 255, 255, 0.06)',
  borderGlass: 'rgba(255, 255, 255, 0.18)',
  textPrimary: '#f9fafb',
  textSecondary: '#cbd5f5',
  textTertiary: '#94a3b8',
  primary: '#22d3ee',
  secondary: '#38bdf8',
  warning: '#f59e0b',
  error: '#ef4444',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

export const Typography = {
  h1: {
    fontSize: 32,
    fontWeight: '700' as const,
  },
  h2: {
    fontSize: 24,
    fontWeight: '700' as const,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as const,
  },
  label: {
    fontSize: 12,
    fontWeight: '600' as const,
    letterSpacing: 0.3,
  },
  caption: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
};

export const Shadows = {
  lg: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
    },
    android: {
      elevation: 8,
    },
    default: {},
  }),
};
