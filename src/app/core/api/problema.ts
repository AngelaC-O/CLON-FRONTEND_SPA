import { HttpErrorResponse } from '@angular/common/http';
import { ProblemDetail } from './modelos.generados';

/** El back-end agrega `regla` en la raíz del JSON; el esquema ProblemDetail no la declara. */
export type ProblemaApi = ProblemDetail & { regla?: string };

export function leerProblema(error: HttpErrorResponse): ProblemaApi | null {
  const cuerpo: unknown = error.error;
  return typeof cuerpo === 'object' && cuerpo !== null && !(cuerpo instanceof Blob)
    ? (cuerpo as ProblemaApi)
    : null;
}

export function mensajeDelProblema(error: HttpErrorResponse, porDefecto: string): string {
  return leerProblema(error)?.detail || porDefecto;
}
