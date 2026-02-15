import tokens from './design-tokens.json';

export const theme = tokens;

export type Theme = typeof theme;

export const colors = theme.colors;
export const spacing = theme.spacing;
export const radius = theme.radius;
export const shadow = theme.shadow;
export const typography = theme.typography;

export function textStyle(styleKey: keyof typeof typography.styles) {
  const style = typography.styles[styleKey];
  return {
    fontSize: style.fontSize,
    lineHeight: style.lineHeight,
    fontWeight: String(style.fontWeight) as any,
    color: colors.text.primary,
  } as const;
}

export function resolveColor(path: string): string {
  const clean = path.replace(/[{}]/g, '').replace(/^colors\./, '');
  const parts = clean.split('.');
  let cur: any = colors;
  for (const p of parts) {
    if (cur == null) return path;
    cur = cur[p];
  }
  return typeof cur === 'string' ? cur : path;
}
