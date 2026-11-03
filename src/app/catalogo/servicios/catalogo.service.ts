import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AreaDTO, ServicioDTO } from '../modelos/catalogo.modelos';

/** CUS57. */
@Injectable({ providedIn: 'root' })
export class CatalogoService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiBase;

  listarAreas(): Observable<AreaDTO[]> {
    return this.http.get<AreaDTO[]>(`${this.api}/areas`);
  }

  registrarArea(area: AreaDTO): Observable<AreaDTO> {
    return this.http.post<AreaDTO>(`${this.api}/areas`, area);
  }

  registrarServicio(servicio: ServicioDTO): Observable<ServicioDTO> {
    return this.http.post<ServicioDTO>(`${this.api}/servicios`, servicio);
  }
}
