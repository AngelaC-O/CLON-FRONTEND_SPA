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

  registrarYCobrar(venta: VentaRapidaDTO): Observable<VentaDTO> {
    return this.http.post<VentaDTO>(`${this.url}/rapidas`, venta);
  }

  armarProforma(proforma: ProformaDTO): Observable<ProformaDTO> {
    return this.http.post<ProformaDTO>(`${this.api}/proformas`, proforma);
  }
}
