import { TipoDocumentoDTO } from './modelos.generados';

/** Solo los tipos ACTIVOS se ofrecen en los selectores. */
export function tiposActivos(tipos: TipoDocumentoDTO[]): TipoDocumentoDTO[] {
  return tipos.filter((tipo) => tipo.estado !== 'INACTIVO');
}

/** Longitud y formato del catálogo 06 que devuelve GET /tipos-documento. */
export function numeroDocumentoValido(tipo: TipoDocumentoDTO, numero: string): boolean {
  const min = tipo.longitudMin ?? 1;
  const max = tipo.longitudMax ?? Number.MAX_SAFE_INTEGER;
  return (
    numero.length >= min &&
    numero.length <= max &&
    (tipo.soloNumeros ? /^\d+$/ : /^[A-Za-z0-9]+$/).test(numero)
  );
}
