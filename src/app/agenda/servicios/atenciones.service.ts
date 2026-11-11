import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { parametros } from '../../core/api/parametros';
import {
  AtencionDTO,
  CitaAtencionDTO,
  DetalleAtencionDTO,
  InicioAtencionDTO,
  ProductoStockDTO,
  RecomendacionDTO,
} from '../modelos/agenda.modelos';

/** CUS11 y CUS12. */
@Injectable({ providedIn: 'root' })
export class AtencionesService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBase}/atenciones`;

  /** Citas del día de la especialista de la sesión (Duda 6 de NOTAS_IT1); sin fecha, hoy. */
  listarMiAgenda(fecha?: string): Observable<CitaAtencionDTO[]> {
    return this.http.get<CitaAtencionDTO[]>(`${this.url}/mi-agenda`, {
      params: parametros({ fecha }),
    });
  }

  /** La atención EN_CURSO de una cita, para retomarla desde otro equipo (Duda 7). */
  obtenerEnCurso(idCita: number): Observable<AtencionDTO> {
    return this.http.get<AtencionDTO>(`${this.url}/en-curso`, { params: parametros({ idCita }) });
  }

  iniciar(inicio: InicioAtencionDTO): Observable<AtencionDTO> {
    return this.http.post<AtencionDTO>(this.url, inicio);
  }

  finalizar(idAtencion: number, detalle: DetalleAtencionDTO): Observable<AtencionDTO> {
    return this.http.patch<AtencionDTO>(`${this.url}/${idAtencion}/fin`, detalle);
  }

  /** CUS12: productos de venta activos de la sede, con precio y stock (sin costo, RN24). */
  buscarProductos(nombre: string): Observable<ProductoStockDTO[]> {
    return this.http.get<ProductoStockDTO[]>(`${this.url}/productos`, {
      params: parametros({ nombre }),
    });
  }

  recomendarProducto(
    idAtencion: number,
    recomendacion: RecomendacionDTO,
  ): Observable<RecomendacionDTO> {
    return this.http.post<RecomendacionDTO>(
      `${this.url}/${idAtencion}/recomendaciones`,
      recomendacion,
    );
  }
}
