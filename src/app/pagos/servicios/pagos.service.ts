import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdelantoDTO, EnlacePagoDTO, MedioPagoDTO } from '../modelos/pagos.modelos';

/**
 * Cobro digital de CUS07 y la configuración de medios de pago de CUS62 (IGU_MediosPago, que se
 * muestra como pestaña del catálogo, por eso este módulo no tiene rutas).
 */
@Injectable({ providedIn: 'root' })
export class PagosService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiBase;

  generarEnlaceAdelanto(idCita: number, adelanto: AdelantoDTO): Observable<EnlacePagoDTO> {
    return this.http.post<EnlacePagoDTO>(`${this.api}/citas/${idCita}/enlace-adelanto`, adelanto);
  }

  /** CUS62: todos los medios, activos e inactivos; sin la copia en memoria de ListasService. */
  listarMedios(): Observable<MedioPagoDTO[]> {
    return this.http.get<MedioPagoDTO[]>(`${this.api}/medios-pago`);
  }

  /** CUS62: el efectivo no se cobra por la pasarela (RN42). */
  configurarMedio(
    idMedioPago: number,
    cambio: Pick<MedioPagoDTO, 'estado' | 'usaPasarela'>,
  ): Observable<MedioPagoDTO> {
    return this.http.patch<MedioPagoDTO>(`${this.api}/medios-pago/${idMedioPago}`, cambio);
  }
}
