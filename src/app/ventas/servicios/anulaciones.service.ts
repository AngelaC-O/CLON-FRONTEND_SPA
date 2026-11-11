import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { parametros } from '../../core/api/parametros';
import { DevolucionDTO, SolicitudAnulacionDTO } from '../modelos/ventas.modelos';

export type EstadoSolicitud = NonNullable<SolicitudAnulacionDTO['estado']>;

/** IGU_Anulacion: CUS22 (solicitud), CUS23 (bandeja y nota de crédito) y CUS24 (devoluciones). */
@Injectable({ providedIn: 'root' })
export class AnulacionesService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiBase;

  /** CUS22: queda PENDIENTE en la bandeja de la administradora; la venta no cambia. */
  solicitar(idVenta: number, solicitud: SolicitudAnulacionDTO): Observable<SolicitudAnulacionDTO> {
    return this.http.post<SolicitudAnulacionDTO>(
      `${this.api}/ventas/${idVenta}/solicitudes-anulacion`,
      solicitud,
    );
  }

  /** CUS23: solicitudes de la sede con su venta, total, motivo, quién y cuándo. */
  listar(estado: EstadoSolicitud): Observable<SolicitudAnulacionDTO[]> {
    return this.http.get<SolicitudAnulacionDTO[]>(`${this.api}/solicitudes-anulacion`, {
      params: parametros({ estado }),
    });
  }

  /** CUS23: emite la nota de crédito, anula la venta y aprueba la solicitud en una transacción. */
  aprobar(idSolicitud: number): Observable<SolicitudAnulacionDTO> {
    return this.http.post<SolicitudAnulacionDTO>(
      `${this.api}/solicitudes-anulacion/${idSolicitud}/aprobacion`,
      {},
    );
  }

  /** CUS23: la solicitud queda RECHAZADA y la venta sigue CERRADA. */
  rechazar(idSolicitud: number, motivoRechazo: string): Observable<SolicitudAnulacionDTO> {
    return this.http.post<SolicitudAnulacionDTO>(
      `${this.api}/solicitudes-anulacion/${idSolicitud}/rechazo`,
      { motivoRechazo },
    );
  }

  /** CUS24: una DEVOLUCION por cada pago con tarjeta, por la pasarela. */
  devolverPago(idVenta: number): Observable<DevolucionDTO> {
    return this.http.post<DevolucionDTO>(`${this.api}/ventas/${idVenta}/devolucion`, {
      formaDevolucion: 'MEDIO_ORIGINAL',
    });
  }

  /** CUS24: Yape o Plin, devueltos desde la app, con el número de operación. */
  registrarDevolucionManual(
    idVenta: number,
    idTransaccion: number,
    codigoOperacion: string,
  ): Observable<DevolucionDTO> {
    return this.http.post<DevolucionDTO>(`${this.api}/ventas/${idVenta}/devolucion-manual`, {
      idTransaccion,
      codigoOperacion,
    });
  }
}
