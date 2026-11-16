import { nombreO, numero } from '../../core/api/nombres';
import { MovimientoKardexDTO, ProductoDTO } from './inventario.modelos';

/** Un insumo va en su unidad mínima (RN54). */
export const UNIDADES_INSUMO = [
  { codigo: 'ML', texto: 'Mililitro (ml)' },
  { codigo: 'G', texto: 'Gramo (g)' },
  { codigo: 'UND', texto: 'Unidad' },
] as const;

/** Stock en el mínimo o por debajo (RF47). */
export function enMinimo(producto: ProductoDTO): boolean {
  return (
    producto.estado !== 'INACTIVO' &&
    producto.stockMinimo !== undefined &&
    (producto.stockActual ?? 0) <= producto.stockMinimo
  );
}

/** Precio sugerido: costo × (1 + margen %) (RF87), redondeado a céntimos. */
export function precioSugerido(
  costo: number | null,
  margenPorcentaje: number | null,
): number | null {
  if (costo === null || margenPorcentaje === null || costo < 0) {
    return null;
  }
  return Math.round(costo * (1 + margenPorcentaje / 100) * 100) / 100;
}

/** Margen que llega del back-end (fracción, 0.5) como porcentaje (50 %). */
export function margenTexto(margen: number): string {
  return `${Math.round(margen * 1000) / 10} %`;
}

/**
 * De dónde salió un movimiento: la atención, la venta por su comprobante (Venta B001-123), la
 * compra por su documento (Compra F001-45) o un registro manual (Duda 21, It. 2.1).
 */
export function origenMovimiento(movimiento: MovimientoKardexDTO): string {
  if (movimiento.idAtencion) {
    return `Atención ${numero(movimiento.idAtencion)}`;
  }
  if (movimiento.idDetalleVenta || movimiento.comprobante) {
    return `Venta ${nombreO(movimiento.comprobante)}`;
  }
  if (movimiento.idDetalleCompra || movimiento.documentoCompra) {
    return `Compra ${nombreO(movimiento.documentoCompra)}`;
  }
  return 'Manual';
}

/** 09/11/2026 11:05 de una fecha-hora del back-end. */
export function fechaHora(valor?: string): string {
  if (!valor) {
    return '';
  }
  const [anio, mes, dia] = valor.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio} ${valor.slice(11, 16)}`.trim();
}

/** Fecha local como la pide el contrato (2026-11-09), desplazada en días. */
export function fechaIso(desplazamientoDias = 0): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + desplazamientoDias);
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}
