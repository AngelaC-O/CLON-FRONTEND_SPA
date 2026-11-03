export interface TipoDocumento {
  id: number;
  abreviatura: string;
  longitudMin: number;
  longitudMax: number;
  soloNumeros: boolean;
  /** Solo estos se consultan en APISPERU (consulta_api = 'S'). */
  consulta: boolean;
}

/**
 * Copia de TIPO_DOCUMENTO (script 07 del back-end, en su orden de inserción). El draw.io pide
 * GET /api/v1/tipos-documento, pero no está en el contrato (ver docs/NOTAS_IT1.md, Dudas).
 */
export const TIPOS_DOCUMENTO: TipoDocumento[] = [
  { id: 1, abreviatura: 'DNI', longitudMin: 8, longitudMax: 8, soloNumeros: true, consulta: true },
  {
    id: 2,
    abreviatura: 'CE',
    longitudMin: 8,
    longitudMax: 12,
    soloNumeros: false,
    consulta: false,
  },
  {
    id: 3,
    abreviatura: 'RUC',
    longitudMin: 11,
    longitudMax: 11,
    soloNumeros: true,
    consulta: true,
  },
  {
    id: 4,
    abreviatura: 'PASAPORTE',
    longitudMin: 6,
    longitudMax: 12,
    soloNumeros: false,
    consulta: false,
  },
  {
    id: 5,
    abreviatura: 'CDI',
    longitudMin: 6,
    longitudMax: 15,
    soloNumeros: false,
    consulta: false,
  },
];

export function tipoDocumento(id: number | null | undefined): TipoDocumento | undefined {
  return TIPOS_DOCUMENTO.find((tipo) => tipo.id === id);
}

export function numeroDocumentoValido(tipo: TipoDocumento, numero: string): boolean {
  return (
    numero.length >= tipo.longitudMin &&
    numero.length <= tipo.longitudMax &&
    (tipo.soloNumeros ? /^\d+$/ : /^[A-Za-z0-9]+$/).test(numero)
  );
}
