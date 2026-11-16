/**
 * Regla de la Iteración 2.1: ninguna pantalla muestra un id en lugar de un nombre. Si la respuesta
 * no trae el nombre, se muestra «—» (y se anota como duda en NOTAS_IT2), nunca el id.
 */
export const SIN_NOMBRE = '—';

/** El primer nombre que llegue con texto, o «—». */
export function nombreO(...nombres: (string | null | undefined)[]): string {
  return nombres.map((n) => n?.trim()).find(Boolean) ?? SIN_NOMBRE;
}

/** «Rosa Quispe» de nombres y apellidos, o «—». */
export function nombreCompleto(persona?: { nombres?: string; apellidos?: string } | null): string {
  return nombreO([persona?.nombres, persona?.apellidos].filter(Boolean).join(' '));
}

/** Número de un documento transaccional (cita, atención, venta, caja): «N° 123». */
export function numero(id?: number | null): string {
  return id === undefined || id === null ? SIN_NOMBRE : `N° ${id}`;
}

/** La venta se nombra por su comprobante (B001-123); si no tiene, «Venta N° 123». */
export function nombreVenta(comprobante?: string | null, idVenta?: number | null): string {
  return comprobante?.trim() || `Venta ${numero(idVenta)}`;
}

/** Lo que usan de una HoraLibre (GET /citas/disponibilidad y /ventas/rapidas/libres). */
interface ConLibres {
  especialistas?: { idPersonal?: number; nombre?: string }[];
  recursos?: { idRecurso?: number; nombre?: string }[];
}

/** Nombre de una especialista libre: el de la hora (It. 2.1) o el que se pase de respaldo. */
export function especialistaLibre(hora: ConLibres, id: number, respaldo?: string): string {
  return nombreO(hora.especialistas?.find((e) => e.idPersonal === id)?.nombre, respaldo);
}

/** Nombre de un recurso libre: el de la hora (It. 2.1) o el que se pase de respaldo. */
export function recursoLibre(hora: ConLibres, id: number, respaldo?: string): string {
  return nombreO(hora.recursos?.find((r) => r.idRecurso === id)?.nombre, respaldo);
}

/** «B001-123» de un comprobante con serie y número; undefined si no tiene. */
export function comprobanteDe(comprobante?: { serie?: string; numero?: string } | null) {
  return comprobante?.serie && comprobante.numero
    ? `${comprobante.serie}-${comprobante.numero}`
    : undefined;
}
