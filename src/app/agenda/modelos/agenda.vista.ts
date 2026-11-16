import { nombreCompleto, numero } from '../../core/api/nombres';
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
    CANCELADA: 'Cancelada',
    REPROGRAMADA: 'Reprogramada',
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
    CANCELADA: 'bad',
  };
  return clases[estado ?? ''] ?? '';
}

/** La franja trae el nombre de la clienta (diferencia 24 de NOTAS_IT1). */
export function tituloBloque(bloque: FranjaAgendaDTO): string {
  if (bloque.nombreCliente) {
    return bloque.nombreCliente;
  }
  return bloque.origen === 'CITA' ? `Cita ${numero(bloque.idOrigen)}` : 'Atención sin cita';
}

/** Nombres y apellidos de la especialista, o «—» (nunca su id, It. 2.1). */
export function nombreEspecialista(especialista: Especialista | undefined): string {
  return nombreCompleto(especialista);
}

/** La fecha y hora ya pasaron: el back-end responde 422 por RN49. */
export const MENSAJE_RN49 = 'La fecha y hora ya pasaron: elige una fecha desde hoy (RN49).';

/** Solo la especialista asignada o la administradora atiende la cita: 403 por RN50. */
export const MENSAJE_RN50 =
  'Solo la especialista asignada a la cita o la administradora puede atenderla (RN50).';

/** 02/11/2026 de una fecha (2026-11-02) o una fecha-hora del back-end; con hora, 02/11/2026 10:00. */
export function fechaCorta(fecha?: string, conHora = false): string {
  if (!fecha) {
    return '';
  }
  const [anio, mes, dia] = fecha.slice(0, 10).split('-');
  const texto = `${dia}/${mes}/${anio}`;
  return conHora && fecha.length > 10 ? `${texto} ${horaDe(fecha)}` : texto;
}

/** Motivo de la inasistencia: CITA no tiene estado NO_ASISTIO (CUS10, decisión del 08/11/2026). */
export const MOTIVO_NO_SE_PRESENTO = 'No se presentó';
