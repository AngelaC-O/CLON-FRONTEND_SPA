import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ParametroDTO, TipoDocumentoDTO } from '../modelos/seguridad.modelos';

/** CUS65 Configurar Parámetro del Negocio, con los tipos de documento. */
@Injectable({ providedIn: 'root' })
export class ParametrosService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiBase;

  listar(): Observable<ParametroDTO[]> {
    return this.http.get<ParametroDTO[]>(`${this.api}/parametros`);
  }

  /** Los códigos no se crean; el cambio queda en la auditoría (RN29). */
  cambiarValor(
    codigo: string,
    cambio: Pick<ParametroDTO, 'valorNumero' | 'valorTexto' | 'fechaVigencia'>,
  ): Observable<ParametroDTO> {
    return this.http.patch<ParametroDTO>(`${this.api}/parametros/${codigo}`, cambio);
  }

  /** Sin la copia en memoria de ListasService, para ver también los inactivos al día. */
  listarTiposDocumento(): Observable<TipoDocumentoDTO[]> {
    return this.http.get<TipoDocumentoDTO[]>(`${this.api}/tipos-documento`);
  }

  /** Solo el DNI y el RUC se consultan en APISPERU (RN45). */
  configurarTipoDocumento(
    idTipoDocumento: number,
    cambio: Pick<TipoDocumentoDTO, 'estado' | 'consultaApi'>,
  ): Observable<TipoDocumentoDTO> {
    return this.http.patch<TipoDocumentoDTO>(
      `${this.api}/tipos-documento/${idTipoDocumento}`,
      cambio,
    );
  }
}
