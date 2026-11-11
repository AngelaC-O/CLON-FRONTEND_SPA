import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { parametros } from '../../core/api/parametros';
import { RecursoDTO } from '../modelos/sedes.modelos';

/** CUS61. */
@Injectable({ providedIn: 'root' })
export class RecursosService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiBase;

  listar(idSede: number): Observable<RecursoDTO[]> {
    return this.http.get<RecursoDTO[]>(`${this.api}/recursos`, {
      params: parametros({ idSede }),
    });
  }

  registrar(recurso: RecursoDTO): Observable<RecursoDTO> {
    return this.http.post<RecursoDTO>(`${this.api}/recursos`, recurso);
  }
}
