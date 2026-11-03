export type CanalCobro = 'QR' | 'LINK';

export interface MedioPago {
  id: number;
  nombre: string;
  etiqueta: string;
  /** Canal que se propone; el efectivo nunca pasa por Izipay (RN42). */
  canal: CanalCobro | null;
}

/**
 * Copia de MEDIO_PAGO (script 12 del back-end, en su orden de inserción). El contrato no tiene un
 * GET de medios de pago (ver docs/NOTAS_IT1.md, Dudas).
 */
export const MEDIOS_PAGO: MedioPago[] = [
  { id: 1, nombre: 'EFECTIVO', etiqueta: 'Efectivo', canal: null },
  { id: 2, nombre: 'YAPE', etiqueta: 'Yape', canal: 'QR' },
  { id: 3, nombre: 'PLIN', etiqueta: 'Plin', canal: 'QR' },
  { id: 4, nombre: 'TARJETA', etiqueta: 'Tarjeta', canal: 'LINK' },
];

export function medioPago(id: number | null | undefined): MedioPago | undefined {
  return MEDIOS_PAGO.find((medio) => medio.id === id);
}
