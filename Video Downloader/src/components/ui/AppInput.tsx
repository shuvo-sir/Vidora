import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { Radius, Spacing, Typography } from '@/src/theme';
import { useSettings } from '@/src/features/settings/SettingsProvider';

export interface AppInputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  helperText?: string;
  errorMessage?: string;
  leftAccessory?: ReactNode;
  rightAccessory?: ReactNode;
  editable?: boolean;
  disabled?: boolean;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  textInputProps?: Omit<TextInputProps, 'value' | 'onChangeText' | 'editable' | 'keyboardType' | 'secureTextEntry'>;
}

export function AppInput({
  label,
  placeholder,
  value,
  onChangeText,
  helperText,
  errorMessage,
  leftAccessory,
  rightAccessory,
  editable = true,
  disabled = false,
  keyboardType = 'default',
  secureTextEntry = false,
  accessibilityLabel,
  style,
  textInputProps,
}: AppInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const isDisabled = disabled || !editable;
  const hasError = Boolean(errorMessage);
  const { colors } = useSettings();
  const styles = useMemo(() => StyleSheet.create({
    container: {
      width: '100%',
    },
    label: {
      ...Typography.sm,
      color: colors.textPrimary,
      marginBottom: Spacing.sm,
    },
    inputContainer: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.md,
      backgroundColor: colors.surface,
    },
    inputFocused: {
      borderColor: colors.primary,
    },
    inputError: {
      borderColor: colors.error,
    },
    inputDisabled: {
      opacity: 0.5,
    },
    input: {
      flex: 1,
      minHeight: 52,
      paddingHorizontal: Spacing.md,
      color: colors.textPrimary,
      ...Typography.md,
    },
    accessoryLeft: {
      marginLeft: Spacing.md,
    },
    accessoryRight: {
      marginRight: Spacing.md,
    },
    helperText: {
      ...Typography.xs,
      color: colors.textSecondary,
      marginTop: Spacing.sm,
    },
    errorText: {
      ...Typography.xs,
      color: colors.error,
      marginTop: Spacing.sm,
    },
  }), [colors]);

  return (
    <View style={[styles.container, style]}>
      {label ? (
        <Text style={styles.label} nativeID={`${accessibilityLabel ?? label}-label`}>
          {label}
        </Text>
      ) : null}

      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputFocused,
          hasError && styles.inputError,
          isDisabled && styles.inputDisabled,
        ]}>
        {leftAccessory ? <View style={styles.accessoryLeft}>{leftAccessory}</View> : null}
        <TextInput
          {...textInputProps}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          editable={!isDisabled}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          onFocus={(event) => {
            setIsFocused(true);
            textInputProps?.onFocus?.(event);
          }}
          onBlur={(event) => {
            setIsFocused(false);
            textInputProps?.onBlur?.(event);
          }}
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityLabelledBy={label ? `${accessibilityLabel ?? label}-label` : undefined}
          accessibilityHint={errorMessage ?? helperText}
          style={styles.input}
        />
        {rightAccessory ? <View style={styles.accessoryRight}>{rightAccessory}</View> : null}
      </View>

      {errorMessage ? (
        <Text accessibilityRole="alert" style={styles.errorText}>
          {errorMessage}
        </Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
}
