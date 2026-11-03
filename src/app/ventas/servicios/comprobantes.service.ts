import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { EnlaceComprobanteDTO } from '../modelos/ventas.modelos';

/** CUS20. */
@Injectable({ providedIn: 'root' })
export class ComprobantesService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBase}/comprobantes`;

  obtenerRepresentacion(idComprobante: number): Observable<Blob> {
    return this.http.get(`${this.url}/${idComprobante}/representacion`, { responseType: 'blob' });
  }

  obtenerEnlace(idComprobante: number): Observable<EnlaceComprobanteDTO> {
    return this.http.get<EnlaceComprobanteDTO>(`${this.url}/${idComprobante}/enlace`);
  }
}
