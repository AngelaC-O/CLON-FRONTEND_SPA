/**
 * Códigos MODULO:ACCION que exige el back-end en sus @PreAuthorize.
 * docs/openapi.yaml solo trae tres de ejemplo (ver docs/NOTAS_IT1.md, Dudas).
 */
export const PERMISOS = {
  agendaVer: 'AGENDA:VER',
  atencionCrear: 'ATENCION:CREAR',
  atencionEditar: 'ATENCION:EDITAR',
  cajaCrear: 'CAJA:CREAR',
  cajaEditar: 'CAJA:EDITAR',
  cajaVer: 'CAJA:VER',
  catalogoVer: 'CATALOGO:VER',
  clientasVer: 'CLIENTAS:VER',
  sedesCrear: 'SEDES:CREAR',
  seguridadVer: 'SEGURIDAD:VER',
  ventasCrear: 'VENTAS:CREAR',
} as const;
