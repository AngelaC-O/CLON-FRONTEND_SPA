import { HttpClient, HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { parametros } from '../../core/api/parametros';
import {
  FiltroReporte,
  FormatoExportacion,
  ReporteDTO,
  TipoReporte,
} from '../modelos/reportes.modelos';

/** CUS48 Generar Reporte Gerencial y CUS49 Exportar Reporte. */
@Injectable({ providedIn: 'root' })
export class ReportesService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBase}/reportes`;

  /** Sin ventas anuladas (RN33); sin idSede, el consolidado (RF93). */
  generar(tipo: TipoReporte, filtro: FiltroReporte): Observable<ReporteDTO> {
    return this.http.get<ReporteDTO>(`${this.url}/${tipo}`, { params: parametros({ ...filtro }) });
  }

  /** El archivo con su cabecera Content-Disposition, para guardarlo con su nombre. */
  exportar(
    tipo: TipoReporte,
    filtro: FiltroReporte,
    formato: FormatoExportacion,
  ): Observable<HttpResponse<Blob>> {
    return this.http.get(`${this.url}/${tipo}/exportacion`, {
      params: parametros({ ...filtro, formato }),
      responseType: 'blob',
      observe: 'response',
    });
  }
}
