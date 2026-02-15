import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing, textStyle, theme, resolveColor } from '../theme';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

export default function Chip({ label, selected, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: selected
            ? resolveColor(theme.components.chip.bgSelected)
            : resolveColor(theme.components.chip.bg),
          borderRadius: radius[theme.components.chip.radius as keyof typeof radius],
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <Text
        style={[
          textStyle(theme.components.chip.textStyle as any),
          {
            color: selected
              ? resolveColor(theme.components.chip.textSelected)
              : resolveColor(theme.components.chip.text),
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: spacing['3'],
    paddingVertical: spacing['2'],
  },
});
