import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { parametros } from '../../core/api/parametros';
import { ClienteDTO, ResultadoConsulta } from '../modelos/agenda.modelos';

/** CUS01 y CUS02. */
@Injectable({ providedIn: 'root' })
export class ClientesService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBase}/clientes`;

  buscar(filtro: { nombres?: string; telefono?: string }): Observable<ClienteDTO[]> {
    return this.http.get<ClienteDTO[]>(this.url, { params: parametros(filtro) });
  }

  registrar(cliente: ClienteDTO): Observable<ClienteDTO> {
    return this.http.post<ClienteDTO>(this.url, cliente);
  }

  /** Responde 200 con el dato verificado o 202 si la consulta externa no respondió. */
  consultarDocumento(
    idTipoDocumento: number,
    numeroDocumento: string,
  ): Observable<ResultadoConsulta> {
    return this.http.get<ResultadoConsulta>(`${this.url}/consulta-documento`, {
      params: parametros({ idTipoDocumento, numeroDocumento }),
    });
  }
}
