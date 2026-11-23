import { useMemo, type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Radius, Spacing } from '@/src/theme';
import { useSettings } from '@/src/features/settings/SettingsProvider';

export type AppCardVariant = 'default' | 'secondary' | 'outline';

export interface AppCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  variant?: AppCardVariant;
}

export function AppCard({
  children,
  style,
  padding = Spacing.md,
  variant = 'default',
}: AppCardProps) {
  const { colors } = useSettings();
  const styles = useMemo(() => StyleSheet.create({
    card: {
      width: '100%',
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
  }), [colors]);
  const variantStyles = useMemo(() => StyleSheet.create({
    default: { backgroundColor: colors.surface },
    secondary: { backgroundColor: colors.surfaceSecondary },
    outline: { backgroundColor: 'transparent' },
  }), [colors]);

  return (
    <View
      style={[
        styles.card,
        variantStyles[variant],
        { padding },
        style,
      ]}>
      {children}
    </View>
  );
}
