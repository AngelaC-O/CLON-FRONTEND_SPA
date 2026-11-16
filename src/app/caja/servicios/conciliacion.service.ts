import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ConciliacionDTO, JustificacionDTO, ResumenImportacionDTO } from '../modelos/caja.modelos';

/** El contrato 2.1 ya tipa los ítems como ItemConciliacion (Duda 22). */
export type Conciliacion = ConciliacionDTO;

/** CUS47 Conciliar Ventas del Mes. */
@Injectable({ providedIn: 'root' })
export class ConciliacionService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBase}/conciliaciones`;

  /** Reporte de liquidación de Izipay (CSV o Excel): comisión y fecha de abono por cobro. */
  importarLiquidacion(archivo: File): Observable<ResumenImportacionDTO> {
    const datos = new FormData();
    datos.append('archivoLiquidacion', archivo, archivo.name);
    return this.http.post<ResumenImportacionDTO>(`${this.url}/liquidacion`, datos);
  }

  /** Una diferencia por venta, comprobante o transacción (RN31); las anuladas no cuentan (RN33). */
  conciliar(anio: number, mes: number): Observable<Conciliacion> {
    return this.http.post<Conciliacion>(this.url, { anio, mes });
  }

  justificar(
    idConciliacion: number,
    idItem: number,
    justificacion: JustificacionDTO,
  ): Observable<Conciliacion> {
    return this.http.patch<Conciliacion>(
      `${this.url}/${idConciliacion}/items/${idItem}`,
      justificacion,
    );
  }

  /** Solo sin diferencias SIN_JUSTIFICAR; después ya no cambia. */
  cerrar(idConciliacion: number): Observable<Conciliacion> {
    return this.http.patch<Conciliacion>(`${this.url}/${idConciliacion}/cierre`, {});
  }
}
