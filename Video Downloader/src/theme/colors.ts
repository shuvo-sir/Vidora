export type AppColors = {
  background: string;
  surface: string;
  surfaceSecondary: string;
  primary: string;
  secondary: string;
  textPrimary: string;
  textSecondary: string;
  success: string;
  warning: string;
  error: string;
  border: string;
};

const darkColors: AppColors = {
  background: '#0B1020',
  surface: '#151D30',
  surfaceSecondary: '#1D2940',
  primary: '#8B5CF6',
  secondary: '#38BDF8',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  border: '#29364C',
};

const lightColors: AppColors = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceSecondary: '#F1F5F9',
  primary: '#7C3AED',
  secondary: '#0284C7',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  success: '#16A34A',
  warning: '#D97706',
  error: '#DC2626',
  border: '#CBD5E1',
};

export const Colors = darkColors;

export function getColors(darkTheme: boolean): AppColors {
  return darkTheme ? darkColors : lightColors;
}
