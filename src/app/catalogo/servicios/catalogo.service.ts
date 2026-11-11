import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { parametros } from '../../core/api/parametros';
import { AreaDTO, PaqueteDTO, PromocionDTO, ServicioDTO } from '../modelos/catalogo.modelos';

/** CUS57 a CUS60. */
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

  /** CUS58: todos los servicios, activos e inactivos, con variantes, precios e insumos. */
  listarServicios(): Observable<ServicioDTO[]> {
    return this.http.get<ServicioDTO[]>(`${this.api}/servicios`);
  }

  /** CUS58: datos e insumos; desactivar es estado INACTIVO. El precio se cambia aparte. */
  actualizarServicio(idServicio: number, servicio: ServicioDTO): Observable<ServicioDTO> {
    return this.http.put<ServicioDTO>(`${this.api}/servicios/${idServicio}`, servicio);
  }

  /** CUS58: el precio anterior y el nuevo quedan en la auditoría (RN25). */
  cambiarPrecio(
    idServicio: number,
    idVariante: number,
    precioNuevo: number,
  ): Observable<ServicioDTO> {
    return this.http.patch<ServicioDTO>(
      `${this.api}/servicios/${idServicio}/variantes/${idVariante}/precio`,
      { precioNuevo },
    );
  }

  /** CUS59: paquetes y membresías con sus servicios. */
  listarPaquetes(): Observable<PaqueteDTO[]> {
    return this.http.get<PaqueteDTO[]>(`${this.api}/paquetes`);
  }

  registrarPaquete(paquete: PaqueteDTO): Observable<PaqueteDTO> {
    return this.http.post<PaqueteDTO>(`${this.api}/paquetes`, paquete);
  }

  /** CUS60: todas las promociones, vigentes o no. */
  listarPromociones(): Observable<PromocionDTO[]> {
    return this.http.get<PromocionDTO[]>(`${this.api}/promociones`, {
      params: parametros({ vigentes: 'false' }),
    });
  }

  registrarPromocion(promocion: PromocionDTO): Observable<PromocionDTO> {
    return this.http.post<PromocionDTO>(`${this.api}/promociones`, promocion);
  }
}
