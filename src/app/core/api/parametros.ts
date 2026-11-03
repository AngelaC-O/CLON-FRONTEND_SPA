import { HttpParams } from '@angular/common/http';

type Valor = string | number | null | undefined;

/** Arma los parámetros de consulta sin enviar los opcionales vacíos. */
export function parametros(valores: Record<string, Valor>): HttpParams {
  let params = new HttpParams();
  for (const [nombre, valor] of Object.entries(valores)) {
    if (valor !== null && valor !== undefined && valor !== '') {
      params = params.set(nombre, valor);
    }
  }
  return params;
}
