import { MedioPagoDTO } from './modelos.generados';

export type CanalCobro = 'QR' | 'LINK';

/** Solo los medios ACTIVOS se ofrecen al cobrar. */
export function mediosActivos(medios: MedioPagoDTO[]): MedioPagoDTO[] {
  return medios.filter((medio) => medio.estado !== 'INACTIVO');
}

/** «YAPE» → «Yape». */
export function etiquetaMedio(medio: MedioPagoDTO | undefined, idMedioPago?: number): string {
  const nombre = medio?.nombre?.trim();
  if (!nombre) {
    return `Medio ${idMedioPago ?? medio?.idMedioPago ?? ''}`.trim();
  }
  return nombre.charAt(0).toUpperCase() + nombre.slice(1).toLowerCase();
}

/**
 * Canal que se propone para un medio que pasa por la pasarela (usaPasarela): la tarjeta va por
 * enlace y las billeteras por QR. El efectivo no pasa por Izipay (RN42).
 */
export function canalPropuesto(medio: MedioPagoDTO | undefined): CanalCobro | null {
  if (!medio?.usaPasarela) {
    return null;
  }
  return medio.nombre?.toUpperCase() === 'TARJETA' ? 'LINK' : 'QR';
}
