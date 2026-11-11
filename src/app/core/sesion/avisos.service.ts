import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AvisoDTO } from '../api/modelos.generados';

/** Panel de avisos de Inicio (CUS50): el back-end ya filtra los que el rol de la sesión puede ver. */
@Injectable({ providedIn: 'root' })
export class AvisosService {
  private readonly http = inject(HttpClient);

  listar(): Observable<AvisoDTO[]> {
    return this.http.get<AvisoDTO[]>(`${environment.apiBase}/avisos`);
  }
}
