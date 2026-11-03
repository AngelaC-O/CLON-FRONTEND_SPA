import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AperturaCajaDTO, ArqueoDTO, CajaDTO, EsperadoDTO } from '../modelos/caja.modelos';

/** CUS44 y CUS45. */
@Injectable({ providedIn: 'root' })
export class CajaService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBase}/cajas`;

  abrir(apertura: AperturaCajaDTO): Observable<CajaDTO> {
    return this.http.post<CajaDTO>(this.url, apertura);
  }

  calcularEsperado(idCaja: number): Observable<EsperadoDTO> {
    return this.http.get<EsperadoDTO>(`${this.url}/${idCaja}/esperado`);
  }

  cerrar(idCaja: number, arqueo: ArqueoDTO): Observable<CajaDTO> {
    return this.http.post<CajaDTO>(`${this.url}/${idCaja}/cierre`, arqueo);
  }
}
