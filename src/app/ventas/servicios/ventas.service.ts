import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { parametros } from '../../core/api/parametros';
import {
  CierreVentaDTO,
  CrearVentaDTO,
  DescuentosDTO,
  HoraLibre,
  PagosDTO,
  PorCobrarDTO,
  ProformaDTO,
  ResultadoConsulta,
  VentaDTO,
  VentaRapidaDTO,
} from '../modelos/ventas.modelos';

/** CUS13, CUS18, CUS19 y CUS21. */
@Injectable({ providedIn: 'root' })
export class VentasService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiBase;
  private readonly url = `${this.api}/ventas`;

  /** Atenciones FINALIZADAS sin venta y ventas ABIERTAS de la sede (diferencia 31 de NOTAS_IT1). */
  listarPorCobrar(): Observable<PorCobrarDTO> {
    return this.http.get<PorCobrarDTO>(`${this.url}/por-cobrar`);
  }

  /** La venta con el estado actual de cada cobro digital en la pasarela (Dudas 8 y 10). */
  obtener(idVenta: number): Observable<VentaDTO> {
    return this.http.get<VentaDTO>(`${this.url}/${idVenta}`);
  }

  crearDesdeAtencion(venta: CrearVentaDTO): Observable<VentaDTO> {
    return this.http.post<VentaDTO>(this.url, venta);
  }

  aplicarDescuentos(idVenta: number, descuentos: DescuentosDTO): Observable<VentaDTO> {
    return this.http.patch<VentaDTO>(`${this.url}/${idVenta}/descuentos`, descuentos);
  }

  /** Responde 202 si queda algún pago digital por confirmar. */
  registrarPagos(idVenta: number, pagos: PagosDTO): Observable<VentaDTO> {
    return this.http.post<VentaDTO>(`${this.url}/${idVenta}/pagos`, pagos);
  }

  cerrar(idVenta: number, cierre: CierreVentaDTO): Observable<VentaDTO> {
    return this.http.post<VentaDTO>(`${this.url}/${idVenta}/cierre`, cierre);
  }

  /** Responde 200 con el dato verificado o 202 si la consulta externa no respondió. */
  consultarRuc(ruc: string): Observable<ResultadoConsulta> {
    return this.http.get<ResultadoConsulta>(`${this.url}/consulta-ruc/${ruc}`);
  }

  libresAhora(idVariante: number): Observable<HoraLibre[]> {
    return this.http.get<HoraLibre[]>(`${this.url}/rapidas/libres`, {
      params: parametros({ idVariante }),
    });
  }

  /** 201: venta CERRADA; 202: el cobro digital quedó PENDIENTE y la venta sigue ABIERTA (RN52). */
  registrarYCobrar(venta: VentaRapidaDTO): Observable<VentaDTO> {
    return this.http.post<VentaDTO>(`${this.url}/rapidas`, venta);
  }

  armarProforma(proforma: ProformaDTO): Observable<ProformaDTO> {
    return this.http.post<ProformaDTO>(`${this.api}/proformas`, proforma);
  }
}
