import { comprobanteDe as serieNumero, nombreVenta } from '../../../core/api/nombres';
import { SolicitudAnulacionDTO, VentaDTO } from '../../modelos/ventas.modelos';

/** Códigos de motivo de la nota de crédito que admite la anulación (RN32). */
export const MOTIVOS_SUNAT = [
  { codigo: '01', texto: '01 · Anulación de la operación' },
  { codigo: '02', texto: '02 · Anulación por error en el RUC' },
  { codigo: '06', texto: '06 · Devolución total' },
] as const;

export type FormaDevolucion = NonNullable<SolicitudAnulacionDTO['formaDevolucion']>;

export const FORMAS_DEVOLUCION: Record<FormaDevolucion, string> = {
  MEDIO_ORIGINAL: 'Por el medio de pago original',
  SALDO_FAVOR: 'Como saldo a favor de la clienta',
};

export function textoMotivo(codigo?: string): string {
  return MOTIVOS_SUNAT.find((m) => m.codigo === codigo)?.texto ?? codigo ?? '';
}

/** «B001-00000125» o, sin comprobante, «Venta N° 620» (It. 2.1). */
export function comprobanteDe(venta: VentaDTO): string {
  return nombreVenta(serieNumero(venta.comprobante), venta.idVenta);
}

/** La venta de una solicitud, por su comprobante; sin él, «Venta N° 620». */
export function ventaDe(solicitud: SolicitudAnulacionDTO): string {
  return nombreVenta(solicitud.comprobante, solicitud.idVenta);
}

/** 09/11/2026 11:00 de una fecha-hora del back-end. */
export function fechaHora(valor?: string): string {
  if (!valor) {
    return '';
  }
  const [anio, mes, dia] = valor.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio} ${valor.slice(11, 16)}`.trim();
}
