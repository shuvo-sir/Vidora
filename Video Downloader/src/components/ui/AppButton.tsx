import { useMemo, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { Radius, Spacing, Typography } from '@/src/theme';
import { useSettings } from '@/src/features/settings/SettingsProvider';

export type AppButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type AppButtonSize = 'sm' | 'md' | 'lg';

export interface AppButtonProps {
  title: string;
  onPress: () => void;
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  disabled?: boolean;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

const sizeStyles = {
  sm: {
    minHeight: 36,
    paddingHorizontal: Spacing.sm,
  },
  md: {
    minHeight: 44,
    paddingHorizontal: Spacing.md,
  },
  lg: {
    minHeight: 52,
    paddingHorizontal: Spacing.lg,
  },
} as const;

export function AppButton({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  leftIcon,
  rightIcon,
  style,
  textStyle,
  accessibilityLabel,
}: AppButtonProps) {
  const isDisabled = disabled || loading;
  const { colors } = useSettings();
  const styles = useMemo(() => StyleSheet.create({
    primary: {
      backgroundColor: colors.primary,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    secondary: {
      backgroundColor: colors.secondary,
      borderWidth: 1,
      borderColor: colors.secondary,
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.primary,
    },
    ghost: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: 'transparent',
    },
    danger: {
      backgroundColor: colors.error,
      borderWidth: 1,
      borderColor: colors.error,
    },
    primaryText: { color: colors.textPrimary },
    secondaryText: { color: colors.background },
    outlineText: { color: colors.primary },
    ghostText: { color: colors.textPrimary },
    dangerText: { color: colors.textPrimary },
    button: {
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radius.md,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    contentPressed: {
      opacity: 0.86,
    },
    title: {
      textAlign: 'center',
    },
    iconLeft: {
      marginRight: Spacing.sm,
    },
    iconRight: {
      marginLeft: Spacing.sm,
    },
    pressed: {
      opacity: 0.82,
      transform: [{ scale: 0.985 }],
    },
    disabled: {
      opacity: 0.45,
    },
  }), [colors]);
  const variantStyles = {
    primary: styles.primary,
    secondary: styles.secondary,
    outline: styles.outline,
    ghost: styles.ghost,
    danger: styles.danger,
  };
  const variantTextStyles = {
    primary: styles.primaryText,
    secondary: styles.secondaryText,
    outline: styles.outlineText,
    ghost: styles.ghostText,
    danger: styles.dangerText,
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        sizeStyles[size],
        variantStyles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}>
      {({ pressed }) => (
        <View style={[styles.content, pressed && !isDisabled && styles.contentPressed]}>
          {loading ? (
            <ActivityIndicator
              size="small"
              color={variant === 'outline' || variant === 'ghost' ? colors.primary : colors.textPrimary}
            />
          ) : (
            <>
              {leftIcon ? <View style={styles.iconLeft}>{leftIcon}</View> : null}
              <Text
                numberOfLines={1}
                style={[styles.title, variantTextStyles[variant], sizeTextStyles[size], textStyle]}>
                {title}
              </Text>
              {rightIcon ? <View style={styles.iconRight}>{rightIcon}</View> : null}
            </>
          )}
        </View>
      )}
    </Pressable>
  );
}

const sizeTextStyles = StyleSheet.create({
  sm: { ...Typography.sm, lineHeight: 18 },
  md: { ...Typography.md, lineHeight: 20, fontWeight: '600' },
  lg: { ...Typography.lg, lineHeight: 24 },
});
