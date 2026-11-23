import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Spacing, Typography } from '@/src/theme';
import { useSettings } from '@/src/features/settings/SettingsProvider';

export interface AppHeaderProps {
  title: string;
  subtitle?: string;
  leftSlot?: ReactNode;
  rightSlot?: ReactNode;
}

export function AppHeader({
  title,
  subtitle,
  leftSlot,
  rightSlot,
}: AppHeaderProps) {
  const { colors } = useSettings();
  const styles = useMemo(() => StyleSheet.create({
    header: {
      width: '100%',
      minHeight: 56,
      flexDirection: 'row',
      alignItems: 'center',
    },
    titleContainer: {
      flex: 1,
      justifyContent: 'center',
    },
    title: {
      ...Typography.xxl,
      color: colors.textPrimary,
    },
    subtitle: {
      ...Typography.sm,
      color: colors.textSecondary,
      marginTop: Spacing.xs,
    },
    sideSlot: {
      marginRight: Spacing.md,
    },
    rightSlot: {
      marginRight: 0,
      marginLeft: Spacing.md,
    },
  }), [colors]);

  return (
    <View style={styles.header}>
      {leftSlot ? <View style={styles.sideSlot}>{leftSlot}</View> : null}
      <View style={styles.titleContainer}>
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={2} style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {rightSlot ? <View style={[styles.sideSlot, styles.rightSlot]}>{rightSlot}</View> : null}
    </View>
  );
}
