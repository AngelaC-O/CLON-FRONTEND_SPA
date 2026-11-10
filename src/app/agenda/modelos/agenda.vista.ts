import { Especialista, FranjaAgendaDTO } from './agenda.modelos';

/** Fecha local de hoy como la pide el contrato (2026-11-09). */
export function hoyIso(): string {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

/** HH:MM de una fecha-hora local del back-end (2026-11-09T10:00:00). */
export function horaDe(fechaHora?: string): string {
  return fechaHora?.slice(11, 16) ?? '';
}

export function minutosDelDia(fechaHora?: string): number {
  const [horas, minutos] = horaDe(fechaHora).split(':').map(Number);
  return (horas || 0) * 60 + (minutos || 0);
}

export function ordenarPorInicio<T extends { inicio?: string }>(bloques: T[]): T[] {
  return [...bloques].sort((a, b) => (a.inicio ?? '').localeCompare(b.inicio ?? ''));
}

export function etiquetaEstado(estado?: string): string {
  const etiquetas: Record<string, string> = {
    PENDIENTE: 'Pendiente',
    EN_ATENCION: 'En atención',
    EN_CURSO: 'En atención',
    FINALIZADA: 'Finalizada',
    COBRADA: 'Cobrada',
  };
  return etiquetas[estado ?? ''] ?? estado ?? '';
}

export function claseEstado(estado?: string): string {
  const clases: Record<string, string> = {
    PENDIENTE: 'warn',
    EN_ATENCION: 'dk',
    EN_CURSO: 'dk',
    FINALIZADA: 'ok',
    COBRADA: 'ok',
  };
  return clases[estado ?? ''] ?? '';
}

/** La franja trae el nombre de la clienta (diferencia 24 de NOTAS_IT1). */
export function tituloBloque(bloque: FranjaAgendaDTO): string {
  if (bloque.nombreCliente) {
    return bloque.nombreCliente;
  }
  return bloque.origen === 'CITA' ? `Cita ${bloque.idOrigen}` : 'Atención sin cita';
}

export function nombreEspecialista(especialista: Especialista | undefined): string {
  const nombre = [especialista?.nombres, especialista?.apellidos].filter(Boolean).join(' ');
  return nombre || `Especialista ${especialista?.idPersonal ?? ''}`.trim();
}

/** La fecha y hora ya pasaron: el back-end responde 422 por RN49. */
export const MENSAJE_RN49 = 'La fecha y hora ya pasaron: elige una fecha desde hoy (RN49).';

/** Solo la especialista asignada o la administradora atiende la cita: 403 por RN50. */
export const MENSAJE_RN50 =
  'Solo la especialista asignada a la cita o la administradora puede atenderla (RN50).';
