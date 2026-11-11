import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, shareReplay, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CategoriaProductoDTO,
  MedioPagoDTO,
  PaqueteDTO,
  PromocionDTO,
  ServicioDTO,
  TipoDocumentoDTO,
} from './modelos.generados';

/**
 * Listas de configuración que usan varias pantallas: tipos de documento (CUS65), medios de pago
 * (CUS62) y servicios activos con sus variantes (CUS58). Reemplazan las copias fijas y los códigos
 * escritos a mano de la Iteración 1 (Dudas 2, 5 y 11 de NOTAS_IT1). Se piden una vez por carga de
 * la aplicación; si la petición falla, la siguiente vuelve a intentarlo.
 */
@Injectable({ providedIn: 'root' })
export class ListasService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiBase;
  private tipos$?: Observable<TipoDocumentoDTO[]>;
  private medios$?: Observable<MedioPagoDTO[]>;
  private servicios$?: Observable<ServicioDTO[]>;
  private categorias$?: Observable<CategoriaProductoDTO[]>;

  tiposDocumento(): Observable<TipoDocumentoDTO[]> {
    this.tipos$ ??= this.http.get<TipoDocumentoDTO[]>(`${this.api}/tipos-documento`).pipe(
      catchError((error) => {
        this.tipos$ = undefined;
        return throwError(() => error);
      }),
      shareReplay(1),
    );
    return this.tipos$;
  }

  mediosPago(): Observable<MedioPagoDTO[]> {
    this.medios$ ??= this.http.get<MedioPagoDTO[]>(`${this.api}/medios-pago`).pipe(
      catchError((error) => {
        this.medios$ = undefined;
        return throwError(() => error);
      }),
      shareReplay(1),
    );
    return this.medios$;
  }

  serviciosActivos(): Observable<ServicioDTO[]> {
    this.servicios$ ??= this.http
      .get<ServicioDTO[]>(`${this.api}/servicios`, { params: { estado: 'ACTIVO' } })
      .pipe(
        catchError((error) => {
          this.servicios$ = undefined;
          return throwError(() => error);
        }),
        shareReplay(1),
      );
    return this.servicios$;
  }

  /** Categorías de producto por nombre (CUS32, CUS66). Piden PRODUCTOS:VER. */
  categoriasProducto(): Observable<CategoriaProductoDTO[]> {
    this.categorias$ ??= this.http
      .get<CategoriaProductoDTO[]>(`${this.api}/categorias-producto`)
      .pipe(
        catchError((error) => {
          this.categorias$ = undefined;
          return throwError(() => error);
        }),
        shareReplay(1),
      );
    return this.categorias$;
  }

  /** Promociones ACTIVAS cuya vigencia incluye hoy (CUS60). No se guardan: cambian con la fecha. */
  promocionesVigentes(): Observable<PromocionDTO[]> {
    return this.http.get<PromocionDTO[]>(`${this.api}/promociones`, {
      params: { vigentes: true },
    });
  }

  /** Paquetes y membresías (CUS59). */
  paquetes(): Observable<PaqueteDTO[]> {
    return this.http.get<PaqueteDTO[]>(`${this.api}/paquetes`);
  }
}
