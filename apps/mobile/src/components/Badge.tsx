import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, textStyle } from '../theme';

type Variant = 'fresh' | 'frozen' | 'variable' | 'b2b' | 'b2c' | 'neutral';

const palette: Record<Variant, { bg: string; text: string }> = {
  fresh: { bg: colors.badges.freshBg, text: colors.badges.freshText },
  frozen: { bg: colors.badges.frozenBg, text: colors.badges.frozenText },
  variable: { bg: colors.badges.variableBg, text: colors.badges.variableText },
  b2b: { bg: colors.badges.b2bBg, text: colors.badges.b2bText },
  b2c: { bg: colors.badges.b2cBg, text: colors.badges.b2cText },
  neutral: { bg: colors.neutral[100], text: colors.text.secondary },
};

export default function Badge({ label, variant }: { label: string; variant: Variant }) {
  const v = palette[variant];
  return (
    <View style={[styles.base, { backgroundColor: v.bg, borderRadius: radius.pill }]}>
      <Text style={[textStyle('label'), { color: v.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: spacing['2'],
    paddingVertical: spacing['1'],
  },
});
