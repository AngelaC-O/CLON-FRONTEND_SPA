import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { parametros } from '../../core/api/parametros';
import {
  ConsumoPendienteDTO,
  MovimientoDTO,
  MovimientoKardexDTO,
} from '../modelos/inventario.modelos';

/** CUS33 (salidas y consumos pendientes), CUS34 (ajustes) y CUS35 (kardex). */
@Injectable({ providedIn: 'root' })
export class KardexService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiBase;

  /** estaEnMinimo avisa que quedó en el stock mínimo (RF47). */
  registrarSalida(
    idProducto: number,
    salida: { cantidad: number; motivo: string; idAtencion?: number },
  ): Observable<MovimientoDTO> {
    return this.http.post<MovimientoDTO>(`${this.api}/productos/${idProducto}/salidas`, salida);
  }

  /** cantidad es lo contado: el back-end guarda la diferencia con el stock. */
  registrarAjuste(idProducto: number, cantidad: number, motivo: string): Observable<MovimientoDTO> {
    return this.http.post<MovimientoDTO>(`${this.api}/productos/${idProducto}/ajustes`, {
      cantidad,
      motivo,
    });
  }

  /** Sin fechas, los últimos 30 días de la sede de la sesión. */
  consultarKardex(
    idProducto: number,
    filtro: { fechaInicio?: string; fechaFin?: string },
  ): Observable<MovimientoKardexDTO[]> {
    return this.http.get<MovimientoKardexDTO[]>(`${this.api}/productos/${idProducto}/kardex`, {
      params: parametros(filtro),
    });
  }

  /** Lo que faltó descontar al finalizar atenciones (RN53), del más antiguo al más reciente. */
  listarConsumosPendientes(): Observable<ConsumoPendienteDTO[]> {
    return this.http.get<ConsumoPendienteDTO[]>(`${this.api}/consumos-pendientes`);
  }

  regularizar(idConsumo: number): Observable<ConsumoPendienteDTO> {
    return this.http.post<ConsumoPendienteDTO>(
      `${this.api}/consumos-pendientes/${idConsumo}/regularizacion`,
      {},
    );
  }

  descartar(idConsumo: number, observacion: string): Observable<ConsumoPendienteDTO> {
    return this.http.patch<ConsumoPendienteDTO>(
      `${this.api}/consumos-pendientes/${idConsumo}/descarte`,
      { observacion },
    );
  }
}
