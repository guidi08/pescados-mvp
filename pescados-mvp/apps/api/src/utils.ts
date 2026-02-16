export function formatBRL(cents: number): string {
  const value = cents / 100;
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
