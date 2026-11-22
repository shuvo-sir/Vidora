import type { ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Colors, Radius, Spacing } from '@/src/theme';

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

const variantStyles = StyleSheet.create({
  default: {
    backgroundColor: Colors.surface,
  },
  secondary: {
    backgroundColor: Colors.surfaceSecondary,
  },
  outline: {
    backgroundColor: 'transparent',
  },
});

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
