export function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export function soles(valor: number | null | undefined): string {
  return `S/ ${(valor ?? 0).toFixed(2)}`;
}
