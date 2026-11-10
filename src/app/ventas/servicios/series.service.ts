import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SerieDTO } from '../modelos/ventas.modelos';

/** CUS63 Configurar Serie de Comprobante. */
@Injectable({ providedIn: 'root' })
export class SeriesService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBase}/series-comprobante`;

  /** Series de la sede de la sesión con su último número, que lleva Oracle (RN47). */
  listar(): Observable<SerieDTO[]> {
    return this.http.get<SerieDTO[]>(this.url);
  }

  /** Nace ACTIVA con el correlativo en 0. */
  registrar(serie: SerieDTO): Observable<SerieDTO> {
    return this.http.post<SerieDTO>(this.url, serie);
  }
}
