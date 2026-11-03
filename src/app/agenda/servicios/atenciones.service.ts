import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AtencionDTO, DetalleAtencionDTO, InicioAtencionDTO } from '../modelos/agenda.modelos';

/** CUS11. */
@Injectable({ providedIn: 'root' })
export class AtencionesService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBase}/atenciones`;

  iniciar(inicio: InicioAtencionDTO): Observable<AtencionDTO> {
    return this.http.post<AtencionDTO>(this.url, inicio);
  }

  finalizar(idAtencion: number, detalle: DetalleAtencionDTO): Observable<AtencionDTO> {
    return this.http.patch<AtencionDTO>(`${this.url}/${idAtencion}/fin`, detalle);
  }
}
