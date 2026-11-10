export type { Columna, FilaReporteDTO, ReporteDTO } from '../../core/api/modelos.generados';

/** Tipos de reporte de GET /reportes/{tipoReporte} (CUS48). */
export type TipoReporte =
  'ventas' | 'productos' | 'margen' | 'demanda' | 'ocupacion' | 'especialistas';

export type FormatoExportacion = 'EXCEL' | 'PDF';

export interface FiltroReporte {
  fechaInicio: string;
  fechaFin: string;
  agrupacion?: string;
  /** Sin sede, el consolidado de todas (RF93). */
  idSede?: number;
}
