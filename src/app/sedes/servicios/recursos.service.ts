import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RecursoDTO } from '../modelos/sedes.modelos';

/** CUS61. */
@Injectable({ providedIn: 'root' })
export class RecursosService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiBase;

  registrar(recurso: RecursoDTO): Observable<RecursoDTO> {
    return this.http.post<RecursoDTO>(`${this.api}/recursos`, recurso);
  }
}
