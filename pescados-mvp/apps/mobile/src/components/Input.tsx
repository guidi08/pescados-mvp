import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, theme, textStyle, resolveColor } from '../theme';

type Props = {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: any;
  multiline?: boolean;
  error?: string | null;
  helperText?: string;
};

export default function Input({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  multiline,
  error,
  helperText,
}: Props) {
  const borderColor = error ? resolveColor(theme.components.input.borderError) : resolveColor(theme.components.input.border);

  return (
    <View style={{ gap: spacing['2'] }}>
      {label ? <Text style={[textStyle('label'), { color: colors.text.secondary }]}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={resolveColor(theme.components.input.placeholder)}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[
          styles.input,
          {
            borderColor,
            backgroundColor: resolveColor(theme.components.input.bg),
            color: resolveColor(theme.components.input.text),
            borderRadius: radius[theme.components.input.radius as keyof typeof radius],
            minHeight: theme.components.input.height,
            paddingHorizontal: theme.components.input.paddingX,
            paddingVertical: multiline ? spacing['3'] : 0,
          },
        ]}
      />
      {error ? <Text style={[textStyle('caption'), { color: colors.semantic.error }]}>{error}</Text> : null}
      {helperText && !error ? <Text style={[textStyle('caption'), { color: colors.text.secondary }]}>{helperText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
  },
});
