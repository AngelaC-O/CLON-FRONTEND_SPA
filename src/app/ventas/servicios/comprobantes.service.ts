import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { parametros } from '../../core/api/parametros';
import { ComprobanteDTO, EnlaceComprobanteDTO } from '../modelos/ventas.modelos';

/** CUS20. */
@Injectable({ providedIn: 'root' })
export class ComprobantesService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBase}/comprobantes`;

  /** Estado SUNAT actual, también después del reenvío automático (RN46; Duda 12). */
  obtener(idComprobante: number): Observable<ComprobanteDTO> {
    return this.http.get<ComprobanteDTO>(`${this.url}/${idComprobante}`);
  }

  obtenerRepresentacion(idComprobante: number): Observable<Blob> {
    return this.http.get(`${this.url}/${idComprobante}/representacion`, { responseType: 'blob' });
  }

  obtenerEnlace(
    idComprobante: number,
    canal?: string,
    correo?: string,
  ): Observable<EnlaceComprobanteDTO> {
    return this.http.get<EnlaceComprobanteDTO>(`${this.url}/${idComprobante}/enlace`, {
      params: parametros({ canal, correo }),
    });
  }
}
