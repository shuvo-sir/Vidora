import type { ReactNode } from 'react';
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

import { Colors, Radius, Spacing, Typography } from '@/src/theme';

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
              color={variant === 'outline' || variant === 'ghost' ? Colors.primary : Colors.textPrimary}
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

const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: Colors.primary,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  secondary: {
    backgroundColor: Colors.secondary,
    borderWidth: 1,
    borderColor: Colors.secondary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  danger: {
    backgroundColor: Colors.error,
    borderWidth: 1,
    borderColor: Colors.error,
  },
});

const variantTextStyles = StyleSheet.create({
  primary: { color: Colors.textPrimary },
  secondary: { color: Colors.background },
  outline: { color: Colors.primary },
  ghost: { color: Colors.textPrimary },
  danger: { color: Colors.textPrimary },
});

const sizeTextStyles = StyleSheet.create({
  sm: { ...Typography.sm, lineHeight: 18 },
  md: { ...Typography.md, lineHeight: 20, fontWeight: '600' },
  lg: { ...Typography.lg, lineHeight: 24 },
});

const styles = StyleSheet.create({
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
});
