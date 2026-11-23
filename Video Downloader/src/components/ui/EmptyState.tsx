import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/src/components/ui/AppButton';
import { Spacing, Typography } from '@/src/theme';
import { useSettings } from '@/src/features/settings/SettingsProvider';

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  description,
  icon,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const { colors } = useSettings();
  const styles = useMemo(() => StyleSheet.create({
    container: {
      width: '100%',
      minHeight: 220,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.lg,
    },
    iconContainer: {
      marginBottom: Spacing.md,
    },
    title: {
      ...Typography.xl,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    description: {
      ...Typography.md,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: Spacing.sm,
    },
    action: {
      marginTop: Spacing.lg,
    },
  }), [colors]);

  return (
    <View style={styles.container}>
      {icon ? <View style={styles.iconContainer}>{icon}</View> : null}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionLabel && onAction ? (
        <AppButton
          title={actionLabel}
          onPress={onAction}
          variant="primary"
          size="md"
          style={styles.action}
        />
      ) : null}
    </View>
  );
}
