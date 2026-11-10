import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AperturaCajaDTO, ArqueoDTO, CajaDTO, EsperadoDTO } from '../modelos/caja.modelos';

/** CUS44, CUS45 y CUS46. */
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

  /** CUS46: cajas CERRADAS con diferencia en algún medio, aún sin aprobar (RN30). */
  listarConDiferencia(): Observable<CajaDTO[]> {
    return this.http.get<CajaDTO[]>(`${this.url}/con-diferencia`);
  }

  /** CUS46: cajas abiertas hoy en la sede, de la última a la primera (RF66). */
  listarDelDia(): Observable<CajaDTO[]> {
    return this.http.get<CajaDTO[]>(`${this.url}/del-dia`);
  }

  /** CUS46: la caja sigue CERRADA y queda revisada (RF67). */
  aprobarCierre(idCaja: number): Observable<CajaDTO> {
    return this.http.patch<CajaDTO>(`${this.url}/${idCaja}/revision`, {});
  }

  /** CUS46: vuelve a ABIERTA; luego se arquea y se cierra otra vez (CUS45). */
  reabrir(idCaja: number, motivoReapertura: string): Observable<CajaDTO> {
    return this.http.patch<CajaDTO>(`${this.url}/${idCaja}/reapertura`, { motivoReapertura });
  }
}
