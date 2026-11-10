import { Columna, FilaReporteDTO, TipoReporte } from './reportes.modelos';

export interface OpcionReporte {
  tipo: TipoReporte;
  texto: string;
  /** Muestra costos o márgenes: solo para la administradora (RN24). */
  conCostos: boolean;
}

/** Los seis reportes de CUS48 (RF68 a RF73). */
export const REPORTES: OpcionReporte[] = [
  { tipo: 'ventas', texto: 'Ventas', conCostos: false },
  { tipo: 'productos', texto: 'Productos (rotación, stock y margen)', conCostos: true },
  { tipo: 'margen', texto: 'Margen por servicio y línea', conCostos: true },
  { tipo: 'demanda', texto: 'Demanda y días pico', conCostos: false },
  { tipo: 'ocupacion', texto: 'Ocupación de recursos', conCostos: false },
  { tipo: 'especialistas', texto: 'Ingresos por especialista', conCostos: false },
];

/** Agrupaciones del reporte de ventas (RF68). */
export const AGRUPACIONES_VENTAS = [
  { valor: 'DIA', texto: 'Día' },
  { valor: 'MES', texto: 'Mes' },
  { valor: 'LINEA', texto: 'Línea' },
  { valor: 'SERVICIO', texto: 'Servicio' },
  { valor: 'ESPECIALISTA', texto: 'Especialista' },
  { valor: 'MEDIO_PAGO', texto: 'Medio de pago' },
  { valor: 'TIPO_ATENCION', texto: 'Tipo de atención' },
];

export const ROL_ADMINISTRADORA = 'ADMINISTRADORA';

/** Columnas con importes en soles: se muestran con «S/». */
const EN_SOLES = ['importe', 'costo', 'margen'];

/** Valor de una celda con el formato de su columna. */
export function celda(fila: FilaReporteDTO, campo?: string): string {
  const valor = (fila as Record<string, unknown>)[campo ?? ''];
  if (valor === undefined || valor === null) {
    return '';
  }
  if (typeof valor === 'number' && EN_SOLES.includes(campo ?? '')) {
    return `S/ ${valor.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (typeof valor === 'number') {
    return valor.toLocaleString('es-PE');
  }
  return String(valor);
}

/** La columna que se grafica: el importe si lo hay; si no, la primera numérica. */
export function columnaDelGrafico(columnas: Columna[], filas: FilaReporteDTO[]): Columna | null {
  const numericas = columnas.filter(
    (c) =>
      c.campo !== 'grupo' &&
      filas.some((f) => typeof (f as Record<string, unknown>)[c.campo ?? ''] === 'number'),
  );
  return numericas.find((c) => c.campo === 'importe') ?? numericas[0] ?? null;
}

/** Fecha local como la pide el contrato (2026-11-09), desplazada en días. */
export function fechaIso(desplazamientoDias = 0): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + desplazamientoDias);
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/** Primer día del mes en curso. */
export function inicioDeMes(): string {
  return `${fechaIso().slice(0, 8)}01`;
}

/** reporte_ventas_2026-11-01_2026-11-30.xlsx de la cabecera Content-Disposition. */
export function nombreDeArchivo(disposicion: string | null, porDefecto: string): string {
  const coincidencia = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposicion ?? '');
  return coincidencia ? decodeURIComponent(coincidencia[1]) : porDefecto;
}
