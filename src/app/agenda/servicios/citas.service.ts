import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { parametros } from '../../core/api/parametros';
import {
  AdelantoDTO,
  BloqueAgendaDTO,
  CitaDTO,
  HoraLibre,
  ListaEsperaDTO,
} from '../modelos/agenda.modelos';

/** CUS05 a CUS08. El enlace de pago del adelanto está en pagos/servicios. */
@Injectable({ providedIn: 'root' })
export class CitasService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBase}/citas`;

  consultarDisponibilidad(idVariante: number, fecha: string): Observable<HoraLibre[]> {
    return this.http.get<HoraLibre[]>(`${this.url}/disponibilidad`, {
      params: parametros({ idVariante, fecha }),
    });
  }

  agendar(cita: CitaDTO): Observable<CitaDTO> {
    return this.http.post<CitaDTO>(this.url, cita);
  }

  registrarEspera(espera: ListaEsperaDTO): Observable<ListaEsperaDTO> {
    return this.http.post<ListaEsperaDTO>(`${this.url}/lista-espera`, espera);
  }

  registrarAdelantoEfectivo(idCita: number, adelanto: AdelantoDTO): Observable<CitaDTO> {
    return this.http.post<CitaDTO>(`${this.url}/${idCita}/adelanto`, adelanto);
  }

  consultarAgenda(filtro: {
    fecha: string;
    idPersonal?: number;
    idRecurso?: number;
  }): Observable<BloqueAgendaDTO[]> {
    return this.http.get<BloqueAgendaDTO[]>(`${this.url}/agenda`, { params: parametros(filtro) });
  }
}
