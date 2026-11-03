import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdelantoDTO, EnlacePagoDTO } from '../modelos/pagos.modelos';

/** Cobro digital de CUS07. Este módulo no tiene frontera IGU_ propia, por eso no tiene rutas. */
@Injectable({ providedIn: 'root' })
export class PagosService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiBase;

  generarEnlaceAdelanto(idCita: number, adelanto: AdelantoDTO): Observable<EnlacePagoDTO> {
    return this.http.post<EnlacePagoDTO>(`${this.api}/citas/${idCita}/enlace-adelanto`, adelanto);
  }
}
