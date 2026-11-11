export type {
  AperturaCajaDTO,
  ArqueoCalculadoDTO,
  ArqueoDTO,
  CajaDTO,
  ComprobantePendiente,
  CobroPendienteDTO,
  ConciliacionDTO,
  Egreso,
  EsperadoDTO,
  EsperadoMedioDTO,
  JustificacionDTO,
  Medio,
  ReaperturaDTO,
  ResumenImportacionDTO,
} from '../../core/api/modelos.generados';

/**
 * Ítem de la conciliación tal como lo muestran los ejemplos de /conciliaciones. El esquema del
 * contrato apunta por error a `Item` (la línea de una venta): ver la Duda 22 de NOTAS_IT2.
 */
export interface ItemConciliacion {
  idItem?: number;
  estado?: 'COINCIDE' | 'SIN_JUSTIFICAR' | 'JUSTIFICADA' | 'EXCLUIDA';
  idVenta?: number;
  idTransaccion?: number;
  referenciaSunat?: string;
  aceptadoSunat?: boolean;
  pagoRespaldado?: boolean;
  justificacion?: string;
}
