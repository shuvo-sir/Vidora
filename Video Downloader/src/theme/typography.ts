import type { TextStyle } from 'react-native';

export const Typography = {
  xs: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  sm: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  md: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
  lg: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '600',
  },
  xl: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
  },
  xxl: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
  },
  display: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
  },
} satisfies Record<string, TextStyle>;
