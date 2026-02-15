import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { radius, theme, textStyle, resolveColor } from '../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: 'sm' | 'md';
  disabled?: boolean;
  loading?: boolean;
};

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
}: Props) {
  const v = theme.components.button.variants[variant];
  const bg = disabled ? resolveColor(v.bgDisabled ?? v.bg) : resolveColor(v.bg);
  const textColor = disabled ? resolveColor(v.textDisabled ?? v.text) : resolveColor(v.text);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          height: theme.components.button.height[size],
          paddingHorizontal: theme.components.button.paddingX[size],
          borderRadius: radius[theme.components.button.radius as keyof typeof radius],
          backgroundColor: pressed && !disabled && v.bgPressed ? resolveColor(v.bgPressed) : bg,
          borderColor: v.border ? resolveColor(v.border) : 'transparent',
          borderWidth: v.border ? StyleSheet.hairlineWidth : 0,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[textStyle(theme.components.button.textStyle[size] as any), { color: textColor }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
