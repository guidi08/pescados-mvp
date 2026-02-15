import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { radius, resolveColor, shadow, theme } from '../theme';

type Props = ViewProps & {
  padding?: number;
};

export default function Card({ style, padding, ...rest }: Props) {
  const pad = padding ?? theme.components.card.padding;
  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: resolveColor(theme.components.card.bg),
          borderColor: resolveColor(theme.components.card.border),
          borderRadius: radius[theme.components.card.radius as keyof typeof radius],
          padding: pad,
          ...shadow[theme.components.card.shadow as keyof typeof shadow],
        },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});
