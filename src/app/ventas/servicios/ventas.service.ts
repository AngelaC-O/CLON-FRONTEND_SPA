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
  ProductoStockDTO,
  ProformaDTO,
  ResultadoConsulta,
  VentaDTO,
  VentaProductosDTO,
  VentaRapidaDTO,
} from '../modelos/ventas.modelos';

/** CUS13, CUS18, CUS19, CUS21, CUS25 y CUS26. */
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

  /** CUS25: productos de venta activos con su precio y su stock en la sede. */
  buscarProductos(filtro: {
    nombre?: string;
    marca?: string;
    idCategoria?: number | null;
  }): Observable<ProductoStockDTO[]> {
    return this.http.get<ProductoStockDTO[]>(`${this.url}/productos`, {
      params: parametros(filtro),
    });
  }

  /** CUS26. 201: venta CERRADA con su comprobante; 202: cobro digital PENDIENTE, venta ABIERTA (RN52). */
  venderProductos(venta: VentaProductosDTO): Observable<VentaDTO> {
    return this.http.post<VentaDTO>(`${this.url}/productos`, venta);
  }

  armarProforma(proforma: ProformaDTO): Observable<ProformaDTO> {
    return this.http.post<ProformaDTO>(`${this.api}/proformas`, proforma);
  }
}
