import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { parametros } from '../../core/api/parametros';
import {
  AdelantoDTO,
  CitaDTO,
  FiltrosAgendaDTO,
  FranjaAgendaDTO,
  HoraLibre,
  ListaEsperaDTO,
  ReprogramacionDTO,
} from '../modelos/agenda.modelos';

/** CUS05 a CUS10. El enlace de pago del adelanto está en pagos/servicios. */
@Injectable({ providedIn: 'root' })
export class CitasService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBase}/citas`;

  consultarDisponibilidad(idVariante: number, fecha: string): Observable<HoraLibre[]> {
    return this.http.get<HoraLibre[]>(`${this.url}/disponibilidad`, {
      params: parametros({ idVariante, fecha }),
    });
  }

  /** Con idEspera, la espera pasa a ASIGNADA en la misma operación (RF09). */
  agendar(cita: CitaDTO): Observable<CitaDTO> {
    return this.http.post<CitaDTO>(this.url, cita);
  }

  registrarEspera(espera: ListaEsperaDTO): Observable<ListaEsperaDTO> {
    return this.http.post<ListaEsperaDTO>(`${this.url}/lista-espera`, espera);
  }

  /** Esperas PENDIENTES de la sede para ese día, en el orden en que se anotaron. */
  listarEspera(fecha: string): Observable<ListaEsperaDTO[]> {
    return this.http.get<ListaEsperaDTO[]>(`${this.url}/lista-espera`, {
      params: parametros({ fecha }),
    });
  }

  descartarEspera(idEspera: number): Observable<ListaEsperaDTO> {
    return this.http.patch<ListaEsperaDTO>(`${this.url}/lista-espera/${idEspera}/descarte`, {});
  }

  registrarAdelantoEfectivo(idCita: number, adelanto: AdelantoDTO): Observable<CitaDTO> {
    return this.http.post<CitaDTO>(`${this.url}/${idCita}/adelanto`, adelanto);
  }

  /** CUS09: la cita origen queda REPROGRAMADA y la nueva hereda el adelanto. */
  reprogramar(idCita: number, reprogramacion: ReprogramacionDTO): Observable<CitaDTO> {
    return this.http.post<CitaDTO>(`${this.url}/${idCita}/reprogramacion`, reprogramacion);
  }

  /** CUS10: el adelanto pasa a saldo a favor (RN05); la inasistencia es «No se presentó». */
  cancelar(idCita: number, motivoCancelacion: string): Observable<CitaDTO> {
    return this.http.patch<CitaDTO>(`${this.url}/${idCita}/cancelacion`, { motivoCancelacion });
  }

  consultarAgenda(filtro: {
    fecha: string;
    idPersonal?: number;
    idRecurso?: number;
  }): Observable<FranjaAgendaDTO[]> {
    return this.http.get<FranjaAgendaDTO[]>(`${this.url}/agenda`, { params: parametros(filtro) });
  }

  listarFiltros(): Observable<FiltrosAgendaDTO> {
    return this.http.get<FiltrosAgendaDTO>(`${this.url}/filtros`);
  }
}
